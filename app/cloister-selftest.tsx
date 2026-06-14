// On-device Cloister prover self-test. Runs the native gnark prover on REAL hardware
// against a bundled sample witness (no backend/pool needed) and reports init + prove
// latency. This isolates the device-specific unknowns: real-hardware proving time and
// whether the 9.3MB proving key + Groth16 prove fit in device memory.
//
// Route: /cloister-selftest
import { useEffect, useState } from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { initProver, prove } from 'cloister-prover';
import sampleWitness from '@/features/cloister/sample-witness.json';

type Line = { label: string; value: string };

export default function CloisterSelfTest() {
  const [lines, setLines] = useState<Line[]>([{ label: 'status', value: 'starting…' }]);
  const push = (label: string, value: string) => setLines((l) => [...l, { label, value }]);

  useEffect(() => {
    (async () => {
      try {
        const t0 = Date.now();
        const ready = await initProver();
        push('initProver', `${ready} in ${Date.now() - t0} ms`);

        // warm + measured prove
        await prove(sampleWitness);
        const t1 = Date.now();
        const res = await prove(sampleWitness);
        const ms = Date.now() - t1;

        push('PROVE (on-device)', `${ms} ms`);
        push('proof bytes', String((res.proofHex.length - 2) / 2));
        push('public[0] root', res.publicSignals[0].slice(0, 22) + '…');
        push('public[1] amount', res.publicSignals[1]);
        push('result', ms < 1000 ? '✅ under 1s on device' : `⚠️ ${ms} ms (>1s)`);
      } catch (e: any) {
        push('ERROR', String(e?.message ?? e));
      }
    })();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.c}>
      <Text style={styles.h}>Cloister on-device prover self-test</Text>
      {lines.map((l, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.k}>{l.label}</Text>
          <Text style={styles.v}>{l.value}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  c: { padding: 24, paddingTop: 80, gap: 10 },
  h: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  k: { color: '#667', fontSize: 13 },
  v: { fontWeight: '700', fontSize: 13, flexShrink: 1, textAlign: 'right' },
});
