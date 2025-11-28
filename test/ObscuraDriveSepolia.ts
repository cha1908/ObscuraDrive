import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, deployments, fhevm } from "hardhat";
import { expect } from "chai";
import { ObscuraDrive } from "../types";

function encryptCidWithAddress(cid: string, addressSeed: string): string {
  const cidBytes = ethers.getBytes(ethers.toUtf8Bytes(cid));
  const keyBytes = ethers.getBytes(ethers.keccak256(ethers.toUtf8Bytes(addressSeed.toLowerCase())));
  const encrypted: number[] = [];

  for (let i = 0; i < cidBytes.length; i++) {
    encrypted.push(cidBytes[i] ^ keyBytes[i % keyBytes.length]);
  }

  return ethers.hexlify(Uint8Array.from(encrypted));
}

function decryptCid(encryptedCid: string, addressSeed: string): string {
  const encryptedBytes = ethers.getBytes(encryptedCid);
  const keyBytes = ethers.getBytes(ethers.keccak256(ethers.toUtf8Bytes(addressSeed.toLowerCase())));
  const decrypted: number[] = [];

  for (let i = 0; i < encryptedBytes.length; i++) {
    decrypted.push(encryptedBytes[i] ^ keyBytes[i % keyBytes.length]);
  }

  return ethers.toUtf8String(Uint8Array.from(decrypted));
}

type Signers = {
  user: HardhatEthersSigner;
};

describe("ObscuraDriveSepolia", function () {
  let obscuraDrive: ObscuraDrive;
  let contractAddress: string;
  let signers: Signers;

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This test runs only against Sepolia FHEVM`);
      this.skip();
    }

    try {
      const deployment = await deployments.get("ObscuraDrive");
      contractAddress = deployment.address;
      obscuraDrive = await ethers.getContractAt("ObscuraDrive", deployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { user: ethSigners[0] };
  });

  it("uploads and decrypts a CID on Sepolia", async function () {
    this.timeout(5 * 60000);

    await fhevm.initializeCLIApi();

    const plainCid = "QmSepoliaVaultCheck";
    const randomAddress = ethers.Wallet.createRandom().address;
    const encryptedCid = encryptCidWithAddress(plainCid, randomAddress);

    const encryptedKey = await fhevm
      .createEncryptedInput(contractAddress, signers.user.address)
      .addAddress(randomAddress)
      .encrypt();

    const tx = await obscuraDrive
      .connect(signers.user)
      .uploadFile("sepolia-demo.txt", encryptedCid, encryptedKey.handles[0], encryptedKey.inputProof);
    await tx.wait();

    const count = await obscuraDrive.getFileCount(signers.user.address);
    expect(count).to.be.greaterThan(0);
    const index = Number(count) - 1;

    const stored = await obscuraDrive.getFile(signers.user.address, index);
    const clearAddress = await fhevm.userDecryptEaddress(stored.encryptedKey, contractAddress, signers.user);
    const cid = decryptCid(stored.encryptedCid, clearAddress);

    expect(cid).to.eq(plainCid);
  });
});
