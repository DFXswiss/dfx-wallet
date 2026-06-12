import { useEffect, useState } from 'react';
import {
  Image,
  ImageBackground,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Icon } from '@/components';
import { DfxColors, Typography } from '@/theme';

const DEFAULT_LAN = process.env.EXPO_PUBLIC_CLOISTER_LAN ?? '192.168.178.110';

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
  const [pay, setPay] = useState<{ config: string; amount: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState('');
  const [scan, setScan] = useState<string | null>(null);

  useEffect(() => {
    if (!permission?.granted) void requestPermission();
  }, [permission, requestPermission]);

  const handleScan = ({ data }: { data: string }) => {
    if (scanned) return;
    if (!data.includes('cloister-pay')) return; // nur Cloister-QRs
    setScanned(true);
    const qi = data.indexOf('?');
    const params = new URLSearchParams(qi >= 0 ? data.slice(qi + 1) : '');
    setPay({
      config: params.get('config') ?? `http://${DEFAULT_LAN}:8790/config`,
      amount: params.get('amount') ?? '250',
    });
  };

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'ready') setStatus('Baue Proof on-device…');
      if (msg.type === 'paid') {
        if (msg.ok) {
          setStatus(`✅ Bezahlt (${msg.ms} ms)\n${msg.txHash}`);
          setScan(msg.scan);
        } else setStatus('❌ ' + (msg.error ?? 'Fehler'));
      }
    } catch {
      // ignore
    }
  };

  // Bestätigungsschritt — die Tx wird erst nach „Bezahlen bestätigen" gebaut & gesendet.
  if (pay && !confirmed) {
    return (
      <View style={[styles.payWrap, styles.payCenter]}>
        <Text style={styles.payConfirmLabel}>Zahlung bestätigen</Text>
        <Text style={styles.payAmount}>{pay.amount} USDC</Text>
        <Text style={styles.payRecipient}>an DFX Merchant · Base Sepolia</Text>
        <Text style={styles.payPrivacy}>Abgeschirmt — niemand sieht, dass du zahlst.</Text>
        <TouchableOpacity style={styles.payConfirmBtn} onPress={() => { setConfirmed(true); setStatus('Engine lädt…'); }}>
          <Text style={styles.scanBtnText}>Bezahlen bestätigen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.payCancelBtn} onPress={() => { setPay(null); setConfirmed(false); setScanned(false); }}>
          <Text style={styles.payCancelText}>Abbrechen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (pay && confirmed) {
    const host = pay.config.replace(/^https?:\/\//, '').split(':')[0];
    const payUrl = `http://${host}:8799/cloister-pay.html?auto=1&amount=${pay.amount}&config=${encodeURIComponent(pay.config)}`;
    return (
      <View style={styles.payWrap}>
        <Text style={styles.payTitle}>Cloister — privat zahlen ({pay.amount} USDC)</Text>
        <Text style={styles.payStatus}>{status}</Text>
        {scan ? (
          <TouchableOpacity style={styles.scanBtn} onPress={() => Linking.openURL(scan)}>
            <Text style={styles.scanBtnText}>Auf Basescan öffnen ↗</Text>
          </TouchableOpacity>
        ) : null}
        <WebView
          source={{ uri: payUrl }}
          onMessage={onMessage}
          onError={(ev) => setStatus('WebView-Fehler: ' + ev.nativeEvent.description)}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          mixedContentMode="always"
          cacheEnabled={false}
          incognito
          style={styles.payWebview}
        />
      </View>
    );
  }

  const cutoutStyle = {
    left: width * CUTOUT_PCT.left,
    top: height * CUTOUT_PCT.top,
    width: width * CUTOUT_PCT.width,
    height: height * CUTOUT_PCT.height,
  };

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

          <View style={{ flex: 1 }} />
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
  payWrap: { flex: 1, backgroundColor: '#0b0b0f', paddingTop: 60, paddingHorizontal: 16 },
  payCenter: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  payConfirmLabel: { color: '#888', fontSize: 15, marginBottom: 8 },
  payAmount: { color: '#fff', fontSize: 44, fontWeight: '800', marginBottom: 4 },
  payRecipient: { color: '#ccc', fontSize: 16, marginBottom: 20 },
  payPrivacy: { color: '#0a8', fontSize: 13, marginBottom: 40, textAlign: 'center' },
  payConfirmBtn: { backgroundColor: '#1769ff', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, width: '100%', alignItems: 'center', marginBottom: 12 },
  payCancelBtn: { paddingVertical: 12, alignItems: 'center' },
  payCancelText: { color: '#888', fontSize: 15 },
  payTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 12 },
  payStatus: { color: '#0f0', fontSize: 14, marginBottom: 12 },
  payWebview: { flex: 1, borderRadius: 8, overflow: 'hidden' },
  scanBtn: { backgroundColor: '#1769ff', borderRadius: 8, padding: 12, marginBottom: 12, alignItems: 'center' },
  scanBtnText: { color: '#fff', fontWeight: '600' },
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
