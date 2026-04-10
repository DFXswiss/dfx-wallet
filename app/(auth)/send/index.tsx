import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChainSelector, PrimaryButton, ScreenContainer } from '@/components';
import type { ChainId } from '@/config/chains';
import { DfxColors, Typography } from '@/theme';

type SendStep = 'input' | 'confirm';

export default function SendScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [step, setStep] = useState<SendStep>('input');
  const [selectedChain, setSelectedChain] = useState<ChainId>('ethereum');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');

  const isValidAddress = recipient.length >= 26;

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
            onPress={() => {
              // TODO: Open QR scanner via expo-camera
            }}
          >
            <Text style={styles.scanText}>Scan</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Amount</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor={DfxColors.textTertiary}
          keyboardType="decimal-pad"
        />
        <Pressable onPress={() => setAmount('MAX')}>
          <Text style={styles.maxButton}>Use max</Text>
        </Pressable>
      </View>

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
            {recipient.slice(0, 8)}...{recipient.slice(-6)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Amount</Text>
          <Text style={styles.summaryValue}>{amount}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Network Fee</Text>
          <Text style={styles.summaryValue}>~0.001 ETH</Text>
        </View>
      </View>

      <View style={styles.spacer} />

      <PrimaryButton
        title="Send"
        onPress={() => {
          // TODO: walletService.sendTransaction(...)
          router.back();
        }}
      />
    </View>
  );

  return (
    <ScreenContainer scrollable>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => (step === 'input' ? router.back() : setStep('input'))}>
            <Text style={styles.backButton}>{'\u2190'}</Text>
          </Pressable>
          <Text style={styles.title}>{t('send.title')}</Text>
          <View style={styles.backButton} />
        </View>

        {step === 'input' && renderInputStep()}
        {step === 'confirm' && renderConfirmStep()}
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
  maxButton: {
    ...Typography.bodySmall,
    color: DfxColors.primary,
    alignSelf: 'flex-end',
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
  spacer: {
    flex: 1,
  },
});
