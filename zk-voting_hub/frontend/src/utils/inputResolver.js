import { ethers } from "ethers";

/**
 * Parses and strictly validates ZKPassport requirements if the manifest
 * defines verificationMethod as "zkpassport".
 */
export function parseZKPassportConfig(manifest) {
  if (!manifest || manifest.verificationMethod !== "zkpassport") {
    return null;
  }

  const config = manifest.zkpassportConfig || {};
  const requirements = {};

  // Validate Age
  if (config.minAge !== undefined) {
    const age = parseInt(config.minAge, 10);
    if (isNaN(age) || age < 0) {
      throw new Error("Critical Manifest Error: Invalid minAge requirement in ZKPassport config.");
    }
    requirements.minAge = age;
  }

  // Validate Nationality
  if (config.nationality !== undefined) {
    if (Array.isArray(config.nationality)) {
      requirements.nationality = config.nationality.map(String);
    } else if (typeof config.nationality === "string") {
      requirements.nationality = [config.nationality];
    } else {
      throw new Error("Critical Manifest Error: Nationality must be a string or array of strings.");
    }
  }

  return requirements;
}

/**
 * Universal Resolver: Fetches all 25 signals required by local Groth16 KycVoting.
 * Ignored if manifest.verificationMethod === 'zkpassport'.
 */
export async function resolveSystemInputs(manifest, userInputs, verifierAddress, provider) {
  const resolvedInputs = { ...userInputs };

  // Skip local resolution if using external ZKPassport validation
  if (manifest.verificationMethod === "zkpassport") return resolvedInputs;
  if (!manifest.frontendDisplay?.computedInputs) return resolvedInputs;

  for (const input of manifest.frontendDisplay.computedInputs) {
    
    // 1. Static Provider (e.g., pollId) - already injected by VotePage
    if (input.provider === "static") continue;

    // 2. Contract Call (minAge, merkleRoot)
    if (input.provider === "contract-call") {
      try {
        const abi = [`function ${input.method} view returns (uint256)`];
        const contract = new ethers.Contract(verifierAddress, abi, provider);
        const funcName = input.method.split("(")[0];
        const result = await contract[funcName]();
        resolvedInputs[input.id] = result.toString();
      } catch (err) {
        throw new Error(`Critical: Failed to fetch ${input.id} from contract. Ensure verifier implements ${input.method}`);
      }
    }

    // 3. Merkle Tree (pathElements, pathIndices) 
    if (input.provider === "merkle-tree") {
      // Demo dataset matching circuit leaves
      const publicVoterDataset = [
        { secret: 12345n, age: 25n },
        { secret: 67890n, age: 19n }
      ];
      
      const treeData = await buildClientTree(publicVoterDataset, userInputs.userSecret, userInputs.userAge);
      
      resolvedInputs.pathElements = treeData.pathElements;
      resolvedInputs.pathIndices = treeData.pathIndices;

      if (input.id === "merkleRoot") resolvedInputs.merkleRoot = treeData.calculatedRoot;
    }
  }

  const required = ["userSecret", "userAge", "pathElements", "pathIndices", "pollId", "merkleRoot", "minAge"];
  required.forEach(key => {
    if (resolvedInputs[key] === undefined) {
      throw new Error(`Circuit Input Error: Signal '${key}' is missing after resolution.`);
    }
  });

  return resolvedInputs;
}

async function buildClientTree(voterDataset, userSecret, userAge) {
  const { buildPoseidon } = await import("circomlibjs");
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  const leaves = voterDataset.map(v => F.toObject(poseidon([BigInt(v.secret), BigInt(v.age)])));
  const myLeaf = F.toObject(poseidon([BigInt(userSecret), BigInt(userAge)]));
  let myIndex = leaves.findIndex(l => l.toString() === myLeaf.toString());
  
  if (myIndex === -1) throw new Error("Credentials not found in registry.");

  const pathElements = [];
  const pathIndices = [];
  const depth = 10;
  let currentLevel = leaves;
  let currentIndex = myIndex;

  for (let i = 0; i < depth; i++) {
    const isRightChild = currentIndex % 2 === 1;
    const siblingIndex = isRightChild ? currentIndex - 1 : currentIndex + 1;
    const siblingNode = siblingIndex < currentLevel.length ? currentLevel[siblingIndex] : 0n;
    pathElements.push(siblingNode.toString());
    pathIndices.push(isRightChild ? 1 : 0);

    const nextLevel = [];
    for (let j = 0; j < currentLevel.length; j += 2) {
      const left = currentLevel[j];
      const right = j + 1 < currentLevel.length ? currentLevel[j + 1] : 0n;
      nextLevel.push(F.toObject(poseidon([left, right])));
    }
    currentLevel = nextLevel;
    currentIndex = Math.floor(currentIndex / 2);
  }
  return { pathElements, pathIndices, calculatedRoot: currentLevel[0].toString() };
}