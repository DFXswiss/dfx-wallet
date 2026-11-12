import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useBalancesForWallet } from '@tetherto/wdk-react-native-core';
import { ConfirmTargetWalletModal, Icon, PrimaryButton } from '@/components';
import { GlassInputField } from '@/components/GlassInputField';
import { GlassListGroup } from '@/components/GlassListGroup';
import { DfxAuthGate } from '@/features/dfx-backend/DfxAuthGate';
import type { ChainId } from '@/config/chains';
import {
  formatBalance,
  formatCryptoAmount as fmtCrypto,
  formatFiat as fmtFiat,
  normalizeDecimalAmount,
  toNumeric,
} from '@/config/portfolio-presentation';
import { isLocalSessionEndedError } from '@/features/dfx-backend/session-guard';
import { getAssetMeta, getAssets, WDK_SUPPORTED_CHAINS } from '@/config/tokens';
import { useEnabledChains } from '@/features/portfolio/useEnabledChains';
import { useLinkedWalletReauth } from '@/features/linked-wallets/useLinkedWalletReauth';
import { canAdvanceToPayment, getPaymentInfoErrorCode } from './services/quote-display';
import { useSellFlow } from './useSellFlow';
import { useLinkChainToDfx } from './useLinkChainToDfx';
import { useAuthStore } from '@/store';
import { Typography, useColors, type ThemeColors } from '@/theme';
import { AssetGlyph } from './AssetGlyph';
import { CurrencyGlyph } from './CurrencyGlyph';
import { ReceiveAssetSheet } from './ReceiveAssetSheet';
import { MobileFeesPanel } from './MobileFeesPanel';
import { isAccountGateError, makeTradeQuoteKey, TRADE_STEP_GAP } from './tradePanelStyles';
import { TradeAmountPanels, TradeSelectorPill } from './TradeAmountPanels';
import { FIAT_CURRENCIES, SELL_ASSETS, type SellAsset } from './tradeCatalog';
import { CopyRow, QuoteRow } from './TradeSummaryCard';
import { TargetWalletBanner } from './TargetWalletBanner';
import { makeTradeSharedStyles } from './tradeSharedStyles';
import type { TradeShellReport } from './TradeScreenShell';

type SellStep = 'amount' | 'bank' | 'confirm';

const SELL_STEPS = ['amount', 'bank', 'confirm'] as const;

export type SellTradeAdapterProps = {
  asset?: string | undefined;
  chain?: string | undefined;
  targetAddress?: string | undefined;
  targetBlockchain?: string | undefined;
  /** Reports the shell chrome (title, back action, step progress, whether
   *  the tab bar should show) this adapter wants; `TradeScreen` feeds it
   *  into the one shared shell. */
  onShellChange: (shell: TradeShellReport) => void;
};

