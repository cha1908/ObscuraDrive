import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Obscura Drive',
  projectId: 'b4efb3f6f6ae64d9b6e5c2f1c7a1c0c5', // Replace with your WalletConnect ID
  chains: [sepolia],
  ssr: false,
});
