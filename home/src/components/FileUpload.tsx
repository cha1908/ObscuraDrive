import { useState, useMemo } from 'react';
import { Contract, Wallet } from 'ethers';
import { useAccount } from 'wagmi';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { encryptCidWithAddress } from '../utils/encryption';
import { pseudoUploadToIpfs } from '../utils/ipfs';

type UploadState = 'idle' | 'uploading' | 'ready' | 'submitting' | 'confirmed';

interface FileUploadProps {
  onUploaded: () => void;
}

export function FileUpload({ onUploaded }: FileUploadProps) {
  const { address } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading } = useZamaInstance();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [ipfsHash, setIpfsHash] = useState('');
  const [encryptedCid, setEncryptedCid] = useState('');
  const [ephemeralAddress, setEphemeralAddress] = useState('');
  const [status, setStatus] = useState<UploadState>('idle');
  const [message, setMessage] = useState('');

  const canSubmit = useMemo(() => {
    return Boolean(
      address &&
      selectedFile &&
      ipfsHash &&
      encryptedCid &&
      ephemeralAddress &&
      !zamaLoading
    );
  }, [address, encryptedCid, ephemeralAddress, ipfsHash, selectedFile, zamaLoading]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
      setIpfsHash('');
      setEncryptedCid('');
      setEphemeralAddress('');
      setStatus('idle');
      setMessage('');
    }
  };

  const handleFakeUpload = async () => {
    if (!selectedFile) {
      setMessage('Select a file first.');
      return;
    }

    setStatus('uploading');
    setMessage('Generating pseudo IPFS hash...');

    const uploadResult = await pseudoUploadToIpfs(selectedFile);
    const wallet = Wallet.createRandom();

    const encrypted = encryptCidWithAddress(uploadResult.hash, wallet.address);

    setIpfsHash(uploadResult.hash);
    setEncryptedCid(encrypted);
    setEphemeralAddress(wallet.address);
    setStatus('ready');
    setMessage('Hash secured. Ready to push on-chain.');
  };

  const handleSubmit = async () => {
    if (!selectedFile || !address || !instance || !encryptedCid || !ephemeralAddress) {
      setMessage('Missing required data to upload.');
      return;
    }

    setStatus('submitting');
    setMessage('Encrypting address A with Zama and sending transaction...');

    try {
      const encryptedInput = await instance
        .createEncryptedInput(CONTRACT_ADDRESS, address)
        .addAddress(ephemeralAddress)
        .encrypt();

      const signer = await signerPromise;
      if (!signer) {
        setMessage('Wallet signer not available.');
        setStatus('ready');
        return;
      }

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.uploadFile(
        fileName || selectedFile.name,
        encryptedCid,
        encryptedInput.handles[0],
        encryptedInput.inputProof
      );
      await tx.wait();

      setStatus('confirmed');
      setMessage('Stored on-chain. You can decrypt from the list on the right.');
      onUploaded();
      setSelectedFile(null);
      setFileName('');
      setIpfsHash('');
      setEncryptedCid('');
      setEphemeralAddress('');
    } catch (error) {
      console.error(error);
      setMessage('Upload failed. Ensure wallet is on Sepolia and try again.');
      setStatus('ready');
    }
  };

  return (
    <div className="card upload-card">
      <div className="card-header">
        <p className="label">Step 1 · Local file</p>
        <h2>Upload & encrypt</h2>
        <p className="muted">
          Pick a file, mint a random address A, encrypt the pseudo IPFS hash with it, then push
          the encrypted payload plus Zama-encrypted key to the chain.
        </p>
      </div>

      <div className="upload-body">
        <label className="field">
          <span>Choose a file</span>
          <input type="file" onChange={handleFileChange} />
        </label>

        <label className="field">
          <span>File name on-chain</span>
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="vision.pdf"
          />
        </label>

        <div className="inline-actions">
          <button
            className="ghost-button"
            onClick={handleFakeUpload}
            disabled={!selectedFile || status === 'uploading'}
          >
            {status === 'uploading' ? 'Hashing...' : 'Generate IPFS hash'}
          </button>
          <button
            className="primary-button"
            disabled={!canSubmit || status === 'submitting'}
            onClick={handleSubmit}
          >
            {status === 'submitting' ? 'Submitting...' : 'Store encrypted record'}
          </button>
        </div>

        <div className="status-box">
          <p className="status-line">
            <span className="label">Pseudo IPFS</span>
            <span className="mono">{ipfsHash || 'pending'}</span>
          </p>
          <p className="status-line">
            <span className="label">Address A</span>
            <span className="mono">{ephemeralAddress || 'not generated'}</span>
          </p>
          <p className="status-line">
            <span className="label">Encrypted CID</span>
            <span className="mono">{encryptedCid ? `${encryptedCid.slice(0, 18)}...` : 'waiting'}</span>
          </p>
        </div>

        <p className="hint">{message || 'Steps: upload file → generate hash → send transaction'}</p>
      </div>
    </div>
  );
}
