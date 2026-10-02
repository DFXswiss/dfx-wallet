import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BrandLogo,
  GlassIconButton,
  GlassPill,
  GlassSurface,
  Icon,
  ScreenBackdrop,
} from '@/components';
import {
  Layout,
  Radius,
  Spacing,
  Typography,
  useColors,
  useResolvedScheme,
  type ThemeColors,
} from '@/theme';

const CUTOUT_PCT = {
  left: 0.0925,
  top: 0.3257,
  width: 0.8115,
  height: 0.3838,
};

type Props = {
  onScan: (data: string) => boolean;
  onClose: () => void;
  onOpenSettings: () => void;
};

export function ScannerView({ onScan, onClose, onOpenSettings }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const scheme = useResolvedScheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width, height } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const scannedRef = useRef(false);
  const [unknownData, setUnknownData] = useState<string | null>(null);

  useEffect(() => {
    if (!permission?.granted) void requestPermission();
  }, [permission, requestPermission]);

  const processScan = useCallback(
    (data: string) => {
      if (scannedRef.current) return;
      scannedRef.current = true;
      setScanned(true);
      if (!onScan(data)) setUnknownData(data);
    },
    [onScan],
  );

  const handleScan = useCallback(
    ({ data }: { data: string }) => {
      processScan(data);
    },
    [processScan],
  );

  const handlePaste = useCallback(async () => {
    const text = await Clipboard.getStringAsync();
    if (text) processScan(text);
  }, [processScan]);

  const handleCopy = useCallback(async () => {
    if (unknownData !== null) await Clipboard.setStringAsync(unknownData);
  }, [unknownData]);

  const handleRescan = useCallback(() => {
    scannedRef.current = false;
    setScanned(false);
    setUnknownData(null);
  }, []);

  const cutoutStyle = {
    left: width * CUTOUT_PCT.left,
    top: height * CUTOUT_PCT.top,
    width: width * CUTOUT_PCT.width,
    height: height * CUTOUT_PCT.height,
  };

  return (
    <View style={styles.bg} testID="scanner-view">
      <ScreenBackdrop variant="pay" />

      <SafeAreaView style={styles.flow} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.header}>
          <GlassIconButton
            icon={<Icon name="arrow-left" size={26} color={colors.text} />}
            onPress={onClose}
            size={36}
            accessibilityLabel={t('common.back')}
            testID="pay-back-button"
          />

          <BrandLogo size="header" />

          <GlassIconButton
            icon={<Icon name="menu" size={26} color={colors.primary} strokeWidth={2.5} />}
            onPress={onOpenSettings}
            size={36}
            accessibilityLabel={t('settings.title')}
            testID="pay-menu-button"
          />
        </View>

        <View style={styles.spacer} />

        {unknownData === null ? (
          <GlassPill
            shape="rounded"
            onPress={() => void handlePaste()}
            style={styles.pasteButton}
            contentStyle={styles.fullWidthButton}
            testID="scanner-paste"
            accessibilityRole="button"
            accessibilityLabel={t('scan.pasteFromClipboard')}
          >
            {t('scan.pasteFromClipboard')}
          </GlassPill>
        ) : (
          <GlassSurface radius={Radius.xl} style={styles.unknownSheet} testID="scanner-unknown">
            <Text style={styles.unknownTitle}>{t('scan.unknownTitle')}</Text>
            <Text style={styles.unknownBody}>{t('scan.unknownBody')}</Text>
            <Text style={styles.unknownData} numberOfLines={3} ellipsizeMode="middle">
              {unknownData}
            </Text>
            <View style={styles.unknownActions}>
              <GlassPill
                shape="rounded"
                onPress={() => void handleCopy()}
                style={styles.unknownAction}
                contentStyle={styles.fullWidthButton}
                testID="scanner-unknown-copy"
                accessibilityRole="button"
                accessibilityLabel={t('common.copy')}
              >
                {t('common.copy')}
              </GlassPill>
              <GlassPill
                selected
                shape="rounded"
                onPress={handleRescan}
                style={styles.unknownAction}
                contentStyle={styles.fullWidthButton}
                testID="scanner-unknown-rescan"
                accessibilityRole="button"
                accessibilityLabel={t('scan.rescan')}
              >
                {t('scan.rescan')}
              </GlassPill>
            </View>
          </GlassSurface>
        )}
      </SafeAreaView>

      <View style={[styles.cutout, scheme === 'dark' && styles.cutoutDark, cutoutStyle]}>
        {permission?.granted && (
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            {...(!scanned ? { onBarcodeScanned: handleScan } : {})}
          />
        )}
        {!permission?.granted && (
          <View style={styles.permissionFallback}>
            <Text style={styles.permissionText}>{t('pay.cameraPermission')}</Text>
            <Pressable style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>{t('pay.grantPermission')}</Text>
            </Pressable>
          </View>
        )}
        <View style={[styles.cornerBracket, styles.cornerTL]} />
        <View style={[styles.cornerBracket, styles.cornerTR]} />
        <View style={[styles.cornerBracket, styles.cornerBL]} />
        <View style={[styles.cornerBracket, styles.cornerBR]} />
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    bg: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flow: {
      flex: 1,
      paddingHorizontal: Layout.screenPadding,
      zIndex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: Spacing.xs,
      paddingBottom: Spacing.sm,
    },
    spacer: {
      flex: 1,
    },
    cutout: {
      position: 'absolute',
      overflow: 'hidden',
      borderRadius: Radius.lg,
      backgroundColor: colors.scrimSoft,
    },
    cutoutDark: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    cornerBracket: {
      position: 'absolute',
      width: 28,
      height: 28,
      borderColor: colors.primary,
    },
    cornerTL: {
      top: -1,
      left: -1,
      borderTopWidth: 3,
      borderLeftWidth: 3,
      borderTopLeftRadius: Radius.lg,
    },
    cornerTR: {
      top: -1,
      right: -1,
      borderTopWidth: 3,
      borderRightWidth: 3,
      borderTopRightRadius: Radius.lg,
    },
    cornerBL: {
      bottom: -1,
      left: -1,
      borderBottomWidth: 3,
      borderLeftWidth: 3,
      borderBottomLeftRadius: Radius.lg,
    },
    cornerBR: {
      bottom: -1,
      right: -1,
      borderBottomWidth: 3,
      borderRightWidth: 3,
      borderBottomRightRadius: Radius.lg,
    },
    permissionFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.base,
      gap: Spacing.md,
      backgroundColor: colors.cardOverlay,
    },
    permissionText: {
      ...Typography.bodyMedium,
      color: colors.text,
      textAlign: 'center',
    },
    permissionButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: Radius.pill,
    },
    permissionButtonText: {
      ...Typography.bodyMedium,
      color: colors.white,
      fontWeight: '600',
    },
    pasteButton: {
      alignSelf: 'stretch',
      marginBottom: Spacing.lg,
    },
    fullWidthButton: {
      width: '100%',
    },
    unknownSheet: {
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      gap: Spacing.md,
    },
    unknownTitle: {
      ...Typography.headlineSmall,
      color: colors.text,
    },
    unknownBody: {
      ...Typography.bodyMedium,
      color: colors.textSecondary,
    },
    unknownData: {
      ...Typography.mono,
      color: colors.text,
    },
    unknownActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    unknownAction: {
      flex: 1,
    },
  });
