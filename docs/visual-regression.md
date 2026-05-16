# Visual Regression Tests

Pixel-by-pixel screenshot comparison for DFX Wallet using [Detox](https://wix.github.io/Detox/) and [jest-image-snapshot](https://github.com/americanexpress/jest-image-snapshot). Test sources live in `e2e/visual/*.test.ts`, baselines in `e2e/__baselines__/*.png`.

## Why Detox + jest-image-snapshot

- Catches visual regressions the [Maestro flows](maestro.md) cannot — colour drift, layout shifts, missing assets, font rendering, etc.
- Runs the same iOS Simulator build Maestro does, so a green Maestro pass + a clean visual run together cover both behaviour and appearance.
- Snapshot diffs are saved as PNG artifacts on failure, so reviewing a regression is a one-glance comparison.

iOS only — Detox on macOS-based runners is stable; the Android equivalent is on the roadmap once Maestro's Android coverage stabilises.

## Test layout

```
e2e/
├── __baselines__/         # committed PNG ground truth
│   ├── welcome.png
│   ├── dashboard.png
│   └── …
├── __diffs__/             # written on failure (gitignored)
├── jest.config.js         # Detox/jest config
├── utils/
│   ├── launch.ts          # launchAndWaitForWelcome / launchWithExistingState
│   ├── pin.ts             # enterPin helper
│   └── screenshot.ts      # expectScreenToMatchBaseline (the matcher)
└── visual/
    └── onboarding.test.ts # the actual `describe` blocks
```

`expectScreenToMatchBaseline(name)` is the only matcher the test files use:

```ts
await element(by.id('welcome-create-wallet-button')).tap();
await waitFor(element(by.id('create-wallet-screen'))).toBeVisible().withTimeout(30_000);
await expectScreenToMatchBaseline('create-wallet');
```

It writes the screenshot to `e2e/__baselines__/create-wallet.png` on first run and compares against it on every subsequent run with a 1% pixel-difference tolerance.

## Running locally

```bash
# One-time install
brew install applesimutils
npx detox build-framework-cache

# Build + run
npm run e2e:build:ios
npm run e2e:test:ios
```

The build uses the `ios.release` Detox configuration in `.detoxrc.js` (which mirrors the Maestro release build). Same `.env.testnet` setup as the Maestro suite — see [docs/maestro.md](maestro.md#test-configuration).

To update a baseline locally after an intentional UI change:

```bash
# Delete the stale baseline, run again, the matcher writes a new one
rm e2e/__baselines__/dashboard.png
npm run e2e:test:ios
```

Then commit the new PNG.

## Feature-gated `describe` blocks

The visual suite is split into MVP and feature-gated `describe` blocks via the same `EXPO_PUBLIC_ENABLE_*` flags the production build reads:

```ts
const featureOn = (envVar: string): boolean => process.env[envVar] === 'true';
const enableRestore = featureOn('EXPO_PUBLIC_ENABLE_RESTORE');
const enablePin = featureOn('EXPO_PUBLIC_ENABLE_PIN');
const enableLegal = featureOn('EXPO_PUBLIC_ENABLE_LEGAL');

const describePinLegal = enablePin && enableLegal ? describe : describe.skip;

describePinLegal('Create wallet flow with PIN + legal', () => {
  // … tests that only make sense when both features are on
});
```

A build with the feature off skips the block instead of running it against the `*Disabled` stub. The MVP `describe`s — Welcome, Create-wallet-MVP, Dashboard-navigation-MVP — stay unconditional and end at the dashboard via the `SetupPinDisabled` redirect.

## Adding a new screenshot

1. Add a new `it` block that taps to the screen and calls `expectScreenToMatchBaseline('your-name')`.
2. Push the branch. The CI run **will fail** because the baseline doesn't exist yet (see [missing-baseline behaviour](#missing-baseline-behaviour-in-ci) below).
3. Download the `detox-artifacts` zip from the failed run:
   ```bash
   gh run download <run-id> --repo DFXswiss/dfx-wallet --dir /tmp/detox
   ```
4. Find your screenshot under `detox-artifacts/ios.release.*/✗ Visual Regression … your test name/your-name.png`.
5. Inspect the PNG — make sure it captures the state you actually want to baseline (not an error screen, not a half-loaded WDK, etc.).
6. Copy it into `e2e/__baselines__/your-name.png` and commit.
7. Re-trigger the visual workflow (see [Triggering visual regression](#triggering-visual-regression) below) — the next run compares against the new baseline.

## Pitfalls

### Missing-baseline behaviour in CI

`jest-image-snapshot` refuses to write new snapshots when `process.env.CI` is set (GitHub Actions sets it automatically). A missing baseline therefore fails the test with:

```
New snapshot was not written. The update flag must be explicitly passed to write a new snapshot.
```

This is by design — it prevents merging a green run that only passes because it silently wrote the baseline. The downside is that adding a baseline always needs the two-pass flow described in [Adding a new screenshot](#adding-a-new-screenshot) above.

### Detox `toBeVisible` is strict (>75% on screen)

Detox treats `toBeVisible` as "more than 75% of the element is on screen". A view that lives below a `ScrollView` or behind a safe-area inset can sit off-screen and time out the matcher even though it is in the view tree:

```ts
// ❌ receive-qr is inside the scroll view, may be partially clipped
await waitFor(element(by.id('receive-qr'))).toBeVisible().withTimeout(30_000);

// ✅ receive-selected-asset-pill is the topmost element on the QR step,
// always fully visible, sufficient signal that the step transition fired
await waitFor(element(by.id('receive-selected-asset-pill'))).toBeVisible().withTimeout(30_000);
```

Pick top-of-screen anchors (header back buttons, the topmost card in a list, the selected-asset pill) over wrapper Views or content sitting deeper in a scroll view.

### `disableSynchronization` + back navigation

`launchAndWaitForWelcome` disables Detox synchronization (the WDK keeps the main queue permanently busy with background work). With synchronization off, Detox does not wait for animations and React-Navigation transitions to settle. The next `tap` after a back-navigation can fire before the destination screen is laid out:

```ts
// ✅ Add a pause() after every back-nav before the next test's first interaction
await element(by.id('receive-screen-back')).tap();
await waitFor(element(by.id('dashboard-balance-toggle'))).toBeVisible().withTimeout(30_000);
await pause();
```

### State carry-over between `describe` blocks

The Create-wallet onboarding runs the WDK's chain init, which can take 90s+ on a fresh install. Re-onboarding for every `describe` block doubles the wall-clock cost, so the existing suite relies on state carry-over: the dashboard left by `Create wallet flow (MVP)` is the entry point for `Dashboard navigation (MVP)`, the onboarded keychain left by `Create wallet flow with PIN + legal` is the entry point for `PIN unlock`:

```ts
// Continues from the Create-wallet-MVP block above without a fresh
// launch — re-onboarding doubles the WDK init cost (~120s).
describe('Dashboard navigation (MVP)', () => {
  it('shows receive screen (asset list)', async () => {
    await element(by.id('dashboard-action-receive')).tap();
    // …
  });
});
```

This is fragile: a failure in the preceding block leaves the next one starting from an unexpected state. Keep the assertions inside each `it` defensive (always `waitFor` before interacting) and document the carry-over with a comment so the next maintainer doesn't add an accidental `beforeAll(launchAndWaitForWelcome)`.

## CI

`.github/workflows/visual-regression.yml` runs the suite on `macos-latest`.

### Triggering visual regression

Since [#149](https://github.com/DFXswiss/dfx-wallet/pull/149) the workflow no longer fires on every `synchronize` push — visual runs are minutes-expensive on macOS runners and most pushes don't change rendering. Triggers:

- `pull_request` events of type `opened`, `reopened`, `ready_for_review`, `labeled` (not `synchronize`)
- `workflow_dispatch` — manual run on any branch
- Nightly schedule (`cron: '0 3 * * *'`) — drift detection on `develop`

To re-trigger after a push:

```bash
# Toggle the needs-visual label to fire the `labeled` event
gh pr edit <pr> --remove-label needs-visual && gh pr edit <pr> --add-label needs-visual
```

### Artifacts

On failure, `e2e/__diffs__/` is uploaded as the `visual-regression-diffs` artifact and the full Detox artifacts directory as `detox-artifacts`. The Detox bundle contains the actual screenshot for each test (regardless of pass/fail) under a directory named after the test:

```
detox-artifacts/ios.release.<ts>Z/
├── ✓ Visual Regression Welcome screen matches baseline/welcome.png
├── ✗ Visual Regression Dashboard navigation (MVP) hides the balance via the eye toggle/dashboard-balance-hidden.png
└── …
```

The `✗`-prefixed directories are the ones you pull into `e2e/__baselines__/` when [adding a new screenshot](#adding-a-new-screenshot).
