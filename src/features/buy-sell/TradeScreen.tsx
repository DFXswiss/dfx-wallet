import { useCallback, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { TradeModeTabs, type TradeMode } from './TradeModeTabs';
import { TradeScreenShell, type TradeShellReport } from './TradeScreenShell';
import { BuyTradeAdapter } from './BuyTradeAdapter';
import { SellTradeAdapter } from './SellTradeAdapter';
import { SwapTradeAdapter } from './SwapTradeAdapter';

const BUY_STEPS = ['amount', 'payment', 'confirm'] as const;
const SELL_STEPS = ['amount', 'bank', 'confirm'] as const;
const SWAP_STEPS = ['amount'] as const;

/** Per-mode shell metadata, resolved via `switch` (not an indexed lookup —
 *  `security/detect-object-injection` flags a `Record<TradeMode, …>[mode]`
 *  access even though `mode` is a closed union, not user input). */
function metaFor(mode: TradeMode): { headerTestID: string; steps: readonly string[] } {
  switch (mode) {
    case 'buy':
      return { headerTestID: 'buy-screen', steps: BUY_STEPS };
    case 'sell':
      return { headerTestID: 'sell-screen', steps: SELL_STEPS };
    case 'swap':
      return { headerTestID: 'swap-header', steps: SWAP_STEPS };
  }
}

function keepNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Shallow-compares the fields that matter for "did the shell actually
 *  change" — deliberately excludes `onBack`. `onBack` is a fresh closure on
 *  every adapter render (it closes over `step`/`router`), so comparing it by
 *  reference would defeat the bail-out below and reintroduce the update
 *  loop this comparison exists to prevent. */
function shellEquals(a: TradeShellReport, b: TradeShellReport): boolean {
  return (
    a.title === b.title &&
    a.headerTestID === b.headerTestID &&
    a.activeStep === b.activeStep &&
    a.showTabs === b.showTabs &&
    // `steps` is always one of the three small literal step lists — joining
    // avoids an indexed comparison (`b.steps[i]`) that
    // `security/detect-object-injection` flags on a variable index, even
    // though it's just an array of short, separator-free step names.
    a.steps.join('|') === b.steps.join('|')
  );
}

export type TradeScreenProps = {
  initialMode: TradeMode;
  asset?: string | undefined;
  chain?: string | undefined;
  targetAddress?: string | undefined;
  targetBlockchain?: string | undefined;
};

export default function TradeScreen({
  initialMode,
  asset,
  chain,
  targetAddress,
  targetBlockchain,
}: TradeScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const defaultShellFor = (mode: TradeMode): TradeShellReport => {
    const meta = metaFor(mode);
    return {
      title: t(`${mode}.title`),
      onBack: () => router.back(),
      headerTestID: meta.headerTestID,
      activeStep: 0,
      showTabs: true,
      steps: meta.steps,
    };
  };

  const [mode, setMode] = useState<TradeMode>(initialMode);
  const [shell, setShell] = useState<TradeShellReport>(() => defaultShellFor(initialMode));

  const handleModeChange = (next: TradeMode) => {
    setMode(next);
    setShell(defaultShellFor(next));
  };

  // Stable identity (empty deps, functional update) so the adapters' own
  // shell-report effects can list it as a dependency without that alone
  // triggering a re-run on every render. The bail-out below (returning the
  // *same* `prev` reference when nothing meaningful changed) is what
  // actually stops an update loop: React skips re-rendering when a state
  // setter is called with a value that's reference-equal to the current
  // state, so a spurious report (same title/step/etc., only a new `onBack`
  // closure) never reaches a render.
  const handleShellChange = useCallback((next: TradeShellReport) => {
    setShell((prev) => (shellEquals(prev, next) ? prev : next));
  }, []);

  // Deep-link params stay on Buy and Sell across in-place tab switches,
  // including a detour through Swap. Only non-empty strings are forwarded.
  // A prefilled target wallet stays gated: that mode shows its banner, and
  // submit still opens the confirm modal before anything is sent.
  const assetParam = keepNonEmptyString(asset);
  const chainParam = keepNonEmptyString(chain);
  const targetAddressParam = keepNonEmptyString(targetAddress);
  const targetBlockchainParam = keepNonEmptyString(targetBlockchain);
  const routeParams = {
    ...(assetParam === undefined ? {} : { asset: assetParam }),
    ...(chainParam === undefined ? {} : { chain: chainParam }),
    ...(targetAddressParam === undefined ? {} : { targetAddress: targetAddressParam }),
    ...(targetBlockchainParam === undefined ? {} : { targetBlockchain: targetBlockchainParam }),
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <TradeScreenShell
        title={shell.title}
        onBack={shell.onBack}
        headerTestID={shell.headerTestID}
        activeStep={shell.activeStep}
        steps={shell.steps}
      >
        {shell.showTabs ? <TradeModeTabs active={mode} onChange={handleModeChange} /> : null}
        {mode === 'buy' ? (
          <BuyTradeAdapter key="buy" {...routeParams} onShellChange={handleShellChange} />
        ) : null}
        {mode === 'sell' ? (
          <SellTradeAdapter key="sell" {...routeParams} onShellChange={handleShellChange} />
        ) : null}
        {mode === 'swap' ? <SwapTradeAdapter key="swap" onShellChange={handleShellChange} /> : null}
      </TradeScreenShell>
    </>
  );
}
