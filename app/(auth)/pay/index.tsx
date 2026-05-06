import { useEffect, useState } from 'react';
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
import { DashboardHeader, Icon, MenuModal } from '@/components';
import { DfxColors, Typography } from '@/theme';

const CUTOUT_PCT = {
  left: 0.0925,
  top: 0.3257,
  width: 0.8115,
  height: 0.3838,
};

export default function PayScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground
        source={require('../../../assets/pay-bg.png')}
        style={styles.bg}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.flow} edges={['top', 'left', 'right', 'bottom']}>
          <DashboardHeader onMenuPress={() => setMenuOpen(true)} />

          <View style={{ flex: 1 }} />

          <View style={styles.lightningWrapper}>
            <Pressable
              style={styles.lightningButton}
              onPress={() => Alert.alert(t('pay.lightningComingSoon'))}
              accessibilityRole="button"
              accessibilityLabel={t('pay.lightning')}
              testID="pay-lightning-button"
            >
              <Icon name="lightning" size={28} color={DfxColors.primary} />
            </Pressable>
          </View>
        </SafeAreaView>

        <View style={[styles.cutout, cutoutStyle]}>
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
        </View>

        <View
          pointerEvents="none"
          style={[styles.corner, styles.cornerTL, { top: cutoutStyle.top, left: cutoutStyle.left }]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.corner,
            styles.cornerTR,
            { top: cutoutStyle.top, left: cutoutStyle.left + cutoutStyle.width - 72 },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.corner,
            styles.cornerBL,
            { top: cutoutStyle.top + cutoutStyle.height - 72, left: cutoutStyle.left },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.corner,
            styles.cornerBR,
            {
              top: cutoutStyle.top + cutoutStyle.height - 72,
              left: cutoutStyle.left + cutoutStyle.width - 72,
            },
          ]}
        />

        <MenuModal visible={menuOpen} onClose={() => setMenuOpen(false)} />
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: DfxColors.background,
  },
  flow: {
    flex: 1,
    paddingHorizontal: 20,
  },
  cutout: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: 'rgba(11, 20, 38, 0.18)',
  },
  corner: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.7,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  cornerTL: {
    borderTopWidth: 8,
    borderLeftWidth: 8,
    borderTopLeftRadius: 22,
  },
  cornerTR: {
    borderTopWidth: 8,
    borderRightWidth: 8,
    borderTopRightRadius: 22,
  },
  cornerBL: {
    borderBottomWidth: 8,
    borderLeftWidth: 8,
    borderBottomLeftRadius: 22,
  },
  cornerBR: {
    borderBottomWidth: 8,
    borderRightWidth: 8,
    borderBottomRightRadius: 22,
  },
  lightningWrapper: {
    alignItems: 'center',
    paddingBottom: 32,
  },
  lightningButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: DfxColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B1426',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  permissionFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  permissionText: {
    ...Typography.bodyMedium,
    color: DfxColors.text,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: DfxColors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  permissionButtonText: {
    ...Typography.bodyMedium,
    color: DfxColors.white,
    fontWeight: '600',
  },
});
