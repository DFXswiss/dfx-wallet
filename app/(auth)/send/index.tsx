import { useCallback, useMemo, useRef, useState } from 'react';
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
import * as Haptics from 'expo-haptics';
import { AppHeader, Icon, PrimaryButton, ShortcutAction } from '@/components';
import { QrScanner } from '@/components/QrScanner';
import { useSendFlow } from '@/hooks';
import type { ChainId } from '@/config/chains';
import { getPaymasterTokenInfo } from '@/config/chains';
import { FEATURES } from '@/config/features';
import { formatBalance } from '@/config/portfolio-presentation';
import { getSendAssetForCanonical } from '@/config/tokens';
import { DfxColors, Typography } from '@/theme';

type SendStep = 'asset' | 'input' | 'confirm' | 'success';

type AssetOption = {
  symbol: string;
  label: string;
  chains: { chain: ChainId; label: string }[];
};

const SEND_ASSETS: AssetOption[] = [
  {
    symbol: 'BTC',
    label: 'Bitcoin',
    chains: [{ chain: 'spark', label: 'Bitcoin' }],
  },
  {
    symbol: 'CHF',
    label: 'CHF',
    chains: [
      { chain: 'ethereum', label: 'Ethereum' },
      { chain: 'arbitrum', label: 'Arbitrum' },
      { chain: 'polygon', label: 'Polygon' },
      { chain: 'base', label: 'Base' },
    ],
  },
  {
    symbol: 'EUR',
    label: 'Euro',
    chains: [
      { chain: 'ethereum', label: 'Ethereum' },
      { chain: 'arbitrum', label: 'Arbitrum' },
      { chain: 'polygon', label: 'Polygon' },
      { chain: 'base', label: 'Base' },
    ],
  },
  {
    symbol: 'USD',
    label: 'Dollar',
    chains: [
      { chain: 'ethereum', label: 'Ethereum' },
      { chain: 'arbitrum', label: 'Arbitrum' },
      { chain: 'polygon', label: 'Polygon' },
      { chain: 'base', label: 'Base' },
    ],
  },
];

