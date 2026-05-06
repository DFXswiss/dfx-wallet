import { by, element, waitFor } from 'detox';
import { expectScreenToMatchBaseline } from '../utils/screenshot';
import { launchAndWaitForWelcome } from '../utils/launch';
import { enterPin } from '../utils/pin';

// Small delay for UI transitions when synchronization is disabled.
const pause = (ms = 1_000) => new Promise((r) => setTimeout(r, ms));

describe('Onboarding', () => {
  describe('Welcome screen', () => {
    beforeAll(async () => {
      await launchAndWaitForWelcome();
    });

    it('matches baseline', async () => {
      await expectScreenToMatchBaseline('welcome');
    });

    it('matches baseline with restore options visible', async () => {
      await element(by.id('welcome-restore-toggle')).tap();
      await pause();
      await expectScreenToMatchBaseline('welcome-restore-expanded');
    });
  });

  describe('Create wallet flow', () => {
    beforeAll(async () => {
      await launchAndWaitForWelcome();
    });

    it('shows create wallet screen', async () => {
      await element(by.id('welcome-create-wallet-button')).tap();
      await waitFor(element(by.id('create-wallet-screen')))
        .toBeVisible()
        .withTimeout(10_000);
      await expectScreenToMatchBaseline('create-wallet');
    });

    it('shows revealed seed phrase', async () => {
      await element(by.id('create-wallet-reveal-button')).tap();
      await pause(2_000);
      await expectScreenToMatchBaseline('create-wallet-revealed');
    });

    it('shows setup PIN screen', async () => {
      await element(by.id('create-wallet-continue-button')).tap();
      await waitFor(element(by.id('setup-pin-screen')))
        .toBeVisible()
        .withTimeout(15_000);
      await expectScreenToMatchBaseline('setup-pin');
    });

    it('shows PIN confirm screen', async () => {
      await enterPin('111111');
      await waitFor(element(by.id('setup-pin-confirm-screen')))
        .toBeVisible()
        .withTimeout(5_000);
      await expectScreenToMatchBaseline('setup-pin-confirm');
    });

    it('shows legal disclaimer screen', async () => {
      await enterPin('111111');
      await waitFor(element(by.id('legal-disclaimer-screen')))
        .toBeVisible()
        .withTimeout(5_000);
      await expectScreenToMatchBaseline('legal-disclaimer');
    });

    it('shows dashboard after onboarding', async () => {
      await element(by.id('legal-accept-checkbox')).tap();
      await element(by.id('legal-continue-button')).tap();
      await waitFor(element(by.id('dashboard-screen')))
        .toBeVisible()
        .withTimeout(10_000);
      await expectScreenToMatchBaseline('dashboard');
    });
  });

  describe('Restore wallet flow', () => {
    beforeAll(async () => {
      await launchAndWaitForWelcome();
    });

    it('shows restore wallet screen', async () => {
      await element(by.id('welcome-restore-toggle')).tap();
      await pause();
      await element(by.id('welcome-restore-seed-button')).tap();
      await waitFor(element(by.id('restore-wallet-screen')))
        .toBeVisible()
        .withTimeout(15_000);
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

    // Setup PIN after restore is visually identical to the create-wallet
    // flow's setup-pin baseline. That screen is already covered above.
    // The continue-button tap is skipped here because it requires scrolling
    // within a Fabric ScrollView which hits a known Detox visibility bug.
  });
});
