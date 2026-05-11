import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useAccount, useBalancesForWallet } from '@tetherto/wdk-react-native-core';
import {
  AppHeader,
  ConfirmTargetWalletModal,
  DfxAuthGate,
  Icon,
  PrimaryButton,
} from '@/components';
import type { ChainId } from '@/config/chains';
import {
  formatBalance,
  formatCryptoAmount as fmtCrypto,
  formatFiat as fmtFiat,
  toNumeric,
} from '@/config/portfolio-presentation';
import { getAssetMeta, getAssets, WDK_SUPPORTED_CHAINS } from '@/config/tokens';
import { useEnabledChains, useLdsWallet, useLinkedWalletReauth, useSellFlow } from '@/hooks';
import { markChainLinkedInAutoLinkCache } from '@/hooks/useDfxAutoLink';
import { dfxAuthService, DfxApiError } from '@/services/dfx';
import { secureStorage, StorageKeys } from '@/services/storage';
import { useAuthStore } from '@/store';
import { DfxColors, Typography } from '@/theme';

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
        label: 'SegWit',
        blockchain: 'Bitcoin',
        tokens: [{ assetSymbol: 'BTC', label: 'BTC' }],
      },
      {
        chain: 'bitcoin-taproot',
        label: 'Taproot',
        blockchain: 'Lightning',
        tokens: [{ assetSymbol: 'BTC', label: 'BTC' }],
      },
      {
        chain: 'bitcoin-lightning',
        // Lightning pill = same LDS lightning.space rails as Taproot.
        label: 'Lightning',
        blockchain: 'Lightning',
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
  const params = useLocalSearchParams<{
    asset?: string;
    chain?: string;
    targetAddress?: string;
    targetBlockchain?: string;
  }>();
  const targetAddress =
    typeof params.targetAddress === 'string' && params.targetAddress.length > 0
      ? params.targetAddress
      : null;
  const targetBlockchain =
    typeof params.targetBlockchain === 'string' && params.targetBlockchain.length > 0
      ? params.targetBlockchain
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
  const { enabledChains } = useEnabledChains();
  const {
    paymentInfo,
    isLoading,
    error,
    authGate,
    getQuote,
    createPaymentInfo,
    dismissAuthGate,
    retryLast,
  } = useSellFlow();
  const [step, setStep] = useState<SellStep>('amount');
  const initialPreselect = useMemo(() => {
    const wantedSymbol = typeof params.asset === 'string' ? params.asset.toUpperCase() : null;
    const wantedChain = typeof params.chain === 'string' ? params.chain : null;
    if (!wantedSymbol) return null;
    const asset = SELL_ASSETS.find((a) => a.symbol === wantedSymbol);
    if (!asset) return null;
    const chainIdx = wantedChain ? asset.chains.findIndex((c) => c.chain === wantedChain) : 0;
    return { asset, chainIdx: chainIdx >= 0 ? chainIdx : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [selectedAsset, setSelectedAsset] = useState<SellAsset | null>(
    initialPreselect?.asset ?? null,
  );
  const [selectedChainIndex, setSelectedChainIndex] = useState(initialPreselect?.chainIdx ?? 0);
  const [selectedTokenIndex, setSelectedTokenIndex] = useState(0);
  const [amount, setAmount] = useState('');
  const [payoutCurrency, setPayoutCurrency] = useState<(typeof FIAT_CURRENCIES)[number]>('CHF');
  const [iban, setIban] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Replay the last failed call after the user finishes the DFX login flow.
  const isDfxAuthenticated = useAuthStore((s) => s.isDfxAuthenticated);
  useFocusEffect(
    useCallback(() => {
      if (isDfxAuthenticated) {
        void retryLast();
      }
    }, [isDfxAuthenticated, retryLast]),
  );

  const btcAccount = useAccount({ network: 'bitcoin', accountIndex: 0 });
  const sparkAccount = useAccount({ network: 'spark', accountIndex: 0 });
  const ethAccount = useAccount({ network: 'ethereum', accountIndex: 0 });
  const lds = useLdsWallet();

  const linkChainToDfx = useCallback(
    async (chain: ChainId) => {
      if (chain === 'bitcoin-taproot' || chain === 'bitcoin-lightning') {
        const user = lds.user ?? (await lds.signIn());
        if (!user) {
          throw new Error('DFX Lightning wallet not ready — please retry.');
        }
        try {
          const ldsToken = await dfxAuthService.linkLnurlAddress(
            user.lightning.addressLnurl,
            user.lightning.addressOwnershipProof,
            { wallet: 'DFX Bitcoin', blockchain: 'Lightning' },
          );
          await secureStorage.set(StorageKeys.DFX_AUTH_TOKEN, ldsToken);
          await markChainLinkedInAutoLinkCache('lightning');
          void retryLast();
        } catch (err) {
          if (err instanceof DfxApiError && err.statusCode === 409) {
            const ownerToken = await dfxAuthService.loginAsLnurlAddressOwner(
              user.lightning.addressLnurl,
              user.lightning.addressOwnershipProof,
              { wallet: 'DFX Bitcoin', blockchain: 'Lightning' },
            );
            await secureStorage.set(StorageKeys.DFX_AUTH_TOKEN, ownerToken);
            await secureStorage.remove(StorageKeys.DFX_LINKED_CHAINS);
            void retryLast();
            return;
          }
          throw err;
        }
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
      const sign = async (message: string) => {
        const result = await account.sign(message);
        if (!result.success) {
          throw new Error(result.error ?? 'Failed to sign message');
        }
        return result.signature;
      };
      try {
        const newToken = await dfxAuthService.linkAddress(account.address, sign, {
          wallet: 'DFX Wallet',
          blockchain: blockchainName,
        });
        await secureStorage.set(StorageKeys.DFX_AUTH_TOKEN, newToken);
        if (chain === 'bitcoin' || chain === 'arbitrum' || chain === 'polygon' || chain === 'base')
          await markChainLinkedInAutoLinkCache(chain);
        void retryLast();
      } catch (err) {
        // 409 → address belongs to another DFX user. Re-auth as that user
        // (drop the prior session) so the rest of the flow runs against the
        // account that already owns this wallet. See buy/index.tsx for full
        // rationale.
        if (err instanceof DfxApiError && err.statusCode === 409) {
          const ownerToken = await dfxAuthService.loginAsAddressOwner(account.address, sign, {
            wallet: 'DFX Wallet',
            blockchain: blockchainName,
          });
          await secureStorage.set(StorageKeys.DFX_AUTH_TOKEN, ownerToken);
          await secureStorage.remove(StorageKeys.DFX_LINKED_CHAINS);
          void retryLast();
          return;
        }
        throw err;
      }
    },
    [btcAccount, sparkAccount, ethAccount, lds, retryLast],
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
    const asset = assetConfigs.find(
      (a) => a.getNetwork() === network && getAssetMeta(a.getId())?.symbol === symbol,
    );
    if (!asset) return false;
    const result = balanceResults?.find((r) => r.assetId === asset.getId());
    const raw = result?.success ? (result.balance ?? '0') : '0';
    return toNumeric(formatBalance(raw, asset.getDecimals())) > 0;
  };

  // Only show chains+tokens the user actually holds funds in.
  const availableChains = useMemo(() => {
    if (!selectedAsset) return [];
    return selectedAsset.chains
      .map((c) => ({
        ...c,
        tokens: c.tokens.filter((t) => hasHolding(c.chain, t.assetSymbol)),
      }))
      .filter((c) => c.tokens.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAsset, balanceResults, assetConfigs]);

  // eslint-disable-next-line security/detect-object-injection -- selectedChainIndex is bounded by availableChains.length
  const selectedChainSpec = availableChains[selectedChainIndex] ?? null;
  // eslint-disable-next-line security/detect-object-injection -- selectedTokenIndex is bounded by tokens.length
  const selectedTokenSpec = selectedChainSpec?.tokens[selectedTokenIndex] ?? null;
  const sellAsset = selectedTokenSpec?.assetSymbol ?? '';
  const blockchain = selectedChainSpec?.blockchain ?? '';

  useEffect(() => {
    if (step !== 'amount' || !selectedChainSpec) return;
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;
    const id = setTimeout(() => {
      if (!selectedChainSpec) return;
      void getQuote({
        amount: numAmount,
        asset: sellAsset,
        blockchain,
        currency: payoutCurrency,
        chain: selectedChainSpec.chain,
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
  // /sell/quote returns SellQuoteDto without asset/currency objects — those
  // only land on /sell/paymentInfos. We render the breakdown from local
  // selection state instead, so a valid quote shows up immediately.
  const hasQuote =
    !!paymentInfo && paymentInfo.isValid && !!paymentInfo.fees && parseFloat(amount) > 0;
  const quoteError =
    !hasQuote && paymentInfo && paymentInfo.error ? String(paymentInfo.error) : null;
  // Empty quote without an explicit error code → the chain still has to
  // be linked. Tapping Weiter triggers the linkChain modal and auto-
  // retries the quote. See buy/index.tsx for full rationale.
  const needsContinue = !hasQuote && !quoteError && !!paymentInfo && !isLoading;
  // See buy/index.tsx — open the Angebot card the moment a positive amount
  // is set so the user always sees something refreshing instead of an empty
  // void during the /sell/quote round-trip.
  const showQuoteCard = hasQuote || (parseFloat(amount) > 0 && !!selectedChainSpec);
  const minVolume = paymentInfo?.minVolume;
  const maxVolume = paymentInfo?.maxVolume;
  const numAmount = parseFloat(amount);
  const belowMin = minVolume != null && numAmount > 0 && numAmount < minVolume;
  const aboveMax = maxVolume != null && numAmount > maxVolume;

  const renderAmountStep = () => (
    <View style={styles.stepContent}>
      {hasTargetWallet ? (
        <View style={styles.targetBanner} testID="sell-target-wallet-banner">
          <View style={styles.targetIcon}>
            <Icon name="wallet" size={18} color={DfxColors.primary} />
          </View>
          <View style={styles.targetBody}>
            <Text style={styles.targetLabel}>{t('linkedWallet.banner.label')}</Text>
            <Text style={styles.targetAddress} numberOfLines={1}>
              {targetAddressShort}
            </Text>
          </View>
        </View>
      ) : null}
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

      {selectedAsset && availableChains.length === 0 ? (
        <Text style={styles.warning}>{t('sell.noBalance')}</Text>
      ) : null}

      {selectedAsset && availableChains.length > 0 ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chainBar}>
            {availableChains.map((c, i) => (
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

          {showQuoteCard ? (
            <View style={styles.quoteCard}>
              <View style={styles.quoteHeader}>
                <Text style={styles.quoteTitle}>{t('sell.summary')}</Text>
                {isLoading ? <ActivityIndicator size="small" color={DfxColors.primary} /> : null}
              </View>
              {hasQuote && fees ? (
                <>
                  <QuoteRow
                    label={t('sell.exchangeRate')}
                    value={`1 ${sellAsset} = ${fmtFiat(paymentInfo!.exchangeRate)} ${payoutCurrency}`}
                  />
                  <QuoteRow
                    label={t('sell.feeDfx')}
                    value={`${(fees.rate * 100).toFixed(2)}%`}
                    {...(fees.dfx > 0 ? { sub: `${fmtFiat(fees.dfx)} ${payoutCurrency}` } : {})}
                  />
                  {fees.network > 0 ? (
                    <QuoteRow
                      label={t('sell.feeNetwork')}
                      value={`${fmtFiat(fees.network)} ${payoutCurrency}`}
                    />
                  ) : null}
                  {fees.fixed > 0 ? (
                    <QuoteRow
                      label={t('sell.feeFixed')}
                      value={`${fmtFiat(fees.fixed)} ${payoutCurrency}`}
                    />
                  ) : null}
                  <QuoteRow
                    label={t('sell.feeTotal')}
                    value={`${fmtFiat(fees.total)} ${payoutCurrency}`}
                    emphasis
                  />
                  <View style={styles.quoteDivider} />
                  <QuoteRow
                    label={t('sell.youReceive')}
                    value={`${fmtFiat(paymentInfo!.estimatedAmount)} ${payoutCurrency}`}
                    emphasis
                  />
                </>
              ) : quoteError ? (
                <Text style={styles.quoteError}>
                  {t([`sell.quoteError.${quoteError}`, 'sell.quoteError.generic'], {
                    code: quoteError,
                  })}
                </Text>
              ) : needsContinue ? (
                <Text style={styles.quoteHint}>{t('sell.continueHint')}</Text>
              ) : (
                <Text style={styles.quotePlaceholder}>{t('sell.fetchingQuote')}</Text>
              )}
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
            onPress={() => {
              if (hasTargetWallet) {
                setConfirmError(null);
                setConfirmOpen(true);
                return;
              }
              setStep('bank');
            }}
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
          if (!selectedChainSpec) return;
          const info = await createPaymentInfo({
            amount: numAmount,
            asset: sellAsset,
            blockchain,
            currency: payoutCurrency,
            iban: iban.replace(/\s/g, ''),
            chain: selectedChainSpec.chain,
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
              value={`${(paymentInfo.fees.rate * 100).toFixed(2)}% · ${fmtFiat(paymentInfo.fees.dfx)} ${paymentInfo.currency.name}`}
            />
          ) : (
            <QuoteRow
              label={t('sell.feeDfx')}
              value={`${(paymentInfo.fees.rate * 100).toFixed(2)}%`}
            />
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
          <View style={styles.progressRow}>
            {['amount', 'bank', 'confirm'].map((item, index) => {
              const currentIndex = step === 'amount' ? 0 : step === 'bank' ? 1 : 2;
              const active = index <= currentIndex;
              return (
                <View key={item} style={[styles.progressStep, active && styles.progressActive]} />
              );
            })}
          </View>
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
      <DfxAuthGate gate={authGate} onClose={dismissAuthGate} onLinkChain={linkChainToDfx} />
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
          setConfirmOpen(false);
          setConfirmError(null);
        }}
        onConfirm={async () => {
          if (!targetAddress || !targetBlockchain) return;
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
            setConfirmOpen(false);
            setStep('bank');
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
  progressRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 8,
    paddingTop: 4,
    paddingBottom: 12,
  },
  progressStep: {
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DfxColors.border,
  },
  progressActive: {
    backgroundColor: DfxColors.primary,
    borderColor: DfxColors.primary,
  },
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
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: DfxColors.border,
    minHeight: 54,
  },
  assetTileActive: { borderColor: DfxColors.primary, backgroundColor: 'rgba(220,234,254,0.72)' },
  assetTileSymbol: {
    ...Typography.bodyLarge,
    color: DfxColors.text,
    fontWeight: '700',
  },
  assetTileSymbolActive: { color: DfxColors.primary },
  pressed: { opacity: 0.7 },
  chainBar: { flexGrow: 0 },
  chainChip: {
    backgroundColor: 'rgba(255,255,255,0.92)',
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
    backgroundColor: 'rgba(255,255,255,0.92)',
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
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DfxColors.border,
    padding: 18,
    gap: 16,
    alignItems: 'center',
  },
  amountInput: {
    fontSize: 36,
    fontWeight: '700',
    color: DfxColors.text,
    textAlign: 'center',
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
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DfxColors.border,
    padding: 18,
    gap: 14,
  },
  quoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quoteTitle: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: DfxColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  quotePlaceholder: {
    ...Typography.bodyMedium,
    color: DfxColors.textTertiary,
    paddingVertical: 8,
  },
  quoteError: {
    ...Typography.bodyMedium,
    color: DfxColors.error,
    paddingVertical: 8,
  },
  quoteHint: {
    ...Typography.bodyMedium,
    color: DfxColors.primary,
    paddingVertical: 8,
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
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DfxColors.border,
    padding: 16,
    color: DfxColors.text,
    ...Typography.bodyLarge,
    letterSpacing: 1,
  },
  bankCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DfxColors.border,
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
  targetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DfxColors.border,
    borderLeftWidth: 4,
    borderLeftColor: DfxColors.primary,
  },
  targetIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: DfxColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetBody: {
    flex: 1,
    gap: 2,
  },
  targetLabel: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: DfxColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  targetAddress: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: DfxColors.text,
    fontFamily: 'monospace',
  },
});
