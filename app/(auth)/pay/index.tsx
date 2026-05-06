import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { DashboardHeader, Icon, MenuModal } from '@/components';
import { DfxColors, Typography } from '@/theme';

const CUTOUT_PCT = {
  left: 0.0925,
  top: 0.3496,
  width: 0.8103,
  height: 0.3366,
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
      <View style={styles.root}>
        <Image
          source={require('../../../assets/pay-bg.png')}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />

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

        {permission?.granted ? (
          <View pointerEvents="none" style={[styles.cutout, cutoutStyle]}>
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleScan}
            />
          </View>
        ) : (
          <View style={[styles.cutout, cutoutStyle, styles.permissionFallback]}>
            <Text style={styles.permissionText}>{t('pay.cameraPermission')}</Text>
            <Pressable style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>{t('pay.grantPermission')}</Text>
            </Pressable>
          </View>
        )}

        <MenuModal visible={menuOpen} onClose={() => setMenuOpen(false)} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
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
