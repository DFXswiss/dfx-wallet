import { useState } from 'react';
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
  const { send, isLoading, txHash, error, reset } = useSendFlow(selectedChain);

  const symbol = selectedAsset?.symbol ?? '';
  const isValidAddress = recipient.length >= 26;

  const handleAssetSelect = (asset: AssetOption) => {
    setSelectedAsset(asset);
    setSelectedChain(asset.chains[0]!.chain);
    setStep('input');
  };

  const handleSend = async () => {
    const hash = await send({ to: recipient, amount });
    if (hash) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('success');
    }
  };

  const renderAssetStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepSubtitle}>{t('send.sendToCrypto')}</Text>
      <View style={styles.assetList}>
        {SEND_ASSETS.map((asset) => (
          <Pressable
            key={asset.symbol}
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
    </View>
  );

  const renderInputStep = () => {
    if (!selectedAsset) return null;
    return (
      <View style={styles.stepContent}>
        <Pressable style={styles.selectedAssetPill} onPress={() => setStep('asset')}>
          <Text style={styles.selectedAssetText}>{selectedAsset.symbol}</Text>
          <Icon name="chevron-right" size={14} color={DfxColors.textTertiary} />
        </Pressable>

        {selectedAsset.chains.length > 1 && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('send.network')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chainBar}>
              {selectedAsset.chains.map((c) => (
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
              style={[styles.input, styles.recipientInput]}
              value={recipient}
              onChangeText={setRecipient}
              placeholder={t('send.addressPlaceholder')}
              placeholderTextColor={DfxColors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable style={styles.scanButton} onPress={() => setScannerVisible(true)}>
              <Text style={styles.scanText}>{t('send.scan')}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>
            {t('send.amount')} ({symbol})
          </Text>
          <TextInput
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
          title={t('common.continue')}
          onPress={() => setStep('confirm')}
          disabled={!isValidAddress || !amount || parseFloat(amount) <= 0}
        />

        <ShortcutAction
          icon={<Icon name="swap" size={18} color={DfxColors.white} strokeWidth={2.2} />}
          label={t('send.sellInstead')}
          onPress={() => router.push('/(auth)/sell')}
          testID="send-action-sell"
        />
      </View>
    );
  };

  const renderConfirmStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Confirm Transaction</Text>

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Network</Text>
          <Text style={styles.summaryValue}>{selectedChain}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>To</Text>
          <Text style={styles.summaryValue} numberOfLines={1}>
            {recipient.slice(0, 10)}...{recipient.slice(-6)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Amount</Text>
          <Text style={styles.summaryValue}>
            {amount} {symbol}
          </Text>
        </View>
      </View>

      <Text style={styles.warning}>
        Transactions are irreversible. Please verify the recipient address and amount.
      </Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.spacer} />

      <PrimaryButton title="Confirm & Send" onPress={handleSend} loading={isLoading} />
      <PrimaryButton
        title="Cancel"
        variant="outlined"
        onPress={() => {
          reset();
          setStep('input');
        }}
      />
    </View>
  );

  const renderSuccessStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.successContainer}>
        <Text style={styles.successIcon}>{'\u2705'}</Text>
        <Text style={styles.successTitle}>Transaction Sent</Text>
        <Text style={styles.successDescription}>
          {amount} {symbol} sent to {recipient.slice(0, 10)}...{recipient.slice(-6)}
        </Text>
        {txHash && (
          <Text style={styles.txHash} selectable>
            TX: {txHash.slice(0, 12)}...{txHash.slice(-8)}
          </Text>
        )}
      </View>

      <View style={styles.spacer} />

      <PrimaryButton title="Done" onPress={() => router.back()} />
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
            {step === 'input' && renderInputStep()}
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
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 2,
    borderColor: DfxColors.primary,
  },
  destinationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    padding: 18,
    gap: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  assetCardActive: {
    borderColor: DfxColors.primary,
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
    backgroundColor: DfxColors.surface,
    borderRadius: 12,
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
    backgroundColor: DfxColors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  scanText: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: DfxColors.primary,
  },
  summary: {
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
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
