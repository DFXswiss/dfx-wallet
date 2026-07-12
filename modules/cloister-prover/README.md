# cloister-prover (local Expo module)

On-device Cloister zero-knowledge prover. Wraps the gomobile-built
`Cloister.xcframework` (gnark Groth16 + Poseidon2) and ships the proving keys in
the app bundle — the private witness never leaves the device.

## Regenerate native artifacts (not committed)

The xcframework (~61 MB) and keys (~14 MB) are build artifacts. Rebuild them with:

```bash
cd ~/DFXswiss/cloister-protocol/packages/prover-gnark
./scripts/build-ios.sh ~/DFXswiss/dfx-wallet
```

Then `npx expo prebuild --clean && (cd ios && pod install)` in the wallet.

## JS API

```ts
import { initProver, hash, prove, isCloisterNativeAvailable } from 'cloister-prover';
await initProver();                 // load keys (idempotent)
const h = await hash([1n, 2n]);     // Poseidon2 → bigint
const { a, b, c, publicSignals } = await prove(witnessInput);
```
