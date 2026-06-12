import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

// M1-Spike: beweist, dass die WebView auf dem Gerät einen Cloister-Groth16-Proof erzeugt.
// Lädt den Prover vom lokalen Mac-Server (Simulator erreicht den Host via localhost) im
// Selbsttest-Modus; die zkey/wasm werden dort gefetcht — keine Asset-Bundling-Logistik für M1.
const PROVER_URL =
  process.env.EXPO_PUBLIC_CLOISTER_PROVER_URL ?? 'http://localhost:8799/cloister-prover.html?selftest=1';

export default function CloisterTest() {
  const [result, setResult] = useState('Lade Prover in WebView…');

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'ready') setResult('Prover geladen — erzeuge Proof…');
      if (msg.type === 'selftest-result') {
        setResult(
          msg.verified
            ? `✅ Proof auf dem Gerät\nverified=${msg.verified}  matchesExpected=${msg.matchesExpected}\n${msg.ms} ms`
            : `❌ Fehlgeschlagen: ${msg.error ?? 'unbekannt'}`,
        );
      }
    } catch {
      // ignore non-JSON
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cloister — On-Device Prover</Text>
      <Text style={styles.result}>{result}</Text>
      <WebView
        source={{ uri: PROVER_URL }}
        onMessage={onMessage}
        onError={(e) => setResult('WebView-Fehler: ' + e.nativeEvent.description)}
        javaScriptEnabled
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
  result: { color: '#0f0', fontSize: 15, fontFamily: 'Courier', marginBottom: 12 },
  webview: { flex: 1, borderRadius: 8, overflow: 'hidden' },
});
