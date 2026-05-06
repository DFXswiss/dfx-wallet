import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { DashboardHeader, Icon, MenuModal } from '@/components';
import { DfxColors, Typography } from '@/theme';

const FRAME_SIZE = 280;
const CORNER_SIZE = 36;
const CORNER_THICKNESS = 4;
const CORNER_RADIUS = 16;

export default function PayScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const laserAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!permission?.granted) void requestPermission();
  }, [permission, requestPermission]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(laserAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(laserAnim, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [laserAnim]);

  const handleScan = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    Alert.alert(t('pay.comingSoonTitle'), t('pay.comingSoonMessage', { data }), [
      { text: t('common.ok'), onPress: () => router.back() },
    ]);
  };

  const laserY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, FRAME_SIZE - 12],
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground
        source={require('../../../assets/pay-bg.png')}
        style={styles.bg}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          <DashboardHeader onMenuPress={() => setMenuOpen(true)} />

          <Text style={styles.title}>{t('pay.scanToPay')}</Text>

          <View style={styles.frameWrapper}>
            <View style={styles.frame} testID="pay-qr-frame">
              {permission?.granted ? (
                <CameraView
                  style={StyleSheet.absoluteFill}
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={handleScan}
                />
              ) : (
                <View style={styles.permissionFallback}>
                  <Text style={styles.permissionText}>{t('pay.cameraPermission')}</Text>
                  <Pressable style={styles.permissionButton} onPress={requestPermission}>
                    <Text style={styles.permissionButtonText}>{t('pay.grantPermission')}</Text>
                  </Pressable>
                </View>
              )}

              <View pointerEvents="none" style={[styles.corner, styles.cornerTL]} />
              <View pointerEvents="none" style={[styles.corner, styles.cornerTR]} />
              <View pointerEvents="none" style={[styles.corner, styles.cornerBL]} />
              <View pointerEvents="none" style={[styles.corner, styles.cornerBR]} />

              {permission?.granted && (
                <Animated.View
                  pointerEvents="none"
                  style={[styles.laser, { transform: [{ translateY: laserY }] }]}
                />
              )}
            </View>
          </View>

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

          <MenuModal visible={menuOpen} onClose={() => setMenuOpen(false)} />
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
    paddingHorizontal: 20,
  },
  title: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
    textAlign: 'center',
    marginTop: 24,
    fontWeight: '500',
  },
  frameWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderRadius: CORNER_RADIUS,
    overflow: 'hidden',
    backgroundColor: 'rgba(11, 20, 38, 0.08)',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: DfxColors.white,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: CORNER_RADIUS,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: CORNER_RADIUS,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: CORNER_RADIUS,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: CORNER_RADIUS,
  },
  laser: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: DfxColors.primary,
    shadowColor: DfxColors.primary,
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  permissionFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
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
});
