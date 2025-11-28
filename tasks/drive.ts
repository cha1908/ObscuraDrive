import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { ethers } from "ethers";

function deriveKeyBytes(addressSeed: string): Uint8Array {
  const hexKey = ethers.keccak256(ethers.toUtf8Bytes(addressSeed.toLowerCase()));
  return ethers.getBytes(hexKey);
}

function encryptCidWithAddress(cid: string, addressSeed: string): string {
  const cidBytes = ethers.getBytes(ethers.toUtf8Bytes(cid));
  const keyBytes = deriveKeyBytes(addressSeed);
  const encrypted: number[] = [];

  for (let i = 0; i < cidBytes.length; i++) {
    encrypted.push(cidBytes[i] ^ keyBytes[i % keyBytes.length]);
  }

  return ethers.hexlify(Uint8Array.from(encrypted));
}

function decryptCid(encryptedCid: string, addressSeed: string): string {
  const encryptedBytes = ethers.getBytes(encryptedCid);
  const keyBytes = deriveKeyBytes(addressSeed);
  const decrypted: number[] = [];

  for (let i = 0; i < encryptedBytes.length; i++) {
    decrypted.push(encryptedBytes[i] ^ keyBytes[i % keyBytes.length]);
  }

  return ethers.toUtf8String(Uint8Array.from(decrypted));
}

task("drive:address", "Prints the ObscuraDrive address").setAction(async (_taskArguments: TaskArguments, hre) => {
  const { deployments } = hre;

  const drive = await deployments.get("ObscuraDrive");

  console.log("ObscuraDrive address is " + drive.address);
});

task("drive:upload", "Upload a demo file entry")
  .addParam("name", "Plain file name to store")
  .addParam("cid", "Plain IPFS hash to encrypt")
  .setAction(async (taskArguments: TaskArguments, hre) => {
    const { ethers: hreEthers, deployments, fhevm } = hre;
    const [signer] = await hreEthers.getSigners();
    const drive = await deployments.get("ObscuraDrive");
    const contract = await hreEthers.getContractAt("ObscuraDrive", drive.address);

    const ephemeral = ethers.Wallet.createRandom();
    const encryptedCid = encryptCidWithAddress(taskArguments.cid, ephemeral.address);

    await fhevm.initializeCLIApi();
    const encryptedInput = await fhevm
      .createEncryptedInput(drive.address, signer.address)
      .addAddress(ephemeral.address)
      .encrypt();

    console.log(`Uploading with A=${ephemeral.address}`);
    const tx = await contract
      .connect(signer)
      .uploadFile(
        taskArguments.name,
        encryptedCid,
        encryptedInput.handles[0],
        encryptedInput.inputProof,
      );

    const receipt = await tx.wait();
    console.log(`tx hash=${receipt?.hash ?? "pending"}`);
  });

task("drive:first", "Decrypt the first stored file for the caller")
  .addOptionalParam("owner", "Owner address (defaults to the caller)")
  .setAction(async (taskArguments: TaskArguments, hre) => {
    const { ethers: hreEthers, deployments, fhevm } = hre;
    const [signer] = await hreEthers.getSigners();
    const drive = await deployments.get("ObscuraDrive");
    const contract = await hreEthers.getContractAt("ObscuraDrive", drive.address);

    const owner = taskArguments.owner ?? signer.address;
    const file = await contract.getFile(owner, 0);
    console.log(`Encrypted CID: ${file.encryptedCid}`);

    await fhevm.initializeCLIApi();
    const decryptedAddress = await fhevm.userDecryptEaddress(file.encryptedKey, drive.address, signer);

    const cid = decryptCid(file.encryptedCid, decryptedAddress as string);
    console.log(`Decrypted A: ${decryptedAddress}`);
    console.log(`Recovered CID: ${cid}`);
  });
