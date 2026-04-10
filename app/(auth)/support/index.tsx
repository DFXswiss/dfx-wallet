import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components';
import { DfxColors, Typography } from '@/theme';

export default function SupportScreen() {
  const { t } = useTranslation();

  // TODO: Port support flow from RealUnit (tickets list, create ticket, chat)
  // Mirrors: screens/support/ (subpages/, cubits/)

  return (
    <ScreenContainer scrollable>
      <View style={styles.content}>
        <Text style={styles.title}>{t('support.title')}</Text>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Support (ticket list, create ticket, chat)</Text>
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
