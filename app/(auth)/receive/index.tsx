import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { ChainSelector, PrimaryButton, ScreenContainer } from '@/components';
import type { ChainId } from '@/config/chains';
import { useWalletStore } from '@/store';
import { DfxColors, Typography } from '@/theme';

export default function ReceiveScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { getAccountForChain } = useWalletStore();
  const [selectedChain, setSelectedChain] = useState<ChainId>('bitcoin');
  const [copied, setCopied] = useState(false);

  const account = getAccountForChain(selectedChain);
  const address = account?.address || '0x0000...0000';

  const handleCopy = async () => {
    await Clipboard.setStringAsync(address);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backButton}>{'\u2190'}</Text>
          </Pressable>
          <Text style={styles.title}>{t('receive.title')}</Text>
          <View style={styles.backButton} />
        </View>

        <ChainSelector selected={selectedChain} onSelect={setSelectedChain} />

        <View style={styles.qrContainer}>
          {/* TODO: Replace with actual QR code component (e.g. react-native-qrcode-svg) */}
          <View style={styles.qrPlaceholder}>
            <Text style={styles.qrText}>QR</Text>
          </View>
        </View>

        <View style={styles.addressContainer}>
          <Text style={styles.addressLabel}>Your {selectedChain} address</Text>
          <Text style={styles.address} selectable>
            {address}
          </Text>
        </View>

        <PrimaryButton title={copied ? 'Copied!' : 'Copy Address'} onPress={handleCopy} />

        <Text style={styles.warning}>
          Only send {selectedChain === 'bitcoin' ? 'BTC' : 'EVM compatible tokens'} to this
          address. Sending other assets may result in permanent loss.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingVertical: 16,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    fontSize: 24,
    color: DfxColors.text,
    width: 32,
  },
  title: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 16,
    backgroundColor: DfxColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrText: {
    fontSize: 48,
    fontWeight: '700',
    color: DfxColors.black,
  },
  addressContainer: {
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 8,
    alignItems: 'center',
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
});
