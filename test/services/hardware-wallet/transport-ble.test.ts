/**
 * Deep tests for the BLE byte transport (BitBox02 Nova). This is the raw
 * channel the Noise XX handshake runs over, so framing, ordering and
 * lifecycle behavior are wallet-security relevant: a dropped or reordered
 * frame here surfaces as a failed (or worse, wrong) handshake upstream.
 *
 * react-native-ble-plx is mapped to an empty mock in the unit project, so we
 * provide an explicit factory. The BleManager is a module-level singleton in
 * production code; the factory returns one shared mock manager that gets
 * reconfigured per test.
 */
import { BleTransport, scanBleDevices } from '@/features/hardware-wallet/services/transport-ble';

const BITBOX_NOVA_SERVICE_UUID = '0000bb02-0000-1000-8000-00805f9b34fb';
const BITBOX_NOVA_WRITE_CHAR_UUID = '0000bb03-0000-1000-8000-00805f9b34fb';
const BITBOX_NOVA_NOTIFY_CHAR_UUID = '0000bb04-0000-1000-8000-00805f9b34fb';
const BLE_CHUNK_SIZE = 128;

const mockManager = {
  connectToDevice: jest.fn(),
  startDeviceScan: jest.fn(),
  stopDeviceScan: jest.fn(),
};
const mockManagerCtor = jest.fn(() => mockManager);

jest.mock('react-native-ble-plx', () => ({
  // Lazy indirection: the factory is evaluated at import time, before the
  // consts above are initialized — only the constructor body may touch them.
  BleManager: function BleManager() {
    return mockManagerCtor();
  },
}));

type MonitorCallback = (error: Error | null, char: { value: string | null } | null) => void;

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function fromBase64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

/** Builds a fake ble-plx Device exposing the BitBox Nova GATT layout. */
function makeFakeBleDevice(opts?: {
  omitService?: boolean;
  omitWriteChar?: boolean;
  omitNotifyChar?: boolean;
}) {
  const monitorCallbacks: MonitorCallback[] = [];
  const subscription = { remove: jest.fn() };

  const writeChar: { uuid: string; writeWithResponse: jest.Mock } = {
    uuid: BITBOX_NOVA_WRITE_CHAR_UUID,
    writeWithResponse: jest.fn(async (_b64: string): Promise<unknown> => writeChar),
  };
  const notifyChar = {
    uuid: BITBOX_NOVA_NOTIFY_CHAR_UUID,
    monitor: jest.fn((cb: MonitorCallback) => {
      monitorCallbacks.push(cb);
      return subscription;
    }),
  };

  const characteristics = [
    ...(opts?.omitWriteChar ? [] : [writeChar]),
    ...(opts?.omitNotifyChar ? [] : [notifyChar]),
  ];
  const service = {
    uuid: BITBOX_NOVA_SERVICE_UUID,
    characteristics: jest.fn(async () => characteristics),
  };
  const device: {
    id: string;
    discoverAllServicesAndCharacteristics: jest.Mock;
    services: jest.Mock;
    cancelConnection: jest.Mock;
  } = {
    id: 'nova-1',
    discoverAllServicesAndCharacteristics: jest.fn(async (): Promise<unknown> => device),
    services: jest.fn(async () => (opts?.omitService ? [] : [service])),
    cancelConnection: jest.fn(async (): Promise<unknown> => device),
  };

  return {
    device,
    writeChar,
    notifyChar,
    subscription,
    /** Simulate a notification frame arriving from the device. */
    notify: (bytes: Uint8Array) => {
      for (const cb of monitorCallbacks) cb(null, { value: toBase64(bytes) });
    },
    /** Simulate a monitor error (e.g. link loss). */
    notifyError: (error: Error) => {
      for (const cb of monitorCallbacks) cb(error, null);
    },
    /** Simulate an empty notification (no value). */
    notifyEmpty: () => {
      for (const cb of monitorCallbacks) cb(null, { value: null });
    },
  };
}

async function connectedTransport(fake = makeFakeBleDevice()) {
  mockManager.connectToDevice.mockImplementation(async () => fake.device);
  const transport = new BleTransport();
  await transport.connectToDevice('nova-1');
  return { transport, fake };
}

