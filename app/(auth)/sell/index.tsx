import { useEffect, useState } from 'react';
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
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { AppHeader, Icon, PrimaryButton } from '@/components';
import type { ChainId } from '@/config/chains';
import { useSellFlow } from '@/hooks';
import { DfxColors, Typography } from '@/theme';

const fmtFiat = (n: number): string =>
  Number.isFinite(n)
    ? n.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';

const fmtCrypto = (n: number): string =>
  Number.isFinite(n)
    ? n.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 8 })
    : '0';

type SellStep = 'amount' | 'bank' | 'confirm';

// DFX payouts only support EUR and CHF bank transfers — USD removed.
const FIAT_CURRENCIES = ['CHF', 'EUR'] as const;

type SellChain = {
  chain: ChainId;
  label: string;
  blockchain: string;
  tokens: { assetSymbol: string; label: string }[];
};
type SellAsset = {
  symbol: string;
  chains: SellChain[];
};

const USD_TOKENS = [
  { assetSymbol: 'USDT', label: 'USDT' },
  { assetSymbol: 'USDC', label: 'USDC' },
];

const SELL_ASSETS: SellAsset[] = [
  {
    symbol: 'BTC',
    chains: [
      {
        chain: 'bitcoin',
        label: 'Bitcoin',
        blockchain: 'Bitcoin',
        tokens: [{ assetSymbol: 'BTC', label: 'BTC' }],
      },
    ],
  },
  {
    symbol: 'CHF',
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
    chains: [
      { chain: 'ethereum', label: 'Ethereum', blockchain: 'Ethereum', tokens: USD_TOKENS },
      { chain: 'arbitrum', label: 'Arbitrum', blockchain: 'Arbitrum', tokens: USD_TOKENS },
      { chain: 'polygon', label: 'Polygon', blockchain: 'Polygon', tokens: USD_TOKENS },
      { chain: 'base', label: 'Base', blockchain: 'Base', tokens: USD_TOKENS },
    ],
  },
];

