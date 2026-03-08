// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

contract MockGroth16Verifier4 {
    bool public shouldPass = true;

    function setShouldPass(bool _shouldPass) external {
        shouldPass = _shouldPass;
    }

    function verifyProof(
        uint[2] calldata /*_pA*/,
        uint[2][2] calldata /*_pB*/,
        uint[2] calldata /*_pC*/,
        uint[4] calldata /*_pubSignals*/
    ) external view returns (bool) {
        return shouldPass;
    }
}