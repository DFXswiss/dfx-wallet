import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components';
import { DfxColors, Typography } from '@/theme';

export default function SendScreen() {
  const { t } = useTranslation();

  // TODO: Port send flow from RealUnit (chain/asset selector, recipient, amount, confirm)
  // Mirrors: screens/send/ + screens/send_invoice/

  return (
    <ScreenContainer scrollable>
      <View style={styles.content}>
        <Text style={styles.title}>{t('send.title')}</Text>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Send flow (chain selector, recipient, amount, QR scan, confirm)</Text>
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
