export const digestStringAsync = jest.fn(async (_algo: string, data: string) => {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
});

export const CryptoDigestAlgorithm = { SHA256: 'SHA-256' };
