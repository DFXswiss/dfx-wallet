import { StyleSheet, Text, View } from 'react-native';
import { DfxColors, Typography } from '@/theme';

type Props = {
  totalBalance: string;
  currency: string;
};

export function BalanceCard({ totalBalance, currency }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Total Balance</Text>
      <Text style={styles.balance}>
        {totalBalance} <Text style={styles.currency}>{currency}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: DfxColors.surface,
    alignItems: 'center',
    gap: 8,
  },
  label: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
  },
  balance: {
    ...Typography.headlineLarge,
    color: DfxColors.text,
  },
  currency: {
    ...Typography.bodyLarge,
    color: DfxColors.textSecondary,
  },
});
