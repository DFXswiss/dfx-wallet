import { useState } from 'react';
import { ImageBackground, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useAccount } from '@tetherto/wdk-react-native-core';
import { AppHeader, ChainSelector, PrimaryButton, QrCode, ShortcutAction } from '@/components';
import type { ChainId } from '@/config/chains';
import { DfxColors, Typography } from '@/theme';

export default function ReceiveScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [selectedChain, setSelectedChain] = useState<ChainId>('ethereum');
  const [copied, setCopied] = useState(false);

  const { address: derivedAddress } = useAccount({ network: selectedChain, accountIndex: 0 });
  const address = derivedAddress ?? '';

  const handleCopy = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground
        source={require('../../../assets/dashboard-bg.png')}
        style={styles.bg}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <AppHeader title={t('receive.title')} testID="receive-screen" />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <ChainSelector selected={selectedChain} onSelect={setSelectedChain} />

            <View style={styles.qrContainer}>
              {address ? (
                <QrCode value={address} size={220} />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Text style={styles.qrPlaceholderText}>No address</Text>
                </View>
              )}
            </View>

            <View style={styles.addressContainer}>
              <Text style={styles.addressLabel}>
                {t('receive.yourAddress', { chain: selectedChain })}
              </Text>
              <Text style={styles.address} selectable numberOfLines={2}>
                {address || 'Wallet not initialized'}
              </Text>
            </View>

            <PrimaryButton
              title={copied ? t('common.copied') : t('common.copy')}
              onPress={handleCopy}
              disabled={!address}
            />

            <Text style={styles.warning}>
              {t('receive.onlyCorrectNetwork', {
                asset: selectedChain === 'spark' ? 'BTC' : 'compatible tokens',
                network: selectedChain,
              })}
            </Text>

            <ShortcutAction
              icon={<Text style={styles.currencyIcon}>{'€'}</Text>}
              label={t('receive.buyBtcWithEuro')}
              onPress={() => router.push('/(auth)/buy')}
              testID="receive-action-buy"
            />
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: DfxColors.background,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 18,
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  qrPlaceholder: {
    width: 220,
    height: 220,
    borderRadius: 16,
    backgroundColor: DfxColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPlaceholderText: {
    ...Typography.bodyMedium,
    color: DfxColors.textTertiary,
  },
  addressContainer: {
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 8,
    alignItems: 'center',
    shadowColor: '#0B1426',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  addressLabel: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  address: {
    ...Typography.bodyMedium,
    color: DfxColors.text,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  warning: {
    ...Typography.bodySmall,
    color: DfxColors.warning,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  currencyIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: DfxColors.white,
    lineHeight: 22,
  },
});
