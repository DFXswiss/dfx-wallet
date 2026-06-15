import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Icon } from '@/components';
import { isOpenCryptoPayQR } from '@/services/opencryptopay';
import { useAuthStore } from '@/store';
import { DfxColors, Typography } from '@/theme';

// LAN fallback for the Cloister config endpoint when a scanned QR omits it.
const DEFAULT_LAN = process.env.EXPO_PUBLIC_CLOISTER_LAN ?? '192.168.178.110';

// Camera cut-out window — positioned as screen-size percentages so the live
// camera lands exactly inside the scanner-frame artwork baked into pay-bg.png
// (these values are pixel-aligned against that asset — do not retune).
const CUTOUT_PCT = {
  left: 0.0925,
  top: 0.3257,
  width: 0.8115,
  height: 0.3838,
};

type PayMode = 'normal' | 'silent';

export default function PayScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const { cloisterEnabled } = useAuthStore();
  const [scanned, setScanned] = useState(false);
  const [mode, setMode] = useState<PayMode>('silent');

  useEffect(() => {
    if (!permission?.granted) void requestPermission();
  }, [permission, requestPermission]);

  // Re-arm the scanner whenever the screen regains focus (e.g. after backing
  // out of the confirm/invoice screen) so a second scan works.
  useFocusEffect(
    useCallback(() => {
      setScanned(false);
    }, []),
  );

  const handleScan = ({ data }: { data: string }) => {
    if (scanned) return;

    if (mode === 'silent') {
      // Shielded payments are an opt-in feature gated on the highest KYC level
      // (set in Settings → Private Payments). If it isn't enabled, send the
      // user there instead of onto the shielded rail.
      if (!cloisterEnabled) {
        Alert.alert(t('settings.privatePayments'), t('privatePayments.notEnabled'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.continue'), onPress: () => router.push('/(auth)/private-payments') },
        ]);
        return;
      }
      // Silent → Cloister shielded payment. Only Cloister Pay QR codes carry
      // the shielded-pool config; reject anything else rather than silently
      // dropping the user onto the wrong rail.
      if (!data.includes('cloister-pay')) {
        Alert.alert(t('pay.modeSilent'), t('pay.wrongQrSilent'));
        return;
      }
      setScanned(true);
      const qi = data.indexOf('?');
      const params = new URLSearchParams(qi >= 0 ? data.slice(qi + 1) : '');
      router.push({
        pathname: '/(auth)/pay/cloister',
        params: {
          config: params.get('config') ?? `http://${DEFAULT_LAN}:8790/config`,
          amount: params.get('amount') ?? '250',
        },
      });
      return;
    }

    // Normal → DFX OpenCryptoPay standard.
    setScanned(true);
    if (isOpenCryptoPayQR(data)) {
      router.push({ pathname: '/(auth)/pay/opencryptopay', params: { lnurl: data } });
      return;
    }
    Alert.alert(t('pay.comingSoonTitle'), t('pay.comingSoonMessage', { data }), [
      { text: t('common.ok'), onPress: () => setScanned(false) },
    ]);
  };

  const cutoutStyle = {
    left: width * CUTOUT_PCT.left,
    top: height * CUTOUT_PCT.top,
    width: width * CUTOUT_PCT.width,
    height: height * CUTOUT_PCT.height,
  };

  const isSilent = mode === 'silent';

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <ImageBackground
        source={require('../../../assets/pay-bg.png')}
        style={styles.bg}
        resizeMode="cover"
      >
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
              <Icon name="arrow-left" size={26} color={DfxColors.text} />
            </Pressable>

            <Image
              source={require('../../../assets/dfx-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            <Pressable
              onPress={() => router.push('/settings')}
              hitSlop={12}
              style={[styles.headerSlot, styles.headerSlotRight]}
              accessibilityRole="button"
              accessibilityLabel={t('settings.title')}
              testID="pay-menu-button"
            >
              <Icon name="menu" size={26} color={DfxColors.primary} strokeWidth={2.5} />
            </Pressable>
          </View>

          <View style={styles.spacer} />

          {/* Floating control card — solid surface keeps the labels readable
              over the photographic background. */}
          <View style={styles.panel}>
            <View style={styles.toggle}>
              <Pressable
                style={[styles.segment, !isSilent && styles.segmentActive]}
                onPress={() => setMode('normal')}
                accessibilityRole="tab"
                accessibilityState={{ selected: !isSilent }}
                testID="pay-mode-normal"
              >
                <Text style={[styles.segmentText, !isSilent && styles.segmentTextActive]}>
                  {t('pay.modeNormal')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.segment, isSilent && styles.segmentActive]}
                onPress={() => setMode('silent')}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSilent }}
                testID="pay-mode-silent"
              >
                <Icon
                  name="shield"
                  size={15}
                  color={isSilent ? DfxColors.white : DfxColors.textSecondary}
                  strokeWidth={2.4}
                />
                <Text style={[styles.segmentText, isSilent && styles.segmentTextActive]}>
                  {t('pay.modeSilent')}
                </Text>
              </Pressable>
            </View>

            <View style={styles.hintRow}>
              <Icon
                name={isSilent ? 'shield' : 'lightning'}
                size={14}
                color={DfxColors.primary}
                strokeWidth={2.2}
              />
              <Text style={styles.hintText} numberOfLines={2}>
                {isSilent ? t('pay.modeSilentHint') : t('pay.modeNormalHint')}
              </Text>
            </View>
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
  spacer: {
    flex: 1,
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
  logo: {
    height: 30,
    width: 110,
  },
  cutout: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: 'rgba(11, 20, 38, 0.18)',
  },
  panel: {
    backgroundColor: DfxColors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: DfxColors.border,
    padding: 8,
    marginBottom: 10,
    gap: 4,
    shadowColor: '#0B1426',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: DfxColors.surfaceLight,
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  segmentActive: {
    backgroundColor: DfxColors.primary,
    shadowColor: DfxColors.primaryDark,
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  segmentText: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: DfxColors.textSecondary,
  },
  segmentTextActive: {
    color: DfxColors.white,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
    // Fixed height fits up to 2 lines, so the panel — and therefore the
    // camera cut-out above it — never shifts when the hint changes length
    // between Normal (1 line) and Privat (2 lines).
    height: 46,
  },
  hintText: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
    textAlign: 'center',
    flexShrink: 1,
  },
  permissionFallback: {
    ...StyleSheet.absoluteFillObject,
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
