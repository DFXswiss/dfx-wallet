# Spike: native BitBox (gomobile/FFI) — replace the WASM-WebView path

Goal: prove that the dfx-wallet hardware-wallet stack can run on a native binding of
`BitBoxSwiss/bitbox02-api-go` (the RealUnit pattern) instead of the `bitbox-api` WASM
lib hosted in a WebView. The WebView path is the cause of the closed PR #153
(WASM load fails against `about:blank`; CSP/nonce fragility).

## What is already proven (✓)

1. **The reusable native core works.** RealUnit's `bitbox_flutter/go/` module (wrapping
   `bitbox02-api-go` + go-ethereum + btcd/psbt, built via gomobile) was compiled and its
   fake-device harness run on this machine — `ETHGetAddress`, `ETHSignMessage`,
   `ETHSignTypedMessage` (EIP-712), `BTCXPub`, `InitDevice` all pass, error/panic paths
   handled. See `go-core-proof.txt`.
2. **The binaries already exist** — no gomobile rebuild needed for the spike:
   - iOS: `bitbox_flutter/ios/Api.xcframework` (arm64 + simulator)
   - Android: `bitbox_flutter/android/libs/api.aar`
3. **RealUnit ships these binaries in production** on real iOS/Android devices → on-device
   feasibility is established outside this repo.
4. **dfx-wallet is already shaped for the swap.** The protocol sits behind `BitboxApi`
   (`src/features/hardware-wallet/services/bitbox-protocol.ts`); transports are separate
   (`transport-usb.ts` HID, `transport-ble.ts`). Only `BitboxApi`'s implementation and its
   WebView host change. `BitboxTransport {write,read,close}` already matches Go's
   `GoReadWriteCloserInterface`.

## Scaffolding added by this spike (additive, build-safe)

- `src/features/hardware-wallet/native/NativeBitboxSpec.ts` — the JS-facing native-module
  contract, mirroring the Go exports.
- `src/features/hardware-wallet/native/NativeBitboxApi.ts` — a drop-in `BitboxApi`
  delegating to the native module (the seam swap). Typechecks against the existing
  `BitboxApi` interface; `product()` and a couple of glue points are marked TODO.

No existing file is modified, so the current build is untouched.

## Remaining work to a running ETHGetAddress (the spike's acceptance test)

Requires a machine with **full Xcode** (this Studio has only CommandLineTools) and an
iOS simulator or a BitBox02 + the bitbox simulator.

### iOS
1. Vendor `Api.xcframework` into the iOS project (Podspec `vendored_frameworks`, or an
   Expo config-plugin that copies it).
2. Write a Swift Expo-module / TurboModule implementing `NativeBitboxSpec`. Map each method
   to the `Api.objc.h` symbols (`ApiETHGetAddress`, `ApiETHSignTypedMessage`, …). Feed the
   device read/write (the existing USB/BLE transport) into Go via the
   `GoReadWriteCloserInterface` callback (`Api.GetDevice`).
3. Acceptance: connect → init → channelHashVerify(true) → `ethAddress(1, "m/44'/60'/0'/0/0", false)`
   returns a valid 0x address on the simulator/device.

### Android
4. Add `api.aar` as a module dependency; Kotlin module implementing `NativeBitboxSpec`,
   same transport-callback wiring. (`transport-usb.ts` already does Android HID.)

### Integration
5. Behind a feature flag, construct `NativeBitboxApi` instead of the WASM `BitboxApi`;
   keep the WASM path until parity is proven.
6. Once parity holds on both platforms: delete `BitboxWasmWebView.tsx`, `bridge-html.ts`,
   `wasm-bridge.ts`, the `bitbox-api` dependency and the CSP/nonce tests.

## Artefact-Hygiene / risks
- xcframework/aar come from the bitbox_flutter gomobile build — set up a reproducible
  build or a shared-artifact source so dfx-wallet and RealUnit don't drift.
- Verify the cakewallet plugin origin's licence.
- Measure bundle-size delta (native Go binary vs WASM).
- Final device test geräte-frei via RealUnit's `bitbox_testkit` / SimulatedBitboxPlatform.
