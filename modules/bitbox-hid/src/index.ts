import { NativeModule, requireNativeModule } from 'expo-modules-core';

type BitboxHidDevice = {
  deviceId: string;
  vendorId: number;
  productId: number;
  deviceName: string;
};

interface BitboxHidModuleType extends NativeModule {
  enumerate(): Promise<BitboxHidDevice[]>;
  open(deviceId: string): Promise<boolean>;
  write(data: number[]): Promise<number>;
  read(timeoutMs: number): Promise<number[]>;
  close(): Promise<void>;
  isConnected(): boolean;
}

let module: BitboxHidModuleType | null = null;

function getModule(): BitboxHidModuleType {
  if (!module) {
    module = requireNativeModule<BitboxHidModuleType>('BitboxHid');
  }
  return module;
}

/** List connected USB HID devices matching BitBox02 VID/PID */
export async function enumerate(): Promise<BitboxHidDevice[]> {
  return getModule().enumerate();
}

/** Open a connection to a specific device */
export async function open(deviceId: string): Promise<boolean> {
  return getModule().open(deviceId);
}

/** Write raw bytes to the device */
export async function write(data: Uint8Array): Promise<number> {
  return getModule().write(Array.from(data));
}

/** Read raw bytes from the device (with timeout in ms) */
export async function read(timeoutMs: number = 5000): Promise<Uint8Array> {
  const bytes = await getModule().read(timeoutMs);
  return new Uint8Array(bytes);
}

/** Close the connection */
export async function close(): Promise<void> {
  return getModule().close();
}

/** Check if a device is currently connected */
export function isConnected(): boolean {
  return getModule().isConnected();
}
