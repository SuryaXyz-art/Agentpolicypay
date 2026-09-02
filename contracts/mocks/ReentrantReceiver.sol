// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IGuardExecutor {
    function executeIntent(bytes32 intentHash) external;
}

contract ReentrantReceiver {
    address public immutable guard;
    bytes32 public intentHash;
    bool public attempted;
    bool public succeeded;

    constructor(address guard_, bytes32 intentHash_) {
        guard = guard_;
        intentHash = intentHash_;
    }

    function setIntentHash(bytes32 intentHash_) external {
        intentHash = intentHash_;
    }

    receive() external payable {
        attempted = true;
        try IGuardExecutor(guard).executeIntent(intentHash) {
            succeeded = true;
        } catch {}
    }
}
