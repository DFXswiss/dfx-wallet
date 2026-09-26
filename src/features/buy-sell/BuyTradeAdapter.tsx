import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { ConfirmTargetWalletModal, Icon, PrimaryButton } from '@/components';
import { DfxAuthGate } from '@/features/dfx-backend/DfxAuthGate';
import {
  formatFiat as fmtFiat,
  formatCryptoAmount as fmtCrypto,
  SYMBOL_GLYPH,
} from '@/config/portfolio-presentation';
import { useLinkedWalletReauth } from '@/features/linked-wallets/useLinkedWalletReauth';
import { useBuyFlow } from './useBuyFlow';
import { useLinkChainToDfx } from './useLinkChainToDfx';
import { useAuthStore } from '@/store';
import { Typography, useColors, type ThemeColors } from '@/theme';
import { PayCurrencySheet } from './PayCurrencySheet';
import { ReceiveAssetSheet } from './ReceiveAssetSheet';
import { AssetGlyph } from './AssetGlyph';
import { CurrencyGlyph } from './CurrencyGlyph';
import { MobileFeesPanel } from './MobileFeesPanel';
import { isAccountGateError, makeTradeQuoteKey, TRADE_STEP_GAP } from './tradePanelStyles';
import { TradeAmountPanels, TradeSelectorPill } from './TradeAmountPanels';
import { CURRENCIES, BUY_ASSETS, type BuyAsset } from './tradeCatalog';
import { CopyRow, QuoteRow } from './TradeSummaryCard';
import { TargetWalletBanner } from './TargetWalletBanner';
import { makeTradeSharedStyles } from './tradeSharedStyles';
import type { TradeShellReport } from './TradeScreenShell';

type BuyStep = 'amount' | 'payment' | 'confirm';

const BUY_STEPS = ['amount', 'payment', 'confirm'] as const;

export type BuyTradeAdapterProps = {
  asset?: string | undefined;
  chain?: string | undefined;
  targetAddress?: string | undefined;
  targetBlockchain?: string | undefined;
  /** Reports the shell chrome (title, back action, step progress, whether
   *  the tab bar should show) this adapter wants; `TradeScreen` feeds it
   *  into the one shared shell. */
  onShellChange: (shell: TradeShellReport) => void;
};

