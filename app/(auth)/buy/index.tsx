import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useAccount } from '@tetherto/wdk-react-native-core';
import { AppHeader, DfxAuthGate, Icon, PrimaryButton } from '@/components';
import type { ChainId } from '@/config/chains';
import {
  formatFiat as fmtFiat,
  formatCryptoAmount as fmtCrypto,
} from '@/config/portfolio-presentation';
import { useBuyFlow, useLdsWallet } from '@/hooks';
import { dfxAuthService } from '@/services/dfx';
import { useAuthStore } from '@/store';
import { DfxColors, Typography } from '@/theme';

type BuyStep = 'amount' | 'payment' | 'confirm';

// DFX bank-transfer Buy only supports EUR (SEPA) and CHF (SIC) — USD removed.
const CURRENCIES = ['CHF', 'EUR'] as const;

// What the user is buying. Each asset maps to one or more chains, and each
// chain offers one or more concrete tokens (e.g. USD on Ethereum has both
// USDT and USDC; CHF has only ZCHF; BTC has only the native asset).
type BuyChain = {
  chain: ChainId;
  label: string;
  blockchain: string;
  tokens: { assetSymbol: string; label: string }[];
};
type BuyAsset = {
  symbol: string;
  label: string;
  chains: BuyChain[];
};

const USD_TOKENS = [
  { assetSymbol: 'USDT', label: 'USDT' },
  { assetSymbol: 'USDC', label: 'USDC' },
];

const BUY_ASSETS: BuyAsset[] = [
  {
    symbol: 'BTC',
    label: 'Bitcoin',
    chains: [
      {
        chain: 'bitcoin',
        label: 'SegWit',
        blockchain: 'Bitcoin',
        tokens: [{ assetSymbol: 'BTC', label: 'BTC' }],
      },
      {
        chain: 'bitcoin-taproot',
        label: 'Taproot',
        // Taproot in dfx-wallet is the DFX Lightning Address (lightning.space-
        // managed Taproot Asset channels), so it maps to DFX's `Lightning`
        // blockchain on the buy/sell side.
        blockchain: 'Lightning',
        tokens: [{ assetSymbol: 'BTC', label: 'BTC' }],
      },
      {
        chain: 'spark',
        label: 'Lightning',
        blockchain: 'Spark',
        tokens: [{ assetSymbol: 'BTC', label: 'BTC' }],
      },
      {
        chain: 'ethereum',
        label: 'Ethereum',
        blockchain: 'Ethereum',
        tokens: [{ assetSymbol: 'WBTC', label: 'WBTC' }],
      },
      {
        chain: 'arbitrum',
        label: 'Arbitrum',
        blockchain: 'Arbitrum',
        tokens: [{ assetSymbol: 'WBTC', label: 'WBTC' }],
      },
      {
        chain: 'polygon',
        label: 'Polygon',
        blockchain: 'Polygon',
        tokens: [{ assetSymbol: 'WBTC', label: 'WBTC' }],
      },
      {
        chain: 'base',
        label: 'Base',
        blockchain: 'Base',
        tokens: [{ assetSymbol: 'cbBTC', label: 'cbBTC' }],
      },
    ],
  },
  {
    symbol: 'CHF',
    label: 'Frankencoin',
    chains: [
      {
        chain: 'ethereum',
        label: 'Ethereum',
        blockchain: 'Ethereum',
        tokens: [{ assetSymbol: 'ZCHF', label: 'ZCHF' }],
      },
      {
        chain: 'arbitrum',
        label: 'Arbitrum',
        blockchain: 'Arbitrum',
        tokens: [{ assetSymbol: 'ZCHF', label: 'ZCHF' }],
      },
      {
        chain: 'polygon',
        label: 'Polygon',
        blockchain: 'Polygon',
        tokens: [{ assetSymbol: 'ZCHF', label: 'ZCHF' }],
      },
      {
        chain: 'base',
        label: 'Base',
        blockchain: 'Base',
        tokens: [{ assetSymbol: 'ZCHF', label: 'ZCHF' }],
      },
    ],
  },
  {
    symbol: 'EUR',
    label: 'dEURO',
    chains: [
      {
        chain: 'ethereum',
        label: 'Ethereum',
        blockchain: 'Ethereum',
        tokens: [{ assetSymbol: 'dEURO', label: 'dEURO' }],
      },
      {
        chain: 'arbitrum',
        label: 'Arbitrum',
        blockchain: 'Arbitrum',
        tokens: [{ assetSymbol: 'dEURO', label: 'dEURO' }],
      },
      {
        chain: 'polygon',
        label: 'Polygon',
        blockchain: 'Polygon',
        tokens: [{ assetSymbol: 'dEURO', label: 'dEURO' }],
      },
      {
        chain: 'base',
        label: 'Base',
        blockchain: 'Base',
        tokens: [{ assetSymbol: 'dEURO', label: 'dEURO' }],
      },
    ],
  },
  {
    symbol: 'USD',
    label: 'Dollar',
    chains: [
      { chain: 'ethereum', label: 'Ethereum', blockchain: 'Ethereum', tokens: USD_TOKENS },
      { chain: 'arbitrum', label: 'Arbitrum', blockchain: 'Arbitrum', tokens: USD_TOKENS },
      { chain: 'polygon', label: 'Polygon', blockchain: 'Polygon', tokens: USD_TOKENS },
      { chain: 'base', label: 'Base', blockchain: 'Base', tokens: USD_TOKENS },
    ],
  },
];