export function SellTradeAdapter({
  asset,
  chain,
  targetAddress: targetAddressProp,
  targetBlockchain: targetBlockchainProp,
  onShellChange,
}: SellTradeAdapterProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const sharedStyles = useMemo(() => makeTradeSharedStyles(colors), [colors]);
  const router = useRouter();
  const { t } = useTranslation();
  const targetAddress =
    typeof targetAddressProp === 'string' && targetAddressProp.length > 0
      ? targetAddressProp
      : null;
  const targetBlockchain =
    typeof targetBlockchainProp === 'string' && targetBlockchainProp.length > 0
      ? targetBlockchainProp
      : null;
  const hasTargetWallet = !!targetAddress && !!targetBlockchain;
  const targetAddressShort = targetAddress
    ? targetAddress.length > 18
      ? `${targetAddress.slice(0, 10)}…${targetAddress.slice(-6)}`
      : targetAddress
    : '';
  const { reauthAs } = useLinkedWalletReauth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [paymentInfoError, setPaymentInfoError] = useState<string | null>(null);
  // Same-tick double presses both see confirmLoading === false. The ref
  // closes that window; confirmLoading still guards a press after paint.
  // Taken on submit. Released on a terminal payment-info result, on cancel,
  // and on Back. A replay and an opening auth gate leave it held.
  const submitLockRef = useRef(false);
  // Bumped on every payment submit and on every cancel, so a response from
  // an earlier submit cannot be applied to a later one.
  const submitGenRef = useRef(0);
  // The submit whose payment-info result may still open the confirm step.
  // Null after cancel, Back, or a terminal result. A null payload that opens
  // an auth gate keeps it, so the replay after sign-in can still apply.
  const pendingGenRef = useRef<number | null>(null);
  const unresolvedPaymentRef = useRef(false);
  const [unresolvedPayment, setUnresolvedPayment] = useState(0);
  const { enabledChains } = useEnabledChains();
  const {
    paymentInfo,
    quoteKey,
    errorKey,
    actionErrorKey,
    isLoading,
    error,
    authGate,
    getQuote,
    createPaymentInfo,
    dismissAuthGate,
    cancelAuthGate,
    retryLast,
  } = useSellFlow();
  const [step, setStep] = useState<SellStep>('amount');
  const initialPreselect = useMemo(() => {
    const wantedSymbol = typeof asset === 'string' ? asset.toUpperCase() : null;
    const wantedChain = typeof chain === 'string' ? chain : null;
    if (!wantedSymbol) return null;
    const found = SELL_ASSETS.find((a) => a.symbol === wantedSymbol);
    if (!found) return null;
    const chainIdx = wantedChain ? found.chains.findIndex((c) => c.chain === wantedChain) : 0;
    return { asset: found, chainIdx: chainIdx >= 0 ? chainIdx : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [selectedAsset, setSelectedAsset] = useState<SellAsset | null>(
    initialPreselect?.asset ?? null,
  );
  const [selectedChainIndex, setSelectedChainIndex] = useState(initialPreselect?.chainIdx ?? 0);
  const [selectedTokenIndex, setSelectedTokenIndex] = useState(0);
  const [amount, setAmount] = useState('');
  const [payoutCurrency, setPayoutCurrency] = useState<(typeof FIAT_CURRENCIES)[number]>('CHF');
  const [payPickerOpen, setPayPickerOpen] = useState(false);
  const [iban, setIban] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    setPaymentInfoError(null);
  }, [amount, selectedAsset, selectedChainIndex, selectedTokenIndex, payoutCurrency]);

  const beginPaymentSubmit = (): number => {
    const gen = ++submitGenRef.current;
    pendingGenRef.current = gen;
    submitLockRef.current = true;
    return gen;
  };

  const cancelPaymentSubmit = useCallback((): void => {
    submitGenRef.current += 1;
    pendingGenRef.current = null;
    submitLockRef.current = false;
  }, []);

  const handlePaymentInfoResult = useCallback(
    (info: Awaited<ReturnType<typeof createPaymentInfo>>, gen: number) => {
      // Back or auth-gate cancel may have landed while this request was in
      // flight. A newer submit owns the generation then, and this result
      // must not be applied to it.
      if (pendingGenRef.current === null || pendingGenRef.current !== gen) return;
      if (canAdvanceToPayment(info)) {
        pendingGenRef.current = null;
        submitLockRef.current = false;
        setPaymentInfoError(null);
        setConfirmError(null);
        setConfirmOpen(false);
        setStep('confirm');
        return;
      }

      const errorCode = getPaymentInfoErrorCode(info);
      if (errorCode) {
        pendingGenRef.current = null;
        submitLockRef.current = false;
        setPaymentInfoError(
          errorCode === 'noCode'
            ? t('sell.quoteError.noCode')
            : t([`sell.quoteError.${errorCode}`, 'sell.quoteError.generic'], { code: errorCode }),
        );
        return;
      }

      // null, and no error code on the payload. The hook's auth gate or
      // error lands on the next render; decide there so a stale closure
      // cannot show an error beside the gate. Keep the generation: a gate
      // is not a terminal result, and the replay still has to apply.
      unresolvedPaymentRef.current = true;
      setUnresolvedPayment((n) => n + 1);
    },
    [t],
  );

  const resumeAfterAuth = useCallback(async () => {
    const gen = pendingGenRef.current;
    const result = await retryLast();
    if (result?.kind === 'paymentInfo') {
      if (gen === null || pendingGenRef.current !== gen) return;
      handlePaymentInfoResult(result.info, gen);
    }
    // quote results are applied by the hook's own state
  }, [retryLast, handlePaymentInfoResult]);

  // Replay the last failed call after the user finishes the DFX login flow.
  // retryLast only replays an action that was gated and not cancelled.
  // Read the gate through a ref so this callback stays stable while the
  // modal opens and closes.
  const isDfxAuthenticated = useAuthStore((s) => s.isDfxAuthenticated);
  const authGateRef = useRef(authGate);
  authGateRef.current = authGate;
  useFocusEffect(
    useCallback(() => {
      if (isDfxAuthenticated) {
        void resumeAfterAuth();
        return;
      }
      // Act only when signed out with no gate and a payment submit still pending
      // (the user backed out of login): then drop the replay and unlock below.
      if (authGateRef.current || pendingGenRef.current === null) return;
      cancelAuthGate();
      pendingGenRef.current = null;
      submitLockRef.current = false;
    }, [isDfxAuthenticated, resumeAfterAuth, cancelAuthGate]),
  );

  // One modal at a time: the auth gate replaces the confirm dialog.
  // Closing the dialog must not release the submit lock. The replay of the
  // call that opened the gate still owns it.
  useLayoutEffect(() => {
    if (!authGate || !confirmOpen) return;
    setConfirmOpen(false);
    setConfirmLoading(false);
  }, [authGate, confirmOpen]);

  useEffect(() => {
    if (!unresolvedPaymentRef.current) return;
    if (isLoading) return;
    unresolvedPaymentRef.current = false;
    if (authGate) {
      // Hold the submit lock and the pending generation until cancel or the
      // replay. The gate is the only control the user has until then.
      return;
    }
    pendingGenRef.current = null;
    submitLockRef.current = false;
    setConfirmLoading(false);
    const message = error ?? t('sell.quoteError.noCode');
    if (confirmOpen) setConfirmError(message);
    // The bank step already renders the hook error once this update commits.
    if (!error) setPaymentInfoError(message);
  }, [unresolvedPayment, authGate, error, isLoading, confirmOpen, t]);

  const { linkChainToDfx } = useLinkChainToDfx({ retryLast: resumeAfterAuth });

  const handleLinkChainToDfx = useCallback(
    async (chain: Parameters<typeof linkChainToDfx>[0]) => {
      const gateForLink = authGateRef.current ?? undefined;
      try {
        await linkChainToDfx(chain);
      } catch (linkError) {
        if (isLocalSessionEndedError(linkError)) {
          cancelPaymentSubmit();
          cancelAuthGate(gateForLink);
          return;
        }
        throw linkError;
      }
    },
    [linkChainToDfx, cancelAuthGate, cancelPaymentSubmit],
  );

  // Wallet balances — drive the chain/token chip filter so users only see
  // chains where they actually have funds to sell.
  const assetConfigs = useMemo(() => getAssets(enabledChains), [enabledChains]);
  const wdkAssets = useMemo(
    () => assetConfigs.filter((a) => WDK_SUPPORTED_CHAINS.includes(a.getNetwork() as ChainId)),
    [assetConfigs],
  );
  const { data: balanceResults } = useBalancesForWallet(0, wdkAssets);

  const hasHolding = (network: ChainId, symbol: string): boolean => {
    const found = assetConfigs.find(
      (a) => a.getNetwork() === network && getAssetMeta(a.getId())?.symbol === symbol,
    );
    if (!found) return false;
    const result = balanceResults?.find((r) => r.assetId === found.getId());
    const raw = result?.success ? (result.balance ?? '0') : '0';
    return toNumeric(formatBalance(raw, found.getDecimals())) > 0;
  };

  // Only show chains+tokens the user actually holds funds in.
  const availableChains = useMemo(() => {
    if (!selectedAsset) return [];
    return selectedAsset.chains
      .map((c) => ({
        ...c,
        tokens: c.tokens.filter((tk) => hasHolding(c.chain, tk.assetSymbol)),
      }))
      .filter((c) => c.tokens.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAsset, balanceResults, assetConfigs]);

  // The selected chain is owned by the pay-asset sheet. Availability only
  // gates quoting; it must not change the panel geometry or move the status.
  // eslint-disable-next-line security/detect-object-injection -- selectedChainIndex is bounded by selectedAsset.chains.length
  const selectedChainSpec = selectedAsset?.chains[selectedChainIndex] ?? null;
  // eslint-disable-next-line security/detect-object-injection -- selectedTokenIndex is bounded by tokens.length
  const selectedTokenSpec = selectedChainSpec?.tokens[selectedTokenIndex] ?? null;
  const sellAsset = selectedTokenSpec?.assetSymbol ?? '';
  const blockchain = selectedChainSpec?.blockchain ?? '';
  const selectedAssetIsAvailable =
    !!selectedChainSpec &&
    availableChains.some(
      (c) =>
        c.chain === selectedChainSpec.chain && c.tokens.some((tk) => tk.assetSymbol === sellAsset),
    );
  const hasAnySellBalance =
    balanceResults == null
      ? null
      : SELL_ASSETS.some((candidate) =>
          candidate.chains.some((candidateChain) =>
            candidateChain.tokens.some((token) =>
              hasHolding(candidateChain.chain, token.assetSymbol),
            ),
          ),
        );
  const showNoBalance =
    (!selectedAsset && hasAnySellBalance === false) ||
    (selectedAsset !== null && !selectedAssetIsAvailable);
  const normalizedAmount = normalizeDecimalAmount(amount);
  const numAmount = normalizedAmount === null ? null : Number(normalizedAmount);
  const currentQuoteKey = makeTradeQuoteKey({
    amount: numAmount ?? Number.NaN,
    currency: payoutCurrency,
    asset: sellAsset,
    blockchain,
    chain: selectedChainSpec?.chain ?? '',
  });

  useEffect(() => {
    if (step !== 'amount' || !selectedChainSpec || !selectedAssetIsAvailable) return;
    if (numAmount === null || numAmount <= 0) return;
    const id = setTimeout(() => {
      if (!selectedChainSpec || !selectedAssetIsAvailable) return;
      void getQuote({
        amount: numAmount,
        asset: sellAsset,
        blockchain,
        currency: payoutCurrency,
        chain: selectedChainSpec.chain,
      });
    }, 350);
    return () => clearTimeout(id);
  }, [
    numAmount,
    payoutCurrency,
    sellAsset,
    blockchain,
    step,
    getQuote,
    selectedChainSpec,
    selectedAssetIsAvailable,
  ]);

  // Own callback (real deps) instead of an inline closure in the effect
  // below — keeps `router` out of that effect's dependency list entirely,
  // since the effect body never reads it directly.
  const onBack = useCallback(() => {
    // A payment-info response still in flight must not open confirm.
    // Back from the bank step also drops the auth replay.
    cancelPaymentSubmit();
    if (step === 'bank') {
      cancelAuthGate();
      setStep('amount');
    } else if (step === 'confirm') setStep('bank');
    else router.back();
  }, [step, router, cancelPaymentSubmit, cancelAuthGate]);

  // Report the shell chrome for the step currently active. `t` re-creates
  // on every render in the test mocks (and isn't guaranteed stable in the
  // app either), so this can fire more often than "just on step changes" —
  // that no longer causes an update loop because `onShellChange` (see
  // `TradeScreen`) bails out when the reported shell hasn't actually
  // changed, regardless of how often it's called.
  useEffect(() => {
    onShellChange({
      title: t('sell.title'),
      onBack,
      headerTestID: 'sell-screen',
      activeStep: step === 'amount' ? 0 : step === 'bank' ? 1 : 2,
      showTabs: step === 'amount',
      steps: SELL_STEPS,
    });
  }, [step, t, onBack, onShellChange]);

  const copy = async (label: string, value: string) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1800);
  };

  // /sell/quote returns SellQuoteDto without asset/currency objects — those
  // only land on /sell/paymentInfos. We render the breakdown from local
  // selection state instead, so a valid quote shows up immediately.
  const quoteIsCurrent = !!currentQuoteKey && !isLoading && quoteKey === currentQuoteKey;
  const hasQuote =
    quoteIsCurrent &&
    !!paymentInfo &&
    paymentInfo.isValid &&
    !!paymentInfo.feesTarget &&
    numAmount !== null &&
    numAmount > 0;
  // Empty quote without an explicit error code → the chain still has to
  // be linked. The sell CTA opens the bank step; submitting the IBAN with
  // Continue triggers the linkChain modal and retries the quote.
  const paymentError = quoteIsCurrent ? (paymentInfo?.error ?? paymentInfo?.errors?.[0]) : null;
  const quoteError = quoteIsCurrent && !hasQuote && paymentError ? String(paymentError) : null;
  const quoteErrorIsCurrent = !!currentQuoteKey && !isLoading && errorKey === currentQuoteKey;
  const genericQuoteError = quoteErrorIsCurrent ? error : null;
  const actionErrorIsCurrent =
    !!currentQuoteKey && !isLoading && actionErrorKey === currentQuoteKey;
  const genericActionError = actionErrorIsCurrent ? error : null;
  const authGateIsCurrent = !!authGate && (quoteErrorIsCurrent || actionErrorIsCurrent);
  const needsContinue =
    quoteIsCurrent && !hasQuote && !quoteError && !genericQuoteError && !!paymentInfo;
  const canOpenGate =
    !isLoading &&
    !!currentQuoteKey &&
    (authGateIsCurrent || !!genericQuoteError || needsContinue || isAccountGateError(quoteError));
  const sellAction = t('sell.cta', { asset: sellAsset });
  const quoteHeader = quoteError
    ? t([`sell.quoteError.${quoteError}`, 'sell.quoteError.generic'], { code: quoteError })
    : needsContinue
      ? t('sell.continueHint', { action: sellAction, next: t('common.continue') })
      : isLoading
        ? t('sell.fetchingQuote')
        : hasQuote && paymentInfo && Number.isFinite(paymentInfo.rate) && paymentInfo.rate > 0
          ? t('sell.rateInclFees', {
              asset: sellAsset,
              amount: fmtFiat(1 / paymentInfo.rate),
              currency: payoutCurrency,
            })
          : t('sell.summary');
  const feePanelStatus = quoteError
    ? t([`sell.quoteError.${quoteError}`, 'sell.quoteError.generic'], { code: quoteError })
    : genericQuoteError
      ? genericQuoteError
      : genericActionError
        ? genericActionError
        : needsContinue
          ? t('sell.continueHint', { action: sellAction, next: t('common.continue') })
          : null;
  const minVolume = paymentInfo?.minVolume;
  const maxVolume = paymentInfo?.maxVolume;
  const belowMin =
    minVolume != null && numAmount !== null && numAmount > 0 && numAmount < minVolume;
  const aboveMax = maxVolume != null && numAmount !== null && numAmount > maxVolume;
  const feesTarget = paymentInfo?.feesTarget;

  const renderAmountStepContent = () => (
    <View style={styles.stepContent}>
      {hasTargetWallet ? (
        <TargetWalletBanner testID="sell-target-wallet-banner" addressShort={targetAddressShort} />
      ) : null}
      <TradeAmountPanels
        testID={selectedAsset ? 'sell-amount-panels' : 'sell-amount-panels-empty'}
        flipTestID="sell-flip-to-buy"
        flipAccessibilityLabel={t('sell.flipToBuy')}
        onFlip={() => router.replace('/(auth)/buy')}
        payLabel={<Text style={styles.plabel}>{t('sell.youSell')}</Text>}
        payAmount={
          <TextInput
            testID="sell-amount-input"
            style={styles.amt}
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            editable={!!selectedAsset}
          />
        }
        paySelector={
          <TradeSelectorPill
            onPress={() => setPayPickerOpen(true)}
            testID="sell-pay-asset-pill"
            accessibilityLabel={t('sell.youSell')}
          >
            {sellAsset ? <AssetGlyph symbol={sellAsset} size={32} /> : null}
            <View style={styles.pillMeta}>
              <Text style={styles.pillTitle} numberOfLines={1}>
                {sellAsset || '—'}
              </Text>
              {selectedChainSpec ? (
                <Text style={styles.pillSubtitle} numberOfLines={1}>
                  {selectedChainSpec.label}
                </Text>
              ) : null}
            </View>
          </TradeSelectorPill>
        }
        receiveLabel={
          <View style={styles.prowBetween}>
            <Text style={[styles.plabel, styles.receiveLabelFixed]} numberOfLines={1}>
              {t('sell.youReceive')}
            </Text>
            {isLoading ? (
              <Text style={styles.pmeta} numberOfLines={1} testID="sell-fetching-quote">
                {t('sell.fetchingQuote')}
              </Text>
            ) : null}
          </View>
        }
        receiveAmount={
          <TextInput
            style={styles.amt}
            value={hasQuote && paymentInfo ? fmtFiat(paymentInfo.estimatedAmount) : ''}
            editable={false}
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            testID="sell-receive-amount"
          />
        }
        receiveSelector={
          <TradeSelectorPill
            onPress={() =>
              setPayoutCurrency(
                (cur) =>
                  FIAT_CURRENCIES[(FIAT_CURRENCIES.indexOf(cur) + 1) % FIAT_CURRENCIES.length]!,
              )
            }
            testID="sell-receive-currency-pill"
            accessibilityLabel={t('sell.youReceive')}
          >
            <CurrencyGlyph code={payoutCurrency} size={32} />
            <Text style={styles.pillTitle}>{payoutCurrency}</Text>
          </TradeSelectorPill>
        }
      />

      <ReceiveAssetSheet
        visible={payPickerOpen}
        onClose={() => setPayPickerOpen(false)}
        assets={SELL_ASSETS}
        selectedAssetSymbol={selectedAsset?.symbol}
        selectedChainIndex={selectedChainIndex}
        selectedTokenIndex={selectedTokenIndex}
        titleKey="sell.youSell"
        optionTestIDPrefix="sell-pay-asset-option"
        onSelect={(pickedAsset, chainIndex, tokenIndex) => {
          setSelectedAsset(pickedAsset);
          setSelectedChainIndex(chainIndex);
          setSelectedTokenIndex(tokenIndex);
          setPayPickerOpen(false);
        }}
      />

      <MobileFeesPanel
        mode="sell"
        quote={hasQuote ? paymentInfo : null}
        payAssetCode={sellAsset}
        receiveAssetCode=""
        currencyCode={payoutCurrency}
        expanded={!collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        testID="sell-fees-panel"
        headline={quoteHeader}
        statusMessage={feePanelStatus}
      />

      {showNoBalance ? (
        <Text style={sharedStyles.warning} testID="sell-no-balance">
          {t('sell.noBalance')}
        </Text>
      ) : null}

      {belowMin ? (
        <Text style={sharedStyles.warning}>
          {t('sell.volumeMin', {
            amount: fmtCrypto(minVolume!),
            asset: sellAsset,
          })}
        </Text>
      ) : null}
      {aboveMax ? (
        <Text style={sharedStyles.warning}>
          {t('sell.volumeMax', {
            amount: fmtCrypto(maxVolume!),
            asset: sellAsset,
          })}
        </Text>
      ) : null}

      <PrimaryButton
        testID="sell-cta"
        title={sellAction}
        icon={<Icon name="arrow-right" size={18} color={colors.onPrimary} />}
        onPress={() => {
          if (hasTargetWallet) {
            setConfirmError(null);
            setConfirmOpen(true);
            return;
          }
          setStep('bank');
        }}
        disabled={
          !numAmount ||
          numAmount <= 0 ||
          belowMin ||
          aboveMax ||
          isLoading ||
          (!hasQuote && !canOpenGate)
        }
        loading={isLoading}
      />
      <View style={sharedStyles.securityRow} testID="sell-security-row">
        <Icon name="shield" size={14} color={colors.textTertiary} />
        <Text style={sharedStyles.securityText}>{t('sell.security')}</Text>
      </View>
    </View>
  );

  const renderBankStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepSubtitle}>{t('sell.bankAccount')}</Text>
      <Text style={styles.description}>{t('sell.bankDescription')}</Text>

      <GlassInputField
        style={styles.ibanInputText}
        value={iban}
        onChangeText={setIban}
        placeholder="CH00 0000 0000 0000 0000 0"
        autoCapitalize="characters"
        autoCorrect={false}
      />

      {error ? <Text style={sharedStyles.errorText}>{error}</Text> : null}
      {paymentInfoError ? <Text style={sharedStyles.errorText}>{paymentInfoError}</Text> : null}

      <View style={sharedStyles.spacer} />

      <PrimaryButton
        title={t('common.continue')}
        onPress={async () => {
          if (!selectedChainSpec || numAmount === null || numAmount <= 0) return;
          if (submitLockRef.current) return;
          const gen = beginPaymentSubmit();
          setPaymentInfoError(null);
          const info = await createPaymentInfo({
            amount: numAmount,
            asset: sellAsset,
            blockchain,
            currency: payoutCurrency,
            iban: iban.replace(/\s/g, ''),
            chain: selectedChainSpec.chain,
          });
          if (pendingGenRef.current !== gen) return;
          handlePaymentInfoResult(info, gen);
        }}
        disabled={iban.replace(/\s/g, '').length < 15}
        loading={isLoading}
      />
    </View>
  );

  const renderConfirmStep = () =>
    paymentInfo ? (
      <View style={styles.stepContent}>
        <Text style={styles.stepSubtitle}>{t('sell.confirmSale')}</Text>

        <GlassListGroup style={sharedStyles.bankCard}>
          <CopyRow
            label={t('sell.depositAddress')}
            value={paymentInfo.depositAddress}
            copied={copiedField === 'addr'}
            onCopy={() => copy('addr', paymentInfo.depositAddress)}
            highlight
          />
        </GlassListGroup>

        <GlassListGroup style={sharedStyles.quoteCard}>
          <Text style={sharedStyles.quoteTitle}>{t('sell.summary')}</Text>
          <QuoteRow
            label={t('sell.youSell')}
            value={`${fmtCrypto(paymentInfo.amount)} ${paymentInfo.asset.name}`}
          />
          {Number.isFinite(paymentInfo.exchangeRate) && paymentInfo.exchangeRate > 0 ? (
            <QuoteRow
              label={t('sell.exchangeRate')}
              value={`1 ${paymentInfo.asset.name} = ${fmtFiat(
                1 / paymentInfo.exchangeRate,
              )} ${paymentInfo.currency.name}`}
            />
          ) : null}
          {feesTarget ? (
            <>
              <QuoteRow
                label={t('sell.feeDfx')}
                value={`${(paymentInfo.fees.rate * 100).toFixed(2)}%`}
                {...(feesTarget.dfx > 0
                  ? { sub: `${fmtFiat(feesTarget.dfx)} ${paymentInfo.currency.name}` }
                  : {})}
              />
              {feesTarget.network > 0 ? (
                <QuoteRow
                  label={t('sell.feeNetwork')}
                  value={`${fmtFiat(feesTarget.network)} ${paymentInfo.currency.name}`}
                />
              ) : null}
              {feesTarget.fixed > 0 ? (
                <QuoteRow
                  label={t('sell.feeFixed')}
                  value={`${fmtFiat(feesTarget.fixed)} ${paymentInfo.currency.name}`}
                />
              ) : null}
              {feesTarget.bank > 0 ? (
                <QuoteRow
                  label={t('sell.feeBank')}
                  value={`${fmtFiat(feesTarget.bank)} ${paymentInfo.currency.name}`}
                />
              ) : null}
              <QuoteRow
                label={t('sell.feeTotal')}
                value={`${fmtFiat(feesTarget.total)} ${paymentInfo.currency.name}`}
                emphasis
              />
            </>
          ) : null}
          <View style={sharedStyles.quoteDivider} />
          <QuoteRow
            label={t('sell.youReceive')}
            value={`${fmtFiat(paymentInfo.estimatedAmount)} ${paymentInfo.currency.name}`}
            emphasis
          />
          <View style={sharedStyles.quoteDivider} />
          <QuoteRow label={t('sell.payoutTo')} value={paymentInfo.beneficiary?.iban ?? iban} />
        </GlassListGroup>

        <Text style={sharedStyles.hint}>{t('sell.transferHint')}</Text>

        <View style={sharedStyles.spacer} />

        <PrimaryButton title={t('common.done')} onPress={() => router.back()} />
      </View>
    ) : null;

  return (
    <>
      {step === 'amount' && renderAmountStepContent()}
      {step === 'bank' && renderBankStep()}
      {step === 'confirm' && renderConfirmStep()}
      <DfxAuthGate
        gate={authGateIsCurrent ? authGate : null}
        onClose={() => {
          dismissAuthGate(authGate ?? undefined);
        }}
        onCancel={() => {
          cancelPaymentSubmit();
          cancelAuthGate(authGate ?? undefined);
        }}
        onLinkChain={handleLinkChainToDfx}
      />
      <ConfirmTargetWalletModal
        visible={confirmOpen}
        flow="sell"
        assetLabel={sellAsset || ''}
        walletAddressShort={targetAddressShort}
        walletBlockchain={targetBlockchain ?? ''}
        loading={confirmLoading}
        error={confirmError}
        onCancel={() => {
          if (confirmLoading) return;
          cancelPaymentSubmit();
          cancelAuthGate();
          setConfirmOpen(false);
          setConfirmError(null);
        }}
        onConfirm={async () => {
          if (confirmLoading || submitLockRef.current) return;
          if (!targetAddress || !targetBlockchain) return;
          submitLockRef.current = true;
          setConfirmLoading(true);
          setConfirmError(null);
          try {
            const reauth = await reauthAs(targetAddress, targetBlockchain);
            if (!reauth.ok) {
              if ('cancelled' in reauth) {
                setConfirmOpen(false);
                return;
              }
              setConfirmError(
                t([`linkedWallet.reauthError.${reauth.error}`, 'linkedWallet.reauthError.generic']),
              );
              return;
            }
            setConfirmOpen(false);
            setStep('bank');
          } catch (err) {
            if (isLocalSessionEndedError(err)) {
              setConfirmOpen(false);
              return;
            }
            setConfirmError(
              err instanceof Error ? err.message : t('linkedWallet.reauthError.generic'),
            );
          } finally {
            submitLockRef.current = false;
            setConfirmLoading(false);
          }
        }}
      />
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    stepContent: { gap: TRADE_STEP_GAP },
    stepSubtitle: {
      ...Typography.bodyLarge,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    description: {
      ...Typography.bodyMedium,
      color: colors.textSecondary,
    },
    prowBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      minWidth: 0,
      gap: 8,
    },
    plabel: {
      fontSize: 12.5,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    receiveLabelFixed: {
      flexShrink: 0,
    },
    pmeta: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: 12,
      color: colors.textTertiary,
    },
    amt: {
      flex: 1,
      minWidth: 0,
      fontSize: 33,
      fontWeight: '700',
      letterSpacing: -0.5,
      color: colors.text,
      padding: 0,
    },
    pillMeta: { flex: 1, flexShrink: 1, minWidth: 0 },
    pillTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.2,
    },
    pillSubtitle: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textTertiary,
      marginTop: 0,
    },
    ibanInputText: {
      ...Typography.bodyLarge,
      letterSpacing: 1,
    },
  });
