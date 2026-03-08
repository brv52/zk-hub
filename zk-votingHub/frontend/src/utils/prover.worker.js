import "./worker-polyfill.js";
import * as snarkjs from "snarkjs";
import { ethers } from "ethers";

function encodeProofForEVM(proof, publicSignals) {
    const pA = [proof.pi_a[0], proof.pi_a[1]];
    const pB = [
        [proof.pi_b[0][1], proof.pi_b[0][0]], 
        [proof.pi_b[1][1], proof.pi_b[1][0]]
    ];
    const pC = [proof.pi_c[0], proof.pi_c[1]];

    const pubSignalsArray = publicSignals.map(signal => signal.toString());
    console.log("publiSignals created: ", pubSignalsArray);
    const abiCoder = new ethers.AbiCoder();
    
    return abiCoder.encode(
        ["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256[]"],
        [pA, pB, pC, pubSignalsArray]
    );
}

self.onmessage = async function(event) {
    const { resolvedInputs, wasmBuffer, zkeyBuffer } = event.data;

    try {
        const wasmUint8 = new Uint8Array(wasmBuffer);
        const zkeyUint8 = new Uint8Array(zkeyBuffer);

        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            resolvedInputs,
            wasmUint8,
            zkeyUint8
        );

        const encodedProof = encodeProofForEVM(proof, publicSignals);

        self.postMessage({ success: true, payload: encodedProof });
    } catch (error) {
        self.postMessage({ success: false, error: error.message || "Unknown ZK Prover Error" });
    }
};