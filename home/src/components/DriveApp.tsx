import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Header } from './Header';
import { FileUpload } from './FileUpload';
import { FileList } from './FileList';
import '../styles/DriveApp.css';
import '../styles/FileUpload.css';
import '../styles/FileList.css';

export function DriveApp() {
  const { address } = useAccount();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="drive-app">
      <Header />
      <main className="drive-main">
        <section className="hero-block">
          <div>
            <p className="eyebrow">Encrypted file relayer · Zama FHE + IPFS</p>
            <h1 className="hero-title">Obscura Drive</h1>
            <p className="hero-copy">
              Pull a file from your device, mint a fresh EVM address A, encrypt the IPFS hash with it,
              and anchor the encrypted payload plus Zamafied key on-chain. Decrypt on demand to recover
              the original hash without exposing A.
            </p>
            <div className="hero-pills">
              <span className="pill">Pseudo IPFS hash</span>
              <span className="pill">Ephemeral address A</span>
              <span className="pill">FHE ACL ready</span>
            </div>
          </div>
          <div className="hero-status">
            <div className="status-card">
              <p className="status-label">Wallet</p>
              <p className="status-value">
                {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
              </p>
            </div>
            <div className="status-card">
              <p className="status-label">Workflow</p>
              <p className="status-value">Upload → Encrypt → Store → Decrypt</p>
            </div>
          </div>
        </section>

        <section className="drive-grid">
          <FileUpload onUploaded={() => setRefreshKey((value) => value + 1)} />
          <FileList refreshKey={refreshKey} />
        </section>
      </main>
    </div>
  );
}
