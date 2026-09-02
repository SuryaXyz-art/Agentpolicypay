// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./AgentPolicyRegistry.sol";

/// @title AgentPaymentGuard
/// @notice Policy-scoped native 0G escrow and fixed receiver payment executor.
/// @dev Only native 0G deposited into this contract is protected. EOA balances are out of scope.
contract AgentPaymentGuard is ReentrancyGuard {
    AgentPolicyRegistry public immutable policyRegistry;

    enum IntentState { CREATED, PENDING_APPROVAL, READY, EXECUTED, CANCELLED, EXPIRED }

    struct Intent {
        bytes32 intentHash;
        uint256 policyId;
        uint256 nonce;
        address agent;
        address receiver;
        uint256 amount;
        uint256 expiry;
        uint256 reservedDay;
        uint256 executedAt;
        bytes32 reasonHash;
        bytes32 decisionRoot;
        bytes32 preReceiptRoot;
        bytes32 finalReceiptRoot;
        IntentState state;
        bool ownerApproved;
    }

    mapping(uint256 policyId => mapping(address agent => bool)) public approvedAgents;
    mapping(uint256 policyId => mapping(address service => bool)) public allowedServices;
    mapping(uint256 policyId => uint256 amount) public policyBalances;
    mapping(uint256 policyId => uint256 amount) public reservedBalances;
    mapping(uint256 policyId => mapping(uint256 day => uint256 amount)) public dailySpent;
    mapping(uint256 policyId => mapping(uint256 day => uint256 amount)) public dailyReserved;
    mapping(uint256 policyId => uint256 nonce) public nextNonce;
    mapping(bytes32 intentHash => Intent) public intents;
    mapping(uint256 policyId => bool) public policyPaused;

    error ZeroAddress();
    error InvalidAmount();
    error InvalidExpiry();
    error InvalidIntentState(bytes32 intentHash);
    error PolicyInactive();
    error PolicyPaused(uint256 policyId);
    error PolicyNotPaused(uint256 policyId);
    error OwnerApprovalRequired(bytes32 intentHash);
    error NotPolicyOwner(uint256 policyId, address caller);
    error NotApprovedAgent(uint256 policyId, address agent);
    error ReceiverNotAllowed(uint256 policyId, address receiver);
    error AmountExceedsMaxPerTx();
    error DailyLimitExceeded();
    error InsufficientAvailableBalance();
    error IntentAlreadyExists(bytes32 intentHash);
    error IntentExpired();
    error IntentNotExpired();
    error NotIntentActor(bytes32 intentHash, address caller);
    error ReceiptRootRequired();
    error ReceiptRootAlreadyFinalized();
    error NativeTransferFailed();
    error DirectTransferNotSupported();

    event PaymentIntentCreated(
        bytes32 indexed intentHash,
        uint256 indexed policyId,
        uint256 indexed nonce,
        address agent,
        address receiver,
        uint256 amount,
        uint256 expiry,
        bytes32 reasonHash,
        bytes32 decisionRoot,
        bytes32 preReceiptRoot,
        IntentState state
    );
    event PaymentApproved(bytes32 indexed intentHash, address indexed owner);
    event PaymentExecuted(bytes32 indexed intentHash, uint256 indexed policyId, address indexed agent, address receiver, uint256 amount, uint256 nonce, bytes32 preReceiptRoot);
    event PaymentCancelled(bytes32 indexed intentHash, uint256 indexed policyId, address indexed caller);
    event PaymentExpired(bytes32 indexed intentHash, uint256 indexed policyId);
    event PaymentReceiptRootFinalized(bytes32 indexed intentHash, bytes32 indexed receiptRoot);
    event AgentPermissionChanged(uint256 indexed policyId, address indexed agent, bool approved);
    event ServicePermissionChanged(uint256 indexed policyId, address indexed service, bool allowed);
    event Deposited(uint256 indexed policyId, address indexed owner, uint256 amount, uint256 newBalance);
    event Withdrawn(uint256 indexed policyId, address indexed owner, address indexed recipient, uint256 amount, uint256 newBalance);
    event PolicyPauseChanged(uint256 indexed policyId, address indexed owner, bool paused);

    modifier whenPolicyNotPaused(uint256 policyId) {
        _requirePolicyNotPaused(policyId);
        _;
    }

    constructor(address policyRegistry_) {
        if (policyRegistry_ == address(0)) revert ZeroAddress();
        policyRegistry = AgentPolicyRegistry(policyRegistry_);
    }

    function approveAgent(uint256 policyId, address agent) external {
        _requirePolicyOwner(policyId);
        if (agent == address(0)) revert ZeroAddress();
        approvedAgents[policyId][agent] = true;
        emit AgentPermissionChanged(policyId, agent, true);
    }

    function revokeAgent(uint256 policyId, address agent) external {
        _requirePolicyOwner(policyId);
        if (agent == address(0)) revert ZeroAddress();
        approvedAgents[policyId][agent] = false;
        emit AgentPermissionChanged(policyId, agent, false);
    }

    function allowService(uint256 policyId, address service) external {
        _requirePolicyOwner(policyId);
        if (service == address(0)) revert ZeroAddress();
        allowedServices[policyId][service] = true;
        emit ServicePermissionChanged(policyId, service, true);
    }

    function removeService(uint256 policyId, address service) external {
        _requirePolicyOwner(policyId);
        if (service == address(0)) revert ZeroAddress();
        allowedServices[policyId][service] = false;
        emit ServicePermissionChanged(policyId, service, false);
    }

    /// @notice Deposit native 0G into a policy's guarded balance.
    function deposit(uint256 policyId) external payable whenPolicyNotPaused(policyId) {
        AgentPolicyRegistry.Policy memory policy = policyRegistry.getPolicy(policyId);
        if (policy.owner != msg.sender) revert NotPolicyOwner(policyId, msg.sender);
        if (!policy.active) revert PolicyInactive();
        if (msg.value == 0) revert InvalidAmount();
        policyBalances[policyId] += msg.value;
        emit Deposited(policyId, msg.sender, msg.value, policyBalances[policyId]);
    }

    /// @notice Withdraw only unreserved native 0G from a policy vault.
    function withdraw(uint256 policyId, uint256 amount, address payable recipient) external nonReentrant {
        _requirePolicyOwner(policyId);
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (_availableBalance(policyId) < amount) revert InsufficientAvailableBalance();
        policyBalances[policyId] -= amount;
        (bool success,) = recipient.call{value: amount}("");
        if (!success) revert NativeTransferFailed();
        emit Withdrawn(policyId, msg.sender, recipient, amount, policyBalances[policyId]);
    }

    /// @notice Return deterministic eligibility; AI output is never consulted.
    function previewIntent(uint256 policyId, address agent, address receiver, uint256 amount, uint256 expiry)
        external view returns (bool allowed, bool needsApproval, bytes32 reason)
    {
        AgentPolicyRegistry.Policy memory policy = policyRegistry.getPolicy(policyId);
        if (!policy.active) return (false, false, keccak256("policy-inactive"));
        if (policyPaused[policyId]) return (false, false, keccak256("policy-paused"));
        if (agent == address(0) || receiver == address(0)) return (false, false, keccak256("zero-address"));
        if (!approvedAgents[policyId][agent]) return (false, false, keccak256("agent-not-approved"));
        if (!allowedServices[policyId][receiver]) return (false, false, keccak256("receiver-not-allowed"));
        if (amount == 0) return (false, false, keccak256("amount-zero"));
        if (amount > policy.maxPerTx) return (false, false, keccak256("max-per-tx"));
        if (expiry <= block.timestamp) return (false, false, keccak256("expired"));
        if (_availableBalance(policyId) < amount) return (false, false, keccak256("insufficient-balance"));
        uint256 day = _currentDay();
        if (dailySpent[policyId][day] + dailyReserved[policyId][day] + amount > policy.dailyLimit) return (false, false, keccak256("daily-limit"));
        return (true, amount > policy.approvalThreshold, bytes32(0));
    }

    /// @notice Create and reserve a fixed native payment intent for an approved agent.
    function createIntent(
        uint256 policyId,
        address receiver,
        uint256 amount,
        uint256 expiry,
        bytes32 reasonHash,
        bytes32 decisionRoot,
        bytes32 preReceiptRoot
    ) external whenPolicyNotPaused(policyId) returns (bytes32 intentHash) {
        AgentPolicyRegistry.Policy memory policy = policyRegistry.getPolicy(policyId);
        if (!policy.active) revert PolicyInactive();
        if (receiver == address(0)) revert ZeroAddress();
        if (!approvedAgents[policyId][msg.sender]) revert NotApprovedAgent(policyId, msg.sender);
        if (!allowedServices[policyId][receiver]) revert ReceiverNotAllowed(policyId, receiver);
        if (amount == 0) revert InvalidAmount();
        if (amount > policy.maxPerTx) revert AmountExceedsMaxPerTx();
        if (expiry <= block.timestamp) revert InvalidExpiry();
        if (policy.receiptRequired && preReceiptRoot == bytes32(0)) revert ReceiptRootRequired();

        uint256 day = _currentDay();
        if (_availableBalance(policyId) < amount) revert InsufficientAvailableBalance();
        if (dailySpent[policyId][day] + dailyReserved[policyId][day] + amount > policy.dailyLimit) revert DailyLimitExceeded();

        uint256 nonce = ++nextNonce[policyId];
        intentHash = keccak256(abi.encode(block.chainid, address(this), policyId, nonce, msg.sender, receiver, amount, expiry, reasonHash, decisionRoot, preReceiptRoot));
        if (intents[intentHash].intentHash != bytes32(0)) revert IntentAlreadyExists(intentHash);
        IntentState state = amount > policy.approvalThreshold ? IntentState.PENDING_APPROVAL : IntentState.READY;
        intents[intentHash] = Intent({
            intentHash: intentHash,
            policyId: policyId,
            nonce: nonce,
            agent: msg.sender,
            receiver: receiver,
            amount: amount,
            expiry: expiry,
            reservedDay: day,
            executedAt: 0,
            reasonHash: reasonHash,
            decisionRoot: decisionRoot,
            preReceiptRoot: preReceiptRoot,
            finalReceiptRoot: bytes32(0),
            state: state,
            ownerApproved: false
        });
        reservedBalances[policyId] += amount;
        dailyReserved[policyId][day] += amount;
        emit PaymentIntentCreated(intentHash, policyId, nonce, msg.sender, receiver, amount, expiry, reasonHash, decisionRoot, preReceiptRoot, state);
    }

    /// @notice Approve one exact above-threshold intent, including one escalated by a lowered threshold.
    function approveIntent(bytes32 intentHash) external {
        Intent storage intent = _intent(intentHash);
        _requirePolicyNotPaused(intent.policyId);
        AgentPolicyRegistry.Policy memory policy = policyRegistry.getPolicy(intent.policyId);
        if (policy.owner != msg.sender) revert NotPolicyOwner(intent.policyId, msg.sender);
        bool newlyAboveThreshold = intent.state == IntentState.READY && !intent.ownerApproved && intent.amount > policy.approvalThreshold;
        if (intent.state != IntentState.PENDING_APPROVAL && !newlyAboveThreshold) revert InvalidIntentState(intentHash);
        if (block.timestamp > intent.expiry) revert IntentExpired();
        if (!policy.active) revert PolicyInactive();
        intent.ownerApproved = true;
        intent.state = IntentState.READY;
        emit PaymentApproved(intentHash, msg.sender);
    }

    /// @notice Execute using current policy limits and permissions, not just the creation-time snapshot.
    function executeIntent(bytes32 intentHash) external nonReentrant {
        Intent storage intent = _intent(intentHash);
        _requirePolicyNotPaused(intent.policyId);
        AgentPolicyRegistry.Policy memory policy = policyRegistry.getPolicy(intent.policyId);
        if (!policy.active) revert PolicyInactive();
        if (intent.state != IntentState.READY) revert InvalidIntentState(intentHash);
        if (block.timestamp > intent.expiry) revert IntentExpired();
        if (msg.sender != intent.agent && msg.sender != policy.owner) revert NotIntentActor(intentHash, msg.sender);
        if (!approvedAgents[intent.policyId][intent.agent]) revert NotApprovedAgent(intent.policyId, intent.agent);
        if (!allowedServices[intent.policyId][intent.receiver]) revert ReceiverNotAllowed(intent.policyId, intent.receiver);
        if (intent.amount > policy.maxPerTx) revert AmountExceedsMaxPerTx();
        if (intent.amount > policy.approvalThreshold && !intent.ownerApproved) revert OwnerApprovalRequired(intentHash);
        if (policy.receiptRequired && intent.preReceiptRoot == bytes32(0)) revert ReceiptRootRequired();
        uint256 currentDay = _currentDay();
        uint256 otherReservations = dailyReserved[intent.policyId][currentDay];
        if (intent.reservedDay == currentDay) otherReservations -= intent.amount;
        if (dailySpent[intent.policyId][currentDay] + otherReservations + intent.amount > policy.dailyLimit) revert DailyLimitExceeded();

        intent.state = IntentState.EXECUTED;
        intent.executedAt = block.timestamp;
        reservedBalances[intent.policyId] -= intent.amount;
        dailyReserved[intent.policyId][intent.reservedDay] -= intent.amount;
        policyBalances[intent.policyId] -= intent.amount;
        dailySpent[intent.policyId][currentDay] += intent.amount;
        (bool success,) = payable(intent.receiver).call{value: intent.amount}("");
        if (!success) revert NativeTransferFailed();
        emit PaymentExecuted(intentHash, intent.policyId, intent.agent, intent.receiver, intent.amount, intent.nonce, intent.preReceiptRoot);
    }

    function cancelIntent(bytes32 intentHash) external {
        Intent storage intent = _intent(intentHash);
        AgentPolicyRegistry.Policy memory policy = policyRegistry.getPolicy(intent.policyId);
        if (msg.sender != policy.owner && msg.sender != intent.agent) revert NotIntentActor(intentHash, msg.sender);
        if (intent.state != IntentState.CREATED && intent.state != IntentState.PENDING_APPROVAL && intent.state != IntentState.READY) revert InvalidIntentState(intentHash);
        _releaseReservation(intent);
        intent.state = IntentState.CANCELLED;
        emit PaymentCancelled(intentHash, intent.policyId, msg.sender);
    }

    function expireIntent(bytes32 intentHash) external {
        Intent storage intent = _intent(intentHash);
        if (block.timestamp <= intent.expiry) revert IntentNotExpired();
        if (intent.state != IntentState.CREATED && intent.state != IntentState.PENDING_APPROVAL && intent.state != IntentState.READY) revert InvalidIntentState(intentHash);
        _releaseReservation(intent);
        intent.state = IntentState.EXPIRED;
        emit PaymentExpired(intentHash, intent.policyId);
    }

    /// @notice Attach one final Storage root to an executed payment.
    function finalizeReceiptRoot(bytes32 intentHash, bytes32 receiptRoot) external {
        if (receiptRoot == bytes32(0)) revert ReceiptRootRequired();
        Intent storage intent = _intent(intentHash);
        _requirePolicyNotPaused(intent.policyId);
        AgentPolicyRegistry.Policy memory policy = policyRegistry.getPolicy(intent.policyId);
        if (msg.sender != policy.owner && msg.sender != intent.agent) revert NotIntentActor(intentHash, msg.sender);
        if (intent.state != IntentState.EXECUTED) revert InvalidIntentState(intentHash);
        if (intent.finalReceiptRoot != bytes32(0)) revert ReceiptRootAlreadyFinalized();
        intent.finalReceiptRoot = receiptRoot;
        emit PaymentReceiptRootFinalized(intentHash, receiptRoot);
    }

    /// @notice Pause only the caller-owned policy. Cancellation, expiry and available withdrawal remain possible.
    function pause(uint256 policyId) external {
        _requirePolicyOwner(policyId);
        _requirePolicyNotPaused(policyId);
        policyPaused[policyId] = true;
        emit PolicyPauseChanged(policyId, msg.sender, true);
    }

    /// @notice Resume only the caller-owned policy; no owner can resume another owner's policy.
    function unpause(uint256 policyId) external {
        _requirePolicyOwner(policyId);
        if (!policyPaused[policyId]) revert PolicyNotPaused(policyId);
        policyPaused[policyId] = false;
        emit PolicyPauseChanged(policyId, msg.sender, false);
    }

    function getBalance(uint256 policyId) external view returns (uint256 available, uint256 reserved) {
        return (_availableBalance(policyId), reservedBalances[policyId]);
    }

    function spentToday(uint256 policyId) external view returns (uint256) {
        return dailySpent[policyId][_currentDay()];
    }

    function getIntent(bytes32 intentHash) external view returns (Intent memory) {
        return _intent(intentHash);
    }

    function getPayment(bytes32 intentHash) external view returns (address receiver, uint256 amount, uint256 executedAt, bytes32 preReceiptRoot, bytes32 finalReceiptRoot) {
        Intent memory intent = _intent(intentHash);
        if (intent.state != IntentState.EXECUTED) revert InvalidIntentState(intentHash);
        return (intent.receiver, intent.amount, intent.executedAt, intent.preReceiptRoot, intent.finalReceiptRoot);
    }

    function _releaseReservation(Intent storage intent) internal {
        reservedBalances[intent.policyId] -= intent.amount;
        dailyReserved[intent.policyId][intent.reservedDay] -= intent.amount;
    }

    function _intent(bytes32 intentHash) internal view returns (Intent storage intent) {
        intent = intents[intentHash];
        if (intent.intentHash == bytes32(0)) revert InvalidIntentState(intentHash);
    }

    function _availableBalance(uint256 policyId) internal view returns (uint256) {
        return policyBalances[policyId] - reservedBalances[policyId];
    }

    function _requirePolicyOwner(uint256 policyId) internal view returns (address owner) {
        AgentPolicyRegistry.Policy memory policy = policyRegistry.getPolicy(policyId);
        if (policy.owner != msg.sender) revert NotPolicyOwner(policyId, msg.sender);
        return policy.owner;
    }

    function _currentDay() internal view returns (uint256) {
        return block.timestamp / 1 days;
    }

    function _requirePolicyNotPaused(uint256 policyId) internal view {
        if (policyPaused[policyId]) revert PolicyPaused(policyId);
    }

    receive() external payable {
        revert DirectTransferNotSupported();
    }
}
