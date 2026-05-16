import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppHeader, DfxBackgroundScreen, PrimaryButton } from '@/components';
import { BitboxProvider, BitboxWasmWebView } from './services';
import type { HardwareWalletDevice, HardwareWalletStatus } from './services';
import { useHardwareWalletStore } from './store';
import { DfxColors, Typography } from '@/theme';

const provider = new BitboxProvider();

export default function HardwareConnectScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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
      void provider.disconnect();
    };
  }, []);

  return (
    <DfxBackgroundScreen contentStyle={styles.screen} testID="hardware-connect-screen">
      <View style={styles.content}>
        <AppHeader title={t('hardware.connect')} onBack={() => router.back()} testID="hardware" />

        <View style={styles.body}>
          <View style={styles.illustration}>
            <Text style={styles.illustrationText}>BitBox02</Text>
          </View>

          <View style={styles.statusContainer}>
            {status === 'scanning' && <ActivityIndicator color={DfxColors.primary} />}
            <Text style={styles.statusText}>{t(`hardware.status.${status}`)}</Text>
          </View>

          {status === 'disconnected' && (
            <>
              <Text style={styles.description}>
                {isAndroid ? t('hardware.connectDescription') : t('hardware.connectDescriptionIos')}
              </Text>
              <View style={styles.transportInfo}>
                {isAndroid && (
                  <View style={styles.transportRow}>
                    <View style={[styles.transportBadge, styles.usbBadge]}>
                      <Text style={styles.transportBadgeText}>USB</Text>
                    </View>
                    <Text style={styles.transportLabel}>{t('hardware.bitboxStandard')}</Text>
                  </View>
                )}
                <View style={styles.transportRow}>
                  <View style={[styles.transportBadge, styles.bleBadge]}>
                    <Text style={styles.transportBadgeText}>BLE</Text>
                  </View>
                  <Text style={styles.transportLabel}>{t('hardware.bitboxNova')}</Text>
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
                  <Text style={styles.connectText}>{t('hardware.deviceConnect')}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {status === 'verifying' && <Text style={styles.hint}>{t('hardware.pairingHint')}</Text>}

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
            <PrimaryButton title={t('hardware.scanDevices')} onPress={handleScan} />
          )}
          {status === 'connected' && (
            <PrimaryButton title={t('common.done')} onPress={() => router.back()} />
          )}
          {(status === 'connecting' || status === 'verifying') && (
            <PrimaryButton
              title={t('common.cancel')}
              variant="outlined"
              onPress={() => {
                void provider.disconnect();
                reset();
              }}
            />
          )}
        </View>
      </View>
      {/* Hidden WebView for BitBox WASM — mounted when scanning/connecting */}
      <BitboxWasmWebView bridge={provider.getBridge()} onReady={() => setWasmReady(true)} />
    </DfxBackgroundScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingTop: 4,
    paddingBottom: 24,
  },
  content: {
    flex: 1,
    gap: 16,
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
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: DfxColors.border,
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
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DfxColors.border,
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
