import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useAccount, useBalancesForWallet } from '@tetherto/wdk-react-native-core';
import { ConfirmTargetWalletModal, Icon, PrimaryButton } from '@/components';
import { DfxAuthGate } from '@/features/dfx-backend/DfxAuthGate';
import type { ChainId } from '@/config/chains';
import {
  formatBalance,
  formatCryptoAmount as fmtCrypto,
  formatFiat as fmtFiat,
  toNumeric,
} from '@/config/portfolio-presentation';
import { getAssetMeta, getAssets, WDK_SUPPORTED_CHAINS } from '@/config/tokens';
import { useLdsWallet } from '@/hooks';
import { useEnabledChains } from '@/features/portfolio/useEnabledChains';
import { useLinkedWalletReauth } from '@/features/linked-wallets/useLinkedWalletReauth';
import { useSellFlow } from './useSellFlow';
import { markChainLinkedInAutoLinkCache } from '@/hooks/useDfxAutoLink';
import { dfxAuthService, DfxApiError } from '@/features/dfx-backend/services';
import { secureStorage, StorageKeys } from '@/services/storage';
import { useAuthStore } from '@/store';
import { Typography, useColors, type ThemeColors } from '@/theme';
import TradeModeTabs from './TradeModeTabs';
import { AssetGlyph } from './AssetGlyph';
import { CurrencyGlyph } from './CurrencyGlyph';
import { ReceiveAssetSheet } from './ReceiveAssetSheet';
import { MobileFeesPanel } from './MobileFeesPanel';
import { isAccountGateError, makeTradeQuoteKey, TRADE_STEP_GAP } from './tradePanelStyles';
import { TradeAmountPanels, TradeSelectorPill } from './TradeAmountPanels';
import { TradeScreenShell } from './TradeScreenShell';

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
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
    quoteKey,
    errorKey,
    actionErrorKey,
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
  const [payPickerOpen, setPayPickerOpen] = useState(false);
  const [iban, setIban] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);

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
      (chain) =>
        chain.chain === selectedChainSpec.chain &&
        chain.tokens.some((token) => token.assetSymbol === sellAsset),
    );
  const currentQuoteKey = makeTradeQuoteKey({
    amount: parseFloat(amount),
    currency: payoutCurrency,
    asset: sellAsset,
    blockchain,
    chain: selectedChainSpec?.chain ?? '',
  });

  useEffect(() => {
    if (step !== 'amount' || !selectedChainSpec || !selectedAssetIsAvailable) return;
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;
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
    amount,
    payoutCurrency,
    sellAsset,
    blockchain,
    step,
    getQuote,
    selectedChainSpec,
    selectedAssetIsAvailable,
  ]);

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
    !!paymentInfo.fees &&
    parseFloat(amount) > 0;
  // Empty quote without an explicit error code → the chain still has to
  // be linked. Tapping Weiter triggers the linkChain modal and auto-
  // retries the quote. See buy/index.tsx for full rationale.
  // See buy/index.tsx — open the Angebot card the moment a positive amount
  // is set so the user always sees something refreshing instead of an empty
  // void during the /sell/quote round-trip.
  // Keep the fee panel directly below the trade panels, including its empty
  // state before the first quote is available.
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
  const feePanelStatus = quoteError
    ? t([`sell.quoteError.${quoteError}`, 'sell.quoteError.generic'], { code: quoteError })
    : genericQuoteError
      ? genericQuoteError
      : genericActionError
        ? genericActionError
        : needsContinue
          ? t('sell.continueHint')
          : null;
  const minVolume = paymentInfo?.minVolume;
  const maxVolume = paymentInfo?.maxVolume;
  const numAmount = parseFloat(amount);
  const belowMin = minVolume != null && numAmount > 0 && numAmount < minVolume;
  const aboveMax = maxVolume != null && numAmount > maxVolume;

  const renderAmountStepContent = () => (
    <View style={styles.stepContent}>
      {hasTargetWallet ? (
        <View style={styles.targetBanner} testID="sell-target-wallet-banner">
          <View style={styles.targetIcon}>
            <Icon name="wallet" size={18} color={colors.primary} />
          </View>
          <View style={styles.targetBody}>
            <Text style={styles.targetLabel}>{t('linkedWallet.banner.label')}</Text>
            <Text style={styles.targetAddress} numberOfLines={1}>
              {targetAddressShort}
            </Text>
          </View>
        </View>
      ) : null}
      <TradeAmountPanels
        testID={selectedAsset ? 'sell-amount-panels' : 'sell-amount-panels-empty'}
        flipTestID="sell-flip-to-buy"
        flipAccessibilityLabel={t('sell.flipToBuy')}
        onFlip={() => router.replace('/(auth)/buy')}
        payLabel={<Text style={styles.plabel}>{t('sell.youSell')}</Text>}
        payAmount={
          <TextInput
            style={styles.amt}
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            editable={!!selectedAsset}
            testID="sell-pay-amount"
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
            <Text style={styles.plabel}>{t('sell.youReceive')}</Text>
            {isLoading ? <Text style={styles.pmeta}>{t('sell.fetchingQuote')}</Text> : null}
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
        onSelect={(asset, chainIndex, tokenIndex) => {
          setSelectedAsset(asset);
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
        statusMessage={feePanelStatus}
      />

      {selectedAsset && !selectedAssetIsAvailable ? (
        <Text style={styles.warning}>{t('sell.noBalance')}</Text>
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

      <PrimaryButton
        testID="sell-cta"
        title={`${t('sell.title')} ${sellAsset}`}
        icon={<Icon name="arrow-right" size={18} color={colors.white} />}
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
      <View style={styles.securityRow} testID="sell-security-row">
        <Icon name="shield" size={14} color={colors.textTertiary} />
        <Text style={styles.securityText}>{t('sell.security')}</Text>
      </View>
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
        placeholderTextColor={colors.textTertiary}
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

  const renderAmountStep = () => (
    <>
      <TradeModeTabs active="sell" />
      {renderAmountStepContent()}
    </>
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

  const body = (
    <TradeScreenShell
      title={t('sell.title')}
      onBack={() => {
        if (step === 'bank') setStep('amount');
        else if (step === 'confirm') setStep('bank');
        else router.back();
      }}
      headerTestID="sell-screen"
      activeStep={step === 'amount' ? 0 : step === 'bank' ? 1 : 2}
      steps={['amount', 'bank', 'confirm']}
    >
      {step === 'amount' && renderAmountStep()}
      {step === 'bank' && renderBankStep()}
      {step === 'confirm' && renderConfirmStep()}
    </TradeScreenShell>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      {body}
      <DfxAuthGate
        gate={authGateIsCurrent ? authGate : null}
        onClose={dismissAuthGate}
        onLinkChain={linkChainToDfx}
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
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  emphasis?: boolean;
  accent?: boolean;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.quoteRow}>
      <Text style={styles.quoteLabel}>{label}</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text
          style={[
            styles.quoteValue,
            emphasis && styles.quoteValueEmphasis,
            accent && styles.quoteValueAccent,
          ]}
        >
          {value}
        </Text>
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
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
        <Icon name="document" size={14} color={colors.primary} />
        <Text style={styles.copyBadgeText}>{copied ? t('common.copied') : t('common.copy')}</Text>
      </View>
    </Pressable>
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
    pressed: { opacity: 0.7 },
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
    pmeta: { fontSize: 12, color: colors.textTertiary },
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
    quoteCard: {
      backgroundColor: colors.cardOverlay,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 14,
    },
    quoteTitle: {
      ...Typography.bodySmall,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    quotePlaceholder: {
      ...Typography.bodyMedium,
      color: colors.textTertiary,
      paddingVertical: 8,
    },
    quoteError: {
      ...Typography.bodyMedium,
      color: colors.error,
      paddingVertical: 8,
    },
    quoteHint: {
      ...Typography.bodyMedium,
      color: colors.primary,
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
      color: colors.textSecondary,
    },
    quoteValue: {
      ...Typography.bodyMedium,
      color: colors.text,
      fontWeight: '500',
      textAlign: 'right',
    },
    quoteValueEmphasis: { fontWeight: '700' },
    quoteValueAccent: { color: colors.primary },
    quoteToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    quoteToggleText: {
      ...Typography.bodyMedium,
      color: colors.text,
      fontWeight: '500',
      flex: 1,
    },
    quoteFeeBadge: {
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    quoteFeeBadgeText: {
      ...Typography.bodySmall,
      color: colors.primary,
      fontWeight: '600',
    },
    quoteChevronOpen: {
      transform: [{ rotate: '90deg' }],
    },
    quoteSub: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
      textAlign: 'right',
      marginTop: 2,
    },
    quoteDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
    ibanInput: {
      backgroundColor: colors.cardOverlay,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      color: colors.text,
      ...Typography.bodyLarge,
      letterSpacing: 1,
    },
    bankCard: {
      backgroundColor: colors.cardOverlay,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
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
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    copyValue: {
      ...Typography.bodyMedium,
      color: colors.text,
      fontFamily: 'monospace',
    },
    copyValueHighlight: {
      color: colors.primary,
      fontWeight: '700',
    },
    copyBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: colors.primaryLight,
      borderRadius: 999,
    },
    copyBadgeText: {
      ...Typography.bodySmall,
      color: colors.primary,
      fontWeight: '600',
    },
    hint: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
      textAlign: 'center',
      paddingHorizontal: 16,
    },
    warning: {
      ...Typography.bodySmall,
      color: colors.warning,
      textAlign: 'center',
    },
    errorText: {
      ...Typography.bodySmall,
      color: colors.error,
      textAlign: 'center',
    },
    spacer: { minHeight: 16 },
    securityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      marginTop: 12,
    },
    securityText: { ...Typography.bodySmall, color: colors.textTertiary, textAlign: 'center' },
    targetBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.cardOverlay,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    targetIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.primaryLight,
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
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    targetAddress: {
      ...Typography.bodyMedium,
      fontWeight: '600',
      color: colors.text,
      fontFamily: 'monospace',
    },
  });
