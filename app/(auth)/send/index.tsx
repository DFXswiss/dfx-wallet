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
import { AppHeader, ChainSelector, Icon, PrimaryButton, ShortcutAction } from '@/components';
import { QrScanner } from '@/components/QrScanner';
import { useSendFlow } from '@/hooks';
import type { ChainId } from '@/config/chains';
import { DfxColors, Typography } from '@/theme';

type SendStep = 'input' | 'confirm' | 'success';

const CHAIN_SYMBOL: Record<ChainId, string> = {
  ethereum: 'ETH',
  arbitrum: 'ETH',
  polygon: 'MATIC',
  base: 'ETH',
  spark: 'BTC',
  plasma: 'ETH',
  sepolia: 'ETH',
};

export default function SendScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [step, setStep] = useState<SendStep>('input');
  const [selectedChain, setSelectedChain] = useState<ChainId>('ethereum');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const { send, isLoading, txHash, error, reset } = useSendFlow(selectedChain);

  // eslint-disable-next-line security/detect-object-injection -- selectedChain is a ChainId literal union
  const symbol = CHAIN_SYMBOL[selectedChain];
  const isValidAddress = recipient.length >= 26;

  const handleSend = async () => {
    const hash = await send({ to: recipient, amount });
    if (hash) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('success');
    }
  };

  const renderInputStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Send Crypto</Text>

      <ChainSelector selected={selectedChain} onSelect={setSelectedChain} />

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Recipient</Text>
        <View style={styles.recipientRow}>
          <TextInput
            style={[styles.input, styles.recipientInput]}
            value={recipient}
            onChangeText={setRecipient}
            placeholder="Address or ENS name"
            placeholderTextColor={DfxColors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable style={styles.scanButton} onPress={() => setScannerVisible(true)}>
            <Text style={styles.scanText}>Scan</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Amount ({symbol})</Text>
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
      <Stack.Screen options={{ headerShown: false }} />
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
              else router.back();
            }}
            testID="send-screen"
          />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
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
