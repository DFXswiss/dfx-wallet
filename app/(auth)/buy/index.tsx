import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components';
import { DfxColors, Typography } from '@/theme';

export default function BuyScreen() {
  const { t } = useTranslation();

  // TODO: Port buy flow from RealUnit (converter, payment info, confirm)
  // Mirrors: screens/buy/ (cubits: buy_converter, buy_payment_info, buy_confirm)

  return (
    <ScreenContainer scrollable>
      <View style={styles.content}>
        <Text style={styles.title}>{t('buy.title')}</Text>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Buy flow (asset selector, amount converter, SEPA payment info)</Text>
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
