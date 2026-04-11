import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChainSelector, PrimaryButton, ScreenContainer } from '@/components';
import { useSellFlow } from '@/hooks';
import type { ChainId } from '@/config/chains';
import { DfxColors, Typography } from '@/theme';

type SellStep = 'amount' | 'bank' | 'confirm';

const CHAIN_ASSET: Record<ChainId, string> = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  arbitrum: 'ETH',
  polygon: 'MATIC',
};

export default function SellScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { paymentInfo, isLoading, error, createPaymentInfo } = useSellFlow();
  const [step, setStep] = useState<SellStep>('amount');
  const [selectedChain, setSelectedChain] = useState<ChainId>('ethereum');
  const [amount, setAmount] = useState('');
  const [iban, setIban] = useState('');

  const renderAmountStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>How much do you want to sell?</Text>

      <ChainSelector selected={selectedChain} onSelect={setSelectedChain} />

      <View style={styles.amountContainer}>
        <TextInput
          style={styles.amountInput}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor={DfxColors.textTertiary}
          keyboardType="decimal-pad"
        />
        <Text style={styles.amountUnit}>{selectedChain === 'bitcoin' ? 'BTC' : 'ETH'}</Text>
      </View>

      <View style={styles.spacer} />

      <PrimaryButton
        title={t('common.continue')}
        onPress={() => setStep('bank')}
        disabled={!amount || parseFloat(amount) <= 0}
      />
    </View>
  );

  const renderBankStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Bank Account</Text>
      <Text style={styles.description}>Enter the IBAN where you want to receive your funds.</Text>

      <TextInput
        style={styles.ibanInput}
        value={iban}
        onChangeText={setIban}
        placeholder="CH00 0000 0000 0000 0000 0"
        placeholderTextColor={DfxColors.textTertiary}
        autoCapitalize="characters"
        autoCorrect={false}
      />

      <View style={styles.spacer} />

      {error && <Text style={styles.errorText}>{error}</Text>}

      <PrimaryButton
        title={t('common.continue')}
        onPress={async () => {
          const info = await createPaymentInfo({
            amount: parseFloat(amount),
            asset: CHAIN_ASSET[selectedChain],
            blockchain: selectedChain.charAt(0).toUpperCase() + selectedChain.slice(1),
            currency: 'CHF',
            iban: iban.replace(/\s/g, ''),
          });
          if (info) setStep('confirm');
        }}
        disabled={iban.replace(/\s/g, '').length < 15}
        loading={isLoading}
      />
    </View>
  );

  const renderConfirmStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Confirm Sale</Text>

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>You sell</Text>
          <Text style={styles.summaryValue}>
            {paymentInfo?.amount ?? amount} {paymentInfo?.asset?.name ?? CHAIN_ASSET[selectedChain]}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>You receive (est.)</Text>
          <Text style={styles.summaryValue}>
            ~{paymentInfo?.estimatedAmount?.toFixed(2) ?? '—'}{' '}
            {paymentInfo?.currency?.name ?? 'CHF'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>To IBAN</Text>
          <Text style={styles.summaryValue}>{paymentInfo?.beneficiary?.iban ?? iban}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Deposit to</Text>
          <Text style={styles.summaryValue} numberOfLines={1}>
            {paymentInfo?.depositAddress
              ? `${paymentInfo.depositAddress.slice(0, 10)}...${paymentInfo.depositAddress.slice(-6)}`
              : '—'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Fee</Text>
          <Text style={styles.summaryValue}>{paymentInfo?.fees?.total?.toFixed(2) ?? '—'}%</Text>
        </View>
      </View>

      <Text style={styles.hint}>
        Send the exact amount to the deposit address above. The fiat amount will be transferred to
        your bank account after the transaction is confirmed.
      </Text>

      <View style={styles.spacer} />

      <PrimaryButton title="Sell now" onPress={() => router.back()} />
    </View>
  );

  return (
    <ScreenContainer scrollable>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => (step === 'amount' ? router.back() : setStep('amount'))}>
            <Text style={styles.backButton}>{'\u2190'}</Text>
          </Pressable>
          <Text style={styles.title}>{t('sell.title')}</Text>
          <View style={styles.backButton} />
        </View>

        {step === 'amount' && renderAmountStep()}
        {step === 'bank' && renderBankStep()}
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
  description: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
  },
  amountContainer: {
    alignItems: 'center',
    gap: 8,
  },
  amountInput: {
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    padding: 20,
    fontSize: 32,
    fontWeight: '700',
    color: DfxColors.text,
    textAlign: 'center',
    width: '100%',
  },
  amountUnit: {
    ...Typography.bodyLarge,
    color: DfxColors.textSecondary,
  },
  ibanInput: {
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    padding: 16,
    color: DfxColors.text,
    ...Typography.bodyLarge,
    letterSpacing: 1,
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
  },
  hint: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
    textAlign: 'center',
  },
  errorText: {
    ...Typography.bodySmall,
    color: DfxColors.error,
    textAlign: 'center',
  },
  spacer: {
    flex: 1,
  },
});