export default function BuyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ asset?: string; chain?: string }>();
  const {
    paymentInfo,
    isLoading,
    error,
    authGate,
    getQuote,
    createPaymentInfo,
    confirmPayment,
    dismissAuthGate,
    retryLast,
  } = useBuyFlow();
  const [step, setStep] = useState<BuyStep>('amount');
  const initialPreselect = useMemo(() => {
    const wantedSymbol = typeof params.asset === 'string' ? params.asset.toUpperCase() : null;
    const wantedChain = typeof params.chain === 'string' ? params.chain : null;
    if (!wantedSymbol) return null;
    const asset = BUY_ASSETS.find((a) => a.symbol === wantedSymbol);
    if (!asset) return null;
    const chainIdx = wantedChain ? asset.chains.findIndex((c) => c.chain === wantedChain) : 0;
    return { asset, chainIdx: chainIdx >= 0 ? chainIdx : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [selectedAsset, setSelectedAsset] = useState<BuyAsset | null>(
    initialPreselect?.asset ?? null,
  );
  const [selectedChainIndex, setSelectedChainIndex] = useState(initialPreselect?.chainIdx ?? 0);
  const [selectedTokenIndex, setSelectedTokenIndex] = useState(0);
  const [amount, setAmount] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<(typeof CURRENCIES)[number]>('CHF');
  const [copiedField, setCopiedField] = useState<string | null>(null);

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

  // WDK accounts for the chains the user can buy on. We hold each at the
  // top of the screen because hooks can't be called conditionally; the
  // linkChain handler picks the right one based on the failed buy params.
  const btcAccount = useAccount({ network: 'bitcoin', accountIndex: 0 });
  const sparkAccount = useAccount({ network: 'spark', accountIndex: 0 });
  const ethAccount = useAccount({ network: 'ethereum', accountIndex: 0 });
  const lds = useLdsWallet();

  const linkChainToDfx = useCallback(
    async (chain: ChainId) => {
      // Taproot is special: the deposit address is a DFX Lightning Address
      // (`name@dfx.swiss`), provisioned by lightning.space. We hand DFX the
      // LN address plus the ownership proof LDS issued instead of running a
      // wallet sign-flow.
      if (chain === 'bitcoin-taproot') {
        const user = lds.user ?? (await lds.signIn());
        if (!user) {
          throw new Error('DFX Lightning wallet not ready — please retry.');
        }
        await dfxAuthService.linkAddress(
          user.lightning.address,
          async () => user.lightning.addressOwnershipProof,
          { wallet: 'DFX Bitcoin', blockchain: 'Lightning' },
        );
        void retryLast();
        return;
      }

      const account =
        chain === 'bitcoin' ? btcAccount : chain === 'spark' ? sparkAccount : ethAccount;
      if (!account.address) {
        throw new Error(`Wallet for ${chain} not ready`);
      }
      const blockchainName =
        chain === 'bitcoin'
          ? 'Bitcoin'
          : chain === 'spark'
            ? 'Spark'
            : chain === 'arbitrum'
              ? 'Arbitrum'
              : chain === 'polygon'
                ? 'Polygon'
                : chain === 'base'
                  ? 'Base'
                  : 'Ethereum';
      await dfxAuthService.linkAddress(
        account.address,
        async (message) => {
          const result = await account.sign(message);
          if (!result.success) {
            throw new Error(result.error ?? 'Failed to sign message');
          }
          return result.signature;
        },
        { wallet: 'DFX Wallet', blockchain: blockchainName },
      );
      void retryLast();
    },
    [btcAccount, sparkAccount, ethAccount, lds, retryLast],
  );

  // eslint-disable-next-line security/detect-object-injection -- selectedChainIndex is bounded by chains.length
  const selectedChainSpec = selectedAsset?.chains[selectedChainIndex] ?? null;
  // eslint-disable-next-line security/detect-object-injection -- selectedTokenIndex is bounded by tokens.length
  const selectedTokenSpec = selectedChainSpec?.tokens[selectedTokenIndex] ?? null;
  const targetAsset = selectedTokenSpec?.assetSymbol ?? '';
  const blockchain = selectedChainSpec?.blockchain ?? '';

  // Live quote: fetch a fresh exchange-rate + fee preview whenever the user
  // changes amount, currency, or target chain. Debounced so we don't hammer
  // the API on every keystroke.
  useEffect(() => {
    if (step !== 'amount' || !selectedChainSpec) return;
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;
    const id = setTimeout(() => {
      if (!selectedChainSpec) return;
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

  const copy = async (label: string, value: string) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const fees = paymentInfo?.fees;
  // Only render the quote breakdown when the API returned a fully-shaped
  // payment info — partial responses (validation errors) lack `asset`.
  const showQuote =
    !!paymentInfo && !!paymentInfo.asset && !!paymentInfo.currency && parseFloat(amount) > 0;
  const minVolume = paymentInfo?.minVolume;
  const maxVolume = paymentInfo?.maxVolume;
  const numAmount = parseFloat(amount);
  const belowMin = minVolume != null && numAmount > 0 && numAmount < minVolume;
  const aboveMax = maxVolume != null && numAmount > maxVolume;

  const renderAmountStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepSubtitle}>{t('buy.selectAsset')}</Text>
      <View style={styles.assetRow}>
        {BUY_ASSETS.map((asset) => (
          <Pressable
            key={asset.symbol}
            style={({ pressed }) => [
              styles.assetTile,
              selectedAsset?.symbol === asset.symbol && styles.assetTileActive,
              pressed && styles.pressed,
            ]}
            onPress={() => {
              setSelectedAsset(asset);
              setSelectedChainIndex(0);
              setSelectedTokenIndex(0);
            }}
          >
            <Text
              style={[
                styles.assetTileSymbol,
                selectedAsset?.symbol === asset.symbol && styles.assetTileSymbolActive,
              ]}
            >
              {asset.symbol}
            </Text>
          </Pressable>
        ))}
      </View>

      {selectedAsset ? (
        <>
          {selectedAsset.chains.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chainBar}>
              {selectedAsset.chains.map((c, i) => (
                <Pressable
                  key={c.chain}
                  style={[styles.chainChip, selectedChainIndex === i && styles.chainChipActive]}
                  onPress={() => {
                    setSelectedChainIndex(i);
                    setSelectedTokenIndex(0);
                  }}
                >
                  <Text
                    style={[
                      styles.chainChipText,
                      selectedChainIndex === i && styles.chainChipTextActive,
                    ]}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          {selectedChainSpec && selectedChainSpec.tokens.length > 1 ? (
            <View style={styles.tokenRow}>
              {selectedChainSpec.tokens.map((tok, i) => (
                <Pressable
                  key={tok.assetSymbol}
                  style={[styles.tokenChip, selectedTokenIndex === i && styles.tokenChipActive]}
                  onPress={() => setSelectedTokenIndex(i)}
                >
                  <Text
                    style={[
                      styles.tokenChipText,
                      selectedTokenIndex === i && styles.tokenChipTextActive,
                    ]}
                  >
                    {tok.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.amountCard}>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={DfxColors.textTertiary}
              keyboardType="decimal-pad"
            />
            <View style={styles.currencyRow}>
              {CURRENCIES.map((cur) => (
                <Pressable
                  key={cur}
                  style={[
                    styles.currencyChip,
                    selectedCurrency === cur && styles.currencyChipActive,
                  ]}
                  onPress={() => setSelectedCurrency(cur)}
                >
                  <Text
                    style={[
                      styles.currencyText,
                      selectedCurrency === cur && styles.currencyTextActive,
                    ]}
                  >
                    {cur}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.quickRow}>
              {['100', '500', '1000', '5000'].map((val) => (
                <Pressable key={val} style={styles.quickAmount} onPress={() => setAmount(val)}>
                  <Text style={styles.quickAmountText}>{val}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {showQuote && fees ? (
            <View style={styles.quoteCard}>
              <Text style={styles.quoteTitle}>{t('buy.summary')}</Text>
              <QuoteRow
                label={t('buy.exchangeRate')}
                value={`1 ${selectedCurrency} = ${fmtCrypto(1 / paymentInfo!.exchangeRate)} ${paymentInfo!.asset.name}`}
              />
              <QuoteRow
                label={t('buy.feeDfx')}
                value={`${fees.rate.toFixed(2)}%`}
                {...(fees.dfx > 0 ? { sub: `${fmtFiat(fees.dfx)} ${selectedCurrency}` } : {})}
              />
              {fees.network > 0 ? (
                <QuoteRow
                  label={t('buy.feeNetwork')}
                  value={`${fmtFiat(fees.network)} ${selectedCurrency}`}
                />
              ) : null}
              {fees.fixed > 0 ? (
                <QuoteRow
                  label={t('buy.feeFixed')}
                  value={`${fmtFiat(fees.fixed)} ${selectedCurrency}`}
                />
              ) : null}
              <QuoteRow
                label={t('buy.feeTotal')}
                value={`${fmtFiat(fees.total)} ${selectedCurrency}`}
                emphasis
              />
              <View style={styles.quoteDivider} />
              <QuoteRow
                label={t('buy.youReceive')}
                value={`${fmtCrypto(paymentInfo!.estimatedAmount)} ${paymentInfo!.asset.name}`}
                emphasis
              />
            </View>
          ) : null}

          {belowMin ? (
            <Text style={styles.warning}>
              {t('buy.volumeMin', {
                amount: fmtFiat(minVolume!),
                currency: selectedCurrency,
              })}
            </Text>
          ) : null}
          {aboveMax ? (
            <Text style={styles.warning}>
              {t('buy.volumeMax', {
                amount: fmtFiat(maxVolume!),
                currency: selectedCurrency,
              })}
            </Text>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.spacer} />

          <PrimaryButton
            title={t('common.continue')}
            onPress={async () => {
              if (!selectedChainSpec) return;
              const info = await createPaymentInfo({
                amount: numAmount,
                currency: selectedCurrency,
                asset: targetAsset,
                blockchain,
                chain: selectedChainSpec.chain,
              });
              if (info) setStep('payment');
            }}
            disabled={!numAmount || numAmount <= 0 || belowMin || aboveMax}
            loading={isLoading}
          />
        </>
      ) : null}
    </View>
  );

  const renderPaymentStep = () =>
    paymentInfo ? (
      <View style={styles.stepContent}>
        <Text style={styles.stepSubtitle}>{t('buy.paymentInfo')}</Text>

        <View style={styles.bankCard}>
          <CopyRow
            label={t('buy.iban')}
            value={paymentInfo.iban}
            copied={copiedField === 'iban'}
            onCopy={() => copy('iban', paymentInfo.iban)}
            t={t}
          />
          <CopyRow
            label={t('buy.bic')}
            value={paymentInfo.bic}
            copied={copiedField === 'bic'}
            onCopy={() => copy('bic', paymentInfo.bic)}
            t={t}
          />
          <CopyRow
            label={t('buy.recipient')}
            value={paymentInfo.name || 'DFX AG'}
            copied={copiedField === 'name'}
            onCopy={() => copy('name', paymentInfo.name || 'DFX AG')}
            t={t}
          />
          <CopyRow
            label={t('buy.reference')}
            value={paymentInfo.remittanceInfo}
            copied={copiedField === 'ref'}
            onCopy={() => copy('ref', paymentInfo.remittanceInfo)}
            highlight
            t={t}
          />
        </View>

        <View style={styles.quoteCard}>
          <Text style={styles.quoteTitle}>{t('buy.summary')}</Text>
          <QuoteRow
            label={t('common.amount')}
            value={`${fmtFiat(paymentInfo.amount)} ${paymentInfo.currency.name}`}
          />
          <QuoteRow
            label={t('buy.exchangeRate')}
            value={`1 ${paymentInfo.currency.name} = ${fmtCrypto(1 / paymentInfo.exchangeRate)} ${paymentInfo.asset.name}`}
          />
          {paymentInfo.fees.dfx > 0 ? (
            <QuoteRow
              label={t('buy.feeDfx')}
              value={`${paymentInfo.fees.rate.toFixed(2)}% · ${fmtFiat(paymentInfo.fees.dfx)} ${paymentInfo.currency.name}`}
            />
          ) : (
            <QuoteRow label={t('buy.feeDfx')} value={`${paymentInfo.fees.rate.toFixed(2)}%`} />
          )}
          {paymentInfo.fees.network > 0 ? (
            <QuoteRow
              label={t('buy.feeNetwork')}
              value={`${fmtFiat(paymentInfo.fees.network)} ${paymentInfo.currency.name}`}
            />
          ) : null}
          <QuoteRow
            label={t('buy.feeTotal')}
            value={`${fmtFiat(paymentInfo.fees.total)} ${paymentInfo.currency.name}`}
            emphasis
          />
          <View style={styles.quoteDivider} />
          <QuoteRow
            label={t('buy.youReceive')}
            value={`${fmtCrypto(paymentInfo.estimatedAmount)} ${paymentInfo.asset.name}`}
            emphasis
          />
        </View>

        <Text style={styles.hint}>{t('buy.transfer')}</Text>

        <View style={styles.spacer} />

        <PrimaryButton
          title={t('common.confirm')}
          onPress={async () => {
            await confirmPayment(paymentInfo.id);
            setStep('confirm');
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

      <View style={styles.spacer} />

      <PrimaryButton title={t('common.done')} onPress={() => router.back()} />
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <ImageBackground
        source={require('../../../assets/dashboard-bg.png')}
        style={styles.bg}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <AppHeader
            title={t('buy.title')}
            onBack={() => {
              if (step === 'payment') setStep('amount');
              else router.back();
            }}
            testID="buy-screen"
          />
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {step === 'amount' && renderAmountStep()}
            {step === 'payment' && renderPaymentStep()}
            {step === 'confirm' && renderConfirmStep()}
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>
      <DfxAuthGate gate={authGate} onClose={dismissAuthGate} onLinkChain={linkChainToDfx} />
    </>
  );
}

function QuoteRow({
  label,
  value,
  sub,
  emphasis,
}: {
  label: string;
  value: string;
  sub?: string;
  emphasis?: boolean;
}) {
  return (
    <View style={styles.quoteRow}>
      <Text style={styles.quoteLabel}>{label}</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.quoteValue, emphasis && styles.quoteValueEmphasis]}>{value}</Text>
        {sub ? <Text style={styles.quoteSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function CopyRow({
  label,
  value,
  copied,
  onCopy,
  highlight,
  t,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  highlight?: boolean;
  t: (key: string) => string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.copyRow, pressed && styles.pressed]}
      onPress={onCopy}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.copyLabel}>{label}</Text>
        <Text
          style={[styles.copyValue, highlight && styles.copyValueHighlight]}
          numberOfLines={1}
          selectable
        >
          {value}
        </Text>
      </View>
      <View style={styles.copyBadge}>
        <Icon name="document" size={14} color={DfxColors.primary} />
        <Text style={styles.copyBadgeText}>{copied ? t('common.copied') : t('common.copy')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: DfxColors.background,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 18,
  },
  stepContent: {
    gap: 18,
  },
  stepSubtitle: {
    ...Typography.bodyLarge,
    color: DfxColors.textSecondary,
    fontWeight: '500',
  },
  assetRow: {
    flexDirection: 'row',
    gap: 8,
  },
  assetTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DfxColors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
    gap: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  assetTileActive: {
    borderColor: DfxColors.primary,
  },
  assetTileSymbol: {
    ...Typography.bodyLarge,
    color: DfxColors.text,
    fontWeight: '700',
  },
  assetTileSymbolActive: {
    color: DfxColors.primary,
  },
  chainBar: {
    flexGrow: 0,
  },
  chainChip: {
    backgroundColor: DfxColors.surface,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chainChipActive: {
    borderColor: DfxColors.primary,
    backgroundColor: DfxColors.primaryLight,
  },
  chainChipText: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    fontWeight: '500',
  },
  chainChipTextActive: {
    color: DfxColors.primary,
    fontWeight: '600',
  },
  tokenRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tokenChip: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: DfxColors.surface,
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tokenChipActive: {
    borderColor: DfxColors.primary,
    backgroundColor: DfxColors.primaryLight,
  },
  tokenChipText: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: DfxColors.textSecondary,
  },
  tokenChipTextActive: {
    color: DfxColors.primary,
  },
  amountCard: {
    backgroundColor: DfxColors.surface,
    borderRadius: 18,
    padding: 18,
    gap: 14,
  },
  amountInput: {
    fontSize: 36,
    fontWeight: '700',
    color: DfxColors.text,
    textAlign: 'center',
    letterSpacing: -1,
    paddingVertical: 8,
  },
  currencyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  currencyChip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: DfxColors.background,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  currencyChipActive: {
    backgroundColor: DfxColors.primary,
    borderColor: DfxColors.primary,
  },
  currencyText: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: DfxColors.textSecondary,
  },
  currencyTextActive: {
    color: DfxColors.white,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  quickAmount: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: DfxColors.background,
    alignItems: 'center',
  },
  quickAmountText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: DfxColors.textSecondary,
  },
  quoteCard: {
    backgroundColor: DfxColors.surface,
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  quoteTitle: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: DfxColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  quoteLabel: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
  },
  quoteValue: {
    ...Typography.bodyMedium,
    color: DfxColors.text,
    fontWeight: '500',
    textAlign: 'right',
  },
  quoteValueEmphasis: {
    fontWeight: '700',
  },
  quoteSub: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
    textAlign: 'right',
    marginTop: 2,
  },
  quoteDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DfxColors.border,
    marginVertical: 4,
  },
  bankCard: {
    backgroundColor: DfxColors.surface,
    borderRadius: 18,
    paddingVertical: 4,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DfxColors.border,
  },
  copyLabel: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: DfxColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  copyValue: {
    ...Typography.bodyMedium,
    color: DfxColors.text,
    fontFamily: 'monospace',
  },
  copyValueHighlight: {
    color: DfxColors.primary,
    fontWeight: '700',
  },
  copyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: DfxColors.primaryLight,
    borderRadius: 999,
  },
  copyBadgeText: {
    ...Typography.bodySmall,
    color: DfxColors.primary,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  hint: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  warning: {
    ...Typography.bodySmall,
    color: DfxColors.warning,
    textAlign: 'center',
  },
  errorText: {
    ...Typography.bodySmall,
    color: DfxColors.error,
    textAlign: 'center',
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
    color: DfxColors.text,
  },
  successDescription: {
    ...Typography.bodyLarge,
    color: DfxColors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  spacer: {
    minHeight: 16,
  },
});
