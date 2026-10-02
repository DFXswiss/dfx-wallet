import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';

import { GlassIconButton } from '@/components/GlassIconButton';
import { Icon } from '@/components/Icon';
import type { ChainId } from '@/config/chains';
import { AssetCoinSelector } from '@/features/transfer/AssetCoinSelector';
import { NetworkTextTabs } from '@/features/transfer/NetworkTextTabs';
import { buildReceiveAssets } from '@/features/transfer/receiveAssets';
import { useReceiveAddress } from '@/features/transfer/useReceiveAddress';
import { Radius, Spacing, Typography, useColors, type ThemeColors } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  initialSymbol?: string;
  initialChain?: ChainId;
};

const QR_PADDING = 20;
const SCREEN_PADDING = 16;
const MAX_QR_SIZE = 300;

export function OwnCodeFullscreen({
  visible,
  onClose,
  initialSymbol = 'BTC',
  initialChain,
}: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const receiveAssets = useMemo(buildReceiveAssets, [visible]);
  const initialAsset = useMemo(
    () =>
      receiveAssets.find((asset) => asset.symbol === initialSymbol) ??
      receiveAssets.find((asset) => asset.symbol === 'BTC') ??
      receiveAssets[0]!,
    [initialSymbol, receiveAssets],
  );
  const resolvedInitialChain = useMemo(
    () =>
      initialAsset.chains.find((option) => option.chain === initialChain)?.chain ??
      initialAsset.chains[0]!.chain,
    [initialAsset, initialChain],
  );
  const [selectedSymbol, setSelectedSymbol] = useState(initialAsset.symbol);
  const [selectedChain, setSelectedChain] = useState<ChainId>(resolvedInitialChain);
  const wasVisible = useRef(false);

  useEffect(() => {
    if (visible && !wasVisible.current) {
      setSelectedSymbol(initialAsset.symbol);
      setSelectedChain(resolvedInitialChain);
    }
    wasVisible.current = visible;
  }, [initialAsset, resolvedInitialChain, visible]);

  const selectedAsset =
    receiveAssets.find((asset) => asset.symbol === selectedSymbol) ?? initialAsset;
  const address = useReceiveAddress(selectedChain);
  const qrSize = Math.min(width - 2 * SCREEN_PADDING - 2 * QR_PADDING, MAX_QR_SIZE);
  const qrTileSize = qrSize + 2 * QR_PADDING;

  const handleAssetChange = (symbol: string) => {
    const asset = receiveAssets.find((option) => option.symbol === symbol);
    if (!asset) return;
    setSelectedSymbol(asset.symbol);
    setSelectedChain(asset.chains[0]!.chain);
  };

  const handleChainChange = (chain: string) => {
    const option = selectedAsset.chains.find((candidate) => candidate.chain === chain);
    if (option) setSelectedChain(option.chain);
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      statusBarTranslucent
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaProvider style={styles.provider}>
        <View style={styles.modal}>
          <Pressable
            style={styles.backdrop}
            onPress={onClose}
            testID="own-code-backdrop"
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          />

          <SafeAreaView
            style={styles.safeArea}
            edges={['top', 'right', 'bottom', 'left']}
            pointerEvents="box-none"
          >
            <View style={styles.header} pointerEvents="box-none">
              <GlassIconButton
                icon={<Icon name="close" size={20} color={colors.text} />}
                onPress={onClose}
                size={40}
                testID="own-code-close"
                accessibilityLabel={t('common.close')}
              />
            </View>

            <View style={styles.content} pointerEvents="box-none">
              <Text style={styles.title} pointerEvents="none">
                {t('send.yourCode')}
              </Text>

              <View style={styles.controls} pointerEvents="box-none">
                <AssetCoinSelector
                  options={receiveAssets.map((asset) => ({
                    key: asset.symbol,
                    symbol: asset.symbol,
                  }))}
                  value={selectedAsset.symbol}
                  onChange={handleAssetChange}
                  testIDPrefix="own-code-asset"
                />
                {selectedAsset.chains.length > 1 && (
                  <NetworkTextTabs
                    options={selectedAsset.chains.map((option) => ({
                      key: option.chain,
                      label: option.label,
                    }))}
                    value={selectedChain}
                    onChange={handleChainChange}
                    testIDPrefix="own-code-chain"
                  />
                )}
              </View>

              {address ? (
                <Pressable
                  onPress={() => undefined}
                  style={[styles.qrTile, { width: qrTileSize, height: qrTileSize }]}
                  testID="own-code-qr"
                >
                  <QRCode
                    value={address}
                    size={qrSize}
                    quietZone={0}
                    backgroundColor={colors.white}
                    color={colors.black}
                  />
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => undefined}
                  style={[styles.qrTile, { width: qrTileSize, height: qrTileSize }]}
                  testID="own-code-no-address"
                >
                  <Text style={styles.noAddress}>{t('receive.noAddress')}</Text>
                </Pressable>
              )}

              <Pressable onPress={() => undefined} style={styles.addressTarget}>
                <Text testID="own-code-address" style={styles.address} selectable>
                  {address || t('receive.noAddress')}
                </Text>
              </Pressable>

              <Text style={styles.closeHint} pointerEvents="none">
                {t('send.closeHint')}
              </Text>
            </View>
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    provider: {
      flex: 1,
    },
    modal: {
      flex: 1,
      backgroundColor: colors.background,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.background,
    },
    safeArea: {
      flex: 1,
    },
    header: {
      minHeight: 40,
      paddingHorizontal: SCREEN_PADDING,
      alignItems: 'flex-end',
    },
    content: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: SCREEN_PADDING,
      paddingTop: Spacing.sm,
      gap: Spacing.md,
    },
    title: {
      ...Typography.headlineSmall,
      color: colors.text,
      textAlign: 'center',
    },
    controls: {
      alignSelf: 'stretch',
      gap: Spacing.base,
    },
    qrTile: {
      padding: QR_PADDING,
      borderRadius: Radius.xl,
      backgroundColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noAddress: {
      ...Typography.bodyMedium,
      color: colors.textTertiary,
      textAlign: 'center',
    },
    addressTarget: {
      maxWidth: '100%',
      padding: Spacing.xs,
    },
    address: {
      ...Typography.mono,
      color: colors.text,
      textAlign: 'center',
    },
    closeHint: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 'auto',
      paddingBottom: Spacing.sm,
    },
  });
