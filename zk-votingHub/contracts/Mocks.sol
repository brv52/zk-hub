// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

contract MockForwarder {
    function execute(
        address target,
        bytes calldata data
    ) external payable returns (bytes memory) {
        (bool success, bytes memory returndata) = target.call{value: msg.value}(
            data
        );
        if (!success) {
            if (returndata.length > 0) {
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert("Forwarder: Subcall reverted");
            }
        }
        return returndata;
    }
}

contract MockVerifier {
    function verifyProof(
        uint256,
        uint256,
        bytes calldata proofData,
        bytes calldata
    ) external pure returns (bool isValid, bytes32 nullifier) {
        (, , , uint256[] memory publicSignals) = abi.decode(
            proofData,
            (uint256[2], uint256[2][2], uint256[2], uint256[])
        );
        return (true, bytes32(publicSignals[0]));
    }
}
