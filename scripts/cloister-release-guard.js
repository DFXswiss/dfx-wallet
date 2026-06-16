// Copyright (c) 2026 DFX AG. Licensed under the MIT License.
//
// Build-time guard: a Base-mainnet Cloister build must NOT carry any testnet/pilot flag.
// The embedded demo signer, the KYC eval-bypass and the sideload auto-auth are Sepolia-only.
// Run before a release build:  node scripts/cloister-release-guard.js
// (Exits non-zero — fails the build — if a mainnet build has any pilot flag set.)

const chainId = Number(process.env.EXPO_PUBLIC_CLOISTER_CHAINID || '84532');
const isMainnet = chainId === 8453; // Base mainnet

const set = (v) => v && v !== '' && v !== '0';
const offenders = [];
if (set(process.env.EXPO_PUBLIC_CLOISTER_KEY)) offenders.push('EXPO_PUBLIC_CLOISTER_KEY (embedded demo signer)');
if (set(process.env.EXPO_PUBLIC_CLOISTER_EVAL)) offenders.push('EXPO_PUBLIC_CLOISTER_EVAL (KYC bypass)');
if (set(process.env.EXPO_PUBLIC_CLOISTER_SIDELOAD)) offenders.push('EXPO_PUBLIC_CLOISTER_SIDELOAD (auth bypass)');

if (isMainnet && offenders.length > 0) {
  console.error(
    '\nx Cloister release guard: a Base-mainnet build (chainId 8453) must NOT set these testnet/pilot flags:\n  - ' +
      offenders.join('\n  - ') +
      "\n  Unset them (the user's own wallet signs, KYC + onboarding are enforced) and rebuild.\n",
  );
  process.exit(1);
}

console.log('cloister release guard: ok (chainId ' + chainId + (isMainnet ? ' — mainnet, no pilot flags)' : ' — testnet/pilot)'));
