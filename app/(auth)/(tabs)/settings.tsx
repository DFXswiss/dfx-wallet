import { useEffect, useState } from 'react';
import {
  Alert,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useWalletManager } from '@tetherto/wdk-react-native-core';
import { Icon } from '@/components';
import { isBiometricAvailable } from '@/services/biometric';
import { dfxUserService } from '@/services/dfx';
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
  /** Optional toggle on the right side of the row. When set, the row
   *  renders a native `Switch` instead of the chevron and the tap target
   *  flips the underlying state via the Switch's own onValueChange. */
  toggle?: { value: boolean; onChange: (next: boolean) => void; disabled?: boolean };
};

type SettingsSection = {
  title: string;
  rows: SettingsRow[];
};

export default function SettingsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { reset, isDfxAuthenticated, biometricEnabled, setBiometricEnabled } = useAuthStore();
  const { selectedCurrency, setSelectedCurrency } = useWalletStore();
  const [biometricSupported, setBiometricSupported] = useState<boolean | null>(null);

  // Probe the OS for Face ID / Touch ID support so the toggle is greyed
  // out on devices that can't honour it (older simulators, no enrolled
  // biometric). Single one-shot check on mount — re-checks not needed
  // because enrolment changes mid-session are rare and `setBiometricEnabled`
  // re-validates before persisting anyway.
  useEffect(() => {
    let mounted = true;
    void isBiometricAvailable()
      .then((avail) => {
        if (mounted) setBiometricSupported(avail);
      })
      .catch(() => {
        if (mounted) setBiometricSupported(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleBiometricToggle = async (next: boolean) => {
    // Honour the user's intent even when the OS reports no enrolled
    // biometric (sim, freshly-wiped phone, …) — the lock screen falls
    // back to PIN when Face ID is unavailable, so flipping the toggle
    // off would just force the user to flip it again the moment they
    // enrol biometrics. We surface a one-shot hint when they switch it
    // on without hardware so it's obvious why no Face ID prompt fires.
    if (next && biometricSupported === false) {
      Alert.alert(t('settings.biometric'), t('settings.biometricUnsupported'));
    }
    await setBiometricEnabled(next);
  };

  const syncLanguageToDfx = (locale: 'de' | 'en') => {
    if (!isDfxAuthenticated) return;
    void dfxUserService
      .updateUser({ language: { symbol: locale.toUpperCase() } })
      .catch(() => undefined);
  };

  const syncCurrencyToDfx = (currency: string) => {
    if (!isDfxAuthenticated) return;
    void dfxUserService.updateUser({ currency: { name: currency } }).catch(() => undefined);
  };
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
        {
          icon: 'user',
          label: t('settings.email'),
          testID: 'settings-email',
          route: '/(auth)/email',
        },
      ],
    },
    {
      title: t('settings.sectionWalletSecurity'),
      rows: [
        // Replaces the previous "Wallet address" entry (which deep-linked
        // to the Receive screen, already reachable from the dashboard).
        // The DFX-wallet hub holds the linked-address checkboxes that drive
        // the Portfolio's "Linked DFX wallets" rail, so it earns the slot
        // a user reaches for when looking for "their addresses".
        {
          icon: 'wallet',
          label: t('settings.dfxWallets'),
          testID: 'settings-dfx-wallets',
          route: '/(auth)/wallets',
        },
        // Face ID / Touch ID toggle — the only place the user can flip
        // `biometricEnabled`, which the lock-screen reads on mount to
        // auto-prompt the system biometric sheet. Disabled when the OS
        // reports no enrolled biometric.
        {
          icon: 'shield',
          label: t('settings.biometric'),
          testID: 'settings-biometric',
          toggle: {
            value: biometricEnabled,
            onChange: (next) => void handleBiometricToggle(next),
          },
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
        {
          icon: 'shield',
          label: t('settings.multiSig'),
          testID: 'settings-multi-sig',
          route: '/(auth)/multi-sig',
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
            const next = currentLang === 'DE' ? 'en' : 'de';
            void i18n.changeLanguage(next);
            syncLanguageToDfx(next);
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
            syncCurrencyToDfx(next);
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
          route: '/(auth)/tax-report',
        },
        {
          icon: 'document',
          label: t('settings.legalDocuments'),
          testID: 'settings-legal-documents',
          route: '/(auth)/legal',
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
          route: '/(auth)/contact',
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
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <ImageBackground
        source={require('../../../assets/dashboard-bg.png')}
        style={styles.container}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <View style={styles.header}>
            <Pressable
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/(auth)/(tabs)/dashboard')
              }
              hitSlop={12}
              style={styles.backBtn}
            >
              <Icon name="arrow-left" size={24} color={DfxColors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>{t('settings.title')}</Text>
            <View style={styles.headerSpacer} />
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
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
        </SafeAreaView>
      </ImageBackground>
    </>
  );
}

type RowProps = {
  row: SettingsRow;
  isLast: boolean;
  onPress: () => void;
};

function SettingsRowView({ row, isLast, onPress }: RowProps) {
  // Toggle rows render a Switch instead of the chevron + skip the
  // surrounding press handler so taps on the row body don't conflict
  // with the Switch's own gesture recogniser.
  if (row.toggle) {
    return (
      <View testID={row.testID} style={[styles.row, !isLast && styles.rowDivider]}>
        <View style={styles.rowIcon}>
          <Icon name={row.icon} size={20} color={DfxColors.primary} />
        </View>
        <Text style={styles.rowLabel}>{row.label}</Text>
        <Switch
          value={row.toggle.value}
          onValueChange={row.toggle.onChange}
          disabled={row.toggle.disabled}
          trackColor={{ true: DfxColors.primary, false: DfxColors.border }}
          ios_backgroundColor={DfxColors.border}
        />
      </View>
    );
  }
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
  container: {
    flex: 1,
    backgroundColor: DfxColors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: DfxColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    ...Typography.headlineSmall,
    color: DfxColors.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 120,
    gap: 18,
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
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DfxColors.border,
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
    minHeight: 60,
    paddingVertical: 12,
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
    borderRadius: 10,
    backgroundColor: DfxColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    ...Typography.bodyMedium,
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
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DfxColors.border,
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
