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

    const [wasmRes, zkeyRes] = await Promise.all([
        fetch(wasmUrl),
        fetch(zkeyUrl)
    ]);

    if (!wasmRes.ok || !zkeyRes.ok) {
        throw new Error("Failed to fetch ZK artifacts from IPFS gateway.");
    }

    const wasmBuffer = await wasmRes.arrayBuffer();
    const zkeyBuffer = await zkeyRes.arrayBuffer();

    return new Promise((resolve, reject) => {
        const worker = new Worker(
            new URL('./prover.worker.js', import.meta.url), 
            { type: 'module' }
        );

        const timeoutId = setTimeout(() => {
            worker.terminate();
            reject(new Error("Proof generation timed out. Malicious or heavy circuit detected."));
        }, 600000);

        worker.onmessage = (event) => {
            clearTimeout(timeoutId);
            if (event.data.success) {
                console.log("> PROOF_GENERATED_SUCCESSFULLY.");
                resolve(event.data.payload);
            } else {
                reject(new Error("Isolated Proving Error: " + event.data.error));
            }
            worker.terminate();
        };

        worker.onerror = (error) => {
            clearTimeout(timeoutId);
            reject(new Error("Fatal Worker Error: " + error.message));
            worker.terminate();
        };

        worker.postMessage(
            { resolvedInputs, wasmBuffer, zkeyBuffer },
            [wasmBuffer, zkeyBuffer] 
        );
    });
}