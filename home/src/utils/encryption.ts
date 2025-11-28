import { ethers } from 'ethers';

function deriveKey(addressSeed: string): Uint8Array {
  const hexKey = ethers.keccak256(ethers.toUtf8Bytes(addressSeed.toLowerCase()));
  return ethers.getBytes(hexKey);
}

export function encryptCidWithAddress(cid: string, addressSeed: string): string {
  const cidBytes = ethers.getBytes(ethers.toUtf8Bytes(cid));
  const keyBytes = deriveKey(addressSeed);
  const encrypted: number[] = [];

  for (let i = 0; i < cidBytes.length; i++) {
    encrypted.push(cidBytes[i] ^ keyBytes[i % keyBytes.length]);
  }

  return ethers.hexlify(Uint8Array.from(encrypted));
}

export function decryptCidWithAddress(encryptedCid: string, addressSeed: string): string {
  const encryptedBytes = ethers.getBytes(encryptedCid);
  const keyBytes = deriveKey(addressSeed);
  const decrypted: number[] = [];

  for (let i = 0; i < encryptedBytes.length; i++) {
    decrypted.push(encryptedBytes[i] ^ keyBytes[i % keyBytes.length]);
  }

  return ethers.toUtf8String(Uint8Array.from(decrypted));
}
