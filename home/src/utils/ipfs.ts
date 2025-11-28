const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function randomBase58(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let output = '';
  for (let i = 0; i < length; i++) {
    output += alphabet[bytes[i] % alphabet.length];
  }
  return output;
}

export async function pseudoUploadToIpfs(file: File) {
  const signature = `${file.name}-${file.size}-${Date.now()}`;
  const hashChunk = randomBase58(34);
  const saltChunk = randomBase58(10);
  const ipfsHash = `Qm${hashChunk}${saltChunk}`.slice(0, 46);

  return {
    hash: ipfsHash,
    signature,
  };
}
