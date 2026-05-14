import { FEATURES } from '@/config/features';

/**
 * BitBox02 pairing route. With `EXPO_PUBLIC_ENABLE_HARDWARE_WALLET`
 * off, neither the WASM bitbox-api bridge, the BLE transport, nor the
 * Android USB-HID native module is loaded into the bundle.
 */
const HardwareConnectScreen = FEATURES.HARDWARE_WALLET
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/hardware-wallet/HardwareConnectScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/hardware-wallet/HardwareWalletDisabled').default as React.ComponentType);

export default HardwareConnectScreen;
