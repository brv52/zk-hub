import React, { useState } from 'react';
import { ethers } from 'ethers';
import abi from '../contracts/VotingHub.json';

export default function CreatePoll({ votingHubAddress, provider }) {
    const [formData, setFormData] = useState({
        question: '',
        verifierAddress: '',
        manifestURI: ''
    });
    const [options, setOptions] = useState(['', '']);
    const [isCreating, setIsCreating] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });

    const handleOptionChange = (index, value) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const addOption = () => setOptions([...options, '']);
    const removeOption = (index) => setOptions(options.filter((_, i) => i !== index));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: '', message: '' });

        if (!ethers.isAddress(formData.verifierAddress)) {
            return setStatus({ type: 'error', message: 'Invalid Verifier Contract Address' });
        }
        const validOptions = options.map(o => o.trim()).filter(o => o !== '');
        if (validOptions.length < 2) {
            return setStatus({ type: 'error', message: 'At least 2 valid options are required' });
        }
        if (!formData.manifestURI.startsWith('ipfs://') && !formData.manifestURI.startsWith('https://')) {
            return setStatus({ type: 'error', message: 'Manifest URI must start with ipfs:// or https://' });
        }

        setIsCreating(true);
        try {
            const signer = await provider.getSigner();
            const hubContract = new ethers.Contract(votingHubAddress, abi.abi, signer);

            const tx = await hubContract.createPoll(
                formData.verifierAddress,
                formData.question,
                validOptions,
                formData.manifestURI
            );

            setStatus({ type: 'info', message: 'Waiting for network confirmation...' });
            await tx.wait();
            
            setStatus({ type: 'success', message: '✅ Poll created successfully!' });
            setFormData({ question: '', verifierAddress: '', manifestURI: '' });
            setOptions(['', '']);
        } catch (error) {
            setStatus({ type: 'error', message: error.reason || error.message });
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md border border-gray-200 mt-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">Create New Poll</h2>
            
            {status.message && (
                <div className={`p-4 mb-6 rounded-md font-medium ${status.type === 'error' ? 'bg-red-50 text-red-700' : status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                    {status.message}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Poll Question</label>
                    <input required type="text" className="w-full p-3 border rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., Who should be the next DAO President?"
                        value={formData.question} onChange={e => setFormData({...formData, question: e.target.value})} />
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Verifier Contract Address</label>
                    <input required type="text" className="w-full p-3 border rounded-md font-mono text-sm focus:ring-blue-500 focus:border-blue-500" placeholder="0x..."
                        value={formData.verifierAddress} onChange={e => setFormData({...formData, verifierAddress: e.target.value})} />
                    <p className="text-xs text-gray-500 mt-1">Address of the contract implementing IUniversalVerifier</p>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Manifest URI (IPFS)</label>
                    <input required type="text" className="w-full p-3 border rounded-md font-mono text-sm focus:ring-blue-500 focus:border-blue-500" placeholder="ipfs://QmYourManifestHash..."
                        value={formData.manifestURI} onChange={e => setFormData({...formData, manifestURI: e.target.value})} />
                </div>

                <div className="border-t pt-6">
                    <label className="block text-sm font-bold text-gray-700 mb-3">Voting Options</label>
                    {options.map((opt, index) => (
                        <div key={index} className="flex gap-2 mb-3">
                            <input required type="text" className="flex-1 p-3 border rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder={`Option ${index + 1}`}
                                value={opt} onChange={e => handleOptionChange(index, e.target.value)} />
                            {options.length > 2 && (
                                <button type="button" onClick={() => removeOption(index)} className="px-4 py-2 bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition font-bold">X</button>
                            )}
                        </div>
                    ))}
                    <button type="button" onClick={addOption} className="text-sm text-blue-600 font-bold hover:text-blue-800 transition">+ Add Another Option</button>
                </div>

                <button type="submit" disabled={isCreating} className={`w-full py-4 rounded-md text-white font-bold text-lg transition ${isCreating ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-900 hover:bg-black'}`}>
                    {isCreating ? 'Deploying to Blockchain...' : 'Launch Poll'}
                </button>
            </form>
        </div>
    );
}