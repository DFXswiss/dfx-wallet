import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

// Cloister On-Chain Pay (Base Sepolia). Parameter kommen aus dem gescannten QR-Deeplink:
//   dfxwallet://cloister-pay?config=<server/config>&amount=<betrag>
// Die WebView-Engine baut den Proof und schickt ihn an den Relayer; hier nur Anzeige.
const DEFAULT_LAN = process.env.EXPO_PUBLIC_CLOISTER_LAN ?? '192.168.178.110';

export default function CloisterPay() {
  const params = useLocalSearchParams<{ config?: string; amount?: string }>();
  const config = params.config ?? `http://${DEFAULT_LAN}:8790/config`;
  const amount = params.amount ?? '250';
  const host = config.replace(/^https?:\/\//, '').split(':')[0];
  const payUrl = `http://${host}:8799/cloister-pay.html?auto=1&amount=${amount}&config=${encodeURIComponent(config)}`;

  const [status, setStatus] = useState(`Zahle ${amount} USDC…`);
  const [scan, setScan] = useState<string | null>(null);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'ready') setStatus('Engine geladen — baue Proof…');
      if (msg.type === 'paid') {
        if (msg.ok) {
          setStatus(`✅ Bezahlt (${msg.ms} ms)\n${msg.txHash}`);
          setScan(msg.scan);
        } else {
          setStatus('❌ ' + (msg.error ?? 'Fehler'));
        }
      }
    } catch {
      // ignore
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cloister — privat zahlen (Base Sepolia)</Text>
      <Text style={styles.status}>{status}</Text>
      {scan ? (
        <TouchableOpacity style={styles.btn} onPress={() => Linking.openURL(scan)}>
          <Text style={styles.btnText}>Auf Basescan öffnen ↗</Text>
        </TouchableOpacity>
      ) : null}
      <WebView
        source={{ uri: payUrl }}
        onMessage={onMessage}
        onError={(e) => setStatus('WebView-Fehler: ' + e.nativeEvent.description)}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        mixedContentMode="always"
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 16, backgroundColor: '#0b0b0f' },
  title: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 12 },
  status: { color: '#0f0', fontSize: 14, fontFamily: 'Courier', marginBottom: 12 },
  btn: { backgroundColor: '#1769ff', borderRadius: 8, padding: 12, marginBottom: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
  webview: { flex: 1, borderRadius: 8, overflow: 'hidden' },
});
