import { Redirect } from 'expo-router';

/**
 * Stand-in for the hardware-wallet pairing route when
 * `EXPO_PUBLIC_ENABLE_HARDWARE_WALLET` is off. Pulls in nothing
 * beyond `expo-router` — no `react-native-ble-plx`, no BitBox WASM,
 * no USB-HID native module, no Noise XX handshake state. That entire
 * stack is sizable and largely deferred until BitBox02 has dedicated
 * end-to-end tests; until then the route bounces to the dashboard.
 */
export default function HardwareWalletDisabled() {
  return <Redirect href="/(auth)/(tabs)/dashboard" />;
}
