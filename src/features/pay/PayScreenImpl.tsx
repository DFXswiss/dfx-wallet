import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BrandLogo, DarkBackdrop, Icon } from '@/components';
import { Typography, useColors, useResolvedScheme, type ThemeColors } from '@/theme';

const CUTOUT_PCT = {
  left: 0.0925,
  top: 0.3257,
  width: 0.8115,
  height: 0.3838,
};

export default function PayScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useColors();
  const scheme = useResolvedScheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width, height } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!permission?.granted) void requestPermission();
  }, [permission, requestPermission]);

  const handleScan = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    Alert.alert(t('pay.comingSoonTitle'), t('pay.comingSoonMessage', { data }), [
      { text: t('common.ok'), onPress: () => router.back() },
    ]);
  };

  const cutoutStyle = {
    left: width * CUTOUT_PCT.left,
    top: height * CUTOUT_PCT.top,
    width: width * CUTOUT_PCT.width,
    height: height * CUTOUT_PCT.height,
  };

  const content = (
    <>
      <SafeAreaView style={styles.flow} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.headerSlot}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            testID="pay-back-button"
          >
            <Icon name="arrow-left" size={26} color={colors.text} />
          </Pressable>

          <BrandLogo size="header" />

          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={12}
            style={[styles.headerSlot, styles.headerSlotRight]}
            accessibilityRole="button"
            accessibilityLabel={t('settings.title')}
            testID="pay-menu-button"
          >
            <Icon name="menu" size={26} color={colors.primary} strokeWidth={2.5} />
          </Pressable>
        </View>

        <View style={{ flex: 1 }} />
      </SafeAreaView>

      <View style={[styles.cutout, scheme === 'dark' && styles.cutoutDark, cutoutStyle]}>
        {permission?.granted && (
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleScan}
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
        {/* Scan-target corner brackets — universal QR-scanner affordance.
            Sit ON TOP of the camera view so the user can always see WHERE
            to align the code, regardless of background contrast. */}
        <View style={[styles.cornerBracket, styles.cornerTL]} />
        <View style={[styles.cornerBracket, styles.cornerTR]} />
        <View style={[styles.cornerBracket, styles.cornerBL]} />
        <View style={[styles.cornerBracket, styles.cornerBR]} />
      </View>
    </>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      {scheme === 'dark' ? (
        <View style={styles.bg}>
          <DarkBackdrop baseColor={colors.background} />
          {content}
        </View>
      ) : (
        <ImageBackground
          source={require('../../../assets/pay-bg.png')}
          style={styles.bg}
          resizeMode="cover"
        >
          {content}
        </ImageBackground>
      )}
    </>
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
      paddingHorizontal: 20,
    },
    cutout: {
      position: 'absolute',
      overflow: 'hidden',
      borderRadius: 20,
      backgroundColor: 'rgba(11, 20, 38, 0.18)',
    },
    // Dark mode has no photo backdrop, so the scan window gets an
    // explicit elevated surface + hairline so the empty state still
    // reads as a target. Camera fills the box when permission is granted.
    cutoutDark: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    // Corner brackets — 24×24 L-shapes anchored to each cutout corner.
    // Border-radius makes the inside corner match the cutout's own
    // rounded box. Primary-color brackets read as a "viewfinder" and
    // remain visible against any camera content.
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
      borderTopLeftRadius: 20,
    },
    cornerTR: {
      top: -1,
      right: -1,
      borderTopWidth: 3,
      borderRightWidth: 3,
      borderTopRightRadius: 20,
    },
    cornerBL: {
      bottom: -1,
      left: -1,
      borderBottomWidth: 3,
      borderLeftWidth: 3,
      borderBottomLeftRadius: 20,
    },
    cornerBR: {
      bottom: -1,
      right: -1,
      borderBottomWidth: 3,
      borderRightWidth: 3,
      borderBottomRightRadius: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 4,
      paddingBottom: 8,
    },
    headerSlot: {
      width: 36,
      height: 36,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    headerSlotRight: {
      alignItems: 'flex-end',
    },
    permissionFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      gap: 12,
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
      borderRadius: 999,
    },
    permissionButtonText: {
      ...Typography.bodyMedium,
      color: colors.white,
      fontWeight: '600',
    },
  });
