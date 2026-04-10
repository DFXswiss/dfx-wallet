import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components';
import { DfxColors, Typography } from '@/theme';

type SettingsItem = {
  label: string;
  route?: string;
};

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const items: SettingsItem[] = [
    { label: t('settings.userData') },
    { label: t('settings.walletAddress') },
    { label: t('settings.seed') },
    { label: t('settings.language') },
    { label: t('settings.currencies') },
    { label: t('settings.network') },
    { label: t('settings.taxReport') },
    { label: t('settings.legalDocuments') },
    { label: t('settings.contact') },
    { label: t('support.title'), route: '/(auth)/support' },
  ];

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('settings.title')}</Text>
        {items.map((item) => (
          <Pressable
            key={item.label}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            onPress={() => item.route && router.push(item.route as never)}
          >
            <Text style={styles.itemLabel}>{item.label}</Text>
            <Text style={styles.chevron}>{'\u203A'}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingVertical: 16,
    gap: 4,
  },
  title: {
    ...Typography.headlineMedium,
    color: DfxColors.text,
    marginBottom: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: DfxColors.surface,
    borderRadius: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  itemLabel: {
    ...Typography.bodyLarge,
    color: DfxColors.text,
  },
  chevron: {
    ...Typography.headlineSmall,
    color: DfxColors.textTertiary,
  },
});
