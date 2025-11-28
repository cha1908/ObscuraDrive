import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <div>
              <h1 className="header-title">Obscura Drive</h1>
              <p className="header-subtitle">Encrypted file registry powered by Zama</p>
            </div>
            <span className="header-badge">Sepolia</span>
          </div>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
