import { BaseStrategy } from "./BaseStrategy";
import { ethers } from "ethers";

export class ZKPassportStrategy extends BaseStrategy {

    async buildDatabase(manifest, rawDataset) {
        const configValues = manifest.configKeys.map(key => {
            const val = manifest.config[key];
            if (val !== undefined) return val;

            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('domain')) return window?.location?.hostname || "localhost";
            if (lowerKey.includes('age')) return 0;
            if (lowerKey.includes('nationalit') || lowerKey.includes('countr')) return [];

            throw new Error(`CONFIG_ERROR: Unknown key [${key}] for ZKPassport`);
        });

        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const encodedConfig = abiCoder.encode(manifest.configABI, configValues);

        return { safeDataset: [], encodedConfig };
    }

    async resolve(manifest, userInputs, verifierAddress, provider, databaseURI) {
        const config = manifest.config || {};
        const resolvedInputs = { ...userInputs, ...config };
        return resolvedInputs;
    }
}