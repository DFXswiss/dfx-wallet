import { Platform } from 'react-native';
import type { BitboxTransport, HardwareWalletDevice } from './types';

/**
 * USB HID transport for BitBox02 (Android only).
 *
 * Implementation strategy:
 * - Native Android module using Android USB Host API
 * - Pattern: @ledgerhq/react-native-hid (proven approach)
 * - The native module exposes: enumerate(), open(deviceId), write(data), read(), close()
 * - React Native bridge calls the native module
 *
 * Required native code (Kotlin):
 *   android/src/main/java/swiss/dfx/wallet/bitbox/
 *     BitboxHidModule.kt     — React Native native module
 *     BitboxHidDevice.kt     — UsbManager + UsbDeviceConnection wrapper
 *     BitboxHidPackage.kt    — Package registration
 *
 * USB filter (AndroidManifest.xml):
 *   <intent-filter>
 *     <action android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED"/>
 *   </intent-filter>
 *   <meta-data android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED"
 *     android:resource="@xml/usb_device_filter"/>
 *
 * BitBox02 USB identifiers:
 *   VendorID:  0x03EB (Atmel/Microchip)
 *   ProductID: 0x2403 (BitBox02)
 */
export class UsbTransport implements BitboxTransport {
  constructor() {
    if (Platform.OS !== 'android') {
      throw new Error('USB HID transport is only available on Android');
    }
  }

  async write(_data: Uint8Array): Promise<number> {
    // TODO: NativeModules.BitboxHid.write(Array.from(data))
    throw new Error('USB transport not yet implemented');
  }

  async read(): Promise<Uint8Array> {
    // TODO: const bytes = await NativeModules.BitboxHid.read()
    // return new Uint8Array(bytes)
    throw new Error('USB transport not yet implemented');
  }

  async close(): Promise<void> {
    // TODO: NativeModules.BitboxHid.close()
    throw new Error('USB transport not yet implemented');
  }
}

/**
 * Scan for BitBox02 devices via USB on Android.
 */
export async function scanUsbDevices(): Promise<HardwareWalletDevice[]> {
  if (Platform.OS !== 'android') return [];

  // TODO: const devices = await NativeModules.BitboxHid.enumerate()
  // return devices.filter(d => d.vendorId === 0x03EB && d.productId === 0x2403)
  //   .map(d => ({ id: d.deviceId, name: 'BitBox02', type: 'bitbox02', transport: 'usb' }))
  return [];
}
