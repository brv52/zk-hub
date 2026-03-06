import { BaseStrategy } from "./BaseStrategy";

export class ZKPassportStrategy extends BaseStrategy {
    async resolve(manifest, userInputs, verifierAddress, provider) {
        const config = manifest.config || {};
        const resolvedInputs = { ...userInputs, ...config };

        return resolvedInputs;
    }
}