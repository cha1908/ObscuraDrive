import { useEffect, useMemo, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { decryptCidWithAddress } from '../utils/encryption';

type StoredFile = {
  id: number;
  uploader: string;
  fileName: string;
  encryptedCid: string;
  encryptedKey: string;
  createdAt: number;
};

interface FileListProps {
  refreshKey: number;
}

export function FileList({ refreshKey }: FileListProps) {
  const { address } = useAccount();
  const { instance, isLoading: zamaLoading } = useZamaInstance();
  const signerPromise = useEthersSigner();
  const [decryptingId, setDecryptingId] = useState<number | null>(null);
  const [decrypted, setDecrypted] = useState<Record<number, { cid: string; address: string }>>({});
  const [error, setError] = useState('');

  const { data, refetch, isLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getFiles',
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address),
    },
  });

  useEffect(() => {
    if (refreshKey > 0) {
      refetch();
    }
  }, [refreshKey, refetch]);

  const files: StoredFile[] = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.map((file: any, index: number) => ({
      id: index,
      uploader: file[0],
      fileName: file[1],
      encryptedCid: file[2],
      encryptedKey: file[3],
      createdAt: Number(file[4]),
    }));
  }, [data]);

  const decryptFile = async (file: StoredFile) => {
    if (!instance || !address) {
      setError('Missing Zama instance or wallet connection.');
      return;
    }
    setError('');
    setDecryptingId(file.id);

    try {
      const keypair = instance.generateKeypair();
      const handleContractPairs = [
        {
          handle: file.encryptedKey,
          contractAddress: CONTRACT_ADDRESS,
        },
      ];
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [CONTRACT_ADDRESS];

      const eip712 = instance.createEIP712(
        keypair.publicKey,
        contractAddresses,
        startTimeStamp,
        durationDays
      );

      const signer = await signerPromise;
      if (!signer) {
        setError('No signer available.');
        setDecryptingId(null);
        return;
      }

      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays
      );

      const clearAddress = result[file.encryptedKey] as string;
      const cid = decryptCidWithAddress(file.encryptedCid, clearAddress);

      setDecrypted((prev) => ({
        ...prev,
        [file.id]: { cid, address: clearAddress },
      }));
    } catch (err) {
      console.error(err);
      setError('Decryption failed. Confirm relayer access and wallet connection.');
    } finally {
      setDecryptingId(null);
    }
  };

  if (!address) {
    return (
      <div className="card files-card">
        <div className="card-header">
          <p className="label">Step 2 · View</p>
          <h2>Stored files</h2>
          <p className="muted">Connect your wallet to fetch encrypted records bound to it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card files-card">
      <div className="card-header">
        <p className="label">Step 2 · View</p>
        <h2>Stored files</h2>
        <p className="muted">
          Fetch everything saved under your address, then user-decrypt the stored key to unlock the
          original IPFS hash.
        </p>
      </div>


      {isLoading ? (
        <div className="empty-state">
          <p>Loading encrypted files...</p>
        </div>
      ) : null}

      {!isLoading && files.length === 0 ? (
        <div className="empty-state">
          <p>No files yet. Upload one on the left to start the flow.</p>
        </div>
      ) : null}

      <div className="file-list">
        {files.map((file) => (
          <div key={file.id} className="file-row">
            <div className="file-meta">
              <p className="file-name">{file.fileName}</p>
              <p className="file-date">
                {file.createdAt ? new Date(file.createdAt * 1000).toLocaleString() : 'timestamp'}
              </p>
              <p className="mono small">
                {file.encryptedCid.slice(0, 22)}...
              </p>
            </div>

            <div className="file-actions">
              {decrypted[file.id] ? (
                <div className="decrypted-box">
                  <p className="label">Address A</p>
                  <p className="mono">{decrypted[file.id].address}</p>
                  <p className="label">IPFS hash</p>
                  <p className="mono">{decrypted[file.id].cid}</p>
                </div>
              ) : (
                <button
                  className="primary-button"
                  onClick={() => decryptFile(file)}
                  disabled={zamaLoading || decryptingId === file.id}
                >
                  {decryptingId === file.id ? 'Decrypting...' : 'Decrypt'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
