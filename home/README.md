# Obscura Drive frontend

React + Vite interface for the Obscura Drive contract.

## Run
- `npm install`
- `npm run dev` for local dev, `npm run build` for a production bundle.

## Workflow
1. Select a local file.
2. Generate a pseudo IPFS hash and a random address A, then encrypt the hash with A.
3. Encrypt A with Zama via the relayer SDK and call `uploadFile`.
4. Read stored files with viem and decrypt address A to recover the IPFS hash on demand.

Update `src/config/contracts.ts` after deploying the contract to Sepolia so the UI targets the live address.
