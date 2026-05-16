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
import { useAccount } from '@tetherto/wdk-react-native-core';
import { AppHeader, ConfirmTargetWalletModal, Icon, PrimaryButton } from '@/components';
import { DfxAuthGate } from '@/features/dfx-backend/DfxAuthGate';
import type { ChainId } from '@/config/chains';
import {
  formatFiat as fmtFiat,
  formatCryptoAmount as fmtCrypto,
} from '@/config/portfolio-presentation';
import { useLdsWallet } from '@/hooks';
import { useLinkedWalletReauth } from '@/features/linked-wallets/useLinkedWalletReauth';
import { useBuyFlow } from './useBuyFlow';
import { markChainLinkedInAutoLinkCache } from '@/features/dfx-backend/useDfxAutoLinkImpl';
import { dfxAuthService, DfxApiError } from '@/features/dfx-backend/services';
import { secureStorage, StorageKeys } from '@/services/storage';
import { useAuthStore } from '@/store';
import { Typography, useColors, type ThemeColors } from '@/theme';

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
  /** Pill is shown but tapping it surfaces a "not yet supported" hint
   *  instead of running the quote/link flow (e.g. Spark/Lightning native:
   *  DFX' /v1/auth doesn't accept the WDK Spark signature yet). */
  unsupported?: boolean;
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
        // Taproot pill = the DFX Lightning Address (lightning.space-managed
        // Taproot Asset channels). Stays consistent with receive's "Taproot"
        // label so users see one BTC layer name across screens.
        label: 'Taproot',
        blockchain: 'Lightning',
        tokens: [{ assetSymbol: 'BTC', label: 'BTC' }],
      },
      {
        chain: 'bitcoin-lightning',
        // Lightning pill = same DFX Lightning Network rails as Taproot
        // (also driven by the lightning.space LDS user). Surfaced as a
        // separate pill because "Lightning" is the label most users expect.
        // Auth/buy flow routes through the LDS LNURL helper just like
        // Taproot.
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

  // When the user opened the buy screen by tapping a linked-wallet card in
  // Portfolio, both `targetAddress` and `targetBlockchain` are present. The
  // amount step shows a banner; the Continue button opens a confirmation
  // modal that re-authenticates as the target wallet's owner before posting
  // /buy/paymentInfos so the bank wire credits the chosen wallet.
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
      // Taproot + Lightning both ride the same DFX Lightning Network rails
      // (lightning.space-managed LDS user). The deposit address is a Lightning
      // Address (`name@dfx.swiss`) and we hand DFX the LNURL form plus the
      // ownership proof LDS issued instead of running a wallet sign-flow.
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
          // 409 → the LDS LNURL is on another DFX user. Mirror the EVM/BTC
          // recovery: drop the current JWT and re-auth as the LNURL owner
          // so the buy flow can continue against the account that already
          // has Lightning attached.
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
        // Mark in the auto-link cache so the next cold start skips this
        // chain instead of re-prompting. Only chains that auto-link knows
        // about: bitcoin + the EVM chains (ethereum is the login, no cache
        // entry needed).
        if (chain === 'bitcoin' || chain === 'arbitrum' || chain === 'polygon' || chain === 'base')
          await markChainLinkedInAutoLinkCache(chain);
        void retryLast();
      } catch (err) {
        // 409 means the address belongs to a *different* DFX user. The user's
        // mental model is "this is MY wallet" — so re-auth as the owner of
        // this address (drop the prior JWT) instead of forcing a merge that
        // DFX won't allow. The buy flow then runs against the account that
        // already has the chain in `user.blockchains`, dodging both the
        // 409 and the next "Asset blockchain mismatch".
        if (err instanceof DfxApiError && err.statusCode === 409) {
          const ownerToken = await dfxAuthService.loginAsAddressOwner(account.address, sign, {
            wallet: 'DFX Wallet',
            blockchain: blockchainName,
          });
          await secureStorage.set(StorageKeys.DFX_AUTH_TOKEN, ownerToken);
          // Wipe the per-chain link cache: a different user means different
          // already-linked chains, so auto-link should re-evaluate from scratch.
          await secureStorage.remove(StorageKeys.DFX_LINKED_CHAINS);
          void retryLast();
          return;
        }
        throw err;
      }
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

  const copy = async (label: string, value: string) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const fees = paymentInfo?.fees;
  // /buy/quote returns DFX' BuyQuoteDto which omits the asset/currency
  // objects (they only land on the /buy/paymentInfos response). We always
  // know what the user picked locally, so render the breakdown as soon as
  // the response is `isValid: true` with a fee block — no need to wait
  // for `paymentInfo.asset` to materialise (it never will on /quote).
  const hasQuote =
    !!paymentInfo && paymentInfo.isValid && !!paymentInfo.fees && parseFloat(amount) > 0;
  // DFX returns 200 with `error` set for soft validation failures (e.g.
  // KycRequired, AssetUnsupported). We need to surface that to the user
  // instead of getting stuck on "Angebot wird berechnet …".
  const quoteError =
    !hasQuote && paymentInfo && paymentInfo.error ? String(paymentInfo.error) : null;
  // DFX sometimes returns 200 with `isValid: false` and no error code —
  // typically when the chain isn't yet attached to the user's account.
  // Tapping Weiter triggers /buy/paymentInfos which fires the linkChain
  // gate, runs the modal sign flow, and auto-refreshes the quote. Tell
  // the user to do exactly that instead of bouncing off a generic error.
  const needsContinue = !hasQuote && !quoteError && !!paymentInfo && !isLoading;
  const unsupportedChain = !!selectedChainSpec?.unsupported;
  // Open the Angebot card as soon as the user has typed a positive amount,
  // even before the first /buy/quote round-trip returns. Keeps the previous
  // quote on screen while a refresh is in flight so the user always sees
  // *something* and can read the change as it lands.
  const showQuoteCard = hasQuote || (parseFloat(amount) > 0 && !!selectedChainSpec);
  const minVolume = paymentInfo?.minVolume;
  const maxVolume = paymentInfo?.maxVolume;
  const numAmount = parseFloat(amount);
  const belowMin = minVolume != null && numAmount > 0 && numAmount < minVolume;
  const aboveMax = maxVolume != null && numAmount > maxVolume;

  const renderAmountStep = () => (
    <View style={styles.stepContent}>
      {hasTargetWallet ? (
        <View style={styles.targetBanner} testID="buy-target-wallet-banner">
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
              placeholderTextColor={colors.textTertiary}
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

          {showQuoteCard ? (
            <View style={styles.quoteCard}>
              <View style={styles.quoteHeader}>
                <Text style={styles.quoteTitle}>{t('buy.summary')}</Text>
                {isLoading && !unsupportedChain ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : null}
              </View>
              {unsupportedChain ? (
                <Text style={styles.quoteError}>{t('buy.chainUnsupported')}</Text>
              ) : hasQuote && fees ? (
                <>
                  <QuoteRow
                    label={t('buy.exchangeRate')}
                    value={`1 ${selectedCurrency} = ${fmtCrypto(1 / paymentInfo!.exchangeRate)} ${targetAsset}`}
                  />
                  <QuoteRow
                    label={t('buy.feeDfx')}
                    value={`${(fees.rate * 100).toFixed(2)}%`}
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
                    value={`${fmtCrypto(paymentInfo!.estimatedAmount)} ${targetAsset}`}
                    emphasis
                  />
                </>
              ) : quoteError ? (
                // DFX accepted the request but rejected the combination
                // (e.g. asset unsupported for this user, KYC required, etc.).
                // Surface the backend error code so the user sees *something*
                // actionable instead of an endless "calculating" placeholder.
                <Text style={styles.quoteError}>
                  {t([`buy.quoteError.${quoteError}`, 'buy.quoteError.generic'], {
                    code: quoteError,
                  })}
                </Text>
              ) : needsContinue ? (
                <Text style={styles.quoteHint}>{t('buy.continueHint')}</Text>
              ) : (
                // First quote still in flight — show a subtle placeholder so
                // the card visibly "opens" the moment the user types instead
                // of jumping in once the response lands.
                <Text style={styles.quotePlaceholder}>{t('buy.fetchingQuote')}</Text>
              )}
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
            disabled={!numAmount || numAmount <= 0 || belowMin || aboveMax || unsupportedChain}
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
              value={`${(paymentInfo.fees.rate * 100).toFixed(2)}% · ${fmtFiat(paymentInfo.fees.dfx)} ${paymentInfo.currency.name}`}
            />
          ) : (
            <QuoteRow
              label={t('buy.feeDfx')}
              value={`${(paymentInfo.fees.rate * 100).toFixed(2)}%`}
            />
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
          title={t('buy.confirmTransfer')}
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
          <View style={styles.progressRow}>
            {['amount', 'payment', 'confirm'].map((item, index) => {
              const currentIndex = step === 'amount' ? 0 : step === 'payment' ? 1 : 2;
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
            {step === 'payment' && renderPaymentStep()}
            {step === 'confirm' && renderConfirmStep()}
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>
      <DfxAuthGate gate={authGate} onClose={dismissAuthGate} onLinkChain={linkChainToDfx} />
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
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
    bg: {
      flex: 1,
      backgroundColor: colors.background,
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
      borderColor: colors.border,
    },
    progressActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    stepSubtitle: {
      ...Typography.bodyLarge,
      color: colors.textSecondary,
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
      backgroundColor: 'rgba(255,255,255,0.92)',
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 6,
      gap: 2,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 54,
    },
    assetTileActive: {
      borderColor: colors.primary,
      backgroundColor: 'rgba(220,234,254,0.72)',
    },
    assetTileSymbol: {
      ...Typography.bodyLarge,
      color: colors.text,
      fontWeight: '700',
    },
    assetTileSymbolActive: {
      color: colors.primary,
    },
    chainBar: {
      flexGrow: 0,
    },
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
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    chainChipText: {
      ...Typography.bodyMedium,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    chainChipTextActive: {
      color: colors.primary,
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
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    tokenChipText: {
      ...Typography.bodyMedium,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tokenChipTextActive: {
      color: colors.primary,
    },
    amountCard: {
      backgroundColor: 'rgba(255,255,255,0.92)',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 16,
    },
    amountInput: {
      fontSize: 36,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
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
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    currencyChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    currencyText: {
      ...Typography.bodyMedium,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    currencyTextActive: {
      color: colors.white,
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
      backgroundColor: colors.background,
      alignItems: 'center',
    },
    quickAmountText: {
      ...Typography.bodySmall,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    quoteCard: {
      backgroundColor: 'rgba(255,255,255,0.92)',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
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
    quoteValueEmphasis: {
      fontWeight: '700',
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
    bankCard: {
      backgroundColor: 'rgba(255,255,255,0.92)',
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
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
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
    pressed: {
      opacity: 0.7,
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
    spacer: {
      minHeight: 16,
    },
    targetBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: 'rgba(255,255,255,0.92)',
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