describe('BleTransport', () => {
  beforeEach(() => {
    mockManager.connectToDevice.mockReset();
    mockManager.startDeviceScan.mockReset();
    mockManager.stopDeviceScan.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('connect lifecycle', () => {
    it('connects with MTU 185, discovers GATT and subscribes to notifications', async () => {
      const { fake } = await connectedTransport();

      expect(mockManager.connectToDevice).toHaveBeenCalledWith('nova-1', { requestMTU: 185 });
      expect(fake.device.discoverAllServicesAndCharacteristics).toHaveBeenCalledTimes(1);
      expect(fake.notifyChar.monitor).toHaveBeenCalledTimes(1);
    });

    it('reuses one BleManager across transports (module-level singleton)', async () => {
      const callsBefore = mockManagerCtor.mock.calls.length;
      await connectedTransport();
      await connectedTransport();
      const callsAfter = mockManagerCtor.mock.calls.length;

      // The singleton is created at most once for the whole module lifetime;
      // two further connects must not construct additional managers.
      expect(callsAfter - callsBefore).toBeLessThanOrEqual(1);
      expect(mockManagerCtor.mock.calls.length).toBeLessThanOrEqual(1);
    });

    it('fails when the BitBox service is missing', async () => {
      const fake = makeFakeBleDevice({ omitService: true });
      mockManager.connectToDevice.mockImplementation(async () => fake.device);

      await expect(new BleTransport().connectToDevice('nova-1')).rejects.toThrow(
        'BitBox02 Nova BLE service not found',
      );
    });

    it('fails when the write characteristic is missing', async () => {
      const fake = makeFakeBleDevice({ omitWriteChar: true });
      mockManager.connectToDevice.mockImplementation(async () => fake.device);

      await expect(new BleTransport().connectToDevice('nova-1')).rejects.toThrow(
        'Write characteristic not found',
      );
    });

    it('fails when the notify characteristic is missing', async () => {
      const fake = makeFakeBleDevice({ omitNotifyChar: true });
      mockManager.connectToDevice.mockImplementation(async () => fake.device);

      await expect(new BleTransport().connectToDevice('nova-1')).rejects.toThrow(
        'Notify characteristic not found',
      );
    });

    it('propagates the manager error when the connection itself fails', async () => {
      mockManager.connectToDevice.mockRejectedValue(new Error('Device nova-1 was disconnected'));

      await expect(new BleTransport().connectToDevice('nova-1')).rejects.toThrow(
        'Device nova-1 was disconnected',
      );
    });

    // Regression guard (was a real bug): double-connect must tear down the
    // first session — otherwise the stale device's monitor keeps feeding
    // frames into the new session's read buffer (cross-device pollution on
    // the Noise channel).
    it('tears down the previous session on reconnect', async () => {
      const fakeA = makeFakeBleDevice();
      const fakeB = makeFakeBleDevice();
      mockManager.connectToDevice
        .mockImplementationOnce(async () => fakeA.device)
        .mockImplementationOnce(async () => fakeB.device);

      const transport = new BleTransport();
      await transport.connectToDevice('nova-1');
      await transport.connectToDevice('nova-2');

      // First connection is fully torn down: connection cancelled, monitor removed.
      expect(fakeA.device.cancelConnection).toHaveBeenCalledTimes(1);
      expect(fakeA.subscription.remove).toHaveBeenCalledTimes(1);

      // Only frames from the NEW device reach the new session.
      fakeB.notify(new Uint8Array([0x42]));
      await expect(transport.read()).resolves.toEqual(new Uint8Array([0x42]));
    });
  });

  describe('write framing', () => {
    it('sends a small payload as a single base64 chunk and reports full length', async () => {
      const { transport, fake } = await connectedTransport();
      const payload = new Uint8Array([0x00, 0x01, 0xfe, 0xff]);

      await expect(transport.write(payload)).resolves.toBe(4);

      expect(fake.writeChar.writeWithResponse).toHaveBeenCalledTimes(1);
      expect(fromBase64(fake.writeChar.writeWithResponse.mock.calls[0]![0])).toEqual(payload);
    });

    it('splits payloads into 128-byte chunks in order and reassembles losslessly', async () => {
      const { transport, fake } = await connectedTransport();
      const payload = new Uint8Array(300).map((_, i) => i % 256);

      await expect(transport.write(payload)).resolves.toBe(300);

      const chunks = fake.writeChar.writeWithResponse.mock.calls.map((c: [string]) => fromBase64(c[0]));
      expect(chunks.map((c) => c.length)).toEqual([128, 128, 44]);

      // Concatenated chunks must reproduce the exact byte stream — Noise
      // handshake frames tolerate zero corruption.
      const reassembled = new Uint8Array(300);
      let offset = 0;
      for (const chunk of chunks) {
        reassembled.set(chunk, offset);
        offset += chunk.length;
      }
      expect(reassembled).toEqual(payload);
    });

    it('sends a payload of exactly one chunk size as a single chunk', async () => {
      const { transport, fake } = await connectedTransport();

      await transport.write(new Uint8Array(BLE_CHUNK_SIZE));

      expect(fake.writeChar.writeWithResponse).toHaveBeenCalledTimes(1);
      expect(fromBase64(fake.writeChar.writeWithResponse.mock.calls[0]![0])).toHaveLength(128);
    });

    it('round-trips every byte value 0..255 through base64 encoding', async () => {
      const { transport, fake } = await connectedTransport();
      const allBytes = new Uint8Array(256).map((_, i) => i);

      await transport.write(allBytes);

      const chunks = fake.writeChar.writeWithResponse.mock.calls.map((c: [string]) => fromBase64(c[0]));
      expect(chunks.map((c) => c.length)).toEqual([128, 128]);
      expect(new Uint8Array([...chunks[0]!, ...chunks[1]!])).toEqual(allBytes);
    });

    it('writes nothing for an empty payload and reports 0', async () => {
      const { transport, fake } = await connectedTransport();

      await expect(transport.write(new Uint8Array(0))).resolves.toBe(0);
      expect(fake.writeChar.writeWithResponse).not.toHaveBeenCalled();
    });

    it('fails controlled when writing before connect', async () => {
      await expect(new BleTransport().write(new Uint8Array([1]))).rejects.toThrow(
        'BLE not connected',
      );
    });

    it('fails controlled when writing after close', async () => {
      const { transport } = await connectedTransport();
      await transport.close();

      await expect(transport.write(new Uint8Array([1]))).rejects.toThrow('BLE not connected');
    });

    it('stops chunking and propagates the error when the device vanishes mid-write', async () => {
      const { transport, fake } = await connectedTransport();
      fake.writeChar.writeWithResponse
        .mockImplementationOnce(async () => fake.writeChar)
        .mockRejectedValueOnce(new Error('Device disconnected'));

      await expect(transport.write(new Uint8Array(300))).rejects.toThrow('Device disconnected');
      // First chunk went out, second failed, third must never be attempted.
      expect(fake.writeChar.writeWithResponse).toHaveBeenCalledTimes(2);
    });
  });

  describe('read / notification queue', () => {
    it('returns a frame buffered before read() was called', async () => {
      const { transport, fake } = await connectedTransport();
      fake.notify(new Uint8Array([0xde, 0xad]));

      await expect(transport.read()).resolves.toEqual(new Uint8Array([0xde, 0xad]));
    });

    it('preserves FIFO ordering across buffered frames', async () => {
      const { transport, fake } = await connectedTransport();
      fake.notify(new Uint8Array([1]));
      fake.notify(new Uint8Array([2]));
      fake.notify(new Uint8Array([3]));

      await expect(transport.read()).resolves.toEqual(new Uint8Array([1]));
      await expect(transport.read()).resolves.toEqual(new Uint8Array([2]));
      await expect(transport.read()).resolves.toEqual(new Uint8Array([3]));
    });

    it('resolves a pending read directly without duplicating into the buffer', async () => {
      jest.useFakeTimers();
      const { transport, fake } = await connectedTransport();

      const pending = transport.read();
      fake.notify(new Uint8Array([0xaa]));
      await expect(pending).resolves.toEqual(new Uint8Array([0xaa]));

      // The frame must not ALSO sit in the buffer; the next read starts empty
      // and times out.
      const next = transport.read();
      const assertion = expect(next).rejects.toThrow('BLE read timeout');
      jest.advanceTimersByTime(10_000);
      await assertion;
    });

    it('decodes base64 notifications byte-exactly, including 0x00 and 0xff', async () => {
      const { transport, fake } = await connectedTransport();
      const frame = new Uint8Array([0x00, 0x7f, 0x80, 0xff]);
      fake.notify(frame);

      await expect(transport.read()).resolves.toEqual(frame);
    });

    it('times out after 10s when the device never answers', async () => {
      jest.useFakeTimers();
      const { transport } = await connectedTransport();

      const read = transport.read();
      const assertion = expect(read).rejects.toThrow('BLE read timeout');
      jest.advanceTimersByTime(10_000);
      await assertion;
    });

    it('does not fire the stale timeout after a successful read', async () => {
      jest.useFakeTimers();
      const { transport, fake } = await connectedTransport();

      const read = transport.read();
      fake.notify(new Uint8Array([1]));
      await expect(read).resolves.toEqual(new Uint8Array([1]));

      // A later pending read must not be clobbered by the first read's timer.
      const second = transport.read();
      jest.advanceTimersByTime(9_999);
      fake.notify(new Uint8Array([2]));
      await expect(second).resolves.toEqual(new Uint8Array([2]));
    });

    // Regression guard (was a real bug): concurrent reads must each settle.
    // The waiter queue hands frames out FIFO — no caller is silently dropped.
    it('serves concurrent reads FIFO, one frame per caller', async () => {
      const { transport, fake } = await connectedTransport();

      const first = transport.read();
      const second = transport.read();

      fake.notify(new Uint8Array([7]));
      fake.notify(new Uint8Array([8]));

      await expect(first).resolves.toEqual(new Uint8Array([7]));
      await expect(second).resolves.toEqual(new Uint8Array([8]));
    });

    it('ignores monitor error frames and empty notifications without crashing', async () => {
      const { transport, fake } = await connectedTransport();

      fake.notifyError(new Error('link loss'));
      fake.notifyEmpty();
      fake.notify(new Uint8Array([0x42]));

      // Only the real frame is delivered; the garbage frames are dropped.
      await expect(transport.read()).resolves.toEqual(new Uint8Array([0x42]));
    });

    // Regression guard (was a real bug): a monitor error (BLE link loss) while
    // reads are in flight must wake every pending read with the REAL error,
    // immediately — not let them wait out the full READ_TIMEOUT_MS and then
    // surface a generic 'BLE read timeout' that hides the link loss. A signing
    // ceremony aborts cleanly with the true cause instead of hanging 10s.
    it('rejects in-flight reads with the real error on monitor link loss (fail fast, not timeout)', async () => {
      jest.useFakeTimers();
      const { transport, fake } = await connectedTransport();

      const first = transport.read();
      const second = transport.read();
      const firstAssertion = expect(first).rejects.toThrow('link loss mid-ceremony');
      const secondAssertion = expect(second).rejects.toThrow('link loss mid-ceremony');

      // No timer advance: the rejection is immediate on link loss, not after 10s.
      fake.notifyError(new Error('link loss mid-ceremony'));
      await firstAssertion;
      await secondAssertion;

      // Waiters are consumed: a fresh read starts empty and times out on its own.
      const next = transport.read();
      const nextAssertion = expect(next).rejects.toThrow('BLE read timeout');
      jest.advanceTimersByTime(10_000);
      await nextAssertion;
    });
  });

  describe('close', () => {
    it('cancels the connection and drops buffered frames', async () => {
      const { transport, fake } = await connectedTransport();
      fake.notify(new Uint8Array([1]));

      await transport.close();

      expect(fake.device.cancelConnection).toHaveBeenCalledTimes(1);
      // Buffered pre-close data must not survive into the next read — and a
      // closed transport fails fast instead of waiting out the 10s timeout.
      await expect(transport.read()).rejects.toThrow('BLE not connected');
    });

    it('is a no-op when never connected, and idempotent', async () => {
      const transport = new BleTransport();
      await expect(transport.close()).resolves.toBeUndefined();

      const { transport: connected, fake } = await connectedTransport();
      await connected.close();
      await connected.close();
      expect(fake.device.cancelConnection).toHaveBeenCalledTimes(1);
    });

    // Pinned: read-after-close is not rejected immediately — it hangs for the
    // full 10s and then fails with the generic timeout. Callers cannot
    // distinguish "closed" from "device mute".
    it('rejects read-after-close immediately instead of waiting out the timeout', async () => {
      const { transport } = await connectedTransport();
      await transport.close();

      await expect(transport.read()).rejects.toThrow('BLE not connected');
    });

    // Regression guard (was a real bug): a read in flight when the link
    // drops must fail loudly — a forever-pending promise upstream means a
    // signing ceremony that never errors out.
    it('rejects an in-flight read when close() runs', async () => {
      const { transport } = await connectedTransport();

      const pending = transport.read();
      const assertion = expect(pending).rejects.toThrow('BLE transport closed');

      await transport.close();
      await assertion;
    });

    // Regression guard (was a real bug): close() must remove the monitor
    // subscription so stale notifications cannot repopulate a dead
    // transport's buffer.
    it('removes the monitor on close; late notifications do not feed read()', async () => {
      const { transport, fake } = await connectedTransport();
      await transport.close();

      expect(fake.subscription.remove).toHaveBeenCalledTimes(1);

      fake.notify(new Uint8Array([0x66]));
      await expect(transport.read()).rejects.toThrow('BLE not connected');
    });
  });
});

describe('scanBleDevices', () => {
  beforeEach(() => {
    mockManager.startDeviceScan.mockReset();
    mockManager.stopDeviceScan.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  type ScanListener = (
    error: Error | null,
    device: { id: string; name: string | null; localName?: string | null } | null,
  ) => void;

  function getScanListener(): ScanListener {
    expect(mockManager.startDeviceScan).toHaveBeenCalledTimes(1);
    return mockManager.startDeviceScan.mock.calls[0]![2];
  }

  it('scans filtered on the BitBox service UUID without duplicates', async () => {
    const scan = scanBleDevices();
    expect(mockManager.startDeviceScan).toHaveBeenCalledWith(
      [BITBOX_NOVA_SERVICE_UUID],
      { allowDuplicates: false },
      expect.any(Function),
    );

    jest.advanceTimersByTime(10_000);
    await expect(scan).resolves.toEqual([]);
    expect(mockManager.stopDeviceScan).toHaveBeenCalledTimes(1);
  });

  it('collects devices, deduplicates by id and stops after the timeout', async () => {
    const scan = scanBleDevices();
    const listener = getScanListener();

    listener(null, { id: 'a', name: 'BitBox02 Nova A' });
    listener(null, { id: 'a', name: 'BitBox02 Nova A' }); // duplicate
    listener(null, { id: 'b', name: 'BitBox02 Nova B' });

    jest.advanceTimersByTime(10_000);
    const devices = await scan;

    expect(devices).toEqual([
      { id: 'a', name: 'BitBox02 Nova A', type: 'bitbox02-nova', transport: 'ble' },
      { id: 'b', name: 'BitBox02 Nova B', type: 'bitbox02-nova', transport: 'ble' },
    ]);
  });

  it('falls back name → localName → "BitBox02 Nova"', async () => {
    const scan = scanBleDevices();
    const listener = getScanListener();

    listener(null, { id: 'a', name: null, localName: 'Local Nova' });
    listener(null, { id: 'b', name: null, localName: null });

    jest.advanceTimersByTime(10_000);
    const devices = await scan;

    expect(devices.map((d) => d.name)).toEqual(['Local Nova', 'BitBox02 Nova']);
  });

  it('ignores scan errors and null devices', async () => {
    const scan = scanBleDevices();
    const listener = getScanListener();

    listener(new Error('bluetooth off'), null);
    listener(null, null);
    listener(null, { id: 'ok', name: 'Nova' });

    jest.advanceTimersByTime(10_000);
    await expect(scan).resolves.toEqual([
      { id: 'ok', name: 'Nova', type: 'bitbox02-nova', transport: 'ble' },
    ]);
  });

  it('ignores devices that appear after the scan window closed', async () => {
    const scan = scanBleDevices();
    const listener = getScanListener();

    jest.advanceTimersByTime(10_000);
    const devices = await scan;
    expect(devices).toEqual([]);

    // Late callback after resolution must not throw (result is already fixed).
    expect(() => listener(null, { id: 'late', name: 'Late Nova' })).not.toThrow();
  });
});
