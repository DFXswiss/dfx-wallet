import { by, element, waitFor } from 'detox';
import { expectScreenToMatchBaseline } from '../utils/screenshot';
import { launchAndWaitForWelcome, launchWithExistingState } from '../utils/launch';
import { enterPin } from '../utils/pin';

describe('PIN unlock', () => {
  beforeAll(async () => {
    // Complete onboarding first so the app has a stored PIN.
    await launchAndWaitForWelcome();

    await element(by.id('welcome-create-wallet-button')).tap();
    await waitFor(element(by.id('create-wallet-screen')))
      .toBeVisible()
      .withTimeout(30_000);

    await element(by.id('create-wallet-reveal-button')).tap();
    // Wait for seed words to render
    await new Promise((r) => setTimeout(r, 2_000));
    await element(by.id('create-wallet-continue-button')).tap();
    // WDK restoreWallet() initializes all chain wallets which can
    // take over 30s, especially with bitcoin + taproot + plasma.
    await waitFor(element(by.id('setup-pin-screen')))
      .toBeVisible()
      .withTimeout(120_000);

    // Enter + confirm PIN (111111)
    await enterPin('111111');
    await waitFor(element(by.id('setup-pin-confirm-screen')))
      .toBeVisible()
      .withTimeout(30_000);
    await enterPin('111111');

    // Legal disclaimer
    await waitFor(element(by.id('legal-disclaimer-screen')))
      .toBeVisible()
      .withTimeout(30_000);
    await element(by.id('legal-accept-checkbox')).tap();
    await element(by.id('legal-continue-button')).tap();
    await waitFor(element(by.id('dashboard-screen')))
      .toBeVisible()
      .withTimeout(30_000);
  });

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
