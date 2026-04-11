import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PrimaryButton, ScreenContainer } from '@/components';
import { BitboxProvider, BitboxWasmWebView } from '@/services/hardware-wallet';
import type { HardwareWalletDevice, HardwareWalletStatus } from '@/services/hardware-wallet';
import { useHardwareWalletStore } from '@/store';
import { DfxColors, Typography } from '@/theme';

const provider = new BitboxProvider();

const STATUS_TEXT: Record<HardwareWalletStatus, string> = {
  disconnected: 'Not connected',
  scanning: 'Scanning for devices...',
  detected: 'Device found',
  connecting: 'Connecting...',
  verifying: 'Verify on device...',
  connected: 'Connected',
};

export default function HardwareConnectScreen() {
  const router = useRouter();
  const { status, device, setStatus, setDevice, setAddress, setError, reset } =
    useHardwareWalletStore();
  const [devices, setDevices] = useState<HardwareWalletDevice[]>([]);

  const isAndroid = Platform.OS === 'android';

  const handleScan = async () => {
    setStatus('scanning');
    try {
      const found = await provider.scanDevices();
      setDevices(found);
      setStatus(found.length > 0 ? 'detected' : 'disconnected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    }
  };

  const handleConnect = async (dev: HardwareWalletDevice) => {
    setDevice(dev);
    setStatus('connecting');
    try {
      await provider.connect(dev);
      setStatus('verifying');
      const address = await provider.getEthAddress();
      setAddress(address);
      setStatus('connected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  const [, setWasmReady] = useState(false);

  useEffect(() => {
    return () => {
      provider.disconnect();
    };
  }, []);

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backButton}>{'\u2190'}</Text>
          </Pressable>
          <Text style={styles.title}>Hardware Wallet</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.body}>
          <View style={styles.illustration}>
            <Text style={styles.illustrationText}>BitBox02</Text>
          </View>

          <View style={styles.statusContainer}>
            {status === 'scanning' && <ActivityIndicator color={DfxColors.primary} />}
            <Text style={styles.statusText}>{STATUS_TEXT[status]}</Text>
          </View>

          {status === 'disconnected' && (
            <>
              <Text style={styles.description}>
                {isAndroid
                  ? 'Connect your BitBox02 via USB or scan for BitBox02 Nova via Bluetooth.'
                  : 'Scan for your BitBox02 Nova via Bluetooth.'}
              </Text>
              <View style={styles.transportInfo}>
                {isAndroid && (
                  <View style={styles.transportRow}>
                    <View style={[styles.transportBadge, styles.usbBadge]}>
                      <Text style={styles.transportBadgeText}>USB</Text>
                    </View>
                    <Text style={styles.transportLabel}>BitBox02 (Standard)</Text>
                  </View>
                )}
                <View style={styles.transportRow}>
                  <View style={[styles.transportBadge, styles.bleBadge]}>
                    <Text style={styles.transportBadgeText}>BLE</Text>
                  </View>
                  <Text style={styles.transportLabel}>BitBox02 Nova</Text>
                </View>
              </View>
            </>
          )}

          {devices.length > 0 && status === 'detected' && (
            <View style={styles.deviceList}>
              {devices.map((dev) => (
                <Pressable
                  key={dev.id}
                  style={styles.deviceItem}
                  onPress={() => handleConnect(dev)}
                >
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>{dev.name}</Text>
                    <View
                      style={[
                        styles.transportBadge,
                        dev.transport === 'usb' ? styles.usbBadge : styles.bleBadge,
                      ]}
                    >
                      <Text style={styles.transportBadgeText}>{dev.transport.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.connectText}>Connect</Text>
                </Pressable>
              ))}
            </View>
          )}

          {status === 'verifying' && (
            <Text style={styles.hint}>
              Please confirm the pairing code on your BitBox02 device.
            </Text>
          )}

          {status === 'connected' && (
            <View style={styles.successContainer}>
              <Text style={styles.successIcon}>{'\u2705'}</Text>
              <Text style={styles.successText}>
                {device?.name} connected via {device?.transport.toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          {status === 'disconnected' && (
            <PrimaryButton title="Scan for devices" onPress={handleScan} />
          )}
          {status === 'connected' && <PrimaryButton title="Done" onPress={() => router.back()} />}
          {(status === 'connecting' || status === 'verifying') && (
            <PrimaryButton
              title="Cancel"
              variant="outlined"
              onPress={() => {
                provider.disconnect();
                reset();
              }}
            />
          )}
        </View>
      </View>
      {/* Hidden WebView for BitBox WASM — mounted when scanning/connecting */}
      <BitboxWasmWebView bridge={provider.getBridge()} onReady={() => setWasmReady(true)} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingVertical: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    fontSize: 24,
    color: DfxColors.text,
    width: 32,
  },
  title: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    gap: 24,
    paddingTop: 24,
  },
  illustration: {
    width: 200,
    height: 120,
    borderRadius: 16,
    backgroundColor: DfxColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationText: {
    ...Typography.headlineSmall,
    color: DfxColors.textTertiary,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: DfxColors.text,
  },
  description: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  transportInfo: {
    gap: 12,
    width: '100%',
    paddingHorizontal: 32,
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  transportBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  usbBadge: {
    backgroundColor: DfxColors.info,
  },
  bleBadge: {
    backgroundColor: DfxColors.success,
  },
  transportBadgeText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: DfxColors.black,
  },
  transportLabel: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
  },
  deviceList: {
    width: '100%',
    gap: 8,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: DfxColors.surface,
    borderRadius: 12,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deviceName: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: DfxColors.text,
  },
  connectText: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: DfxColors.primary,
  },
  hint: {
    ...Typography.bodyMedium,
    color: DfxColors.warning,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  successContainer: {
    alignItems: 'center',
    gap: 12,
  },
  successIcon: {
    fontSize: 48,
  },
  successText: {
    ...Typography.bodyLarge,
    color: DfxColors.success,
  },
  actions: {
    gap: 12,
  },
});
