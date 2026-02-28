import * as snarkjs from "snarkjs";

/**
 * PRODUCTION FIX: Используем нативный метод snarkjs для форматирования.
 * Это гарантирует правильный порядок координат G2 и hex-формат.
 */
export const generateProof = async (manifest, fullInputs) => {
  try {
    const gateway = "https://gateway.pinata.cloud/ipfs/";
    const wasmUrl = manifest.artifacts.wasm.replace("ipfs://", gateway);
    const zkeyUrl = manifest.artifacts.zkey.replace("ipfs://", gateway);

    const [wasmRes, zkeyRes] = await Promise.all([fetch(wasmUrl), fetch(zkeyUrl)]);
    const wasmBuffer = new Uint8Array(await wasmRes.arrayBuffer());
    const zkeyBuffer = new Uint8Array(await zkeyRes.arrayBuffer());

    // 1. Генерация пруфа
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      fullInputs,
      wasmBuffer,
      zkeyBuffer
    );

    // 2. Экспорт данных в формате Solidity
    const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
    
    // 3. Парсинг строки в массивы для ethers.js
    const argv = calldata.replace(/["[\]\s]/g, "").split(",");
    
    return {
      a: [argv[0], argv[1]],
      b: [
        [argv[2], argv[3]], 
        [argv[4], argv[5]]
      ],
      c: [argv[6], argv[7]],
      publicInputs: argv.slice(8)
    };
  } catch (error) {
    console.error("ZK Proof Generation Error:", error);
    throw new Error("Не удалось сгенерировать ZK Proof. Проверьте входные данные.");
  }
};