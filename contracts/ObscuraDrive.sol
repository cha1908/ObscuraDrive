// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, eaddress, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ObscuraDrive - Encrypted file vault powered by Zama FHE
/// @notice Stores encrypted IPFS references and the encryption key (address A) on-chain.
/// The encrypted key can be user-decrypted through the Zama relayer and reused client-side
/// to recover the original IPFS hash.
contract ObscuraDrive is ZamaEthereumConfig {
    struct StoredFile {
        address uploader;
        string fileName;
        string encryptedCid;
        eaddress encryptedKey;
        uint256 createdAt;
    }

    mapping(address => StoredFile[]) private _filesByOwner;

    event FileStored(address indexed uploader, uint256 indexed fileId, string fileName, string encryptedCid);
    event AccessGranted(address indexed uploader, uint256 indexed fileId, address indexed beneficiary);

    /// @notice Upload a new encrypted file record.
    /// @param fileName Plain file name selected locally by the user.
    /// @param encryptedCid CID encrypted off-chain with the randomly generated address A.
    /// @param encryptedKey Address A encrypted for the FHEVM (handle from relayer SDK).
    /// @param inputProof Proof associated with the encrypted key.
    /// @return fileId The index of the stored file for the uploader.
    function uploadFile(
        string calldata fileName,
        string calldata encryptedCid,
        externalEaddress encryptedKey,
        bytes calldata inputProof
    ) external returns (uint256 fileId) {
        require(bytes(fileName).length > 0, "File name required");
        require(bytes(encryptedCid).length > 0, "Encrypted cid required");

        eaddress validatedKey = FHE.fromExternal(encryptedKey, inputProof);

        // Allow the uploader and the contract to manage future decryptions.
        FHE.allow(validatedKey, msg.sender);
        FHE.allowThis(validatedKey);

        StoredFile memory newFile = StoredFile({
            uploader: msg.sender,
            fileName: fileName,
            encryptedCid: encryptedCid,
            encryptedKey: validatedKey,
            createdAt: block.timestamp
        });

        _filesByOwner[msg.sender].push(newFile);
        fileId = _filesByOwner[msg.sender].length - 1;

        emit FileStored(msg.sender, fileId, fileName, encryptedCid);
    }

    /// @notice Allow another address to decrypt the encrypted key for a file you uploaded.
    /// @param owner Address that uploaded the file.
    /// @param fileId Index of the file in the owner's collection.
    /// @param beneficiary Address permitted to decrypt.
    function authorizeDecrypt(
        address owner,
        uint256 fileId,
        address beneficiary
    ) external {
        require(owner == msg.sender, "Only owner");
        require(beneficiary != address(0), "Invalid beneficiary");
        require(fileId < _filesByOwner[owner].length, "Invalid fileId");

        StoredFile storage stored = _filesByOwner[owner][fileId];
        FHE.allow(stored.encryptedKey, beneficiary);

        emit AccessGranted(owner, fileId, beneficiary);
    }

    /// @notice Retrieve a specific stored file for an owner.
    /// @param owner Address that created the file record.
    /// @param fileId Index of the file in the owner's list.
    function getFile(address owner, uint256 fileId) external view returns (StoredFile memory) {
        require(fileId < _filesByOwner[owner].length, "Invalid fileId");
        return _filesByOwner[owner][fileId];
    }

    /// @notice Get all stored files for an owner.
    /// @param owner Address that created the file records.
    function getFiles(address owner) external view returns (StoredFile[] memory) {
        return _filesByOwner[owner];
    }

    /// @notice Get the number of files uploaded by an owner.
    /// @param owner Address that created the file records.
    function getFileCount(address owner) external view returns (uint256) {
        return _filesByOwner[owner].length;
    }
}
