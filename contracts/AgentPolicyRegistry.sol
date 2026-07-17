// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AgentPolicyRegistry
/// @notice Stores spending policies that users create for autonomous AI agents.
contract AgentPolicyRegistry {
    /// @notice A payment policy owned by one user.
    /// @dev The policyId is stored inside the struct so frontends can read one object and know its ID.
    struct Policy {
        uint256 policyId;
        address owner;
        uint256 maxPerTx;
        uint256 dailyLimit;
        uint256 approvalThreshold;
        bool receiptRequired;
        bool active;
        uint256 createdAt;
    }

    /// @dev Revert when the supplied payment limits do not make sense.
    error InvalidPolicyLimits();

    /// @dev Revert when a policy ID does not point to an existing policy.
    error PolicyNotFound(uint256 policyId);

    /// @dev Revert when someone other than the owner tries to edit a policy.
    error NotPolicyOwner(uint256 policyId, address caller);

    /// @dev Revert when a caller tries to deactivate a policy that is already inactive.
    error PolicyAlreadyInactive(uint256 policyId);

    /// @notice Stores every policy by its unique ID.
    mapping(uint256 => Policy) public policies;

    /// @notice Counter used to create the next policy ID.
    /// @dev Starts at 0 and increments before assignment, so the first policy ID is 1.
    uint256 private policyIdCounter;

    event PolicyCreated(
        uint256 indexed policyId,
        address indexed owner,
        uint256 maxPerTx,
        uint256 dailyLimit,
        uint256 approvalThreshold,
        bool receiptRequired
    );

    event PolicyUpdated(
        uint256 indexed policyId,
        address indexed owner,
        uint256 maxPerTx,
        uint256 dailyLimit,
        uint256 approvalThreshold,
        bool receiptRequired
    );

    event PolicyDeactivated(uint256 indexed policyId, address indexed owner);

    /// @dev Checks that the policy exists before the function continues.
    modifier policyExists(uint256 policyId) {
        if (policies[policyId].owner == address(0)) {
            revert PolicyNotFound(policyId);
        }
        _;
    }

    /// @dev Checks that the caller is the owner of the policy before the function continues.
    modifier onlyPolicyOwner(uint256 policyId) {
        if (policies[policyId].owner != msg.sender) {
            revert NotPolicyOwner(policyId, msg.sender);
        }
        _;
    }

    /// @notice Create a new payment policy for the caller.
    /// @param maxPerTx Maximum amount an agent can spend in one transaction.
    /// @param dailyLimit Maximum amount an agent can spend in one day.
    /// @param approvalThreshold Amount above which extra approval is expected by the app.
    /// @param receiptRequired Whether payments under this policy must produce a receipt.
    /// @return policyId The ID assigned to the newly created policy.
    function createPolicy(
        uint256 maxPerTx,
        uint256 dailyLimit,
        uint256 approvalThreshold,
        bool receiptRequired
    ) external returns (uint256 policyId) {
        _validatePolicyValues(maxPerTx, dailyLimit);

        policyIdCounter += 1;
        policyId = policyIdCounter;

        policies[policyId] = Policy({
            policyId: policyId,
            owner: msg.sender,
            maxPerTx: maxPerTx,
            dailyLimit: dailyLimit,
            approvalThreshold: approvalThreshold,
            receiptRequired: receiptRequired,
            active: true,
            createdAt: block.timestamp
        });

        emit PolicyCreated(policyId, msg.sender, maxPerTx, dailyLimit, approvalThreshold, receiptRequired);
    }

    /// @notice Update an existing policy.
    /// @dev Only the policy owner can update it.
    function updatePolicy(
        uint256 policyId,
        uint256 maxPerTx,
        uint256 dailyLimit,
        uint256 approvalThreshold,
        bool receiptRequired
    ) external policyExists(policyId) onlyPolicyOwner(policyId) {
        _validatePolicyValues(maxPerTx, dailyLimit);

        Policy storage policy = policies[policyId];
        policy.maxPerTx = maxPerTx;
        policy.dailyLimit = dailyLimit;
        policy.approvalThreshold = approvalThreshold;
        policy.receiptRequired = receiptRequired;

        emit PolicyUpdated(policyId, msg.sender, maxPerTx, dailyLimit, approvalThreshold, receiptRequired);
    }

    /// @notice Deactivate a policy so it should no longer be used by the app.
    /// @dev The policy stays stored for history, but active becomes false.
    function deactivatePolicy(uint256 policyId) external policyExists(policyId) onlyPolicyOwner(policyId) {
        Policy storage policy = policies[policyId];

        if (!policy.active) {
            revert PolicyAlreadyInactive(policyId);
        }

        policy.active = false;

        emit PolicyDeactivated(policyId, msg.sender);
    }

    /// @notice Read a policy by ID.
    /// @dev Reverts if the policy does not exist, so callers do not mistake empty data for a real policy.
    function getPolicy(uint256 policyId) external view policyExists(policyId) returns (Policy memory) {
        return policies[policyId];
    }

    /// @dev Shared validation keeps create and update rules identical.
    function _validatePolicyValues(uint256 maxPerTx, uint256 dailyLimit) internal pure {
        if (maxPerTx == 0 || dailyLimit == 0 || maxPerTx > dailyLimit) {
            revert InvalidPolicyLimits();
        }
    }
}
