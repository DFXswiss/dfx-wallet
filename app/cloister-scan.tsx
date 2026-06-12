import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

// Cloister Scan-to-Pay mit Bestätigungsschritt: scannen → bestätigen → zahlen.
const DEFAULT_LAN = process.env.EXPO_PUBLIC_CLOISTER_LAN ?? '192.168.178.110';

export default function CloisterScan() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [pay, setPay] = useState<{ config: string; amount: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState('Halte die Kamera auf den QR-Code…');
  const [scan, setScan] = useState<string | null>(null);

  useEffect(() => {
    if (!permission?.granted) void requestPermission();
  }, [permission, requestPermission]);

  const handleScan = ({ data }: { data: string }) => {
    if (scanned || !data.includes('cloister-pay')) return;
    setScanned(true);
    const qi = data.indexOf('?');
    const p = new URLSearchParams(qi >= 0 ? data.slice(qi + 1) : '');
    setPay({ config: p.get('config') ?? `http://${DEFAULT_LAN}:8790/config`, amount: p.get('amount') ?? '250' });
  };

  const reset = () => {
    setPay(null);
    setConfirmed(false);
    setScanned(false);
    setScan(null);
    setStatus('Halte die Kamera auf den QR-Code…');
  };

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'ready') setStatus('Baue Proof on-device…');
      if (msg.type === 'paid') {
        if (msg.ok) {
          setStatus(`✅ Bezahlt (${msg.ms} ms)`);
          setScan(msg.scan);
        } else setStatus('❌ ' + (msg.error ?? 'Fehler'));
      }
    } catch {
      // ignore
    }
  };

  // 1) Bestätigungsschritt — Zahlung wird erst nach „Bestätigen" ausgeführt
  if (pay && !confirmed) {
    return (
      <View style={styles.center}>
        <Text style={styles.confirmLabel}>Zahlung bestätigen</Text>
        <Text style={styles.amount}>{pay.amount} USDC</Text>
        <Text style={styles.recipient}>an DFX Merchant · Base Sepolia</Text>
        <Text style={styles.note}>Abgeschirmt — niemand sieht, dass du zahlst.</Text>
        <TouchableOpacity style={styles.confirmBtn} onPress={() => { setConfirmed(true); setStatus('Engine lädt…'); }}>
          <Text style={styles.confirmBtnText}>Bezahlen bestätigen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={reset}>
          <Text style={styles.cancelText}>Abbrechen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 2) Zahlung läuft / Ergebnis
  if (pay && confirmed) {
    const host = pay.config.replace(/^https?:\/\//, '').split(':')[0];
    const payUrl = `http://${host}:8799/cloister-pay.html?auto=1&amount=${pay.amount}&config=${encodeURIComponent(pay.config)}`;
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Cloister — privat zahlen ({pay.amount} USDC)</Text>
        <Text style={styles.status}>{status}</Text>
        {scan ? (
          <>
            <TouchableOpacity style={styles.confirmBtn} onPress={() => Linking.openURL(scan)}>
              <Text style={styles.confirmBtnText}>Auf Basescan öffnen ↗</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => router.replace('/cloister-home')}>
              <Text style={styles.cancelText}>Fertig</Text>
            </TouchableOpacity>
          </>
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
          style={styles.webview}
        />
      </View>
    );
  }

  // 3) Scanner
  return (
    <View style={styles.container}>
      <Text style={styles.title}>QR-Code scannen</Text>
      <Text style={styles.status}>{status}</Text>
      {permission?.granted ? (
        <CameraView style={styles.cam} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={handleScan} />
      ) : (
        <TouchableOpacity style={styles.confirmBtn} onPress={requestPermission}>
          <Text style={styles.confirmBtnText}>Kamera erlauben</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 16, backgroundColor: '#0b0b0f' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b0b0f', padding: 24 },
  title: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 12 },
  status: { color: '#0f0', fontSize: 14, marginBottom: 12 },
  cam: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  webview: { flex: 1, borderRadius: 8, overflow: 'hidden' },
  confirmLabel: { color: '#888', fontSize: 15, marginBottom: 8 },
  amount: { color: '#fff', fontSize: 44, fontWeight: '800', marginBottom: 4 },
  recipient: { color: '#ccc', fontSize: 16, marginBottom: 20 },
  note: { color: '#0a8', fontSize: 13, marginBottom: 40, textAlign: 'center' },
  confirmBtn: { backgroundColor: '#1769ff', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, width: '100%', alignItems: 'center', marginBottom: 12 },
  confirmBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#888', fontSize: 15 },
});
