export {
  isPasskeySupported,
  createPasskey,
  authenticatePasskey,
  PasskeyPrfUnsupportedError,
} from './passkey-service';
export { deriveMnemonicFromPrf, DERIVATION_VERSION } from './key-derivation';
export { setupPasskeyWallet } from './setup-wallet';
