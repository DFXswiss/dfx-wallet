# Passkey Wallet Architecture

Technical design document for passkey-based wallet creation in DFX Wallet.

## Overview

DFX Wallet supports creating wallets using WebAuthn passkeys as an alternative to manual BIP-39 seed phrase backup. The passkey's PRF (Pseudo-Random Function) extension derives deterministic entropy that generates a standard 12-word mnemonic, fully compatible with the existing Tether WDK wallet flow.

This is a **local-only, stateless** design. No server interaction, no Nostr relays, no cloud storage of key material.

## Cryptographic Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Passkey Creation (WebAuthn)                                      │
│                                                                     │
│    navigator.credentials.create({                                   │
│      rp: { id: "dfx.swiss" },                                      │
│      extensions: { prf: { eval: { first: salt } } }                │
│    })                                                               │
│                                                                     │
│    → Secure Enclave generates P-256 keypair                         │
│    → CredRandom (internal HMAC key) created per credential          │
│    → PRF evaluated: HMAC-SHA256(CredRandom, SHA-256("WebAuthn PRF"  │
│      || 0x00 || salt))                                              │
│    → Returns 32-byte PRF output to app                              │
├─────────────────────────────────────────────────────────────────────┤
│ 2. Salt Computation                                                 │
│                                                                     │
│    salt = SHA-256("dfx-wallet-v1")                                  │
│                                                                     │
│    Static, hardcoded in the app. One passkey = one wallet.          │
│    The salt is not secret — it's a domain separator.                │
├─────────────────────────────────────────────────────────────────────┤
│ 3. Key Derivation (HKDF-SHA256)                                     │
│                                                                     │
│    derived = HKDF-SHA256(                                           │
│      ikm:    prfOutput,                    // 32 bytes from PRF     │
│      salt:   "dfx-wallet-seed-derivation", // domain separation     │
│      info:   "mnemonic-v1",                // purpose binding       │
│      length: 16                            // 128 bits              │
│    )                                                                │
│                                                                     │
│    HKDF adds domain separation so the raw PRF output is never used  │
│    directly as key material. The info field ("mnemonic-v1") allows  │
│    deriving different keys from the same PRF output in the future   │
│    without changing the passkey or salt.                             │
├─────────────────────────────────────────────────────────────────────┤
│ 4. BIP-39 Mnemonic Generation                                      │
│                                                                     │
│    mnemonic = BIP39.entropyToMnemonic(derived)                      │
│             = 12 words (128 bits of entropy)                        │
│                                                                     │
│    Standard BIP-39. The mnemonic is compatible with any wallet      │
│    that supports BIP-39 import (Electrum, BlueWallet, MetaMask).    │
├─────────────────────────────────────────────────────────────────────┤
│ 5. WDK Wallet Creation                                              │
│                                                                     │
│    WDK.createWallet({ mnemonic })                                   │
│    → BIP-32/BIP-44 HD derivation (inside isolated Bare Worklet)     │
│    → Bitcoin: m/84'/0'/0'/0/0 (Native SegWit)                      │
│    → Ethereum: m/44'/60'/0'/0/0                                     │
│    → Private keys never leave the worklet context                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Why PRF, Not Smart Contract Wallets

Coinbase Smart Wallet uses a different approach: passkey P-256 signatures are verified directly on-chain via ERC-4337 account abstraction and the RIP-7212 precompile. This eliminates seed phrases entirely.

We chose PRF-based seed derivation instead because:

| Constraint | Smart Contract Wallet | PRF → BIP-39 Seed |
|---|---|---|
| Bitcoin support | Not possible (no account abstraction on Bitcoin L1) | Works on all chains |
| WDK compatibility | Would require replacing WDK entirely | Drop-in compatible (WDK takes any BIP-39 mnemonic) |
| Chain deployment | Requires deploying contracts on every chain | No on-chain state |
| Gas costs | P-256 verification: ~3,450 gas (RIP-7212) to ~270,000 gas (fallback) | Zero |
| Portability | Wallet addresses tied to contract deployment | Standard BIP-39 — import into any wallet |
| Complexity | High (factory, proxy, entrypoint, bundler) | Low (one function call) |

The Breez SDK (launched March 2026) validated this approach for Bitcoin Lightning wallets.

## WebAuthn Configuration

### Relying Party

```
rpId: "dfx.swiss"
rpName: "DFX Wallet"
```

The rpId is set to the top-level domain `dfx.swiss` (not a subdomain like `wallet.dfx.swiss`). This means:

