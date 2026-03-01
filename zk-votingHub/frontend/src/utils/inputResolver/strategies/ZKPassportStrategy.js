import { BaseStrategy } from "./BaseStrategy";

export class ZKPassportStrategy extends BaseStrategy {
    async resolve(manifest, userInputs, verifierAddress, provider) {
        const config = manifest.config || {};
        const resolvedInputs = { ...userInputs };

        if (config.minAge !== undefined) {
            const age = parseInt(config.minAge, 10);
            if (isNaN(age) || age < 0) throw new Error("Manifest Error: Invalid minAge");
            resolvedInputs.requiredMinAge = age.toString();
        }

        if (config.nationality !== undefined) {
            if (!Array.isArray(config.nationality)) throw new Error("Manifest Error: Nationality must be an array");
            resolvedInputs.allowedNationalities = config.nationality;
        }

        return resolvedInputs;
    }
}