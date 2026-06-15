import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
  Modal,
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
import { warmDepositContext } from '@/features/cloister/deposit';
import { useKycFlow } from '@/features/dfx-backend/useKycFlow';
import { isOpenCryptoPayQR } from '@/services/opencryptopay';
import { useAuthStore } from '@/store';
import { DfxColors, Typography } from '@/theme';

// Cloister build config for warming the fallback leaf cache (incremental/cheap).
const CLOISTER_POOL = process.env.EXPO_PUBLIC_CLOISTER_POOL ?? '';
const CLOISTER_FROM_BLOCK = Number(process.env.EXPO_PUBLIC_CLOISTER_FROM_BLOCK ?? '0');

// LAN fallback for the Cloister config endpoint when a scanned QR omits it.
const DEFAULT_LAN = process.env.EXPO_PUBLIC_CLOISTER_LAN ?? '192.168.178.110';

// Shielded payments require the highest KYC level in production. Testnet eval
// builds set EXPO_PUBLIC_CLOISTER_EVAL=1 to bypass that (no real KYC session).
const REQUIRED_KYC_LEVEL = 50;
const EVAL_BYPASS = process.env.EXPO_PUBLIC_CLOISTER_EVAL === '1';

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
  const { cloisterEnabled, cloisterInfoDismissed, setCloisterInfoDismissed } = useAuthStore();
  // Synchronous guard: React state updates are async, so the camera can fire
  // several frames before `scanned` flips — a ref blocks the duplicate pushes
  // that otherwise stacked multiple confirm screens for one QR.
  const scanLock = useRef(false);
  const [, setScanned] = useState(false);
  const [mode, setMode] = useState<PayMode>('normal');
  const [infoVisible, setInfoVisible] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // KYC level for the Private gate. Skip the network call on eval builds.
  const { loadKycStatus } = useKycFlow();
  const [kycLevel, setKycLevel] = useState<number | null>(null);
  useEffect(() => {
    if (EVAL_BYPASS) return;
    let mounted = true;
    void loadKycStatus()
      .then((dto) => {
        if (mounted) setKycLevel(dto?.kycLevel ?? null);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [loadKycStatus]);
  const verified = EVAL_BYPASS || (kycLevel !== null && kycLevel >= REQUIRED_KYC_LEVEL);

  useEffect(() => {
    if (!permission?.granted) void requestPermission();
  }, [permission, requestPermission]);

  // Warm the fallback leaf cache when entering Pay with private payments on — an
  // incremental delta-sync (only new commitments since the last cached block), so the
  // shielded rail is ready instantly without drawing meaningful power.
  useEffect(() => {
    if (cloisterEnabled && CLOISTER_POOL) {
      void warmDepositContext({ pool: CLOISTER_POOL, fromBlock: CLOISTER_FROM_BLOCK });
    }
  }, [cloisterEnabled]);

  // Re-arm the scanner whenever the screen regains focus (e.g. after backing
  // out of the confirm/invoice screen) so a second scan works.
  useFocusEffect(
    useCallback(() => {
      scanLock.current = false;
      setScanned(false);
    }, []),
  );

  // Private payments are switched on/off in Settings (the master toggle). If
  // they're turned off there while this screen still shows the Private tab,
  // fall back to Normal so a scan can't use the shielded rail behind a
  // disabled setting.
  useEffect(() => {
    if (mode === 'silent' && !cloisterEnabled) setMode('normal');
  }, [mode, cloisterEnabled]);

  // Enter Private mode (caller has already cleared the gates).
  const enablePrivate = () => setMode('silent');

  // Tapping the Private segment. Blocked unless the user is verified AND has
  // switched private payments on in Settings → send them there to verify /
  // enable. First time after that, show the info popup; otherwise switch over.
  const handlePrivatePress = () => {
    if (mode === 'silent') return;
    if (!verified || !cloisterEnabled) {
      router.push('/(auth)/private-payments');
      return;
    }
    if (!cloisterInfoDismissed) {
      setInfoVisible(true);
      return;
    }
    enablePrivate();
  };

  const confirmInfo = () => {
    if (dontShowAgain) void setCloisterInfoDismissed(true);
    setInfoVisible(false);
    enablePrivate();
  };

  // Re-arm the scanner so the next frame is processed (used after a dismissable
  // alert, where the user should be able to retry without leaving the screen).
  const releaseScan = () => {
    scanLock.current = false;
  };

  const handleScan = ({ data }: { data: string }) => {
    // Engage the lock on the very first frame and process exactly one scan.
    // Every subsequent camera frame bails here until the lock is released
    // (on focus after navigating, or when a dismissable alert is closed).
    if (scanLock.current || infoVisible) return;
    scanLock.current = true;

    if (mode === 'silent') {
      // Only Cloister Pay QR codes carry the shielded-pool config; reject
      // anything else and re-arm so the user can try another code.
      if (!data.includes('cloister-pay')) {
        Alert.alert(t('pay.modeSilent'), t('pay.wrongQrSilent'), [
          { text: t('common.ok'), onPress: releaseScan },
        ]);
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
    if (isOpenCryptoPayQR(data)) {
      setScanned(true);
      router.push({ pathname: '/(auth)/pay/opencryptopay', params: { lnurl: data } });
      return;
    }
    Alert.alert(t('pay.comingSoonTitle'), t('pay.comingSoonMessage', { data }), [
      { text: t('common.ok'), onPress: releaseScan },
    ]);
  };

  const cutoutStyle = {
    left: width * CUTOUT_PCT.left,
    top: height * CUTOUT_PCT.top,
    width: width * CUTOUT_PCT.width,
    height: height * CUTOUT_PCT.height,
  };

  const isSilent = mode === 'silent';

  const bullets = [
    t('privatePayments.detailAmount'),
    t('privatePayments.detailLink'),
    t('privatePayments.detailCompliant'),
  ];

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
                onPress={handlePrivatePress}
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
              active={!infoVisible}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={infoVisible ? undefined : handleScan}
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

      {/* First-run info popup for Private payments (brand sheet). */}
      <Modal
        visible={infoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoVisible(false)}
      >
        <View style={styles.modalScrim}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetIcon}>
                <Icon name="shield" size={24} color={DfxColors.primary} />
              </View>
              <Pressable
                onPress={() => setInfoVisible(false)}
                hitSlop={12}
                testID="private-info-close"
                style={styles.sheetClose}
              >
                <Icon name="close" size={20} color={DfxColors.textTertiary} />
              </Pressable>
            </View>

            <Text style={styles.sheetTitle}>{t('privatePayments.heroTitle')}</Text>
            <Text style={styles.sheetIntro}>{t('privatePayments.modalIntro')}</Text>

            <View style={styles.sheetBullets}>
              {bullets.map((b, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Icon name="shield" size={15} color={DfxColors.primary} strokeWidth={2.3} />
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}
            </View>

            <Pressable
              style={styles.checkboxRow}
              onPress={() => setDontShowAgain((v) => !v)}
              testID="private-info-dontshow"
            >
              <View style={[styles.checkbox, dontShowAgain && styles.checkboxOn]}>
                {dontShowAgain ? <Icon name="check" size={14} color={DfxColors.white} strokeWidth={3} /> : null}
              </View>
              <Text style={styles.checkboxLabel}>{t('privatePayments.dontShowAgain')}</Text>
            </Pressable>

            <Pressable style={styles.primaryBtn} onPress={confirmInfo} testID="private-info-activate">
              <Text style={styles.primaryBtnText}>{t('privatePayments.activate')}</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => setInfoVisible(false)}
              testID="private-info-cancel"
            >
              <Text style={styles.secondaryBtnText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  // ---- Private-payments info sheet ----
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(11,20,38,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: DfxColors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 36,
    gap: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: DfxColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
  },
  sheetIntro: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    lineHeight: 21,
  },
  sheetBullets: {
    gap: 12,
    paddingVertical: 2,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bulletText: {
    flex: 1,
    ...Typography.bodyMedium,
    color: DfxColors.text,
    lineHeight: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 6,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: DfxColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: DfxColors.primary,
    borderColor: DfxColors.primary,
  },
  checkboxLabel: {
    flex: 1,
    ...Typography.bodyMedium,
    color: DfxColors.text,
  },
  primaryBtn: {
    backgroundColor: DfxColors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    ...Typography.bodyLarge,
    color: DfxColors.white,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryBtnText: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    fontWeight: '600',
  },
});
