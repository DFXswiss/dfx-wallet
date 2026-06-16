// Copyright (c) 2026 DFX AG. Licensed under the MIT License.
//
// Build-time guard: a Base-mainnet Cloister build must NOT carry any testnet/pilot flag.
// The embedded demo signer, the KYC eval-bypass and the sideload auto-auth are Sepolia-only.
// Run before a release build:  node scripts/cloister-release-guard.mjs
// (Exits non-zero — fails the build — if a mainnet build has any pilot flag set.)

const env = process.env;
const chainId = Number(env.EXPO_PUBLIC_CLOISTER_CHAINID ?? '84532');
const isMainnet = chainId === 8453; // Base mainnet

const PILOT_FLAGS = [
  'EXPO_PUBLIC_CLOISTER_KEY', // embedded demo deployer key
  'EXPO_PUBLIC_CLOISTER_EVAL', // KYC gate bypass
  'EXPO_PUBLIC_CLOISTER_SIDELOAD', // PIN/onboarding auto-auth
];
const offenders = PILOT_FLAGS.filter((k) => env[k] && env[k] !== '' && env[k] !== '0');

if (isMainnet && offenders.length > 0) {
  console.error(
    `\n✖ Cloister release guard: a Base-mainnet build (chainId 8453) must NOT set these testnet/pilot flags:\n  - ${offenders.join('\n  - ')}\n  Unset them (the user's own wallet signs, KYC + onboarding are enforced) and rebuild.\n`,
  );
  process.exit(1);
}

console.log(`cloister release guard: ok (chainId ${chainId}${isMainnet ? ' — mainnet, no pilot flags' : ' — testnet/pilot'})`);
