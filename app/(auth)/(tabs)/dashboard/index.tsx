import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActionBar, BalanceCard, ScreenContainer } from '@/components';
import { DfxColors, Typography } from '@/theme';

export default function DashboardScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const actions = [
    {
      icon: '\u2B06',
      label: t('buy.title'),
      onPress: () => router.push('/(auth)/buy'),
    },
    {
      icon: '\u2B07',
      label: t('sell.title'),
      onPress: () => router.push('/(auth)/sell'),
    },
    {
      icon: '\u27A1',
      label: t('send.title'),
      onPress: () => router.push('/(auth)/send'),
    },
    {
      icon: '\u2B05',
      label: t('receive.title'),
      onPress: () => router.push('/(auth)/receive'),
    },
  ];

  return (
    <ScreenContainer scrollable>
      <View style={styles.content}>
        <BalanceCard totalBalance="0.00" currency="CHF" />
        <ActionBar actions={actions} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dashboard.portfolio')}</Text>
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No assets yet</Text>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: 16,
    gap: 16,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
  },
  emptyState: {
    padding: 32,
    borderRadius: 16,
    backgroundColor: DfxColors.surface,
    alignItems: 'center',
  },
  emptyText: {
    ...Typography.bodyMedium,
    color: DfxColors.textTertiary,
  },
});
