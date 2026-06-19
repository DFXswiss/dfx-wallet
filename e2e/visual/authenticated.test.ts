import { by, device, element, waitFor } from 'detox';
import { expectScreenToMatchBaseline } from '../utils/screenshot';
import { launchAndWaitForWelcome } from '../utils/launch';
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
 * Navigation strategy: onboard ONCE (PIN + legal flow) to the dashboard, then
 * walk forward into each authenticated screen and back, all with Detox
 * synchronization disabled — exactly like the green "Dashboard navigation"
 * block in onboarding.test.ts. We do NOT cold-restart + PIN-unlock per screen:
 * once a real WDK wallet exists its worklet keeps the JS thread permanently
 * busy, so the app never reports "idle"; `device.launchApp()` re-enables
 * synchronization on every new instance and then blocks forever waiting for an
 * idle that never comes (and `enterPin()` re-enables sync for the same reason).
 * Driving with explicit `waitFor` + `pause()` while staying sync-disabled is
 * the only thing that works once the wallet is live (see docs/visual-regression.md).
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
  // WDK chain init on a fresh wallet can take 90s+.
  await waitFor(element(by.id('setup-pin-screen')))
    .toBeVisible()
    .withTimeout(120_000);
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

  // Onboard the PIN wallet the authenticated screens below reuse. Every block
  // after this one navigates from the state this leaves behind (the dashboard),
  // without a fresh launch — see the navigation-strategy note in the header.
  describe('Onboard (PIN + legal)', () => {
    it('reaches the dashboard', async () => {
      await onboardToDashboard();
    });
  });

  // Authenticated screens, captured by navigating forward/back from the
  // onboarded dashboard. Tests run in declaration order and carry the app's
  // navigation state from one to the next, mirroring the MVP suite's
  // "Dashboard navigation" block.
  describe('Authenticated screens', () => {
    beforeAll(async () => {
      // onboardToDashboard() runs enterPin(), which re-enables Detox
      // synchronization. With a live WDK wallet the worklet keeps the JS
      // thread permanently busy, so we must turn synchronization back off
      // before navigating — otherwise every waitFor blocks on an "idle" the
      // app never reaches (the relaunch design hit the same wall, forever).
      await device.disableSynchronization();
    });

    // --- Multi-sig (reached from the dashboard shield button) ---
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

    it('returns to the dashboard from multi-sig', async () => {
      // setup (intro step) → manage → dashboard, one back tap each.
      await element(by.id('multi-sig-back')).tap();
      await waitFor(element(by.id('multi-sig-manage')))
        .toBeVisible()
        .withTimeout(30_000);
      await pause();
      await element(by.id('multi-sig-manage-back')).tap();
      await waitFor(element(by.id('dashboard-screen')))
        .toBeVisible()
        .withTimeout(30_000);
      await pause();
    });

    // --- Settings and its sub-screens (reached from the dashboard menu) ---
    it('shows the settings screen', async () => {
      await openSettings();
      await expectScreenToMatchBaseline('settings');
    });

    // NOTE: the DFX-wallets screen is backend-driven (it fetches /v1/v2/user);
    // against the testnet build with no live DFX API it renders an error state,
    // which is not a meaningful baseline. It stays `pending` in the manifest
    // until the mocked DFX backend lands. Same constraint as buy/sell/kyc/etc.

    it('shows the seed-export screen', async () => {
      await element(by.id('settings-seed')).tap();
      await waitFor(element(by.id('seed-export-screen')))
        .toBeVisible()
        .withTimeout(30_000);
      await pause();
      await expectScreenToMatchBaseline('seed-export');
    });

    it('returns to settings from seed-export', async () => {
      await element(by.id('seed-export-back')).tap();
      await waitFor(element(by.id('settings-user-data')))
        .toBeVisible()
        .withTimeout(30_000);
      await pause();
    });

    it('shows the hardware-connect screen', async () => {
      await element(by.id('settings-hardware-wallet')).tap();
      await waitFor(element(by.id('hardware-connect-screen')))
        .toBeVisible()
        .withTimeout(30_000);
      await pause();
      await expectScreenToMatchBaseline('hardware-connect');
    });
  });
});
