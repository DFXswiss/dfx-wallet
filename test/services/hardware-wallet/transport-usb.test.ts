/**
 * Tests for the USB HID byte transport (BitBox02, Android only).
 *
 * The transport is a thin async facade over the native BitboxHid Expo module
 * (modules/bitbox-hid/src). What matters here:
 * - the Android-only gate fails fast and controlled off-platform
 * - the native module is loaded lazily and errors surface as rejections,
 *   never as synchronous crashes (covers "native module absent")
 * - bytes pass through unmodified in both directions
 * - the permission/open flow distinguishes "denied" (false) from "broken"
 */
import { Platform } from 'react-native';
import * as hid from '@modules/bitbox-hid/src';
import { UsbTransport, scanUsbDevices } from '@/features/hardware-wallet/services/transport-usb';

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

jest.mock('@modules/bitbox-hid/src', () => ({
  enumerate: jest.fn(),
  open: jest.fn(),
  write: jest.fn(),
  read: jest.fn(),
  close: jest.fn(),
  isConnected: jest.fn(),
}));

const mockHid = hid as jest.Mocked<typeof hid>;

/** Platform.OS is read at construct/call time, so per-test mutation works. */
function setPlatform(os: string) {
  (Platform as { OS: string }).OS = os;
}

describe('UsbTransport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setPlatform('android');
  });

  describe('platform gate', () => {
    it('constructs on Android', () => {
      expect(() => new UsbTransport()).not.toThrow();
    });

    it.each(['ios', 'web', 'macos'])('throws synchronously on %s', (os) => {
      setPlatform(os);
      expect(() => new UsbTransport()).toThrow('USB HID transport is only available on Android');
    });
  });

  describe('open (permission / device flow)', () => {
    it('opens the device by id when the native module grants access', async () => {
      mockHid.open.mockResolvedValue(true);

      await expect(new UsbTransport().open('usb-7')).resolves.toBeUndefined();
      expect(mockHid.open).toHaveBeenCalledWith('usb-7');
    });

    it('fails controlled when the module reports failure (permission denied)', async () => {
      mockHid.open.mockResolvedValue(false);

      await expect(new UsbTransport().open('usb-7')).rejects.toThrow(
        'Failed to open USB device',
      );
    });

    it('propagates native rejections (device not found) as rejections, not crashes', async () => {
      mockHid.open.mockRejectedValue(new Error('No device with id usb-9'));

      await expect(new UsbTransport().open('usb-9')).rejects.toThrow('No device with id usb-9');
    });
  });

  describe('write', () => {
    it('passes the byte payload through unmodified and returns the native count', async () => {
      mockHid.write.mockResolvedValue(64);
      const payload = new Uint8Array([0x00, 0x01, 0x7f, 0x80, 0xff]);

      await expect(new UsbTransport().write(payload)).resolves.toBe(64);
      expect(mockHid.write).toHaveBeenCalledTimes(1);
      expect(mockHid.write).toHaveBeenCalledWith(payload);
    });

    it('propagates a native write failure (device unplugged mid-write)', async () => {
      mockHid.write.mockRejectedValue(new Error('USB endpoint closed'));

      await expect(new UsbTransport().write(new Uint8Array([1]))).rejects.toThrow(
        'USB endpoint closed',
      );
    });

    // Pinned: the JS layer keeps no open/closed state — write after close is
    // delegated straight to the native module, which owns the guard.
    it('pins write-after-close: delegates to the native module without a JS guard', async () => {
      mockHid.close.mockResolvedValue(undefined);
      mockHid.write.mockRejectedValue(new Error('not connected'));
      const transport = new UsbTransport();

      await transport.close();
      await expect(transport.write(new Uint8Array([1]))).rejects.toThrow('not connected');
      expect(mockHid.write).toHaveBeenCalledTimes(1);
    });
  });

  describe('read', () => {
    it('reads with the 5s default timeout and returns the bytes unmodified', async () => {
      const frame = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      mockHid.read.mockResolvedValue(frame);

      await expect(new UsbTransport().read()).resolves.toEqual(frame);
      expect(mockHid.read).toHaveBeenCalledWith(5000);
    });

    it('propagates a native read timeout (device disappeared mid-read)', async () => {
      mockHid.read.mockRejectedValue(new Error('read timeout after 5000ms'));

      await expect(new UsbTransport().read()).rejects.toThrow('read timeout after 5000ms');
    });
  });

  describe('close', () => {
    it('delegates to the native module', async () => {
      mockHid.close.mockResolvedValue(undefined);

      await expect(new UsbTransport().close()).resolves.toBeUndefined();
      expect(mockHid.close).toHaveBeenCalledTimes(1);
    });

    it('propagates a native close failure', async () => {
      mockHid.close.mockRejectedValue(new Error('close failed'));

      await expect(new UsbTransport().close()).rejects.toThrow('close failed');
    });
  });
});

describe('scanUsbDevices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setPlatform('android');
  });

  it('returns [] off Android without touching the native module', async () => {
    setPlatform('ios');

    await expect(scanUsbDevices()).resolves.toEqual([]);
    expect(mockHid.enumerate).not.toHaveBeenCalled();
  });

  it('maps native devices to HardwareWalletDevice with USB transport', async () => {
    mockHid.enumerate.mockResolvedValue([
      { deviceId: 'usb-1', vendorId: 0x03eb, productId: 0x2403, deviceName: 'BitBox02 BTC' },
      { deviceId: 'usb-2', vendorId: 0x03eb, productId: 0x2403, deviceName: '' },
    ]);

    await expect(scanUsbDevices()).resolves.toEqual([
      { id: 'usb-1', name: 'BitBox02 BTC', type: 'bitbox02', transport: 'usb' },
      // Empty device name falls back to the product name.
      { id: 'usb-2', name: 'BitBox02', type: 'bitbox02', transport: 'usb' },
    ]);
  });

  it('returns [] when enumeration fails (no crash)', async () => {
    mockHid.enumerate.mockRejectedValue(new Error('USB host service unavailable'));

    await expect(scanUsbDevices()).resolves.toEqual([]);
  });
});

describe('native module absent', () => {
  // The module factory throwing at require time is exactly what a missing
  // native BitboxHid module looks like (requireNativeModule throws inside
  // modules/bitbox-hid/src at import). The dynamic import() in the transport
  // must turn that into a rejection / empty scan — never a synchronous crash.
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('@modules/bitbox-hid/src', () => {
      throw new Error("Cannot find native module 'BitboxHid'");
    });
  });

  afterEach(() => {
    jest.dontMock('@modules/bitbox-hid/src');
    jest.resetModules();
  });

  async function freshTransportModule() {
    return import('@/features/hardware-wallet/services/transport-usb');
  }

  it('scanUsbDevices resolves [] instead of crashing', async () => {
    const fresh = await freshTransportModule();
    await expect(fresh.scanUsbDevices()).resolves.toEqual([]);
  });

  it('UsbTransport.open rejects with the module load error instead of crashing', async () => {
    const fresh = await freshTransportModule();
    const transport = new fresh.UsbTransport();

    await expect(transport.open('usb-1')).rejects.toThrow("Cannot find native module 'BitboxHid'");
  });

  it('UsbTransport.read and close reject controlled as well', async () => {
    const fresh = await freshTransportModule();
    const transport = new fresh.UsbTransport();

    await expect(transport.read()).rejects.toThrow("Cannot find native module 'BitboxHid'");
    await expect(transport.close()).rejects.toThrow("Cannot find native module 'BitboxHid'");
  });
});
