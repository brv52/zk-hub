const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'deployed_verifiers.json');
const FRONTEND_PRESETS_FILE = path.join(__dirname, '..', 'zk-votingHub', 'frontend', 'src', 'artifacts', 'verifierPresets.json');

const PRESET_META = {
    ProofOfMembership: {
        id: 'membership_default',
        name: 'Standard Membership (Merkle)',
    },
    ProofOfStorage: {
        id: 'storage_default',
        name: 'Standard Storage (Merkle)',
    },
    ZKPassport: {
        id: 'passport_default',
        name: 'ZK Passport Verification',
    },
};

function syncFrontendPresets(data) {
    const presets = Object.entries(PRESET_META)
        .map(([type, meta]) => {
            const entry = data[type] || {};
            if (!entry.contractAddress || !entry.manifestURI) {
                return null;
            }
            return {
                id: meta.id,
                name: meta.name,
                address: entry.contractAddress,
                manifestURI: entry.manifestURI,
                updatedAt: entry.timestamp || null,
            };
        })
        .filter(Boolean);

    fs.mkdirSync(path.dirname(FRONTEND_PRESETS_FILE), { recursive: true });
    fs.writeFileSync(FRONTEND_PRESETS_FILE, JSON.stringify(presets, null, 4));
}

function saveDeploymentInfo(type, key, value) {
    let data = {};
    if (fs.existsSync(LOG_FILE)) {
        data = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    }
    
    if (!data[type]) data[type] = {};
    data[type][key] = value;
    data[type].timestamp = new Date().toISOString();

    fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 4));
    syncFrontendPresets(data);
}

module.exports = { saveDeploymentInfo };