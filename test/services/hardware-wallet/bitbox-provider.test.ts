/**
 * Cross-layer tests for BitboxProvider: the production stack
 * (provider → WasmBridge → message protocol) runs unmodified against the
 * behavioral FakeBitboxWebView; only the byte-level transports and the
 * react-native Platform shim are mocked.
 *
 * Every outcome mode of the fake mirrors a real ceremony outcome —
 * see test/helpers/fake-bitbox.ts.
 */
import { BitboxProvider } from '@/features/hardware-wallet/services/bitbox';
import {
  DEFAULT_ETH_DERIVATION_PATH,
  type HardwareWalletDevice,
} from '@/features/hardware-wallet/services/types';
import { FakeBitboxWebView, FakeTransport, FAKE_BITBOX } from '../../helpers/fake-bitbox';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

const mockTransport = new FakeTransport();

jest.mock('@/features/hardware-wallet/services/transport-usb', () => ({
  UsbTransport: jest.fn(),
  scanUsbDevices: jest.fn(async (): Promise<unknown[]> => {
    throw new Error('USB not available on this platform');
  }),
}));

jest.mock('@/features/hardware-wallet/services/transport-ble', () => ({
  BleTransport: jest.fn().mockImplementation(() => ({
    connectToDevice: jest.fn(async () => {}),
    write: (data: Uint8Array) => mockTransport.write(data),
    read: () => mockTransport.read(),
    close: () => mockTransport.close(),
  })),
  scanBleDevices: jest.fn(async () => [
    { id: 'ble-1', name: 'BitBox02 Nova', type: 'bitbox02-nova', transport: 'ble' },
  ]),
}));

const BLE_DEVICE: HardwareWalletDevice = {
  id: 'ble-1',
  name: 'BitBox02 Nova',
  type: 'bitbox02-nova',
  transport: 'ble',
};

function pairedProvider(mode: ConstructorParameters<typeof FakeBitboxWebView>[0] = 'success') {
  const provider = new BitboxProvider();
  const fake = new FakeBitboxWebView(mode);
  fake.bindBridge(provider.getBridge());
  return { provider, fake };
}

