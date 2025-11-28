import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { ObscuraDrive, ObscuraDrive__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

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

async function deployFixture() {
  const factory = (await ethers.getContractFactory("ObscuraDrive")) as ObscuraDrive__factory;
  const obscuraDrive = (await factory.deploy()) as ObscuraDrive;
  const address = await obscuraDrive.getAddress();

  return { obscuraDrive, address };
}

describe("ObscuraDrive", function () {
  let signers: Signers;
  let obscuraDrive: ObscuraDrive;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ obscuraDrive, address: contractAddress } = await deployFixture());
  });

  it("stores encrypted files and lets the owner decrypt the key and CID", async function () {
    const plainCid = "QmEncryptedFile123";
    const randomAddress = ethers.Wallet.createRandom().address;
    const encryptedCid = encryptCidWithAddress(plainCid, randomAddress);

    const encryptedKey = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .addAddress(randomAddress)
      .encrypt();

    await obscuraDrive
      .connect(signers.alice)
      .uploadFile("vault.pdf", encryptedCid, encryptedKey.handles[0], encryptedKey.inputProof);

    const stored = await obscuraDrive.getFile(signers.alice.address, 0);
    expect(stored.fileName).to.eq("vault.pdf");
    expect(stored.encryptedCid).to.eq(encryptedCid);

    const clearAddress = await fhevm.userDecryptEaddress(stored.encryptedKey, contractAddress, signers.alice);
    expect(clearAddress.toLowerCase()).to.eq(randomAddress.toLowerCase());

    const cid = decryptCid(stored.encryptedCid, clearAddress);
    expect(cid).to.eq(plainCid);

    const count = await obscuraDrive.getFileCount(signers.alice.address);
    expect(count).to.eq(1);
  });

  it("allows delegated access when authorized by the uploader", async function () {
    const plainCid = "QmSharedFile999";
    const randomAddress = ethers.Wallet.createRandom().address;
    const encryptedCid = encryptCidWithAddress(plainCid, randomAddress);

    const encryptedKey = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .addAddress(randomAddress)
      .encrypt();

    await obscuraDrive
      .connect(signers.alice)
      .uploadFile("report.txt", encryptedCid, encryptedKey.handles[0], encryptedKey.inputProof);

    await expect(
      obscuraDrive.connect(signers.bob).authorizeDecrypt(signers.alice.address, 0, signers.bob.address),
    ).to.be.revertedWith("Only owner");

    await obscuraDrive
      .connect(signers.alice)
      .authorizeDecrypt(signers.alice.address, 0, signers.bob.address);

    const stored = await obscuraDrive.getFile(signers.alice.address, 0);
    const clearAddress = await fhevm.userDecryptEaddress(stored.encryptedKey, contractAddress, signers.bob);
    expect(clearAddress.toLowerCase()).to.eq(randomAddress.toLowerCase());

    const cid = decryptCid(stored.encryptedCid, clearAddress);
    expect(cid).to.eq(plainCid);
  });
});