export default function SellScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { paymentInfo, isLoading, error, getQuote, createPaymentInfo } = useSellFlow();
  const [step, setStep] = useState<SellStep>('amount');
  const [selectedAsset, setSelectedAsset] = useState<SellAsset | null>(null);
  const [selectedChainIndex, setSelectedChainIndex] = useState(0);
  const [selectedTokenIndex, setSelectedTokenIndex] = useState(0);
  const [amount, setAmount] = useState('');
  const [payoutCurrency, setPayoutCurrency] = useState<(typeof FIAT_CURRENCIES)[number]>('CHF');
  const [iban, setIban] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // eslint-disable-next-line security/detect-object-injection -- selectedChainIndex is bounded by chains.length
  const selectedChainSpec = selectedAsset?.chains[selectedChainIndex] ?? null;
  // eslint-disable-next-line security/detect-object-injection -- selectedTokenIndex is bounded by tokens.length
  const selectedTokenSpec = selectedChainSpec?.tokens[selectedTokenIndex] ?? null;
  const sellAsset = selectedTokenSpec?.assetSymbol ?? '';
  const blockchain = selectedChainSpec?.blockchain ?? '';

  useEffect(() => {
    if (step !== 'amount' || !selectedChainSpec) return;
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;
    const id = setTimeout(() => {
      void getQuote({
        amount: numAmount,
        asset: sellAsset,
        blockchain,
        currency: payoutCurrency,
      });
    }, 350);
    return () => clearTimeout(id);
  }, [amount, payoutCurrency, sellAsset, blockchain, step, getQuote, selectedChainSpec]);

  const copy = async (label: string, value: string) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const fees = paymentInfo?.fees;
  const showQuote =
    !!paymentInfo && !!paymentInfo.asset && !!paymentInfo.currency && parseFloat(amount) > 0;
  const minVolume = paymentInfo?.minVolume;
  const maxVolume = paymentInfo?.maxVolume;
  const numAmount = parseFloat(amount);
  const belowMin = minVolume != null && numAmount > 0 && numAmount < minVolume;
  const aboveMax = maxVolume != null && numAmount > maxVolume;

  const renderAmountStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepSubtitle}>{t('sell.selectAsset')}</Text>
      <View style={styles.assetRow}>
        {SELL_ASSETS.map((asset) => (
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
            <Text style={styles.amountUnit}>{sellAsset}</Text>
            <View style={styles.currencyRow}>
              {FIAT_CURRENCIES.map((cur) => (
                <Pressable
                  key={cur}
                  style={[styles.currencyChip, payoutCurrency === cur && styles.currencyChipActive]}
                  onPress={() => setPayoutCurrency(cur)}
                >
                  <Text
                    style={[
                      styles.currencyText,
                      payoutCurrency === cur && styles.currencyTextActive,
                    ]}
                  >
                    {cur}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {showQuote && fees ? (
            <View style={styles.quoteCard}>
              <Text style={styles.quoteTitle}>{t('sell.summary')}</Text>
              <QuoteRow
                label={t('sell.exchangeRate')}
                value={`1 ${paymentInfo!.asset.name} = ${fmtFiat(paymentInfo!.exchangeRate)} ${paymentInfo!.currency.name}`}
              />
              <QuoteRow
                label={t('sell.feeDfx')}
                value={`${fees.rate.toFixed(2)}%`}
                {...(fees.dfx > 0
                  ? { sub: `${fmtFiat(fees.dfx)} ${paymentInfo!.currency.name}` }
                  : {})}
              />
              {fees.network > 0 ? (
                <QuoteRow
                  label={t('sell.feeNetwork')}
                  value={`${fmtFiat(fees.network)} ${paymentInfo!.currency.name}`}
                />
              ) : null}
              {fees.fixed > 0 ? (
                <QuoteRow
                  label={t('sell.feeFixed')}
                  value={`${fmtFiat(fees.fixed)} ${paymentInfo!.currency.name}`}
                />
              ) : null}
              <QuoteRow
                label={t('sell.feeTotal')}
                value={`${fmtFiat(fees.total)} ${paymentInfo!.currency.name}`}
                emphasis
              />
              <View style={styles.quoteDivider} />
              <QuoteRow
                label={t('sell.youReceive')}
                value={`${fmtFiat(paymentInfo!.estimatedAmount)} ${paymentInfo!.currency.name}`}
                emphasis
              />
            </View>
          ) : null}

          {belowMin ? (
            <Text style={styles.warning}>
              {t('sell.volumeMin', {
                amount: fmtCrypto(minVolume!),
                asset: sellAsset,
              })}
            </Text>
          ) : null}
          {aboveMax ? (
            <Text style={styles.warning}>
              {t('sell.volumeMax', {
                amount: fmtCrypto(maxVolume!),
                asset: sellAsset,
              })}
            </Text>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <PrimaryButton
            title={t('common.continue')}
            onPress={() => setStep('bank')}
            disabled={!numAmount || numAmount <= 0 || belowMin || aboveMax}
          />
        </>
      ) : null}
    </View>
  );

  const renderBankStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepSubtitle}>{t('sell.bankAccount')}</Text>
      <Text style={styles.description}>{t('sell.bankDescription')}</Text>

      <TextInput
        style={styles.ibanInput}
        value={iban}
        onChangeText={setIban}
        placeholder="CH00 0000 0000 0000 0000 0"
        placeholderTextColor={DfxColors.textTertiary}
        autoCapitalize="characters"
        autoCorrect={false}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.spacer} />

      <PrimaryButton
        title={t('common.continue')}
        onPress={async () => {
          const info = await createPaymentInfo({
            amount: numAmount,
            asset: sellAsset,
            blockchain,
            currency: payoutCurrency,
            iban: iban.replace(/\s/g, ''),
          });
          if (info) setStep('confirm');
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

        <View style={styles.bankCard}>
          <CopyRow
            label={t('sell.depositAddress')}
            value={paymentInfo.depositAddress}
            copied={copiedField === 'addr'}
            onCopy={() => copy('addr', paymentInfo.depositAddress)}
            highlight
            t={t}
          />
        </View>

        <View style={styles.quoteCard}>
          <Text style={styles.quoteTitle}>{t('sell.summary')}</Text>
          <QuoteRow
            label={t('sell.youSell')}
            value={`${fmtCrypto(paymentInfo.amount)} ${paymentInfo.asset.name}`}
          />
          <QuoteRow
            label={t('sell.exchangeRate')}
            value={`1 ${paymentInfo.asset.name} = ${fmtFiat(paymentInfo.exchangeRate)} ${paymentInfo.currency.name}`}
          />
          {paymentInfo.fees.dfx > 0 ? (
            <QuoteRow
              label={t('sell.feeDfx')}
              value={`${paymentInfo.fees.rate.toFixed(2)}% · ${fmtFiat(paymentInfo.fees.dfx)} ${paymentInfo.currency.name}`}
            />
          ) : (
            <QuoteRow label={t('sell.feeDfx')} value={`${paymentInfo.fees.rate.toFixed(2)}%`} />
          )}
          {paymentInfo.fees.network > 0 ? (
            <QuoteRow
              label={t('sell.feeNetwork')}
              value={`${fmtFiat(paymentInfo.fees.network)} ${paymentInfo.currency.name}`}
            />
          ) : null}
          <QuoteRow
            label={t('sell.feeTotal')}
            value={`${fmtFiat(paymentInfo.fees.total)} ${paymentInfo.currency.name}`}
            emphasis
          />
          <View style={styles.quoteDivider} />
          <QuoteRow
            label={t('sell.youReceive')}
            value={`${fmtFiat(paymentInfo.estimatedAmount)} ${paymentInfo.currency.name}`}
            emphasis
          />
          <View style={styles.quoteDivider} />
          <QuoteRow label={t('sell.payoutTo')} value={paymentInfo.beneficiary?.iban ?? iban} />
        </View>

        <Text style={styles.hint}>{t('sell.transferHint')}</Text>

        <View style={styles.spacer} />

        <PrimaryButton title={t('common.done')} onPress={() => router.back()} />
      </View>
    ) : null;

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
            title={t('sell.title')}
            onBack={() => {
              if (step === 'bank') setStep('amount');
              else if (step === 'confirm') setStep('bank');
              else router.back();
            }}
            testID="sell-screen"
          />
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {step === 'amount' && renderAmountStep()}
            {step === 'bank' && renderBankStep()}
            {step === 'confirm' && renderConfirmStep()}
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>
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
  bg: { flex: 1, backgroundColor: DfxColors.background },
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32, gap: 18 },
  stepContent: { gap: 18 },
  stepSubtitle: {
    ...Typography.bodyLarge,
    color: DfxColors.textSecondary,
    fontWeight: '500',
  },
  description: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
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
    borderWidth: 2,
    borderColor: 'transparent',
  },
  assetTileActive: { borderColor: DfxColors.primary },
  assetTileSymbol: {
    ...Typography.bodyLarge,
    color: DfxColors.text,
    fontWeight: '700',
  },
  assetTileSymbolActive: { color: DfxColors.primary },
  pressed: { opacity: 0.7 },
  chainBar: { flexGrow: 0 },
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
    alignItems: 'center',
  },
  amountInput: {
    fontSize: 36,
    fontWeight: '700',
    color: DfxColors.text,
    textAlign: 'center',
    letterSpacing: -1,
    paddingVertical: 8,
    minWidth: 200,
  },
  amountUnit: {
    ...Typography.bodyMedium,
    color: DfxColors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: -8,
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
  currencyTextActive: { color: DfxColors.white },
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
  quoteValueEmphasis: { fontWeight: '700' },
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
  ibanInput: {
    backgroundColor: DfxColors.surface,
    borderRadius: 14,
    padding: 16,
    color: DfxColors.text,
    ...Typography.bodyLarge,
    letterSpacing: 1,
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
  spacer: { minHeight: 16 },
});
