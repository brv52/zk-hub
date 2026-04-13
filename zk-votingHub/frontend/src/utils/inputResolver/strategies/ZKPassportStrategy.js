import { BaseStrategy } from "./BaseStrategy";
import { ethers } from "ethers";

function resolveRuntimeDomain(config) {
    if (config?.domain) return config.domain;

    const envDomain = import.meta.env.VITE_ZKPASSPORT_DOMAIN;
    if (envDomain) return envDomain;

    if (typeof window !== "undefined" && window.location?.hostname) {
        return window.location.hostname;
    }
    return "localhost";
}

export class ZKPassportStrategy extends BaseStrategy {

    async buildDatabase(manifest, rawDataset, isPreHashed = false) {
        const configValues = manifest.configKeys.map(key => {
            const val = manifest.config[key];
            if (val !== undefined) return val;

            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('domain')) return resolveRuntimeDomain(manifest.config);
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