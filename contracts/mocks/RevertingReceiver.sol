// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract RevertingReceiver {
    receive() external payable {
        revert("receiver rejected payment");
    }
}
