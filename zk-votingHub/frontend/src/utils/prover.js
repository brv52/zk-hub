import * as snarkjs from "snarkjs";
import { ethers } from "ethers";

export function resolveGateway(uri) {
    if (!uri) return null;
    if (uri.startsWith("ipfs://")) {
        return uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
    }
    return uri;
}

export async function generateAndEncodeProof(manifest, resolvedInputs) {
    if (!manifest.artifacts || !manifest.artifacts.wasmURI || !manifest.artifacts.zkeyURI) {
        throw new Error("Prover Error: Manifest is missing artifacts for local Groth16 proving.");
    }

    const wasmUrl = resolveGateway(manifest.artifacts.wasmURI);
    const zkeyUrl = resolveGateway(manifest.artifacts.zkeyURI);

    try {
        console.log("Downloading ZK artifacts and generating proof... This may take a few seconds.");
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            resolvedInputs, 
            wasmUrl,
            zkeyUrl
        );

        console.log("Proof generated successfully!");
        return encodeProofForEVM(proof, publicSignals);

    } catch (error) {
        console.error("SnarkJS Proving Error:", error);
        throw new Error("Failed to generate Zero-Knowledge Proof. Check your inputs.");
    }
}

function encodeProofForEVM(proof, publicSignals) {
    const pA = [proof.pi_a[0], proof.pi_a[1]];
    const pB = [
        [proof.pi_b[0][1], proof.pi_b[0][0]], 
        [proof.pi_b[1][1], proof.pi_b[1][0]]
    ];
    const pC = [proof.pi_c[0], proof.pi_c[1]];

    const pubSignalsArray = publicSignals.map(signal => signal.toString());

    const abiCoder = new ethers.AbiCoder();
    
    return abiCoder.encode(
        ["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256[]"],
        [pA, pB, pC, pubSignalsArray]
    );
}