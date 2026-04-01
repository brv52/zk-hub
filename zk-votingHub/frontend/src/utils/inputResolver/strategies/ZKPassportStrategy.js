import { BaseStrategy } from "./BaseStrategy";
import { ethers } from "ethers";

export class ZKPassportStrategy extends BaseStrategy {
    
    async buildDatabase(manifest, rawDataset) {
        // ЭВРИСТИКА: Динамически собираем конфиг с безопасными фоллбеками
        const configValues = manifest.configKeys.map(key => {
            const val = manifest.config[key];
            if (val !== undefined) return val;

            // Умные фоллбеки, если создатель опроса удалил эти поля из конфига
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('domain')) return window?.location?.hostname || "localhost";
            if (lowerKey.includes('age')) return 0; // 0 = проверка возраста отключена
            if (lowerKey.includes('nationalit') || lowerKey.includes('countr')) return []; // Пустой массив = проверка гражданства отключена

            throw new Error(`CONFIG_ERROR: Unknown key [${key}] for ZKPassport`);
        });

        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const encodedConfig = abiCoder.encode(manifest.configABI, configValues);
        
        // ZKPassport — stateless (без БД), поэтому возвращаем пустой датасет
        return { safeDataset: [], encodedConfig };
    }

    async resolve(manifest, userInputs, verifierAddress, provider, databaseURI) {
        const config = manifest.config || {};
        // Для ZKPassport на фронтенде мы просто прокидываем конфиг дальше в SDK ZKPassport
        const resolvedInputs = { ...userInputs, ...config };
        return resolvedInputs;
    }
}