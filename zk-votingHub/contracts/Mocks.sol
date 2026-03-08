// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

contract MockForwarder {
    function execute(address target, bytes calldata data) external returns (bool, bytes memory) {
        bytes memory fullData = abi.encodePacked(data, msg.sender);
        (bool success, bytes memory returnData) = target.call(fullData);
        return (success, returnData);
    }
}

contract MockVerifier {
    function verifyProof(uint256, uint256, bytes calldata proofData) external pure returns (bool, bytes32) {
        (,,, uint256[] memory signals) = abi.decode(proofData, (uint[2], uint[2][2], uint[2], uint256[]));
        return (true, bytes32(signals[0]));
    }
}