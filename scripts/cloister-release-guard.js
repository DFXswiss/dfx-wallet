// Copyright (c) 2026 DFX AG. Licensed under the MIT License.
//
// Build-time guard: a production / Base-mainnet Cloister build must NOT carry any testnet/pilot
// flag. The embedded demo signer, the KYC eval-bypass and the sideload auth-bypass are Sepolia-only.
// Wired into the EAS build via the `eas-build-post-install` npm hook, so it runs (and can fail the
// build) automatically on every EAS build — not just when someone remembers to run it.
//   manual:  node scripts/cloister-release-guard.js

const chainId = Number(process.env.EXPO_PUBLIC_CLOISTER_CHAINID || '84532');
const isMainnet = chainId === 8453; // Base mainnet
// EAS sets EAS_BUILD_PROFILE during a build. Fail on the `production` profile REGARDLESS of
// chainId, so a release build that simply forgot to set the mainnet chain-id can't smuggle a
// pilot flag through (defense against the "chainId defaults to testnet" hole).
const isProdProfile = process.env.EAS_BUILD_PROFILE === 'production';

const set = (v) => v && v !== '' && v !== '0';
const offenders = [];
if (set(process.env.EXPO_PUBLIC_CLOISTER_KEY))
  offenders.push('EXPO_PUBLIC_CLOISTER_KEY (embedded demo signer)');
if (set(process.env.EXPO_PUBLIC_CLOISTER_EVAL))
  offenders.push('EXPO_PUBLIC_CLOISTER_EVAL (KYC bypass)');
if (set(process.env.EXPO_PUBLIC_CLOISTER_SIDELOAD))
  offenders.push('EXPO_PUBLIC_CLOISTER_SIDELOAD (auth bypass)');

if ((isMainnet || isProdProfile) && offenders.length > 0) {
  const why = isMainnet ? 'a Base-mainnet build (chainId 8453)' : "the EAS 'production' profile";
  console.error(
    '\nx Cloister release guard: ' +
      why +
      ' must NOT set these testnet/pilot flags:\n  - ' +
      offenders.join('\n  - ') +
      "\n  Unset them (the user's own wallet signs, KYC + onboarding are enforced) and rebuild.\n",
  );
  process.exit(1);
}

console.log(
  'cloister release guard: ok (chainId ' +
    chainId +
    (isProdProfile ? ', production profile' : '') +
    (isMainnet || isProdProfile ? ' — no pilot flags)' : ' — testnet/pilot)'),
);
