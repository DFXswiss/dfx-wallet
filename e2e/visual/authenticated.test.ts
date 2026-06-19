import { by, element, waitFor } from 'detox';
import { expectScreenToMatchBaseline } from '../utils/screenshot';
import { launchAndWaitForWelcome, launchWithExistingState } from '../utils/launch';
import { enterPin } from '../utils/pin';

// Small delay for UI transitions when synchronization is disabled.
const pause = (ms = 1_000) => new Promise((r) => setTimeout(r, ms));

/**
 * Full-variant visual suite.
 *
 * The MVP visual run (onboarding.test.ts, on the default `.env.testnet` build)
 * builds with every EXPO_PUBLIC_ENABLE_* flag unset, so the authenticated,
 * feature-gated screens resolve to their `*Disabled` stubs and can never be
 * snapshotted there. This suite is captured against a build with every flag on
 * (the `full` matrix leg of .github/workflows/visual-regression.yml), so each
 * screen resolves to its real implementation.
 *
 * Baseline names here are disjoint from the MVP suite's, so the two share
 * e2e/__baselines__/ without clobbering each other — enforced by
 * scripts/check-visual-coverage.mjs.
 *
 * Navigation strategy: onboard once (PIN + legal flow), then for every screen
 * cold-restart via launchWithExistingState() + PIN unlock back to a clean
 * dashboard and navigate forward. No back-navigation between sibling screens —
 * with synchronization disabled (the WDK keeps the main queue busy) a tap after
 * a back-nav is the single most flake-prone action (see docs/visual-regression.md).
 */

const PIN = '111111';

async function onboardToDashboard(): Promise<void> {
  await launchAndWaitForWelcome();
  await element(by.id('welcome-create-wallet-button')).tap();
  await waitFor(element(by.id('create-wallet-screen')))
    .toBeVisible()
    .withTimeout(30_000);
  // The continue button is gated behind revealing (acknowledging) the seed.
  await element(by.id('create-wallet-reveal-button')).tap();
  await pause(2_000);
  await element(by.id('create-wallet-continue-button')).tap();
  // WDK chain init on a fresh wallet can take 90s+; allow generous headroom
  // over the observed ceiling so a loaded CI runner doesn't trip the timeout.
  await waitFor(element(by.id('setup-pin-screen')))
    .toBeVisible()
    .withTimeout(180_000);
  await enterPin(PIN);
  await waitFor(element(by.id('setup-pin-confirm-screen')))
    .toBeVisible()
    .withTimeout(30_000);
  await enterPin(PIN);
  await waitFor(element(by.id('legal-disclaimer-screen')))
    .toBeVisible()
    .withTimeout(30_000);
  await element(by.id('legal-accept-checkbox')).tap();
  // The continue button sits below a spacer at the bottom of the scroll view;
  // on shorter viewports it is clipped, so scroll it fully into view first.
  await waitFor(element(by.id('legal-continue-button')))
    .toBeVisible()
    .whileElement(by.id('legal-disclaimer-screen'))
    .scroll(350, 'down');
  await element(by.id('legal-continue-button')).tap();
  await waitFor(element(by.id('dashboard-screen')))
    .toBeVisible()
    .withTimeout(30_000);
}

/** Cold-restart the onboarded app and unlock to a clean dashboard. */
async function relaunchToDashboard(): Promise<void> {
  await launchWithExistingState();
  await waitFor(element(by.id('verify-pin-screen')))
    .toBeVisible()
    .withTimeout(30_000);
  await enterPin(PIN);
  await waitFor(element(by.id('dashboard-screen')))
    .toBeVisible()
    .withTimeout(60_000);
}

async function openSettings(): Promise<void> {
  await element(by.id('dashboard-menu-button')).tap();
  // `settings-user-data` is the topmost settings row — a stable, always-visible
  // anchor for the screen transition (the screen has no root testID).
  await waitFor(element(by.id('settings-user-data')))
    .toBeVisible()
    .withTimeout(30_000);
  await pause();
}

describe('Visual Regression (full variant)', () => {
  // Passkey onboarding screens delete + recreate state on launch, so they run
  // first — before the PIN wallet the authenticated blocks depend on exists.
  describe('Passkey onboarding screens', () => {
    beforeAll(async () => {
      await launchAndWaitForWelcome();
    });

    it('shows create-passkey screen', async () => {
      await element(by.id('welcome-create-passkey-button')).tap();
      await waitFor(element(by.id('create-passkey-screen')))
        .toBeVisible()
        .withTimeout(30_000);
      await pause();
      await expectScreenToMatchBaseline('create-passkey');
    });
  });

  describe('Restore-passkey onboarding screen', () => {
    beforeAll(async () => {
      await launchAndWaitForWelcome();
    });

    it('shows restore-passkey screen', async () => {
      // Restore options are collapsed behind the toggle by default.
      await element(by.id('welcome-restore-toggle')).tap();
      await pause();
      await element(by.id('welcome-restore-passkey-button')).tap();
      await waitFor(element(by.id('restore-passkey-screen')))
        .toBeVisible()
        .withTimeout(30_000);
      await pause();
      await expectScreenToMatchBaseline('restore-passkey');
    });
  });

  // Onboard the PIN wallet the authenticated blocks below reuse.
  describe('Onboard (PIN + legal)', () => {
    it('reaches the dashboard', async () => {
      await onboardToDashboard();
    });
  });

  describe('Settings', () => {
    beforeAll(async () => {
      await relaunchToDashboard();
    });

    it('shows the settings screen', async () => {
      await openSettings();
      await expectScreenToMatchBaseline('settings');
    });
  });

  // NOTE: the DFX-wallets screen is backend-driven (it fetches /v1/v2/user);
  // against the testnet build with no live DFX API it renders an error state,
  // which is not a meaningful baseline. It stays `pending` in the manifest
  // until the mocked DFX backend lands. Same constraint as buy/sell/kyc/etc.

  describe('Seed export', () => {
    beforeAll(async () => {
      await relaunchToDashboard();
    });

    it('shows the seed-export screen', async () => {
      await openSettings();
      await element(by.id('settings-seed')).tap();
      await waitFor(element(by.id('seed-export-screen')))
        .toBeVisible()
        .withTimeout(30_000);
      await pause();
      await expectScreenToMatchBaseline('seed-export');
    });
  });

  describe('Hardware wallet connect', () => {
    beforeAll(async () => {
      await relaunchToDashboard();
    });

    it('shows the hardware-connect screen', async () => {
      await openSettings();
      await element(by.id('settings-hardware-wallet')).tap();
      await waitFor(element(by.id('hardware-connect-screen')))
        .toBeVisible()
        .withTimeout(30_000);
      await pause();
      await expectScreenToMatchBaseline('hardware-connect');
    });
  });

  describe('Multi-sig', () => {
    beforeAll(async () => {
      await relaunchToDashboard();
    });

    it('shows the multi-sig manage screen', async () => {
      await element(by.id('dashboard-shield-button')).tap();
      await waitFor(element(by.id('multi-sig-manage')))
        .toBeVisible()
        .withTimeout(30_000);
      await pause();
      await expectScreenToMatchBaseline('multi-sig');
    });

    it('shows the multi-sig setup screen', async () => {
      await element(by.id('multi-sig-setup-cta')).tap();
      await waitFor(element(by.id('multi-sig')))
        .toBeVisible()
        .withTimeout(30_000);
      await pause();
      await expectScreenToMatchBaseline('multi-sig-setup');
    });
  });
});
