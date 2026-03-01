import { ProofOfMembershipStrategy } from "./strategies/ProofOfMembershipStrategy";
import { ZKPassportStrategy } from "./strategies/ZKPassportStrategy";

const strategies = {
    "zkpassport": new ZKPassportStrategy(),
    "proof-of-membership": new ProofOfMembershipStrategy(),
    "merkle-tree": new ProofOfMembershipStrategy()
};

export async function resolveSystemInputs(manifest, userInputs, verifierAddress, provider) {
    if (!manifest || !manifest.verificationMethod) {
        throw new Error("Invalid manifest: Missing verificationMethod property");
    }
    const strategy = strategies[manifest.verificationMethod];
    if (!strategy) {
        throw new Error(`Unsupported verification method: ${manifest.verificationMethod}`);
    }

    return await strategy.resolve(manifest, userInputs, verifierAddress, provider);
}