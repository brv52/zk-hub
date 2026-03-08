import { useState } from 'react';
import { ethers } from 'ethers';
import abi from '../artifacts/VotingHub.json';

export function useCreatePoll(votingHubAddress, provider) {
    const [formData, setFormData] = useState({
        question: '',
        verifierAddress: '',
        manifestURI: ''
    });
    
    const [durationValue, setDurationValue] = useState(1);
    const [durationUnit, setDurationUnit] = useState('d');
    const [options, setOptions] = useState(['', '']);
    const [isCreating, setIsCreating] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });
    const [isSponsored, setIsSponsored] = useState(false);

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

    const getDurationInSeconds = () => {
        const val = parseFloat(durationValue);
        if (isNaN(val) || val <= 0) return 0;
        switch(durationUnit) {
            case 's': return Math.floor(val);
            case 'm': return Math.floor(val * 60);
            case 'h': return Math.floor(val * 3600);
            case 'd': return Math.floor(val * 86400);
            default: return Math.floor(val);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: '', message: '' });

        const totalSeconds = getDurationInSeconds();
        if (totalSeconds <= 0) {
            return setStatus({ type: 'error', message: 'Duration must be > 0 seconds.' });
        }
        if (!ethers.isAddress(formData.verifierAddress)) {
            return setStatus({ type: 'error', message: 'Invalid 0x Contract Address.' });
        }
        
        const validOptions = options.map(o => o.trim()).filter(o => o !== '');
        if (validOptions.length < 2) {
            return setStatus({ type: 'error', message: 'Minimum 2 nodes required.' });
        }
        if (!formData.manifestURI.startsWith('ipfs://') && !formData.manifestURI.startsWith('https://')) {
            return setStatus({ type: 'error', message: 'Invalid Protocol (Requires IPFS/HTTPS)' });
        }

        setIsCreating(true);
        try {
            const signer = await provider.getSigner();
            const hubContract = new ethers.Contract(votingHubAddress, abi.abi, signer);

            const tx = await hubContract.createPoll(
                formData.verifierAddress,
                formData.question,
                validOptions,
                formData.manifestURI,
                totalSeconds,
                isSponsored 
            );

            setStatus({ type: 'info', message: 'AWAITING_NETWORK_CONFIRMATION...' });
            await tx.wait();
            
            setStatus({ type: 'success', message: 'INSTANCE_DEPLOYED_SUCCESSFULLY.' });
            
            setFormData({ question: '', verifierAddress: '', manifestURI: '' });
            setOptions(['', '']);
            setIsSponsored(false);
            applyPreset(1, 'd');
        } catch (error) {
            setStatus({ type: 'error', message: error.reason || error.message });
        } finally {
            setIsCreating(false);
        }
    };

    return {
        formData,
        setFormData,
        durationValue,
        setDurationValue,
        durationUnit,
        setDurationUnit,
        options,
        isCreating,
        status,
        isSponsored,
        setIsSponsored,
        handleOptionChange,
        addOption,
        removeOption,
        applyPreset,
        getDurationInSeconds,
        handleSubmit
    };
}