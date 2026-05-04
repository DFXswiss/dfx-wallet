import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useWallet } from '@tetherto/wdk-react-native-provider';
import { ChainSelector, PrimaryButton, QrCode, ScreenContainer } from '@/components';
import type { ChainId } from '@/config/chains';
import { DfxColors, Typography } from '@/theme';

const CHAIN_TO_NETWORK: Record<ChainId, string> = {
  bitcoin: 'bitcoin',
  ethereum: 'ethereum',
  arbitrum: 'arbitrum',
  polygon: 'polygon',
};

export default function ReceiveScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { addresses } = useWallet();
  const [selectedChain, setSelectedChain] = useState<ChainId>('bitcoin');
  const [copied, setCopied] = useState(false);

  const networkKey = CHAIN_TO_NETWORK[selectedChain];
  const address = (addresses as Record<string, string> | undefined)?.[networkKey] ?? '';

  const handleCopy = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
          {address ? (
            <QrCode value={address} size={220} />
          ) : (
            <View style={styles.qrPlaceholder}>
              <Text style={styles.qrPlaceholderText}>No address</Text>
            </View>
          )}
        </View>

        <View style={styles.addressContainer}>
          <Text style={styles.addressLabel}>Your {selectedChain} address</Text>
          <Text style={styles.address} selectable numberOfLines={2}>
            {address || 'Wallet not initialized'}
          </Text>
        </View>

        <PrimaryButton
          title={copied ? 'Copied!' : 'Copy Address'}
          onPress={handleCopy}
          disabled={!address}
        />

        <Text style={styles.warning}>
          Only send {selectedChain === 'bitcoin' ? 'BTC' : 'compatible tokens'} on the{' '}
          {selectedChain} network to this address.
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
    paddingVertical: 16,
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
