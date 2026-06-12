import { useRouter } from 'expo-router';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Schlichter Home-Screen für den Cloister-Sideload: zentraler „Bezahlen"-Einstieg.
export default function CloisterHome() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Image source={require('../assets/dfx-logo.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>Privat bezahlen</Text>
      <Text style={styles.subtitle}>Cloister · Base Sepolia</Text>
      <TouchableOpacity style={styles.payBtn} onPress={() => router.push('/cloister-scan')} accessibilityRole="button">
        <Text style={styles.payBtnText}>Bezahlen — QR scannen</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b0b0f', padding: 24 },
  logo: { width: 140, height: 44, marginBottom: 32 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#888', fontSize: 14, marginBottom: 40 },
  payBtn: { backgroundColor: '#1769ff', borderRadius: 14, paddingVertical: 18, paddingHorizontal: 40, width: '100%', alignItems: 'center' },
  payBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