- Any subdomain of dfx.swiss can use the same passkey (future web app, other services)
- The rpId can never be changed — all existing passkeys would become invalid
- Associated Domains must be configured on `https://dfx.swiss/.well-known/`

### User Identity

```
user.id:          random UUID (16 bytes, base64url)
user.name:        "DFX Wallet"
user.displayName: "DFX Wallet"
```

No PII (email, phone) is used. The user sees "dfx.swiss — DFX Wallet" in their passkey manager.

### Authenticator Selection

```
residentKey:      "required"     — discoverable credential (shows in passkey picker)
userVerification: "required"     — biometric/PIN required for every operation
```

### PRF Extension

```
extensions.prf.eval.first: SHA-256("dfx-wallet-v1")   — 32-byte salt as Uint8Array
```

The salt is deterministic and static. It's hashed to avoid leaking the string via CTAP2 transport. The same salt on the same credential always produces the same PRF output.

## Platform Requirements

| Platform | Minimum | Reason |
|---|---|---|
| iOS | 18.0 | PRF extension support in ASAuthorizationPlatformPublicKeyCredentialProvider |
| Android | API 34 (Android 14) | Credential Manager with native passkey + PRF support |

Devices below these versions will not see the passkey option in the UI. The seed phrase flow remains available as fallback.

## Associated Domains Setup

Passkeys in native apps require server-side verification files.

### iOS — Apple App Site Association

File: `https://dfx.swiss/.well-known/apple-app-site-association`

```json
{
  "webcredentials": {
    "apps": ["<TEAM_ID>.swiss.dfx.wallet"]
  }
}
```

- `<TEAM_ID>` is the Apple Developer Team ID from the signing certificate
- Must be served with `Content-Type: application/json`
- No redirects allowed — must be served directly from the domain
- Hosted in the `DFXswiss/landing-page` repo under `.well-known/`

### Android — Asset Links

File: `https://dfx.swiss/.well-known/assetlinks.json`

```json
[{
  "relation": [
    "delegate_permission/common.handle_all_urls",
    "delegate_permission/common.get_login_creds"
  ],
  "target": {
    "namespace": "android_app",
    "package_name": "swiss.dfx.wallet",
    "sha256_cert_fingerprints": ["<SHA256_FINGERPRINT>"]
  }
}]
```

- `<SHA256_FINGERPRINT>` is the SHA-256 of the Android signing certificate
- Obtain via: `keytool -list -v -keystore <keystore> | grep SHA256`

## Storage Model

| Key | Value | Storage | Purpose |
|---|---|---|---|
| `encryptedSeed` | BIP-39 mnemonic (12 words) | expo-secure-store (Keychain/Keystore) | WDK wallet initialization |
| `walletOrigin` | `"passkey"` or absent | expo-secure-store | Determines UI behavior (warnings, export prompts) |
| `passkeyCredentialId` | WebAuthn credential ID | expo-secure-store | Identifies which passkey created this wallet |

The mnemonic is cached locally after derivation. This means:

- The app does not re-evaluate PRF on every unlock (PIN/biometric is used for daily unlock)
- The passkey is the **seed source**, not the **unlock mechanism**
- If the local storage is wiped, the passkey can re-derive the same mnemonic

## Security Analysis

### Threat Model

| Threat | Risk | Mitigation |
|---|---|---|
| Compromised iCloud/Google account | Passkey exfiltrated → wallet compromised | Same risk as seed phrase on paper — user must secure their cloud account |
| Rooted/jailbroken device | expo-secure-store readable → mnemonic exposed | Same as current seed-based model — no regression |
| Passkey deleted without backup | Wallet funds permanently lost | Seed export available in Settings; warning shown at creation and deletion |
| Authenticator without PRF support | Wallet creation fails | Error caught, user redirected to seed phrase flow |
| rpId domain change | All passkeys invalid | rpId set to stable top-level domain `dfx.swiss` |
| CTAP2 transport interception | PRF salt/output visible on USB/NFC | CTAP2 encrypts hmac-secret via ECDH (PIN/UV Auth Protocol) |

### PRF Security Properties

- **Deterministic**: Same credential + same salt = same output, always
- **Credential-bound**: Different credentials with the same salt produce different outputs
- **Origin-bound**: Only `dfx.swiss` (and subdomains) can evaluate the PRF
- **User-verified**: Every PRF evaluation requires biometric/PIN interaction
- **Hardware-backed**: The CredRandom key never leaves the Secure Enclave

