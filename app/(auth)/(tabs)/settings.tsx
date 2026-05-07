import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { useWalletManager } from '@tetherto/wdk-react-native-core';
import { Icon } from '@/components';
import { secureStorage, StorageKeys } from '@/services/storage';
import { useAuthStore, useWalletStore } from '@/store';
import { DfxColors, Typography } from '@/theme';

type IconName = 'user' | 'wallet' | 'shield' | 'globe' | 'document' | 'support';

type SettingsRow = {
  label: string;
  value?: string;
  testID: string;
  icon: IconName;
  route?: string;
  onPress?: () => void;
};

type SettingsSection = {
  title: string;
  rows: SettingsRow[];
};

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { reset } = useAuthStore();
  const { selectedCurrency, setSelectedCurrency } = useWalletStore();
  const CURRENCIES = ['CHF', 'EUR', 'USD'] as const;
  const currentLang = i18n.language?.startsWith('de') ? 'DE' : 'EN';
  const { deleteWallet } = useWalletManager();
  const [walletOrigin, setWalletOrigin] = useState<string | null>(null);

  useEffect(() => {
    void secureStorage.get(StorageKeys.WALLET_ORIGIN).then(setWalletOrigin);
  }, []);

  const handleDeleteWallet = () => {
    const isPasskey = walletOrigin === 'passkey';
    const message = isPasskey
      ? t('settings.deleteWalletConfirmPasskey')
      : t('settings.deleteWalletConfirm');

    Alert.alert(t('settings.deleteWallet'), message, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.deleteWallet'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWallet('default');
          } catch {
            // Wallet may not exist; reset auth state regardless.
          }
          await reset();
          router.replace('/');
        },
      },
    ]);
  };

  const sections: SettingsSection[] = [
    {
      title: t('settings.sectionAccount'),
      rows: [
        {
          icon: 'user',
          label: t('settings.userData'),
          testID: 'settings-user-data',
          route: '/(auth)/kyc',
        },
      ],
    },
    {
      title: t('settings.sectionWalletSecurity'),
      rows: [
        {
          icon: 'wallet',
          label: t('settings.walletAddress'),
          testID: 'settings-wallet-address',
          route: '/(auth)/receive',
        },
        {
          icon: 'shield',
          label: t(walletOrigin === 'passkey' ? 'settings.seed' : 'settings.seedPhrase'),
          testID: 'settings-seed',
          route: '/(auth)/seed-export',
        },
        {
          icon: 'shield',
          label: t('settings.hardwareWallet'),
          testID: 'settings-hardware-wallet',
          route: '/(auth)/hardware-connect',
        },
      ],
    },
    {
      title: t('settings.sectionPreferences'),
      rows: [
        {
          icon: 'globe',
          label: t('settings.language'),
          value: currentLang,
          testID: 'settings-language',
          onPress: () => {
            void i18n.changeLanguage(currentLang === 'DE' ? 'en' : 'de');
          },
        },
        {
          icon: 'globe',
          label: t('settings.currencies'),
          value: selectedCurrency,
          testID: 'settings-currencies',
          onPress: () => {
            const idx = CURRENCIES.indexOf(selectedCurrency as (typeof CURRENCIES)[number]);
            const next = CURRENCIES[(idx + 1) % CURRENCIES.length]!;
            setSelectedCurrency(next);
          },
        },
        {
          icon: 'globe',
          label: t('settings.network'),
          testID: 'settings-network',
          route: '/(auth)/portfolio/manage',
        },
      ],
    },
    {
      title: t('settings.sectionReportsLegal'),
      rows: [
        {
          icon: 'document',
          label: t('settings.taxReport'),
          testID: 'settings-tax-report',
          onPress: () => {
            router.push({
              pathname: '/(auth)/webview',
              params: { url: 'https://docs.dfx.swiss/de/faq.html', title: t('settings.taxReport') },
            });
          },
        },
        {
          icon: 'document',
          label: t('settings.legalDocuments'),
          testID: 'settings-legal-documents',
          onPress: () => {
            router.push({
              pathname: '/(auth)/webview',
              params: {
                url: 'https://docs.dfx.swiss/de/tnc.html',
                title: t('settings.legalDocuments'),
              },
            });
          },
        },
      ],
    },
    {
      title: t('settings.sectionHelp'),
      rows: [
        {
          icon: 'support',
          label: t('settings.contact'),
          testID: 'settings-contact',
          onPress: () => {
            void Linking.openURL('mailto:support@dfx.swiss');
          },
        },
        {
          icon: 'support',
          label: t('support.title'),
          testID: 'settings-support',
          route: '/(auth)/support',
        },
      ],
    },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          gestureEnabled: true,
          title: t('settings.title'),
          headerBackTitle: ' ',
        }}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces
        alwaysBounceVertical
      >
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.rows.map((row, index) => (
                <SettingsRowView
                  key={row.testID}
                  row={row}
                  isLast={index === section.rows.length - 1}
                  onPress={() => {
                    if (row.onPress) row.onPress();
                    else if (row.route) router.push(row.route as never);
                  }}
                />
              ))}
            </View>
          </View>
        ))}

        <Pressable
          testID="settings-delete-wallet"
          style={({ pressed }) => [styles.dangerCard, pressed && styles.pressed]}
          onPress={handleDeleteWallet}
        >
          <Text style={styles.dangerLabel}>{t('settings.deleteWallet')}</Text>
        </Pressable>

        <Text style={styles.version}>DFX Wallet v0.1.0</Text>
      </ScrollView>
    </>
  );
}

type RowProps = {
  row: SettingsRow;
  isLast: boolean;
  onPress: () => void;
};

function SettingsRowView({ row, isLast, onPress }: RowProps) {
  return (
    <Pressable
      testID={row.testID}
      style={({ pressed }) => [styles.row, !isLast && styles.rowDivider, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.rowIcon}>
        <Icon name={row.icon} size={20} color={DfxColors.primary} />
      </View>
      <Text style={styles.rowLabel}>{row.label}</Text>
      {row.value ? <Text style={styles.rowValue}>{row.value}</Text> : null}
      <Icon name="chevron-right" size={18} color={DfxColors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: DfxColors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 120,
    gap: 20,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#0B1426',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DfxColors.border,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: DfxColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    ...Typography.bodyLarge,
    color: DfxColors.text,
    fontWeight: '500',
  },
  rowValue: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
  dangerCard: {
    marginTop: 8,
    paddingVertical: 16,
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#0B1426',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  dangerLabel: {
    ...Typography.bodyLarge,
    color: DfxColors.error,
    fontWeight: '600',
  },
  version: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
    textAlign: 'center',
    marginTop: 16,
  },
});
