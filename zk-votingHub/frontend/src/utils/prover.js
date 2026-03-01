import * as snarkjs from "snarkjs";
import { ethers } from "ethers";

export function resolveGateway(uri) {
    if (!uri) return null;
    if (uri.startsWith("ipfs://")) {
        return uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
    }
    return uri;
}

/**
 * ZK Proof generator for LOCAL Groth16 proofs (Merkle Trees, etc.)
 */
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

/**
 * Encodes local Groth16 SnarkJS output for EVM
 */
function encodeProofForEVM(proof, publicSignals) {
    const clientNullifier = publicSignals[0];
    const pA = [proof.pi_a[0], proof.pi_a[1]];
    const pB = [
        [proof.pi_b[0][1], proof.pi_b[0][0]], 
        [proof.pi_b[1][1], proof.pi_b[1][0]]
    ];
    const pC = [proof.pi_c[0], proof.pi_c[1]];

    const abiCoder = new ethers.AbiCoder();
    return abiCoder.encode(
        ["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256"],
        [pA, pB, pC, clientNullifier]
    );
}

/**
 * НОВАЯ ФУНКЦИЯ: Упаковывает внешние пруфы (ZKPassport) для EVM
 * @param {Array} externalProofs - Массив сырых байтов от внешнего SDK
 * @returns {string} - Bytes calldata
 */
export function encodeExternalProof(externalProofs) {
    const abiCoder = new ethers.AbiCoder();
    // ZKPassport и Noir обычно ожидают массив байтов
    return abiCoder.encode(['bytes[]'], [externalProofs]);
}