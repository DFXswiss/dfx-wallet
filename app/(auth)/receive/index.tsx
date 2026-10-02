import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AppHeader,
  GlassCard,
  Icon,
  PrimaryButton,
  ScreenBackdrop,
  SegmentedControl,
} from '@/components';
import type { ChainId } from '@/config/chains';
import { FEATURES } from '@/config/features';
import { OwnCodeFullscreen } from '@/features/transfer/OwnCodeFullscreen';
import { buildReceiveAssets } from '@/features/transfer/receiveAssets';
import { useReceiveAddress } from '@/features/transfer/useReceiveAddress';
import {
  IconTile,
  Interaction,
  Layout,
  Radius,
  Spacing,
  Typography,
  useColors,
  useResolvedScheme,
  type ThemeColors,
} from '@/theme';

const QR_TILE_SIZE = 168;
const QR_PADDING = 14;
const QR_SIZE = QR_TILE_SIZE - 2 * QR_PADDING;

export default function ReceiveScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useColors();
  const scheme = useResolvedScheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const receiveAssets = useMemo(buildReceiveAssets, []);
  const initialAsset = receiveAssets.find((asset) => asset.symbol === 'BTC') ?? receiveAssets[0]!;
  const [selectedSymbol, setSelectedSymbol] = useState(initialAsset.symbol);
  const [selectedChain, setSelectedChain] = useState<ChainId>(initialAsset.chains[0]!.chain);
  const [copied, setCopied] = useState(false);
  const [ownCodeOpen, setOwnCodeOpen] = useState(false);

  const selectedAsset =
    receiveAssets.find((asset) => asset.symbol === selectedSymbol) ?? initialAsset;
  const selectedNetwork =
    selectedAsset.chains.find((option) => option.chain === selectedChain) ??
    selectedAsset.chains[0]!;
  const address = useReceiveAddress(selectedChain);
  const primaryForeground = scheme === 'dark' ? colors.background : colors.white;

  const handleAssetChange = (key: string) => {
    const asset = receiveAssets.find((option) => option.symbol.toLowerCase() === key);
    if (!asset) return;
    setSelectedSymbol(asset.symbol);
    setSelectedChain(asset.chains[0]!.chain);
    setCopied(false);
  };

  const handleChainChange = (chain: string) => {
    const option = selectedAsset.chains.find((candidate) => candidate.chain === chain);
    if (!option) return;
    setSelectedChain(option.chain);
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (!address) return;
    void Share.share({ message: address });
  };

  const openOwnCode = () => setOwnCodeOpen(true);

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
            {FEATURES.BUY_SELL && (
              <Pressable
                testID="receive-buy"
                accessibilityRole="button"
                accessibilityLabel={t('receive.buyAsset', { asset: selectedAsset.symbol })}
                onPress={() =>
                  router.push({
                    pathname: '/(auth)/buy',
                    params: { asset: selectedAsset.symbol },
                  })
                }
                style={({ pressed }) => [styles.buyCard, pressed && styles.buyCardPressed]}
              >
                <View style={styles.buyIconTile}>
                  <Icon name="bank" size={20} color={primaryForeground} strokeWidth={2.2} />
                </View>
                <View style={styles.buyText}>
                  <Text style={[styles.buyTitle, { color: primaryForeground }]}>
                    {t('receive.buyAsset', { asset: selectedAsset.symbol })}
                  </Text>
                  <Text style={[styles.buySubtitle, { color: primaryForeground }]}>
                    {t('receive.buyFromBankSubtitle')}
                  </Text>
                </View>
                <Icon name="arrow-right" size={20} color={primaryForeground} />
              </Pressable>
            )}

            <SegmentedControl
              options={receiveAssets.map((asset) => ({
                key: asset.symbol.toLowerCase(),
                label: asset.symbol,
              }))}
              value={selectedAsset.symbol.toLowerCase()}
              onChange={handleAssetChange}
              testIDPrefix="receive-asset"
            />

            {selectedAsset.chains.length > 1 && (
              <View testID="receive-chain-bar">
                <SegmentedControl
                  options={selectedAsset.chains.map((option) => ({
                    key: option.chain,
                    label: option.label,
                  }))}
                  value={selectedChain}
                  onChange={handleChainChange}
                  size="sm"
                  testIDPrefix="receive-chain"
                />
              </View>
            )}

            <GlassCard contentStyle={styles.qrCard}>
              <Pressable
                testID="receive-qr"
                accessibilityRole="button"
                accessibilityLabel={t('send.showCode')}
                onPress={openOwnCode}
                style={styles.qrTile}
              >
                {address ? (
                  <QRCode
                    value={address}
                    size={QR_SIZE}
                    quietZone={0}
                    backgroundColor={colors.white}
                    color={colors.black}
                  />
                ) : (
                  <Text style={styles.noAddress}>{t('receive.noAddress')}</Text>
                )}
                <View style={styles.expandBadge} pointerEvents="none">
                  <Icon name="expand" size={12} color={colors.white} strokeWidth={2} />
                </View>
              </Pressable>

              <Pressable
                testID="receive-qr-hint"
                accessibilityRole="button"
                accessibilityLabel={t('send.showCode')}
                onPress={openOwnCode}
              >
                <Text style={styles.qrHint}>{t('send.tapToEnlarge')}</Text>
              </Pressable>

              <Text testID="receive-address" style={styles.address} selectable>
                {address || t('receive.noAddress')}
              </Text>

              <View style={styles.actions}>
                <View style={styles.action}>
                  <PrimaryButton
                    testID="receive-copy-button"
                    title={copied ? t('common.copied') : t('common.copy')}
                    onPress={handleCopy}
                    disabled={!address}
                    icon={<Icon name="copy" size={18} color={colors.white} />}
                  />
                </View>
                <View style={styles.action}>
                  <PrimaryButton
                    testID="receive-share-button"
                    title={t('send.share')}
                    onPress={handleShare}
                    disabled={!address}
                    variant="outlined"
                    icon={<Icon name="share" size={18} color={colors.primary} />}
                  />
                </View>
              </View>
            </GlassCard>

            <Text style={styles.networkHint}>
              {t('receive.onlyCorrectNetwork', {
                asset: selectedAsset.symbol,
                network: selectedNetwork.label,
              })}
            </Text>
          </ScrollView>
        </SafeAreaView>
      </View>

      <OwnCodeFullscreen
        visible={ownCodeOpen}
        onClose={() => setOwnCodeOpen(false)}
        initialSymbol={selectedAsset.symbol}
        initialChain={selectedChain}
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
      paddingBottom: Spacing.xxl,
      gap: Spacing.base,
    },
    buyCard: {
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.base,
      borderRadius: Radius.md,
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOpacity: 0.2,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    buyCardPressed: {
      opacity: Interaction.pressedOpacity,
      transform: [{ scale: 0.99 }],
    },
    buyIconTile: {
      width: IconTile.sm.size,
      height: IconTile.sm.size,
      borderRadius: IconTile.sm.radius,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryDark,
    },
    buyText: {
      flex: 1,
      gap: Spacing.xs,
    },
    buyTitle: {
      ...Typography.bodyLarge,
      fontWeight: '700',
    },
    buySubtitle: {
      ...Typography.bodySmall,
      opacity: 0.82,
    },
    qrCard: {
      alignItems: 'center',
      gap: Spacing.md,
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
    },
    expandBadge: {
      position: 'absolute',
      right: -6,
      bottom: -6,
      width: 22,
      height: 22,
      borderRadius: Radius.sm,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noAddress: {
      ...Typography.bodyMedium,
      color: colors.textTertiary,
      textAlign: 'center',
    },
    qrHint: {
      ...Typography.bodySmall,
      color: colors.primary,
      textAlign: 'center',
    },
    address: {
      ...Typography.mono,
      alignSelf: 'stretch',
      color: colors.text,
      textAlign: 'center',
    },
    actions: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    action: {
      flex: 1,
    },
    networkHint: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: Spacing.md,
    },
  });