### Improvement Over Seed-Only Model

- No seed phrase written on paper → eliminates phishing/social engineering of seed words
- PRF output is hardware-bound → cannot be photographed, screenshot, or copied like a seed phrase
- User verification required → prevents silent key extraction even with physical device access

### Known Limitations

**iCloud Keychain PRF device-specificity**: As of iOS 18.4, Apple's iCloud Keychain may produce different PRF outputs on different devices for the same synced passkey. This means a passkey created on iPhone A and synced to iPhone B might derive a different wallet on iPhone B. Google Password Manager does not have this issue.

Mitigation: Users are prompted to export their recovery phrase as backup. The app tracks `walletOrigin: "passkey"` and shows targeted warnings.

**No formal guarantee of PRF consistency**: Neither Apple nor Google formally guarantee that synced passkeys produce identical PRF outputs across devices. The entire architecture depends on this property being true. Empirical testing (Corbado, Breez) confirms it works on recent OS versions, but there is no contractual SLA.

## Recovery Matrix

| Scenario | Recovery Path |
|---|---|
| Device lost, passkey synced via iCloud/Google | Authenticate passkey on new device → PRF → same wallet |
| Device lost, passkey NOT synced, mnemonic exported | Import 12 words in any BIP-39 wallet |
| Device lost, passkey NOT synced, NO mnemonic | **Funds lost permanently** |
| Passkey accidentally deleted from OS settings | Re-create passkey? No — different CredRandom → different wallet. Use exported mnemonic. |
| Switch from iPhone to Android (or vice versa) | Only via exported mnemonic (until FIDO CXP/CXF is widely adopted) |

## Comparison with Breez SDK Approach

Breez SDK (launched March 2026) uses a similar PRF-based architecture with key differences:

| Aspect | DFX Wallet | Breez SDK |
|---|---|---|
| Salt storage | Static, hardcoded in app | Published as Nostr Kind-1 events |
| Multi-wallet | One passkey = one wallet | Multiple salts = multiple wallets |
| Salt discovery | Not needed (deterministic) | Query Nostr relays for salt list |
| Nostr identity | Not used | Derived from PRF via BIP-32 (m/44'/1237'/55'/0/0) |
| Server dependency | None | Breez relay + public Nostr relays |
| Cross-app sharing | Not applicable | Shared rpId `keys.breez.technology` + Partner Portal |

DFX's design is simpler because:
1. DFX has KYC'd users with authenticated API access — no need for anonymous salt storage
2. One wallet per user is sufficient for the current product
3. No Nostr infrastructure to maintain

## File Structure

```
src/services/passkey/
├── index.ts               # Public API exports
├── passkey-service.ts     # WebAuthn create/get with PRF extension
└── key-derivation.ts      # PRF output → HKDF → BIP-39 mnemonic

app/(onboarding)/
├── create-passkey.tsx     # Passkey creation screen (3-step explainer + create button)
├── restore-passkey.tsx    # Passkey restore screen (authenticate + derive)
└── welcome.tsx            # Updated: passkey option + expandable restore menu
```

## Dependencies

| Package | Version | Purpose | Size |
|---|---|---|---|
| `react-native-passkey` | 3.3.3 | WebAuthn API with PRF extension for React Native | ~25 KB |
| `@noble/hashes` | 2.2.0 | HKDF-SHA256 for key derivation (Paul Miller, audited) | ~50 KB |

Both are well-maintained, audited libraries with no native dependencies beyond what the OS provides.

## Future Considerations

### Phase 2 — UX Optimization
- Make passkey the default for new installations (seed as "Advanced")
- Automatic passkey detection on restore
- Push reminder for seed export when balance exceeds threshold

### Phase 3 — Multi-Passkey
- Register multiple passkeys as backup (different devices/providers)
- Salt index stored on DFX API for multi-wallet support
- FIDO CXP/CXF support for cross-provider migration (Apple → Google)

### HKDF Info Field Versioning
The `info: "mnemonic-v1"` parameter in HKDF allows future derivation of additional key material from the same PRF output without changing the passkey or salt:

```
HKDF(prfOutput, salt, "mnemonic-v1", 16)   → wallet seed (current)
HKDF(prfOutput, salt, "encryption-v1", 32)  → local encryption key (future)
HKDF(prfOutput, salt, "nostr-v1", 32)       → Nostr identity (future)
```

This is forward-compatible without any user action or migration.
