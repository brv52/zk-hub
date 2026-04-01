const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'deploy_data.json');

function saveDeploymentInfo(type, key, value) {
    let data = {};
    if (fs.existsSync(LOG_FILE)) {
        data = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    }

    if (!data[type]) data[type] = {};
    data[type][key] = value;
    data[type].timestamp = new Date().toISOString();

    fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 4));
}

module.exports = { saveDeploymentInfo };