export default function SendScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [step, setStep] = useState<SendStep>('asset');
  // Start unselected so no card has a border on first render — the active
  // border appears only after the user explicitly picks an asset.
  const [selectedAsset, setSelectedAsset] = useState<AssetOption | null>(null);
  const [selectedChain, setSelectedChain] = useState<ChainId>('spark');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const { send, estimate, isLoading, txHash, error, reset } = useSendFlow(selectedChain);

  type FeeState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ok'; fee: string }
    | { status: 'error'; message: string };
  const [feeState, setFeeState] = useState<FeeState>({ status: 'idle' });
  const estimateReqRef = useRef(0);

  const symbol = selectedAsset?.symbol ?? '';
  const sendAsset = useMemo(
    () =>
      selectedAsset ? getSendAssetForCanonical(selectedAsset.symbol, selectedChain) : undefined,
    [selectedAsset, selectedChain],
  );
  const paymasterToken = useMemo(() => getPaymasterTokenInfo(selectedChain), [selectedChain]);
  const isValidAddress = recipient.length >= 26;

  const handleAssetSelect = (asset: AssetOption) => {
    setSelectedAsset(asset);
    setSelectedChain(asset.chains[0]!.chain);
    setStep('input');
  };

  const goToConfirm = useCallback(async () => {
    // Continue + Confirm buttons are gated on `sendAsset` via their
    // `disabled` props, so it is non-null by the time these handlers run.
    setStep('confirm');
    setFeeState({ status: 'loading' });
    const reqId = ++estimateReqRef.current;
    const result = await estimate({ asset: sendAsset!, to: recipient, amount });
    // Drop stale results from earlier estimate calls (e.g. user went back, edited, returned).
    if (reqId !== estimateReqRef.current) return;
    if (result.success) {
      setFeeState({ status: 'ok', fee: result.fee });
    } else {
      setFeeState({ status: 'error', message: result.error });
    }
  }, [sendAsset, estimate, recipient, amount]);

  const handleSend = async () => {
    const hash = await send({ asset: sendAsset!, to: recipient, amount });
    if (hash) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('success');
    }
  };

  const renderAssetStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepSubtitle}>{t('send.sendToCrypto')}</Text>
      <View style={styles.assetList} testID="send-asset-list">
        {SEND_ASSETS.map((asset) => (
          <Pressable
            key={asset.symbol}
            testID={`send-asset-${asset.symbol.toLowerCase()}`}
            style={({ pressed }) => [
              styles.assetCard,
              selectedAsset?.symbol === asset.symbol && styles.assetCardActive,
              pressed && styles.pressed,
            ]}
            onPress={() => handleAssetSelect(asset)}
          >
            <Text
              style={[
                styles.assetSymbol,
                selectedAsset?.symbol === asset.symbol && styles.assetSymbolActive,
              ]}
            >
              {asset.symbol}
            </Text>
            <Text style={styles.assetLabel}>{asset.label}</Text>
          </Pressable>
        ))}
      </View>

      {FEATURES.BUY_SELL && (
        <Pressable
          style={({ pressed }) => [styles.destinationCard, pressed && styles.pressed]}
          onPress={() => router.push('/(auth)/sell')}
          testID="send-destination-bank"
          accessibilityRole="button"
          accessibilityLabel={t('send.sendToBank')}
        >
          <View style={styles.destinationIcon}>
            <Icon name="document" size={20} color={DfxColors.primary} strokeWidth={2.2} />
          </View>
          <View style={styles.destinationText}>
            <Text style={styles.destinationTitle}>{t('send.sendToBank')}</Text>
            <Text style={styles.destinationSubtitle}>{t('send.sendToBankSubtitle')}</Text>
          </View>
          <Icon name="chevron-right" size={18} color={DfxColors.textTertiary} />
        </Pressable>
      )}
    </View>
  );

  const renderInputStep = (asset: AssetOption) => {
    return (
      <View style={styles.stepContent} testID="send-input-step">
        <Pressable
          testID="send-selected-asset-pill"
          style={styles.selectedAssetPill}
          onPress={() => setStep('asset')}
        >
          <Text style={styles.selectedAssetText}>{asset.symbol}</Text>
          <Icon name="chevron-right" size={14} color={DfxColors.textTertiary} />
        </Pressable>

        {asset.chains.length > 1 && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('send.network')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chainBar}>
              {asset.chains.map((c) => (
                <Pressable
                  key={c.chain}
                  style={[styles.chainChip, selectedChain === c.chain && styles.chainChipActive]}
                  onPress={() => setSelectedChain(c.chain)}
                >
                  <Text
                    style={[
                      styles.chainChipText,
                      selectedChain === c.chain && styles.chainChipTextActive,
                    ]}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t('send.recipient')}</Text>
          <View style={styles.recipientRow}>
            <TextInput
              testID="send-recipient-input"
              style={[styles.input, styles.recipientInput]}
              value={recipient}
              onChangeText={setRecipient}
              placeholder={t('send.addressPlaceholder')}
              placeholderTextColor={DfxColors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              testID="send-recipient-scan-button"
              style={styles.scanButton}
              onPress={() => setScannerVisible(true)}
            >
              <Text style={styles.scanText}>{t('send.scan')}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>
            {t('send.amount')} ({symbol})
          </Text>
          <TextInput
            testID="send-amount-input"
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={DfxColors.textTertiary}
            keyboardType="decimal-pad"
          />
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.spacer} />

        <PrimaryButton
          testID="send-continue-button"
          title={t('common.continue')}
          onPress={goToConfirm}
          disabled={!sendAsset || !isValidAddress || !amount || parseFloat(amount) <= 0}
        />

        {FEATURES.BUY_SELL && (
          <ShortcutAction
            icon={<Icon name="swap" size={18} color={DfxColors.white} strokeWidth={2.2} />}
            label={t('send.sellInstead')}
            onPress={() => router.push('/(auth)/sell')}
            testID="send-action-sell"
          />
        )}
      </View>
    );
  };

  const renderConfirmStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('send.confirmTransaction')}</Text>

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('send.network')}</Text>
          <Text style={styles.summaryValue}>{selectedChain}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('send.recipient')}</Text>
          <Text style={styles.summaryValue} numberOfLines={1}>
            {recipient.slice(0, 10)}...{recipient.slice(-6)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('send.amount')}</Text>
          <Text style={styles.summaryValue}>
            {amount} {symbol}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('send.networkFee')}</Text>
          <Text style={styles.summaryValue}>
            {feeState.status === 'loading' && t('send.feeEstimating')}
            {feeState.status === 'error' && t('send.feeUnavailable')}
            {feeState.status === 'ok' &&
              paymasterToken &&
              `${formatBalance(feeState.fee, paymasterToken.decimals)} ${paymasterToken.symbol}`}
          </Text>
        </View>
      </View>

      <Text style={styles.warning}>{t('send.irreversible')}</Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.spacer} />

      <PrimaryButton title={t('common.confirm')} onPress={handleSend} loading={isLoading} />
      <PrimaryButton
        title={t('common.cancel')}
        variant="outlined"
        onPress={() => {
          reset();
          // Drop any in-flight estimate so a late-arriving result doesn't render after cancel.
          estimateReqRef.current += 1;
          setFeeState({ status: 'idle' });
          setStep('input');
        }}
      />
    </View>
  );

  const renderSuccessStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.successContainer}>
        <Text style={styles.successIcon}>{'\u2713'}</Text>
        <Text style={styles.successTitle}>{t('send.sent')}</Text>
        <Text style={styles.successDescription}>
          {t('send.sentDescription', {
            amount,
            symbol,
            recipient: `${recipient.slice(0, 10)}...${recipient.slice(-6)}`,
          })}
        </Text>
        {txHash && (
          <Text style={styles.txHash} selectable>
            {t('send.txHash', { hash: `${txHash.slice(0, 12)}...${txHash.slice(-8)}` })}
          </Text>
        )}
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
            title={t('send.title')}
            onBack={() => {
              if (step === 'confirm') setStep('input');
              else if (step === 'input') setStep('asset');
              else router.back();
            }}
            testID="send-screen"
          />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {step === 'asset' && renderAssetStep()}
            {step === 'input' && selectedAsset && renderInputStep(selectedAsset)}
            {step === 'confirm' && renderConfirmStep()}
            {step === 'success' && renderSuccessStep()}
          </ScrollView>

          <QrScanner
            visible={scannerVisible}
            onScan={(data) => {
              // Handle various QR formats: plain address, ethereum:0x..., bitcoin:bc1...
              // String.prototype.split always yields at least one element, so [0] is defined.
              const address = data.replace(/^(ethereum|bitcoin):/, '').split('?')[0]!;
              setRecipient(address);
            }}
            onClose={() => setScannerVisible(false)}
          />
        </SafeAreaView>
      </ImageBackground>
    </>
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
  },
  stepContent: {
    flex: 1,
    gap: 20,
  },
  stepTitle: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
  },
  stepSubtitle: {
    ...Typography.bodyLarge,
    color: DfxColors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  destinationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: DfxColors.primary,
  },
  destinationIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: DfxColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationText: {
    flex: 1,
    gap: 2,
  },
  destinationTitle: {
    ...Typography.bodyLarge,
    color: DfxColors.text,
    fontWeight: '600',
  },
  destinationSubtitle: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
  },
  assetList: {
    gap: 10,
  },
  assetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: DfxColors.border,
  },
  assetCardActive: {
    borderColor: DfxColors.primary,
    backgroundColor: 'rgba(220,234,254,0.72)',
  },
  pressed: {
    opacity: 0.7,
  },
  assetSymbol: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
    fontWeight: '700',
    width: 56,
  },
  assetSymbolActive: {
    color: DfxColors.primary,
  },
  assetLabel: {
    ...Typography.bodyLarge,
    color: DfxColors.textSecondary,
  },
  selectedAssetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: DfxColors.primaryLight,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 6,
    marginBottom: 4,
  },
  selectedAssetText: {
    ...Typography.bodyMedium,
    color: DfxColors.primary,
    fontWeight: '700',
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
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: DfxColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DfxColors.border,
    padding: 16,
    color: DfxColors.text,
    ...Typography.bodyLarge,
  },
  recipientRow: {
    flexDirection: 'row',
    gap: 8,
  },
  recipientInput: {
    flex: 1,
  },
  scanButton: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DfxColors.border,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  scanText: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: DfxColors.primary,
  },
  summary: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DfxColors.border,
    padding: 20,
    gap: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    ...Typography.bodyMedium,
    color: DfxColors.textTertiary,
  },
  summaryValue: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: DfxColors.text,
    maxWidth: '60%',
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
  successContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: DfxColors.success,
    color: DfxColors.white,
    fontSize: 42,
    lineHeight: 72,
    textAlign: 'center',
    overflow: 'hidden',
  },
  successTitle: {
    ...Typography.headlineMedium,
    color: DfxColors.text,
  },
  successDescription: {
    ...Typography.bodyLarge,
    color: DfxColors.textSecondary,
    textAlign: 'center',
  },
  txHash: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
    fontFamily: 'monospace',
    marginTop: 8,
  },
  spacer: {
    flex: 1,
  },
});
