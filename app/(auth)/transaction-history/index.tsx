import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components';
import { DfxColors, Typography } from '@/theme';

export default function TransactionHistoryScreen() {
  // TODO: Port transaction history from RealUnit (list, filter, receipt, multi-receipt)
  // Mirrors: screens/transaction_history/ (cubits: filter, receipt, multi_receipt)

  return (
    <ScreenContainer scrollable>
      <View style={styles.content}>
        <Text style={styles.title}>Transaction History</Text>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Transaction list with filters and receipts</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingVertical: 24,
    gap: 24,
  },
  title: {
    ...Typography.headlineMedium,
    color: DfxColors.text,
  },
  placeholder: {
    flex: 1,
    padding: 32,
    borderRadius: 16,
    backgroundColor: DfxColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    ...Typography.bodyMedium,
    color: DfxColors.textTertiary,
    textAlign: 'center',
  },
});
