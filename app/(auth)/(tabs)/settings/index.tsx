import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useWallet } from '@tetherto/wdk-react-native-provider';
import { ScreenContainer } from '@/components';
import { secureStorage, StorageKeys } from '@/services/storage';
import { useAuthStore } from '@/store';
import { DfxColors, Typography } from '@/theme';

type SettingsItem = {
  label: string;
  route?: string;
  onPress?: () => void;
  destructive?: boolean;
};

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { reset } = useAuthStore();
  const { clearWallet } = useWallet();
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
          await clearWallet();
          await reset();
          router.replace('/');
        },
      },
    ]);
  };

  const items: SettingsItem[] = [
    { label: t('settings.userData'), route: '/(auth)/kyc' },
    { label: t('settings.walletAddress') },
    { label: t('settings.seed') },
    { label: 'Hardware Wallet', route: '/(auth)/hardware-connect' },
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
            onPress={() => {
              if (item.onPress) item.onPress();
              else if (item.route) router.push(item.route as never);
            }}
          >
            <Text style={styles.itemLabel}>{item.label}</Text>
            <Text style={styles.chevron}>{'\u203A'}</Text>
          </Pressable>
        ))}

        <View style={styles.dangerSection}>
          <Pressable
            style={({ pressed }) => [styles.item, styles.dangerItem, pressed && styles.pressed]}
            onPress={handleDeleteWallet}
          >
            <Text style={styles.dangerLabel}>Delete Wallet</Text>
          </Pressable>
        </View>

        <Text style={styles.version}>DFX Wallet v0.1.0</Text>
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
  dangerSection: {
    marginTop: 24,
  },
  dangerItem: {
    justifyContent: 'center',
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
    marginTop: 24,
  },
});
