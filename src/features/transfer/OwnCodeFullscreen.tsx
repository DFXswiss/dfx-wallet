import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';

import { GlassIconButton } from '@/components/GlassIconButton';
import { Icon } from '@/components/Icon';
import type { ChainId } from '@/config/chains';
import { AssetCoinSelector } from '@/features/transfer/AssetCoinSelector';
import { GroupedAddress } from '@/features/transfer/GroupedAddress';
import { NetworkBar } from '@/features/transfer/NetworkBar';
import { useReceivePresentation } from '@/features/transfer/useReceivePresentation';
import { Radius, Spacing, Typography, useColors, type ThemeColors } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  initialSymbol?: string;
  initialChain?: ChainId;
};

const QR_PADDING = 20;
const SCREEN_PADDING = 16;
const MAX_QR_TILE_SIZE = 300;

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
  const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol);
  const [selectedChain, setSelectedChain] = useState<ChainId>(initialChain ?? 'bitcoin');
  const presentation = useReceivePresentation(selectedSymbol, selectedChain);
  const wasVisible = useRef(false);

  useEffect(() => {
    if (visible && !wasVisible.current) {
      const asset =
        presentation.assets.find((option) => option.symbol === initialSymbol) ??
        presentation.assets.find((option) => option.symbol === 'BTC') ??
        presentation.assets[0]!;
      const chain =
        asset.chains.find((option) => option.chain === initialChain)?.chain ??
        asset.chains[0]!.chain;
      setSelectedSymbol(asset.symbol);
      setSelectedChain(chain);
    }
    wasVisible.current = visible;
  }, [initialChain, initialSymbol, presentation.assets, visible]);

  const qrTileSize = Math.min(width - 2 * SCREEN_PADDING, MAX_QR_TILE_SIZE);
  const qrSize = qrTileSize - 2 * QR_PADDING;

  const handleAssetChange = (symbol: string) => {
    const asset = presentation.assets.find((option) => option.symbol === symbol);
    if (!asset) return;
    setSelectedSymbol(asset.symbol);
    setSelectedChain(asset.chains[0]!.chain);
  };

  const handleChainChange = (chain: string) => {
    const option = presentation.asset.chains.find((candidate) => candidate.chain === chain);
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
              <View style={styles.headerSpacer} />
              <Text style={styles.title} pointerEvents="none">
                {t('send.yourCode')}
              </Text>
              <GlassIconButton
                icon={<Icon name="close" size={20} color={colors.text} />}
                onPress={onClose}
                size={40}
                testID="own-code-close"
                accessibilityLabel={t('common.close')}
              />
            </View>

            <View style={styles.content} pointerEvents="box-none">
              <AssetCoinSelector
                options={presentation.assets.map((asset) => ({
                  key: asset.symbol,
                  symbol: asset.symbol,
                }))}
                value={presentation.asset.symbol}
                onChange={handleAssetChange}
                testIDPrefix="own-code-asset"
              />

              <NetworkBar
                options={presentation.networks}
                value={presentation.chain.chain}
                onChange={handleChainChange}
                testIDPrefix="own-code-chain"
              />

              {presentation.address ? (
                <Pressable
                  onPress={() => undefined}
                  style={[styles.qrTile, { width: qrTileSize, height: qrTileSize }]}
                  testID="own-code-qr"
                >
                  <QRCode
                    value={presentation.address}
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

              {presentation.address ? (
                <GroupedAddress address={presentation.address} testID="own-code-address" />
              ) : (
                <Text testID="own-code-address" style={styles.noAddress} selectable>
                  {t('receive.noAddress')}
                </Text>
              )}
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerSpacer: {
      width: 40,
      height: 40,
    },
    title: {
      ...Typography.headlineSmall,
      color: colors.text,
      textAlign: 'center',
    },
    content: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: SCREEN_PADDING,
      paddingTop: Spacing.base,
      gap: Spacing.md,
    },
    qrTile: {
      marginTop: Spacing.xs,
      padding: QR_PADDING,
      borderRadius: Radius.xl,
      backgroundColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOpacity: 0.18,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 9 },
      elevation: 4,
    },
    noAddress: {
      ...Typography.bodyMedium,
      color: colors.textTertiary,
      textAlign: 'center',
    },
  });