describe('BitboxProvider', () => {
  afterEach(() => {
    mockTransport.closed = false;
    mockTransport.writes.length = 0;
    jest.useRealTimers();
  });

  describe('scanDevices', () => {
    it('merges fulfilled scans and silently drops rejected ones', async () => {
      const { provider } = pairedProvider();
      const devices = await provider.scanDevices();
      // USB scan rejects (iOS), BLE scan resolves — result is BLE-only.
      expect(devices).toEqual([BLE_DEVICE]);
    });
  });

  describe('connect', () => {
    it('refuses USB on non-Android platforms', async () => {
      const { provider } = pairedProvider();
      await expect(provider.connect({ ...BLE_DEVICE, transport: 'usb' })).rejects.toThrow(
        'USB connection is only available on Android',
      );
      expect(provider.isConnected()).toBe(false);
    });

    it('opens BLE transport, runs the pairing ceremony and tracks the device', async () => {
      const { provider, fake } = pairedProvider();

      await provider.connect(BLE_DEVICE);

      expect(fake.calls.map((c) => c.method)).toEqual(['pair']);
      expect(fake.isPaired).toBe(true);
      expect(provider.isConnected()).toBe(true);
      expect(provider.getConnectedDevice()).toEqual(BLE_DEVICE);
    });

    it('disconnects the previous session before connecting again', async () => {
      const { provider, fake } = pairedProvider();

      await provider.connect(BLE_DEVICE);
      await provider.connect(BLE_DEVICE);

      // Second connect must close the first session: pair, close, pair.
      expect(fake.calls.map((c) => c.method)).toEqual(['pair', 'close', 'pair']);
      expect(provider.isConnected()).toBe(true);
    });

    it('closes the half-open transport when pairing never completes', async () => {
      jest.useFakeTimers();
      const { provider } = pairedProvider('timeout');

      const attempt = provider.connect(BLE_DEVICE);
      const assertion = expect(attempt).rejects.toThrow('WASM bridge call timeout: pair');
      // Async advance: the pair timer is only registered after the transport
      // microtasks settle, so the sync variant would never reach it.
      await jest.advanceTimersByTimeAsync(30_000);
      await assertion;

      // Regression guard: a failed pairing must not leave a session that
      // reports connected — that would let signing calls through
      // ensureConnected() against a device that never finished the
      // Noise handshake.
      expect(provider.isConnected()).toBe(false);
      expect(provider.getConnectedDevice()).toBeNull();
      expect(mockTransport.closed).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('closes the WASM session and the physical transport', async () => {
      const { provider, fake } = pairedProvider();
      await provider.connect(BLE_DEVICE);

      await provider.disconnect();

      expect(fake.calls.map((c) => c.method)).toEqual(['pair', 'close']);
      expect(mockTransport.closed).toBe(true);
      expect(provider.isConnected()).toBe(false);
      expect(provider.getConnectedDevice()).toBeNull();
    });

    it('still closes the transport when the WASM close errors', async () => {
      const { provider, fake } = pairedProvider();
      await provider.connect(BLE_DEVICE);
      fake.mode = 'cancel'; // close still succeeds in cancel mode...
      fake.mode = 'disconnect'; // ...but in disconnect mode close errors.

      await expect(provider.disconnect()).resolves.toBeUndefined();
      expect(mockTransport.closed).toBe(true);
      expect(provider.isConnected()).toBe(false);
    });

    it('is a no-op when nothing is connected', async () => {
      const { provider, fake } = pairedProvider();
      await expect(provider.disconnect()).resolves.toBeUndefined();
      expect(fake.calls).toHaveLength(0);
    });
  });

  describe('addresses', () => {
    it('getEthAddress requires a connection', async () => {
      const { provider } = pairedProvider();
      await expect(provider.getEthAddress()).rejects.toThrow('BitBox02 not connected');
    });

    it('getEthAddress passes chainId 1, default path, display=false', async () => {
      const { provider, fake } = pairedProvider();
      await provider.connect(BLE_DEVICE);

      await expect(provider.getEthAddress()).resolves.toBe(FAKE_BITBOX.ethAddress);

      const call = fake.calls.at(-1)!;
      expect(call.method).toBe('ethAddress');
      expect(call.params).toEqual([1, DEFAULT_ETH_DERIVATION_PATH, false]);
    });

    it('getEthAddress forwards a custom derivation path verbatim', async () => {
      const { provider, fake } = pairedProvider();
      await provider.connect(BLE_DEVICE);

      await provider.getEthAddress("m/44'/60'/0'/0/7");

      expect(fake.calls.at(-1)!.params[1]).toBe("m/44'/60'/0'/0/7");
    });

    it('getBtcAddress requests p2wpkh on mainnet with display=false', async () => {
      const { provider, fake } = pairedProvider();
      await provider.connect(BLE_DEVICE);

      await expect(provider.getBtcAddress()).resolves.toBe(FAKE_BITBOX.btcAddress);

      const call = fake.calls.at(-1)!;
      expect(call.method).toBe('btcAddress');
      expect(call.params).toEqual(['btc', "m/84'/0'/0'/0/0", { simpleType: 'p2wpkh' }, false]);
    });
  });

  describe('signEthTransaction', () => {
    it('requires a connection', async () => {
      const { provider } = pairedProvider();
      await expect(provider.signEthTransaction(1, "m/44'/60'/0'/0/0", new Uint8Array(), true))
        .rejects.toThrow('BitBox02 not connected');
    });

    it('returns the signature as 0x-hex r/s and numeric v', async () => {
      const { provider } = pairedProvider();
      await provider.connect(BLE_DEVICE);

      const sig = await provider.signEthTransaction(
        1,
        DEFAULT_ETH_DERIVATION_PATH,
        new Uint8Array([0x01]),
        true,
      );

      const expectedR = '0x' + FAKE_BITBOX.sig.r.map((b) => b.toString(16).padStart(2, '0')).join('');
      const expectedS = '0x' + FAKE_BITBOX.sig.s.map((b) => b.toString(16).padStart(2, '0')).join('');
      expect(sig).toEqual({ r: expectedR, s: expectedS, v: 0x1b });
    });

    it('rejects when the user cancels on the device', async () => {
      const { provider } = pairedProvider('cancel');
      await provider.connect(BLE_DEVICE);

      await expect(
        provider.signEthTransaction(1, DEFAULT_ETH_DERIVATION_PATH, new Uint8Array([0x01]), true),
      ).rejects.toThrow(FAKE_BITBOX.errors.cancel);
      // The session itself survives a cancel — user can retry.
      expect(provider.isConnected()).toBe(true);
    });

    it('rejects when the device disconnects mid-ceremony', async () => {
      const { provider } = pairedProvider('disconnect');
      await provider.connect(BLE_DEVICE);

      await expect(
        provider.signEthTransaction(1, DEFAULT_ETH_DERIVATION_PATH, new Uint8Array([0x01]), true),
      ).rejects.toThrow(FAKE_BITBOX.errors.disconnect);
    });

    it('rejects via bridge timeout when the device hangs mid-ceremony', async () => {
      const { provider, fake } = pairedProvider();
      await provider.connect(BLE_DEVICE);
      // Device hangs AFTER a successful pairing (e.g. stuck firmware screen).
      fake.mode = 'timeout';
      jest.useFakeTimers();

      const attempt = provider.signEthTransaction(
        1,
        DEFAULT_ETH_DERIVATION_PATH,
        new Uint8Array([0x01]),
        true,
      );
      const assertion = expect(attempt).rejects.toThrow(
        'WASM bridge call timeout: ethSign1559Transaction',
      );
      jest.advanceTimersByTime(30_000);
      await assertion;
    });
  });

  describe('signMessage', () => {
    it('assembles the 65-byte r‖s‖v signature', async () => {
      const { provider, fake } = pairedProvider();
      await provider.connect(BLE_DEVICE);

      const message = new Uint8Array([0xde, 0xad]);
      const sig = await provider.signMessage(137, DEFAULT_ETH_DERIVATION_PATH, message);

      expect(sig).toHaveLength(65);
      expect(Array.from(sig.slice(0, 32))).toEqual(FAKE_BITBOX.sig.r);
      expect(Array.from(sig.slice(32, 64))).toEqual(FAKE_BITBOX.sig.s);
      expect(sig[64]).toBe(0x1b);

      const call = fake.calls.at(-1)!;
      expect(call.method).toBe('ethSignMessage');
      // chainId and the message bytes must cross the bridge JSON-safely.
      expect(call.params[0]).toBe(137);
      expect(call.params[2]).toEqual([0xde, 0xad]);
    });
  });
});
