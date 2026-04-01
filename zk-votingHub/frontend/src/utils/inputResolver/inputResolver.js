import { ProofOfMembershipStrategy } from "./strategies/ProofOfMembershipStrategy";
import { ZKPassportStrategy } from "./strategies/ZKPassportStrategy";
import { ProofOfStorageStrategy } from "./strategies/ProofOfStorageStrategy";

const strategies = {
    "zkpassport": new ZKPassportStrategy(),
    "proof-of-membership": new ProofOfMembershipStrategy(),
    "merkle-tree": new ProofOfMembershipStrategy(),
    "storage-proof": new ProofOfStorageStrategy()
};

function getStrategy(method) {
    const strategy = strategies[method];
    if (!strategy) throw new Error(`Unsupported verification method: ${method}`);
    return strategy;
}

export async function resolveSystemInputs(manifest, userInputs, verifierAddress, provider, databaseURI) {
    return await getStrategy(manifest.verificationMethod).resolve(manifest, userInputs, verifierAddress, provider, databaseURI);
}

export async function buildDatabaseFromStrategy(manifest, rawDataset, isPreHashed = false) {
    return await getStrategy(manifest.verificationMethod).buildDatabase(manifest, rawDataset, isPreHashed);
}