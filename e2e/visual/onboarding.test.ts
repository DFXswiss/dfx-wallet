import { by, element, waitFor } from 'detox';
import { expectScreenToMatchBaseline } from '../utils/screenshot';
import { launchAndWaitForWelcome, launchWithExistingState } from '../utils/launch';
import { enterPin } from '../utils/pin';

// Small delay for UI transitions when synchronization is disabled.
const pause = (ms = 1_000) => new Promise((r) => setTimeout(r, ms));

// Each gated describe-block reads the same EXPO_PUBLIC_ENABLE_* string
// the production build resolves through `src/config/features.ts`, so a
// build with the feature off skips its block entirely and a build with
// the feature on runs against the real screen (not the Disabled stub).
const featureOn = (envVar: string): boolean => process.env[envVar] === 'true';
const enableRestore = featureOn('EXPO_PUBLIC_ENABLE_RESTORE');
const enablePasskey = featureOn('EXPO_PUBLIC_ENABLE_PASSKEY');
const enablePin = featureOn('EXPO_PUBLIC_ENABLE_PIN');
const enableLegal = featureOn('EXPO_PUBLIC_ENABLE_LEGAL');

const describeRestoreToggle = enableRestore || enablePasskey ? describe : describe.skip;
const describePinLegal = enablePin && enableLegal ? describe : describe.skip;
const describePin = enablePin ? describe : describe.skip;
const describeRestoreFlow =
  (enableRestore || enablePasskey) && enablePin && enableLegal ? describe : describe.skip;

describe('Visual Regression', () => {
  describe('Welcome screen', () => {
    beforeAll(async () => {
      await launchAndWaitForWelcome();
    });

    it('matches baseline', async () => {
      await expectScreenToMatchBaseline('welcome');
    });
  });

  describeRestoreToggle('Welcome screen with restore toggle', () => {
    beforeAll(async () => {
      await launchAndWaitForWelcome();
    });

    it('matches baseline with restore options visible', async () => {
      await element(by.id('welcome-restore-toggle')).tap();
      await pause();
      await expectScreenToMatchBaseline('welcome-restore-expanded');
    });
  });

  describe('Create wallet flow (MVP)', () => {
    beforeAll(async () => {
      await launchAndWaitForWelcome();
    });

    it('shows create wallet screen', async () => {
      await element(by.id('welcome-create-wallet-button')).tap();
      await waitFor(element(by.id('create-wallet-screen')))
        .toBeVisible()
        .withTimeout(30_000);
      await expectScreenToMatchBaseline('create-wallet');
    });

    it('shows revealed seed phrase', async () => {
      await element(by.id('create-wallet-reveal-button')).tap();
      await pause(2_000);
      await expectScreenToMatchBaseline('create-wallet-revealed');
    });

    it('shows dashboard via the disabled-stub redirect', async () => {
      // With EXPO_PUBLIC_ENABLE_PIN + EXPO_PUBLIC_ENABLE_LEGAL off,
      // SetupPinDisabled marks the wallet onboarded + authenticated
      // and replaces the PIN screen with a `router.replace('/(auth)/(tabs)/dashboard')`,
      // so "continue" jumps straight to the dashboard. WDK's
      // restoreWallet() initialises all chain wallets in between which
      // can take 30s+ — bitcoin, taproot and plasma each open their own
      // worker.
      await element(by.id('create-wallet-continue-button')).tap();
      await waitFor(element(by.id('dashboard-screen')))
        .toBeVisible()
        .withTimeout(120_000);
      await expectScreenToMatchBaseline('dashboard');
    });
  });

  describePinLegal('Create wallet flow with PIN + legal', () => {
    beforeAll(async () => {
      await launchAndWaitForWelcome();
    });

    it('shows create wallet screen', async () => {
      await element(by.id('welcome-create-wallet-button')).tap();
      await waitFor(element(by.id('create-wallet-screen')))
        .toBeVisible()
        .withTimeout(30_000);
      await expectScreenToMatchBaseline('create-wallet');
    });

    it('shows revealed seed phrase', async () => {
      await element(by.id('create-wallet-reveal-button')).tap();
      await pause(2_000);
      await expectScreenToMatchBaseline('create-wallet-revealed');
    });

    it('shows setup PIN screen', async () => {
      await element(by.id('create-wallet-continue-button')).tap();
      // WDK restoreWallet() initializes all chain wallets which can
      // take over 30s, especially with bitcoin + taproot + plasma.
      await waitFor(element(by.id('setup-pin-screen')))
        .toBeVisible()
        .withTimeout(120_000);
      await expectScreenToMatchBaseline('setup-pin');
    });

    it('shows PIN confirm screen', async () => {
      await enterPin('111111');
      await waitFor(element(by.id('setup-pin-confirm-screen')))
        .toBeVisible()
        .withTimeout(30_000);
      await expectScreenToMatchBaseline('setup-pin-confirm');
    });

    it('shows legal disclaimer screen', async () => {
      await enterPin('111111');
      await waitFor(element(by.id('legal-disclaimer-screen')))
        .toBeVisible()
        .withTimeout(30_000);
      await expectScreenToMatchBaseline('legal-disclaimer');
    });

    it('shows dashboard after onboarding', async () => {
      await element(by.id('legal-accept-checkbox')).tap();
      await element(by.id('legal-continue-button')).tap();
      await waitFor(element(by.id('dashboard-screen')))
        .toBeVisible()
        .withTimeout(30_000);
      await expectScreenToMatchBaseline('dashboard-with-pin-legal');
    });
  });

  // PIN unlock reuses the onboarded state from the create wallet flow above.
  // Running this in a separate test file fails because the WDK's second
  // restoreWallet() call hangs on CI — likely due to stale WDK state that
  // survives app reinstall.
  describePin('PIN unlock', () => {
    it('shows verify PIN screen after cold restart', async () => {
      await launchWithExistingState();
      await waitFor(element(by.id('verify-pin-screen')))
        .toBeVisible()
        .withTimeout(30_000);
      await expectScreenToMatchBaseline('verify-pin');
    });

    it('shows error state on wrong PIN', async () => {
      await enterPin('222222');
      await waitFor(element(by.id('verify-pin-error')))
        .toBeVisible()
        .withTimeout(30_000);
      await expectScreenToMatchBaseline('verify-pin-error');
    });

    it('reaches dashboard after correct PIN', async () => {
      await enterPin('111111');
      await waitFor(element(by.id('dashboard-screen')))
        .toBeVisible()
        .withTimeout(30_000);
      await expectScreenToMatchBaseline('pin-unlock-dashboard');
    });
  });

  describeRestoreFlow('Restore wallet flow', () => {
    beforeAll(async () => {
      await launchAndWaitForWelcome();
    });

    it('shows restore wallet screen', async () => {
      await element(by.id('welcome-restore-toggle')).tap();
      await pause();
      await element(by.id('welcome-restore-seed-button')).tap();
      await waitFor(element(by.id('restore-wallet-screen')))
        .toBeVisible()
        .withTimeout(30_000);
      await expectScreenToMatchBaseline('restore-wallet');
    });

    it('shows restore wallet with seed entered', async () => {
      await element(by.id('restore-wallet-seed-input')).tap();
      await element(by.id('restore-wallet-seed-input')).typeText(
        'test test test test test test test test test test test junk',
      );
      await element(by.id('restore-wallet-seed-input')).tapReturnKey();
      await pause();
      await expectScreenToMatchBaseline('restore-wallet-filled');
    });
  });
});
