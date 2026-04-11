import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useWallet } from '@tetherto/wdk-react-native-provider';
import { ChainSelector, PrimaryButton, ScreenContainer } from '@/components';
import { QrScanner } from '@/components/QrScanner';
import { useSendFlow } from '@/hooks';
import type { ChainId } from '@/config/chains';
import { DfxColors, Typography } from '@/theme';

type SendStep = 'input' | 'confirm' | 'success';

const CHAIN_TO_NETWORK: Record<ChainId, string> = {
  bitcoin: 'bitcoin',
  ethereum: 'ethereum',
  arbitrum: 'arbitrum',
  polygon: 'polygon',
};

const CHAIN_SYMBOL: Record<ChainId, string> = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  arbitrum: 'ETH',
  polygon: 'MATIC',
};

export default function SendScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { balances } = useWallet();
  const { send, isLoading, txHash, error, reset } = useSendFlow();
  const [step, setStep] = useState<SendStep>('input');
  const [selectedChain, setSelectedChain] = useState<ChainId>('ethereum');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);

  const symbol = CHAIN_SYMBOL[selectedChain];
  const isValidAddress = recipient.length >= 26;

  const handleSend = async () => {
    const hash = await send({ chain: selectedChain, to: recipient, amount });
    if (hash) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
          <Pressable
            style={styles.scanButton}
            onPress={() => setScannerVisible(true)}
          >
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
    <ScreenContainer scrollable>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (step === 'input') router.back();
              else if (step === 'confirm') setStep('input');
              else router.back();
            }}
          >
            <Text style={styles.backButton}>{'\u2190'}</Text>
          </Pressable>
          <Text style={styles.title}>{t('send.title')}</Text>
          <View style={styles.backButton} />
        </View>

        {step === 'input' && renderInputStep()}
        {step === 'confirm' && renderConfirmStep()}
        {step === 'success' && renderSuccessStep()}

        <QrScanner
          visible={scannerVisible}
          onScan={(data) => {
            // Handle various QR formats: plain address, ethereum:0x..., bitcoin:bc1...
            const address = data.replace(/^(ethereum|bitcoin):/, '').split('?')[0];
            setRecipient(address);
          }}
          onClose={() => setScannerVisible(false)}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingVertical: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    fontSize: 24,
    color: DfxColors.text,
    width: 32,
  },
  title: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
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
