// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AgentPolicyRegistry.sol";

/// @title AgentPaymentGuard
/// @notice Checks whether approved AI agents can spend under a user's policy.
contract AgentPaymentGuard {
    /// @notice The registry that stores user-created payment policies.
    AgentPolicyRegistry public immutable policyRegistry;

    /// @notice Tracks whether a user has approved an AI agent wallet.
    mapping(address user => mapping(address agent => bool)) public approvedAgents;

    /// @notice Tracks whether a user has allowed a service receiver wallet.
    mapping(address user => mapping(address service => bool)) public allowedServices;

    /// @notice Tracks how much each user spent on each day.
    /// @dev Day is calculated as block.timestamp / 1 days.
    mapping(address user => mapping(uint256 day => uint256 amount)) public dailySpent;

    /// @notice Stores every approved payment recorded through this guard.
    mapping(uint256 paymentId => PaymentRecord) public payments;

    /// @notice Counter used to assign unique payment IDs.
    uint256 private paymentIdCounter;

    /// @notice A receipt-like record for an approved agent payment.
    struct PaymentRecord {
        uint256 paymentId;
        address user;
        address agent;
        address receiver;
        uint256 amount;
        uint256 policyId;
        string receiptUri;
        bytes32 receiptHash;
        uint256 timestamp;
    }

    error ZeroAddress();
    error PaymentNotAllowed(string reason);
    error CallerNotUserOrAgent(address caller);
    error ReceiptRequired();

    event AgentApproved(address indexed user, address indexed agent);
    event AgentRevoked(address indexed user, address indexed agent);
    event ServiceAllowed(address indexed user, address indexed service);
    event ServiceRemoved(address indexed user, address indexed service);
    event PaymentRecorded(
        uint256 indexed paymentId,
        address indexed user,
        address indexed agent,
        address receiver,
        uint256 amount,
        uint256 policyId,
        string receiptUri,
        bytes32 receiptHash
    );

    /// @notice Save the policy registry address when deploying the guard.
    constructor(address policyRegistry_) {
        if (policyRegistry_ == address(0)) {
            revert ZeroAddress();
        }

        policyRegistry = AgentPolicyRegistry(policyRegistry_);
    }

    /// @notice Approve an AI agent wallet to spend under the caller's policies.
    function approveAgent(address agent) external {
        if (agent == address(0)) {
            revert ZeroAddress();
        }

        approvedAgents[msg.sender][agent] = true;
        emit AgentApproved(msg.sender, agent);
    }

    /// @notice Revoke a previously approved AI agent wallet.
    function revokeAgent(address agent) external {
        if (agent == address(0)) {
            revert ZeroAddress();
        }

        approvedAgents[msg.sender][agent] = false;
        emit AgentRevoked(msg.sender, agent);
    }

    /// @notice Allow a service receiver address for the caller.
    function allowService(address service) external {
        if (service == address(0)) {
            revert ZeroAddress();
        }

        allowedServices[msg.sender][service] = true;
        emit ServiceAllowed(msg.sender, service);
    }

    /// @notice Remove a service receiver address from the caller's allowlist.
    function removeService(address service) external {
        if (service == address(0)) {
            revert ZeroAddress();
        }

        allowedServices[msg.sender][service] = false;
        emit ServiceRemoved(msg.sender, service);
    }

    /// @notice Check whether an agent payment is allowed by the user's policy and allowlists.
    /// @dev Returns a reason string instead of reverting so frontends can show clear feedback.
    function canSpend(
        address user,
        address agent,
        address receiver,
        uint256 amount,
        uint256 policyId
    ) public view returns (bool allowed, string memory reason) {
        if (user == address(0) || agent == address(0) || receiver == address(0)) {
            return (false, "zero address");
        }

        if (amount == 0) {
            return (false, "amount is zero");
        }

        try policyRegistry.getPolicy(policyId) returns (AgentPolicyRegistry.Policy memory policy) {
            if (policy.owner != user) {
                return (false, "user is not policy owner");
            }

            if (!policy.active) {
                return (false, "policy is inactive");
            }

            if (!approvedAgents[user][agent]) {
                return (false, "agent not approved");
            }

            if (!allowedServices[user][receiver]) {
                return (false, "receiver not allowed");
            }

            if (amount > policy.maxPerTx) {
                return (false, "amount exceeds max per tx");
            }

            uint256 today = _currentDay();
            if (dailySpent[user][today] + amount > policy.dailyLimit) {
                return (false, "daily limit exceeded");
            }

            return (true, "allowed");
        } catch {
            return (false, "policy not found");
        }
    }

    /// @notice Record an approved payment and update the user's daily spending.
    /// @dev The user or the approved agent can submit the record.
    function recordPayment(
        address user,
        address agent,
        address receiver,
        uint256 amount,
        uint256 policyId,
        string calldata receiptUri,
        bytes32 receiptHash
    ) external returns (uint256 paymentId) {
        if (msg.sender != user && msg.sender != agent) {
            revert CallerNotUserOrAgent(msg.sender);
        }

        (bool allowed, string memory reason) = canSpend(user, agent, receiver, amount, policyId);
        if (!allowed) {
            revert PaymentNotAllowed(reason);
        }

        AgentPolicyRegistry.Policy memory policy = policyRegistry.getPolicy(policyId);
        if (policy.receiptRequired && (bytes(receiptUri).length == 0 || receiptHash == bytes32(0))) {
            revert ReceiptRequired();
        }

        uint256 today = _currentDay();
        dailySpent[user][today] += amount;

        paymentIdCounter += 1;
        paymentId = paymentIdCounter;

        payments[paymentId] = PaymentRecord({
            paymentId: paymentId,
            user: user,
            agent: agent,
            receiver: receiver,
            amount: amount,
            policyId: policyId,
            receiptUri: receiptUri,
            receiptHash: receiptHash,
            timestamp: block.timestamp
        });

        emit PaymentRecorded(paymentId, user, agent, receiver, amount, policyId, receiptUri, receiptHash);
    }

    /// @notice Return the amount a user has spent today.
    function spentToday(address user) external view returns (uint256) {
        return dailySpent[user][_currentDay()];
    }

    /// @dev Convert the current timestamp into a day number for daily limit tracking.
    function _currentDay() internal view returns (uint256) {
        return block.timestamp / 1 days;
    }
}
