import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import Papa from 'papaparse';
import abi from '../artifacts/VotingHub.json';
import { buildDatabaseFromStrategy } from '../utils/inputResolver/inputResolver';
import { pinDatasetToIPFS, fetchManifest } from '../utils/zkUtils';

const PRESET_VERIFIERS = [
    {
        id: 'membership_default',
        name: 'Standard Membership (Merkle)',
        address: '0xcd5AfC8233c0023b965E2Ef8618031434997CEE8',
        manifestURI: 'ipfs://QmaMeEFqeMHLhHhU2Cfsub2gVy9jRdK2kRY1dWjk1QGdXk'
    },
    {
        id: 'storage_default',
        name: 'Standart Storage (Merkle)',
        address: '0xE0B53c0465335253c8514521675dC2e5ff18EeCf',
        manifestURI: 'ipfs://QmZhYN6VA9oTQKNkU8af44YCpg8gktE9Yhx5N3sHNfANkU'
    },
    {
        id: 'passport_default',
        name: 'ZK Passport Verification',
        address: '0x7c37000448D8B85332d987Fca5d9f5C10974f574',
        manifestURI: 'ipfs://QmUGGTpb6WjDHZnXgpAmBHZvmEwUXm5BcdiQoYALzVugsz'
    }
];

export function useCreatePoll(votingHubAddress, provider) {
    const [verifierMode, setVerifierMode] = useState('preset');
    const [dbMode, setDbMode] = useState('file');

    const [formData, setFormData] = useState({ question: '', verifierAddress: '', manifestURI: '' });
    const [options, setOptions] = useState(['', '']);
    const [durationValue, setDurationValue] = useState(1);
    const [durationUnit, setDurationUnit] = useState('d');

    const [manifest, setManifest] = useState(null);
    const [isManifestLoading, setIsManifestLoading] = useState(false);

    const [csvFile, setCsvFile] = useState(null);
    const [manualRows, setManualRows] = useState([]);

    const [isCreating, setIsCreating] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });
    const [isSponsored, setIsSponsored] = useState(false);

    useEffect(() => {
        if (!formData.manifestURI) {
            setManifest(null);
            return;
        }

        const loadManifest = async () => {
            setIsManifestLoading(true);
            try {
                const data = await fetchManifest(formData.manifestURI);
                setManifest(data);
                const emptyRow = {};
                data.registrySchema.forEach(field => emptyRow[field.name] = '');
                setManualRows([emptyRow]);
                setStatus({ type: 'success', message: 'MANIFEST_LOADED_AND_VERIFIED' });
            } catch (err) {
                setManifest(null);
                setStatus({ type: 'error', message: err.message });
            } finally {
                setIsManifestLoading(false);
            }
        };

        const timeout = setTimeout(loadManifest, 500);
        return () => clearTimeout(timeout);
    }, [formData.manifestURI]);

    const handlePresetSelect = (presetId) => {
        const preset = PRESET_VERIFIERS.find(p => p.id === presetId);
        if (preset) {
            setFormData(prev => ({ ...prev, verifierAddress: preset.address, manifestURI: preset.manifestURI }));
        }
    };

    const handleManualRowChange = (index, fieldName, value) => {
        const newRows = [...manualRows];
        newRows[index][fieldName] = value;
        setManualRows(newRows);
    };

    const addManualRow = () => {
        const emptyRow = {};
        manifest.registrySchema.forEach(field => emptyRow[field.name] = '');
        setManualRows([...manualRows, emptyRow]);
    };

    const removeManualRow = (index) => {
        const newRows = [...manualRows];
        newRows.splice(index, 1);
        setManualRows(newRows);
    };

    const getDurationInSeconds = () => {
        const val = parseFloat(durationValue);
        if (isNaN(val) || val <= 0) return 0;
        switch (durationUnit) {
            case 's': return Math.floor(val);
            case 'm': return Math.floor(val * 60);
            case 'h': return Math.floor(val * 3600);
            case 'd': return Math.floor(val * 86400);
            default: return 0;
        }
    };

    const handleOptionChange = (index, value) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const addOption = () => setOptions([...options, '']);
    const removeOption = (index) => setOptions(options.filter((_, i) => i !== index));

    const applyPreset = (val, unit) => {
        setDurationValue(val);
        setDurationUnit(unit);
    };

    const validateDatasetField = (field, value) => {
        if (value === undefined || value === null || value.toString().trim() === '') return 'REQUIRED_FIELD';
        const strVal = value.toString().trim();
        const nameLabel = field.name.toLowerCase();

        // 1. Адреса
        if (nameLabel.includes('address') && !/^0x[a-fA-F0-9]{40}$/.test(strVal)) return 'INVALID_ETH_ADDRESS';

        // 2. Секреты и энтропия
        if (nameLabel.includes('secret') || nameLabel.includes('hash') || nameLabel.includes('commitment') || nameLabel.includes('key') || nameLabel.includes('nullifier')) {
            if (strVal.length < 16) return 'WEAK_ENTROPY_MIN_16_CHARS';
            if (strVal.startsWith('0x') && !/^0x[a-fA-F0-9]+$/.test(strVal)) return 'MALFORMED_HEX_STRING';
        }

        // 3. Слоты хранилища (Storage Slots) - ДОБАВЛЕНО
        // Слот обязан быть парсируемым в BigInt (число или hex)
        if (nameLabel.includes('slot')) {
            if (!/^\d+$/.test(strVal) && !/^0x[a-fA-F0-9]+$/.test(strVal)) {
                return 'SLOT_MUST_BE_NUMERIC_OR_HEX';
            }
            try {
                BigInt(strVal); // Финальная проверка
            } catch (e) {
                return 'INVALID_BIGINT_FORMAT';
            }
        }

        // 4. Обычные числа (возраст, баланс, ID)
        if (field.type === 'number' || nameLabel.includes('age') || nameLabel.includes('balance') || nameLabel.includes('amount') || nameLabel.includes('id')) {
            if (isNaN(Number(strVal)) || Number(strVal) < 0) return 'INVALID_NUMERIC_VALUE';
        }

        return null; // Всё четко
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsCreating(true);
        setStatus({ type: 'info', message: 'INITIATING_DEPLOYMENT_SEQUENCE...' });

        const totalSeconds = getDurationInSeconds();
        if (totalSeconds <= 0) {
            return setStatus({ type: 'error', message: 'Duration must be > 0 seconds.' });
        }

        try {
            if (!manifest) throw new Error("NO_MANIFEST_DETECTED");

            let rawDataset = [];
            if (dbMode === 'file' && manifest.registrySchema && manifest.registrySchema.length > 0) {
                if (!csvFile) throw new Error("NO_DATABASE_FILE_PROVIDED");
                rawDataset = await new Promise((resolve, reject) => {
                    Papa.parse(csvFile, {
                        header: true,
                        skipEmptyLines: true,
                        complete: (results) => resolve(results.data),
                        error: (err) => reject(err)
                    });
                });

                setStatus({ type: 'info', message: 'VALIDATING_CSV_DATASET_INTEGRITY...' });
                for (let i = 0; i < rawDataset.length; i++) {
                    const row = rawDataset[i];
                    for (const field of manifest.registrySchema) {
                        const errorMsg = validateDatasetField(field, row[field.name]);
                        if (errorMsg) {
                            throw new Error(`CSV_REJECTED (Row ${i + 1}): [${field.name}] -> ${errorMsg}`);
                        }
                    }
                }
            } else {
                rawDataset = manualRows;
            }

            setStatus({ type: 'info', message: 'ENCRYPTING_DATASET & COMPUTING_ZK_STATE_ROOT...' });
            const { safeDataset, encodedConfig } = await buildDatabaseFromStrategy(manifest, rawDataset);

            setStatus({ type: 'info', message: 'UPLOADING_SAFE_DATASET_TO_IPFS...' });
            const databaseURI = await pinDatasetToIPFS(safeDataset);

            const validOptions = options.map(o => o.trim()).filter(o => o !== '');
            if (validOptions.length < 2) {
                return setStatus({ type: 'error', message: 'Minimum 2 nodes required.' });
            }
            if (!formData.manifestURI.startsWith('ipfs://') && !formData.manifestURI.startsWith('https://')) {
                return setStatus({ type: 'error', message: 'Invalid Protocol (Requires IPFS/HTTPS)' });
            }

            setStatus({ type: 'info', message: 'AWAITING_NETWORK_CONFIRMATION...' });
            const browserProvider = new ethers.BrowserProvider(window.ethereum);
            const signer = await browserProvider.getSigner();
            const hubContract = new ethers.Contract(votingHubAddress, abi.abi, signer);

            const tx = await hubContract.createPoll(
                formData.verifierAddress,
                encodedConfig,
                formData.question,
                validOptions,
                formData.manifestURI,
                databaseURI,
                totalSeconds,
                isSponsored
            );

            await tx.wait();
            setStatus({ type: 'success', message: 'INSTANCE_DEPLOYED_SUCCESSFULLY.' });

        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', message: error.reason || error.message });
        } finally {
            setIsCreating(false);
        }
    };

    return {
        formData, setFormData, durationValue, setDurationValue,
        durationUnit, setDurationUnit, options, setOptions,
        isCreating, status, isSponsored, setIsSponsored,
        verifierMode, setVerifierMode, dbMode, setDbMode,
        manifest, isManifestLoading, csvFile, setCsvFile,
        manualRows, handleManualRowChange, addManualRow,
        handlePresetSelect, PRESET_VERIFIERS, removeManualRow,
        getDurationInSeconds, handleSubmit
    };
}