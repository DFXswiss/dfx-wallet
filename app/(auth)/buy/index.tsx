import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChainSelector, PrimaryButton, ScreenContainer } from '@/components';
import { useBuyFlow } from '@/hooks';
import type { ChainId } from '@/config/chains';
import { DfxColors, Typography } from '@/theme';

type BuyStep = 'amount' | 'payment' | 'confirm';

const CURRENCIES = ['CHF', 'EUR', 'USD'] as const;

const CHAIN_ASSET: Record<ChainId, string> = {
  ethereum: 'ETH',
  arbitrum: 'ETH',
  polygon: 'MATIC',
  spark: 'BTC',
  plasma: 'ETH',
  sepolia: 'ETH',
};

export default function BuyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { paymentInfo, isLoading, error, createPaymentInfo, confirmPayment } = useBuyFlow();
  const [step, setStep] = useState<BuyStep>('amount');
  const [selectedChain, setSelectedChain] = useState<ChainId>('ethereum');
  const [amount, setAmount] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<(typeof CURRENCIES)[number]>('CHF');

  const renderAmountStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>How much do you want to buy?</Text>

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
        <View style={styles.currencySelector}>
          {CURRENCIES.map((cur) => (
            <Pressable
              key={cur}
              style={[styles.currencyChip, selectedCurrency === cur && styles.currencyChipActive]}
              onPress={() => setSelectedCurrency(cur)}
            >
              <Text
                style={[styles.currencyText, selectedCurrency === cur && styles.currencyTextActive]}
              >
                {cur}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.quickAmounts}>
        {['100', '500', '1000', '5000'].map((val) => (
          <Pressable key={val} style={styles.quickAmount} onPress={() => setAmount(val)}>
            <Text style={styles.quickAmountText}>{val}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.spacer} />

      {error && <Text style={styles.errorText}>{error}</Text>}

      <PrimaryButton
        title={t('common.continue')}
        onPress={async () => {
          const info = await createPaymentInfo({
            amount: parseFloat(amount),
            currency: selectedCurrency,
            // eslint-disable-next-line security/detect-object-injection -- selectedChain is a ChainId literal union
            asset: CHAIN_ASSET[selectedChain],
            blockchain: selectedChain.charAt(0).toUpperCase() + selectedChain.slice(1),
          });
          if (info) setStep('payment');
        }}
        disabled={!amount || parseFloat(amount) <= 0}
        loading={isLoading}
      />
    </View>
  );

  const renderPaymentStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Payment Information</Text>

      <View style={styles.paymentInfo}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>IBAN</Text>
          <Text style={styles.infoValue}>{paymentInfo?.iban ?? '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>BIC</Text>
          <Text style={styles.infoValue}>{paymentInfo?.bic ?? '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Recipient</Text>
          <Text style={styles.infoValue}>{paymentInfo?.name ?? 'DFX AG'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Reference</Text>
          <Text style={styles.infoValue} selectable>
            {paymentInfo?.remittanceInfo ?? '—'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Amount</Text>
          <Text style={styles.infoValue}>
            {paymentInfo?.amount ?? amount} {paymentInfo?.currency?.name ?? selectedCurrency}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>You receive (est.)</Text>
          <Text style={styles.infoValue}>
            ~{paymentInfo?.estimatedAmount?.toFixed(6) ?? '—'} {paymentInfo?.asset?.name ?? ''}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Fee</Text>
          <Text style={styles.infoValue}>{paymentInfo?.fees?.total?.toFixed(2) ?? '—'}%</Text>
        </View>
      </View>

      <Text style={styles.hint}>
        Transfer the exact amount with the reference code. Your crypto will be sent to your wallet
        after payment is received.
      </Text>

      <View style={styles.spacer} />

      <PrimaryButton
        title={t('common.confirm')}
        onPress={async () => {
          if (paymentInfo) {
            await confirmPayment(paymentInfo.id);
          }
          setStep('confirm');
        }}
        loading={isLoading}
      />
    </View>
  );

  const renderConfirmStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.successContainer}>
        <Text style={styles.successIcon}>{'\u2705'}</Text>
        <Text style={styles.successTitle}>Order placed</Text>
        <Text style={styles.successDescription}>
          Your purchase of {amount} {selectedCurrency} worth of crypto on {selectedChain} has been
          initiated. Make the bank transfer to complete your order.
        </Text>
      </View>

      <View style={styles.spacer} />

      <PrimaryButton title={t('common.done')} onPress={() => router.back()} />
    </View>
  );

  return (
    <ScreenContainer scrollable>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => (step === 'amount' ? router.back() : setStep('amount'))}>
            <Text style={styles.backButton}>{'\u2190'}</Text>
          </Pressable>
          <Text style={styles.title}>{t('buy.title')}</Text>
          <View style={styles.backButton} />
        </View>

        {step === 'amount' && renderAmountStep()}
        {step === 'payment' && renderPaymentStep()}
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
  amountContainer: {
    gap: 12,
  },
  amountInput: {
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    padding: 20,
    fontSize: 32,
    fontWeight: '700',
    color: DfxColors.text,
    textAlign: 'center',
  },
  currencySelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  currencyChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: DfxColors.surface,
  },
  currencyChipActive: {
    backgroundColor: DfxColors.primary,
  },
  currencyText: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: DfxColors.textSecondary,
  },
  currencyTextActive: {
    color: DfxColors.white,
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  quickAmount: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: DfxColors.surface,
  },
  quickAmountText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: DfxColors.textSecondary,
  },
  paymentInfo: {
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    ...Typography.bodyMedium,
    color: DfxColors.textTertiary,
  },
  infoValue: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: DfxColors.text,
    textAlign: 'right',
    flexShrink: 1,
  },
  hint: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 16,
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
    paddingHorizontal: 16,
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