export function BuyTradeAdapter({
  asset,
  chain,
  targetAddress: targetAddressProp,
  targetBlockchain: targetBlockchainProp,
  onShellChange,
}: BuyTradeAdapterProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const sharedStyles = useMemo(() => makeTradeSharedStyles(colors), [colors]);
  const router = useRouter();
  const { t } = useTranslation();
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
    confirmPayment,
    dismissAuthGate,
    retryLast,
  } = useBuyFlow();
  const { linkChainToDfx } = useLinkChainToDfx({ retryLast });
  const [step, setStep] = useState<BuyStep>('amount');

  // When the user opened the buy screen by tapping a linked-wallet card in
  // Portfolio, both `targetAddress` and `targetBlockchain` are present. The
  // amount step shows a banner; the Continue button opens a confirmation
  // modal that re-authenticates as the target wallet's owner before posting
  // /buy/paymentInfos so the bank wire credits the chosen wallet.
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
  const initialPreselect = useMemo(() => {
    const wantedSymbol = typeof asset === 'string' ? asset.toUpperCase() : null;
    const wantedChain = typeof chain === 'string' ? chain : null;
    if (!wantedSymbol) return null;
    const found = BUY_ASSETS.find((a) => a.symbol === wantedSymbol);
    if (!found) return null;
    const chainIdx = wantedChain ? found.chains.findIndex((c) => c.chain === wantedChain) : 0;
    return { asset: found, chainIdx: chainIdx >= 0 ? chainIdx : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [selectedAsset, setSelectedAsset] = useState<BuyAsset | null>(
    initialPreselect?.asset ?? BUY_ASSETS[0] ?? null,
  );
  const [selectedChainIndex, setSelectedChainIndex] = useState(initialPreselect?.chainIdx ?? 0);
  const [selectedTokenIndex, setSelectedTokenIndex] = useState(0);
  const [amount, setAmount] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<(typeof CURRENCIES)[number]>('CHF');
  const [payPickerOpen, setPayPickerOpen] = useState(false);
  const [receivePickerOpen, setReceivePickerOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);

  // After the user goes through the DFX login flow we land back on this
  // screen; replay the failed call so they don't have to retap "Continue".
  const isDfxAuthenticated = useAuthStore((s) => s.isDfxAuthenticated);
  useFocusEffect(
    useCallback(() => {
      if (isDfxAuthenticated) {
        void retryLast();
      }
    }, [isDfxAuthenticated, retryLast]),
  );

  // eslint-disable-next-line security/detect-object-injection -- selectedChainIndex is bounded by chains.length
  const selectedChainSpec = selectedAsset?.chains[selectedChainIndex] ?? null;
  // eslint-disable-next-line security/detect-object-injection -- selectedTokenIndex is bounded by tokens.length
  const selectedTokenSpec = selectedChainSpec?.tokens[selectedTokenIndex] ?? null;
  const targetAsset = selectedTokenSpec?.assetSymbol ?? '';
  const blockchain = selectedChainSpec?.blockchain ?? '';
  const currentQuoteKey = makeTradeQuoteKey({
    amount: parseFloat(amount),
    currency: selectedCurrency,
    asset: targetAsset,
    blockchain,
    chain: selectedChainSpec?.chain ?? '',
  });

  // Live quote: fetch a fresh exchange-rate + fee preview whenever the user
  // changes amount, currency, or target chain. Debounced so we don't hammer
  // the API on every keystroke.
  useEffect(() => {
    if (step !== 'amount' || !selectedChainSpec) return;
    if (selectedChainSpec.unsupported) return;
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;
    const id = setTimeout(() => {
      if (!selectedChainSpec || selectedChainSpec.unsupported) return;
      void getQuote({
        amount: numAmount,
        currency: selectedCurrency,
        asset: targetAsset,
        blockchain,
        chain: selectedChainSpec.chain,
      });
    }, 350);
    return () => clearTimeout(id);
  }, [amount, selectedCurrency, targetAsset, blockchain, step, getQuote, selectedChainSpec]);

  // Own callback (real deps) instead of an inline closure in the effect
  // below — keeps `router` out of that effect's dependency list entirely,
  // since the effect body never reads it directly.
  const onBack = useCallback(() => {
    if (step === 'payment') setStep('amount');
    else router.back();
  }, [step, router]);

  // Report the shell chrome for the step currently active. Runs after every
  // step change so the one shared `TradeScreenShell` in `TradeScreen` always
  // shows the right title/back-action/progress for Buy. `t` re-creates on
  // every render in the test mocks (and isn't guaranteed stable in the app
  // either), so this can fire more often than "just on step changes" — that
  // no longer causes an update loop because `onShellChange` (see
  // `TradeScreen`) bails out when the reported shell hasn't actually
  // changed, regardless of how often it's called.
  useEffect(() => {
    onShellChange({
      title: t('buy.title'),
      onBack,
      headerTestID: 'buy-screen',
      activeStep: step === 'amount' ? 0 : step === 'payment' ? 1 : 2,
      showTabs: step === 'amount',
      steps: BUY_STEPS,
    });
  }, [step, t, onBack, onShellChange]);

  const copy = async (label: string, value: string) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1800);
  };

  // /buy/quote returns DFX' BuyQuoteDto which omits the asset/currency
  // objects (they only land on the /buy/paymentInfos response). We always
  // know what the user picked locally, so render the breakdown as soon as
  // the response is `isValid: true` with a fee block — no need to wait
  // for `paymentInfo.asset` to materialise (it never will on /quote).
  const quoteIsCurrent = !!currentQuoteKey && !isLoading && quoteKey === currentQuoteKey;
  const hasQuote =
    quoteIsCurrent &&
    !!paymentInfo &&
    paymentInfo.isValid &&
    !!paymentInfo.fees &&
    parseFloat(amount) > 0;
  // DFX returns 200 with `error` set for soft validation failures (e.g.
  // KycRequired, AssetUnsupported). We need to surface that to the user
  // instead of getting stuck on "Angebot wird berechnet …".
  // DFX sometimes returns 200 with `isValid: false` and no error code —
  // typically when the chain isn't yet attached to the user's account.
  // Tapping Weiter triggers /buy/paymentInfos which fires the linkChain
  // gate, runs the modal sign flow, and auto-refreshes the quote. Tell
  // the user to do exactly that instead of bouncing off a generic error.
  const unsupportedChain = !!selectedChainSpec?.unsupported;
  const quoteErrorIsCurrent = !!currentQuoteKey && !isLoading && errorKey === currentQuoteKey;
  const quoteError =
    quoteIsCurrent && !hasQuote && paymentInfo?.error ? String(paymentInfo.error) : null;
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
  // Open the Angebot card as soon as the user has typed a positive amount,
  // even before the first /buy/quote round-trip returns. Keeps the previous
  // quote on screen while a refresh is in flight so the user always sees
  // *something* and can read the change as it lands.
  // App2 keeps the fee panel directly below the amount panels, including before
  // the first quote has arrived. The empty state is rendered by the panel itself.
  const feePanelStatus = unsupportedChain
    ? t('buy.chainUnsupported')
    : quoteError
      ? t([`buy.quoteError.${quoteError}`, 'buy.quoteError.generic'], { code: quoteError })
      : genericQuoteError
        ? genericQuoteError
        : genericActionError
          ? genericActionError
          : needsContinue
            ? t('buy.continueHint')
            : null;
  const minVolume = paymentInfo?.minVolume;
  const maxVolume = paymentInfo?.maxVolume;
  const numAmount = parseFloat(amount);
  const belowMin = minVolume != null && numAmount > 0 && numAmount < minVolume;
  const aboveMax = maxVolume != null && numAmount > maxVolume;

  const renderAmountStepContent = () => (
    <View style={styles.stepContent}>
      {hasTargetWallet ? (
        <TargetWalletBanner testID="buy-target-wallet-banner" addressShort={targetAddressShort} />
      ) : null}
      <TradeAmountPanels
        testID="buy-amount-panels"
        flipTestID="buy-flip-to-sell"
        flipAccessibilityLabel={t('buy.flipToSell')}
        onFlip={() => router.replace('/(auth)/sell')}
        payLabel={<Text style={styles.plabel}>{t('buy.youPay')}</Text>}
        payAmount={
          <TextInput
            style={styles.amt}
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            testID="buy-pay-amount"
          />
        }
        paySelector={
          <TradeSelectorPill
            onPress={() => setPayPickerOpen(true)}
            testID="buy-pay-currency-pill"
            accessibilityLabel={t('buy.youPay')}
          >
            <CurrencyGlyph code={selectedCurrency} size={32} />
            <Text style={styles.pillTitle}>{selectedCurrency}</Text>
          </TradeSelectorPill>
        }
        receiveLabel={
          <View style={styles.prowBetween}>
            <Text style={styles.plabel}>{t('buy.receiveLabel')}</Text>
            {isLoading && !unsupportedChain ? (
              <Text style={styles.pmeta}>{t('buy.fetchingQuote')}</Text>
            ) : null}
          </View>
        }
        receiveAmount={
          <TextInput
            style={styles.amt}
            value={hasQuote && paymentInfo ? fmtCrypto(paymentInfo.estimatedAmount) : ''}
            editable={false}
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            testID="buy-receive-amount"
          />
        }
        receiveSelector={
          <TradeSelectorPill
            onPress={() => setReceivePickerOpen(true)}
            testID="buy-receive-asset-pill"
            accessibilityLabel={t('buy.receiveLabel')}
          >
            <AssetGlyph symbol={targetAsset || selectedAsset?.symbol || ''} size={32} />
            <View style={styles.pillMeta}>
              <Text style={styles.pillTitle} numberOfLines={1}>
                {targetAsset || selectedAsset?.symbol || ''}
              </Text>
              {selectedChainSpec ? (
                <Text style={styles.pillSubtitle} numberOfLines={1}>
                  {selectedChainSpec.label}
                </Text>
              ) : null}
            </View>
          </TradeSelectorPill>
        }
      />

      <View style={styles.quickRow}>
        {['50', '100', '250', '500'].map((val) => (
          <Pressable
            key={val}
            testID={`buy-preset-${val}`}
            style={styles.quickAmount}
            onPress={() => setAmount(val)}
          >
            <Text style={styles.quickAmountText}>
              {`${SYMBOL_GLYPH.get(selectedCurrency) ?? selectedCurrency}${val}`}
            </Text>
          </Pressable>
        ))}
      </View>

      <PayCurrencySheet
        visible={payPickerOpen}
        onClose={() => setPayPickerOpen(false)}
        currencies={CURRENCIES}
        selected={selectedCurrency}
        onSelect={(currency) => {
          setSelectedCurrency(currency);
          setPayPickerOpen(false);
        }}
      />
      <ReceiveAssetSheet
        visible={receivePickerOpen}
        onClose={() => setReceivePickerOpen(false)}
        assets={BUY_ASSETS}
        selectedAssetSymbol={selectedAsset?.symbol}
        selectedChainIndex={selectedChainIndex}
        selectedTokenIndex={selectedTokenIndex}
        onSelect={(pickedAsset, chainIndex, tokenIndex) => {
          setSelectedAsset(pickedAsset);
          setSelectedChainIndex(chainIndex);
          setSelectedTokenIndex(tokenIndex);
          setReceivePickerOpen(false);
        }}
      />

      {selectedAsset ? (
        <>
          <MobileFeesPanel
            mode="buy"
            quote={hasQuote ? paymentInfo : null}
            payAssetCode=""
            receiveAssetCode={targetAsset}
            currencyCode={selectedCurrency}
            expanded={!collapsed}
            onToggle={() => setCollapsed((value) => !value)}
            testID="buy-fees-panel"
            statusMessage={feePanelStatus}
          />

          {belowMin ? (
            <Text style={sharedStyles.warning}>
              {t('buy.volumeMin', {
                amount: fmtFiat(minVolume!),
                currency: selectedCurrency,
              })}
            </Text>
          ) : null}
          {aboveMax ? (
            <Text style={sharedStyles.warning}>
              {t('buy.volumeMax', {
                amount: fmtFiat(maxVolume!),
                currency: selectedCurrency,
              })}
            </Text>
          ) : null}

          <View testID="buy-payment-method-row" style={styles.paymentMethodRow}>
            <View style={styles.paymentMethodIcon}>
              <Icon name="wallet" size={18} color={colors.primary} />
            </View>
            <View style={styles.paymentMethodBody}>
              <Text style={styles.paymentMethodTitle}>{t('buy.paymentMethodSepa')}</Text>
              <Text style={styles.paymentMethodHint}>{t('buy.paymentMethodSepaHint')}</Text>
            </View>
          </View>

          <View style={sharedStyles.spacer} />

          <PrimaryButton
            testID="buy-cta"
            title={`${t('buy.title')} ${targetAsset}`}
            icon={<Icon name="arrow-right" size={18} color={colors.white} />}
            onPress={async () => {
              if (!selectedChainSpec) return;
              if (hasTargetWallet) {
                // Linked-wallet flow: gate the bank-data step behind a
                // confirmation modal so the user verifies asset+wallet
                // pairing once more. The actual /buy/paymentInfos call
                // fires from the modal's onConfirm after the DFX session
                // pivots to the target wallet's owner.
                setConfirmError(null);
                setConfirmOpen(true);
                return;
              }
              const info = await createPaymentInfo({
                amount: numAmount,
                currency: selectedCurrency,
                asset: targetAsset,
                blockchain,
                chain: selectedChainSpec.chain,
              });
              if (info) setStep('payment');
            }}
            disabled={
              !numAmount ||
              numAmount <= 0 ||
              belowMin ||
              aboveMax ||
              unsupportedChain ||
              isLoading ||
              (!hasQuote && !canOpenGate)
            }
            loading={isLoading}
          />
          <View style={sharedStyles.securityRow} testID="buy-security-row">
            <Icon name="shield" size={14} color={colors.textTertiary} />
            <Text style={sharedStyles.securityText}>{t('buy.security')}</Text>
          </View>
        </>
      ) : null}
    </View>
  );

  const renderPaymentStep = () =>
    paymentInfo ? (
      <View style={styles.stepContent}>
        <Text style={styles.stepSubtitle}>{t('buy.paymentInfo')}</Text>

        <View style={sharedStyles.bankCard}>
          <CopyRow
            label={t('buy.iban')}
            value={paymentInfo.iban}
            copied={copiedField === 'iban'}
            onCopy={() => copy('iban', paymentInfo.iban)}
          />
          <CopyRow
            label={t('buy.bic')}
            value={paymentInfo.bic}
            copied={copiedField === 'bic'}
            onCopy={() => copy('bic', paymentInfo.bic)}
          />
          <CopyRow
            label={t('buy.recipient')}
            value={paymentInfo.name || 'DFX AG'}
            copied={copiedField === 'name'}
            onCopy={() => copy('name', paymentInfo.name || 'DFX AG')}
          />
          <CopyRow
            label={t('buy.reference')}
            value={paymentInfo.remittanceInfo}
            copied={copiedField === 'ref'}
            onCopy={() => copy('ref', paymentInfo.remittanceInfo)}
            highlight
          />
        </View>

        <View style={sharedStyles.quoteCard}>
          <Text style={sharedStyles.quoteTitle}>{t('buy.summary')}</Text>
          <QuoteRow
            label={t('common.amount')}
            value={`${fmtFiat(paymentInfo.amount)} ${paymentInfo.currency.name}`}
          />
          <QuoteRow
            label={t('buy.exchangeRate')}
            value={`1 ${paymentInfo.currency.name} = ${fmtCrypto(1 / paymentInfo.exchangeRate)} ${paymentInfo.asset.name}`}
          />
          <View style={sharedStyles.quoteDivider} />
          <QuoteRow
            label={t('buy.youReceive')}
            value={`${fmtCrypto(paymentInfo.estimatedAmount)} ${paymentInfo.asset.name}`}
            emphasis
          />
        </View>

        <Text style={sharedStyles.hint}>{t('buy.transfer')}</Text>

        <View style={sharedStyles.spacer} />

        <PrimaryButton
          title={t('buy.confirmTransfer')}
          onPress={async () => {
            const confirmed = await confirmPayment(paymentInfo.id);
            if (confirmed) setStep('confirm');
          }}
          loading={isLoading}
        />
      </View>
    ) : null;

  const renderConfirmStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.successBlock}>
        <Text style={styles.successIcon}>{'✅'}</Text>
        <Text style={styles.successTitle}>{t('buy.confirm')}</Text>
        <Text style={styles.successDescription}>{t('buy.confirmDescription')}</Text>
      </View>

      <View style={sharedStyles.spacer} />

      <PrimaryButton title={t('common.done')} onPress={() => router.back()} />
    </View>
  );

  return (
    <>
      {step === 'amount' && renderAmountStepContent()}
      {step === 'payment' && renderPaymentStep()}
      {step === 'confirm' && renderConfirmStep()}
      <DfxAuthGate
        gate={authGateIsCurrent ? authGate : null}
        onClose={dismissAuthGate}
        onLinkChain={linkChainToDfx}
      />
      <ConfirmTargetWalletModal
        visible={confirmOpen}
        flow="buy"
        assetLabel={targetAsset || ''}
        walletAddressShort={targetAddressShort}
        walletBlockchain={targetBlockchain ?? ''}
        loading={confirmLoading}
        error={confirmError}
        onCancel={() => {
          if (confirmLoading) return;
          setConfirmOpen(false);
          setConfirmError(null);
        }}
        onConfirm={async () => {
          if (!selectedChainSpec || !targetAddress || !targetBlockchain) return;
          setConfirmLoading(true);
          setConfirmError(null);
          try {
            const reauth = await reauthAs(targetAddress, targetBlockchain);
            if (!reauth.ok) {
              setConfirmError(
                t([`linkedWallet.reauthError.${reauth.error}`, 'linkedWallet.reauthError.generic']),
              );
              return;
            }
            const info = await createPaymentInfo({
              amount: numAmount,
              currency: selectedCurrency,
              asset: targetAsset,
              blockchain,
              chain: selectedChainSpec.chain,
            });
            if (info) {
              setConfirmOpen(false);
              setStep('payment');
            }
          } catch (err) {
            setConfirmError(
              err instanceof Error ? err.message : t('linkedWallet.reauthError.generic'),
            );
          } finally {
            setConfirmLoading(false);
          }
        }}
      />
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    stepContent: {
      gap: TRADE_STEP_GAP,
    },
    stepSubtitle: {
      ...Typography.bodyLarge,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    prowBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    plabel: {
      fontSize: 12.5,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    pmeta: {
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
    pillMeta: {
      flex: 1,
      flexShrink: 1,
    },
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
    quickRow: {
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'space-between',
    },
    quickAmount: {
      flex: 1,
      minHeight: 44,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.background,
      alignItems: 'center',
    },
    quickAmountText: {
      ...Typography.bodySmall,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    paymentMethodRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.cardOverlay,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    paymentMethodIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    paymentMethodBody: {
      flex: 1,
      gap: 2,
    },
    paymentMethodTitle: {
      ...Typography.bodyMedium,
      fontWeight: '600',
      color: colors.text,
    },
    paymentMethodHint: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
    },
    successBlock: {
      alignItems: 'center',
      paddingVertical: 48,
      gap: 16,
    },
    successIcon: {
      fontSize: 64,
    },
    successTitle: {
      ...Typography.headlineMedium,
      color: colors.text,
    },
    successDescription: {
      ...Typography.bodyLarge,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 16,
    },
  });
