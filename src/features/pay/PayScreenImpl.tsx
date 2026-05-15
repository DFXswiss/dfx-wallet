import { useEffect, useState } from 'react';
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
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Icon } from '@/components';
import { useInternalWalletFiat } from '@/features/portfolio/useInternalWalletFiat';
import { useWalletStore } from '@/store';
import { DfxColors, Typography } from '@/theme';

const CURRENCY_SYMBOLS = new Map<string, string>([
  ['USD', '$'],
  ['EUR', '€'],
  ['CHF', 'CHF'],
]);

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
  const { selectedCurrency } = useWalletStore();
  const availableFiat = useInternalWalletFiat();

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
  const currencySymbol = CURRENCY_SYMBOLS.get(selectedCurrency) ?? selectedCurrency;
  const availableLabel = Number.isFinite(availableFiat)
    ? (Math.round(availableFiat * 100) / 100).toLocaleString('de-CH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '0.00';

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

          <View
            style={styles.balanceRail}
            testID="pay-available-balance"
            accessibilityLabel={`${t('pay.availableBalance')} ${currencySymbol} ${availableLabel}`}
          >
            <Text style={styles.balanceLabel} numberOfLines={1}>
              {t('pay.availableBalance')}
            </Text>
            <View style={styles.balanceAmount} accessibilityElementsHidden>
              <Text style={styles.balanceCurrency}>{currencySymbol}</Text>
              <Text style={styles.balanceValue} numberOfLines={1}>
                {availableLabel}
              </Text>
            </View>
          </View>

          <View style={{ flex: 1 }} />
        </SafeAreaView>

        <View style={[styles.cutout, cutoutStyle]}>
          {permission?.granted && (
            <CameraView
              style={styles.cameraScanner}
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
  cutout: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  cameraScanner: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.01,
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
  balanceRail: {
    minHeight: 54,
    marginTop: 18,
    marginHorizontal: 2,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(37,67,111,0.16)',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 18,
  },
  balanceLabel: {
    ...Typography.bodyMedium,
    color: 'rgba(37,67,111,0.72)',
    fontWeight: '700',
    letterSpacing: 0,
    flexShrink: 1,
  },
  balanceAmount: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 6,
    maxWidth: '58%',
  },
  balanceCurrency: {
    fontSize: 16,
    lineHeight: 25,
    color: DfxColors.primary,
    fontWeight: '700',
  },
  balanceValue: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '800',
    color: DfxColors.text,
    flexShrink: 1,
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
