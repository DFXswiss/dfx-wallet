import { ethSignatureToHex } from '../../src/features/hardware-wallet/services/bitbox-protocol';
import { BitboxProvider } from '../../src/features/hardware-wallet/services/bitbox';

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

const mockUsbOpen = jest.fn(async () => undefined);
const mockUsbClose = jest.fn(async () => undefined);

jest.mock('../../src/features/hardware-wallet/services/transport-usb', () => ({
  scanUsbDevices: jest.fn(async () => []),
  UsbTransport: jest.fn().mockImplementation(() => ({
    open: mockUsbOpen,
    write: jest.fn(async (data: Uint8Array) => data.length),
    read: jest.fn(async () => new Uint8Array()),
    close: mockUsbClose,
  })),
}));

jest.mock('../../src/features/hardware-wallet/services/transport-ble', () => ({
  scanBleDevices: jest.fn(async () => []),
  BleTransport: jest.fn().mockImplementation(() => ({
    connectToDevice: jest.fn(async () => undefined),
    write: jest.fn(async (data: Uint8Array) => data.length),
    read: jest.fn(async () => new Uint8Array()),
    close: jest.fn(async () => undefined),
  })),
}));

describe('BitBox Protocol', () => {
  describe('ethSignatureToHex', () => {
    it('should convert Uint8Array signature to hex strings', () => {
      const sig = {
        r: new Uint8Array([0x01, 0x02, 0x03]),
        s: new Uint8Array([0xaa, 0xbb, 0xcc]),
        v: new Uint8Array([0x1b]),
      };

      const result = ethSignatureToHex(sig);

      expect(result.r).toBe('0x010203');
      expect(result.s).toBe('0xaabbcc');
      expect(result.v).toBe(27);
    });

    it('should handle 32-byte r and s values', () => {
      const r = new Uint8Array(32).fill(0xff);
      const s = new Uint8Array(32).fill(0x00);

      const result = ethSignatureToHex({ r, s, v: new Uint8Array([0x1c]) });

      expect(result.r).toBe('0x' + 'ff'.repeat(32));
      expect(result.s).toBe('0x' + '00'.repeat(32));
      expect(result.v).toBe(28);
    });
  });
});

describe('BitboxProvider pairing flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('separates pairing-code display from final pairing confirmation', async () => {
    const provider = new BitboxProvider();
    const bridge = provider.getBridge();

    bridge.setWebView({
      postMessage: (payload: string) => {
        const msg = JSON.parse(payload) as { id: number; method: string };
        if (msg.method === 'beginPairing') {
          bridge.onMessage(JSON.stringify({ id: msg.id, result: { pairingCode: '123-456' } }));
        }
        if (msg.method === 'confirmPairing') {
          bridge.onMessage(JSON.stringify({ id: msg.id, result: true }));
        }
      },
    });

    const device = {
      id: 'usb-1',
      name: 'BitBox02',
      type: 'bitbox02' as const,
      transport: 'usb' as const,
    };

    await expect(provider.beginPairing(device)).resolves.toEqual({ pairingCode: '123-456' });

    expect(mockUsbOpen).toHaveBeenCalledWith('usb-1');
    expect(provider.getConnectedDevice()).toBeNull();

    await provider.confirmPairing();

    expect(provider.getConnectedDevice()).toEqual(device);
  });
});
