import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader, GlassCard, GlassSurface, Icon, ScreenBackdrop } from '@/components';
import type { ChainId } from '@/config/chains';
import { AssetCoinSelector } from '@/features/transfer/AssetCoinSelector';
import { BuyCard } from '@/features/transfer/BuyCard';
import { GroupedAddress } from '@/features/transfer/GroupedAddress';
import { NetworkBar } from '@/features/transfer/NetworkBar';
import { NetworkWarning } from '@/features/transfer/NetworkWarning';
import { OwnCodeFullscreen } from '@/features/transfer/OwnCodeFullscreen';
import { useReceivePresentation } from '@/features/transfer/useReceivePresentation';
import {
  Interaction,
  Layout,
  Radius,
  Spacing,
  Typography,
  useColors,
  useResolvedScheme,
  type ThemeColors,
} from '@/theme';

const QR_TILE_SIZE = 212;
const QR_PADDING = 14;
const QR_SIZE = QR_TILE_SIZE - 2 * QR_PADDING;

export default function ReceiveScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useColors();
  const scheme = useResolvedScheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');
  const [selectedChain, setSelectedChain] = useState<ChainId>('bitcoin');
  const [copied, setCopied] = useState(false);
  const [ownCodeOpen, setOwnCodeOpen] = useState(false);
  const presentation = useReceivePresentation(selectedSymbol, selectedChain);
  const foreground = scheme === 'dark' ? colors.background : colors.white;

  const handleAssetChange = (key: string) => {
    const asset = presentation.assets.find((option) => option.symbol.toLowerCase() === key);
    if (!asset) return;
    setSelectedSymbol(asset.symbol);
    setSelectedChain(asset.chains[0]!.chain);
    setCopied(false);
  };

  const handleChainChange = (chain: string) => {
    const option = presentation.asset.chains.find((candidate) => candidate.chain === chain);
    if (!option) return;
    setSelectedChain(option.chain);
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!presentation.address) return;
    await Clipboard.setStringAsync(presentation.address);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (!presentation.address) return;
    void Share.share({ message: presentation.address });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <View style={styles.bg}>
        <ScreenBackdrop />
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <AppHeader
            title={t('receive.title')}
            onBack={() => router.back()}
            testID="receive-screen"
          />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <BuyCard
              title={presentation.buyTitle}
              onPress={() =>
                router.push({
                  pathname: '/(auth)/buy',
                  params: { asset: presentation.asset.symbol },
                })
              }
            />

            <AssetCoinSelector
              options={presentation.assets.map((asset) => ({
                key: asset.symbol.toLowerCase(),
                symbol: asset.symbol,
              }))}
              value={presentation.asset.symbol.toLowerCase()}
              onChange={handleAssetChange}
              testIDPrefix="receive-asset"
            />

            <NetworkBar
              options={presentation.networks}
              value={presentation.chain.chain}
              onChange={handleChainChange}
              testIDPrefix="receive-chain"
            />

            <GlassCard contentStyle={styles.qrCard}>
              <Text style={styles.addressTitle}>{presentation.addressTitle}</Text>

              <Pressable
                testID="receive-qr"
                accessibilityRole="button"
                accessibilityLabel={t('send.showCode')}
                onPress={() => setOwnCodeOpen(true)}
                style={styles.qrTile}
              >
                {presentation.address ? (
                  <QRCode
                    value={presentation.address}
                    size={QR_SIZE}
                    quietZone={0}
                    backgroundColor={colors.white}
                    color={colors.black}
                  />
                ) : (
                  <Text style={styles.noAddress}>{t('receive.noAddress')}</Text>
                )}
                <View style={styles.expandBadge} pointerEvents="none">
                  <Icon name="expand" size={15} color={colors.white} strokeWidth={2.4} />
                </View>
              </Pressable>

              {presentation.address ? (
                <GroupedAddress address={presentation.address} testID="receive-address" />
              ) : (
                <Text testID="receive-address" style={styles.noAddress} selectable>
                  {t('receive.noAddress')}
                </Text>
              )}

              <NetworkWarning text={presentation.warningText} testID="receive-network-warning" />

              <View style={styles.actions}>
                <Pressable
                  testID="receive-copy-button"
                  accessibilityRole="button"
                  accessibilityLabel={copied ? t('common.copied') : t('common.copy')}
                  accessibilityState={{ disabled: !presentation.address }}
                  disabled={!presentation.address}
                  onPress={handleCopy}
                  style={({ pressed }) => [
                    styles.action,
                    styles.copyAction,
                    !presentation.address && styles.actionDisabled,
                    pressed && styles.actionPressed,
                  ]}
                >
                  <Icon name="copy" size={17} color={foreground} />
                  <Text style={[styles.actionText, { color: foreground }]}>
                    {copied ? t('common.copied') : t('common.copy')}
                  </Text>
                </Pressable>
                <Pressable
                  testID="receive-share-button"
                  accessibilityRole="button"
                  accessibilityLabel={t('send.share')}
                  accessibilityState={{ disabled: !presentation.address }}
                  disabled={!presentation.address}
                  onPress={handleShare}
                  style={({ pressed }) => [
                    styles.action,
                    !presentation.address && styles.actionDisabled,
                    pressed && styles.actionPressed,
                  ]}
                >
                  <GlassSurface variant="quiet" radius={Radius.sm} style={styles.glassAction}>
                    <Icon name="share" size={17} color={colors.text} />
                    <Text style={[styles.actionText, { color: colors.text }]}>
                      {t('send.share')}
                    </Text>
                  </GlassSurface>
                </Pressable>
              </View>
            </GlassCard>
          </ScrollView>
        </SafeAreaView>
      </View>

      <OwnCodeFullscreen
        visible={ownCodeOpen}
        onClose={() => setOwnCodeOpen(false)}
        initialSymbol={presentation.asset.symbol}
        initialChain={presentation.chain.chain}
      />
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    bg: {
      flex: 1,
      backgroundColor: colors.background,
    },
    safeArea: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Layout.screenPadding,
      paddingTop: Spacing.base,
      paddingBottom: Spacing.xxl,
      gap: Spacing.md,
    },
    qrCard: {
      alignItems: 'center',
      gap: Spacing.md,
    },
    addressTitle: {
      ...Typography.addressLabel,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    qrTile: {
      position: 'relative',
      width: QR_TILE_SIZE,
      height: QR_TILE_SIZE,
      padding: QR_PADDING,
      borderRadius: Radius.lg,
      backgroundColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
    expandBadge: {
      position: 'absolute',
      right: -10,
      bottom: -10,
      width: 30,
      height: 30,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noAddress: {
      ...Typography.bodyMedium,
      color: colors.textTertiary,
      textAlign: 'center',
    },
    actions: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    action: {
      flex: 1,
      height: 48,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    copyAction: {
      backgroundColor: colors.primary,
    },
    glassAction: {
      width: '100%',
      height: '100%',
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    actionText: {
      ...Typography.bodyLarge,
      fontWeight: '600',
    },
    actionDisabled: {
      opacity: Interaction.disabledOpacity,
    },
    actionPressed: {
      opacity: Interaction.pressedOpacity,
      transform: [{ scale: 0.99 }],
    },
  });
