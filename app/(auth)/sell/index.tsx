import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components';
import { DfxColors, Typography } from '@/theme';

export default function SellScreen() {
  const { t } = useTranslation();

  // TODO: Port sell flow from RealUnit (balance, bank accounts, converter, confirm)
  // Mirrors: screens/sell/ (cubits: sell_balance, sell_bank_accounts, sell_converter, sell_confirm)

  return (
    <ScreenContainer scrollable>
      <View style={styles.content}>
        <Text style={styles.title}>{t('sell.title')}</Text>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Sell flow (asset selector, bank account, amount, confirm)</Text>
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
