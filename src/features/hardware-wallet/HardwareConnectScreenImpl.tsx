import { useEffect, useRef, useState, useMemo } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppHeader, DfxBackgroundScreen, PrimaryButton } from '@/components';
import { BitboxProvider, BitboxWasmWebView } from './services';
import type { HardwareWalletDevice } from './services';
import {
  HwAddressMismatchError,
  HwBridgeNotReadyError,
  HwBridgeTimeoutError,
  HwFirmwareRejectError,
  HwFirmwareTooOldError,
  HwInvalidPayloadError,
  HwNotConnectedError,
  HwPermissionDeniedError,
  HwTransportFailureError,
  HwUserAbortError,
} from './services/errors';
import { useHardwareWalletStore } from './store';
import { Typography, useColors, type ThemeColors } from '@/theme';

/**
 * Maps a hardware-wallet error to a localised, user-visible message. The
 * UI MUST surface UserAbort and FirmwareReject distinctly — they need
 * different copy ("You rejected on device" vs "Connection failed").
 *
 * Each typed Hw* class maps to its own localisation key. The fallback
 * for an untyped Error returns the generic key (NOT err.message) so a
 * native-library jargon string never reaches the user.
 */

function userMessage(err: unknown, t: any): string {
  if (err instanceof HwUserAbortError) return t('hardware.error.userAbort');
  if (err instanceof HwFirmwareTooOldError)
    return t('hardware.error.firmwareTooOld', {
      actual: err.actual,
      minRequired: err.minRequired,
    });
  if (err instanceof HwFirmwareRejectError) return t('hardware.error.firmwareReject');
  if (err instanceof HwPermissionDeniedError) return t('hardware.error.permissionDenied');
  if (err instanceof HwTransportFailureError) return t('hardware.error.transport');
  if (err instanceof HwAddressMismatchError) return t('hardware.error.addressMismatch');
  if (err instanceof HwInvalidPayloadError) return t('hardware.error.invalidPayload');
  if (err instanceof HwBridgeTimeoutError) return t('hardware.error.transport');
  if (err instanceof HwBridgeNotReadyError) return t('hardware.error.transport');
  if (err instanceof HwNotConnectedError) return t('hardware.error.transport');
  return t('hardware.error.unknown');
}

/**
 * Format a hex channel-hash into 4-char groups for human comparison
 * against the BitBox display. The device renders the first 32 hex
 * chars of the Noise XX channel hash in groups of 4; we mirror that
 * format here so the user can compare line-by-line.
 */
function formatChannelHash(hash: string): string {
  // Lowercase for consistency with what generateNonce/bridge produce.
  const lower = hash.toLowerCase();
  // Use the first 32 chars (= first 16 bytes); that's what the BitBox
  // firmware displays. Grouped into 4-char chunks.
  const head = lower.slice(0, 32);
  const groups: string[] = [];
  for (let i = 0; i < head.length; i += 4) {
    groups.push(head.slice(i, i + 4));
  }
  return groups.join(' ');
}

export default function HardwareConnectScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { t } = useTranslation();
  const {
    status,
    device,
    error,
    channelHash,
    setStatus,
    setDevice,
    setAddress,
    setChannelHash,
    setErrorState,
    reset,
  } = useHardwareWalletStore();
  const [devices, setDevices] = useState<HardwareWalletDevice[]>([]);
  const [, setWasmReady] = useState(false);

  // Per-screen provider instance — never a module-level singleton, so a
  // second mount of this screen does not share transport state with the
  // first. Owned by the useEffect cleanup below.
  const providerRef = useRef<BitboxProvider | null>(null);
  if (!providerRef.current) providerRef.current = new BitboxProvider();
  const provider = providerRef.current;

  const isAndroid = Platform.OS === 'android';

  const handleScan = async () => {
    setStatus('scanning');
    try {
      const found = await provider.scanDevices();
      setDevices(found);
      setStatus(found.length > 0 ? 'detected' : 'disconnected');
    } catch (err) {
      setErrorState(userMessage(err, t));
    }
  };

  const handleConnect = async (dev: HardwareWalletDevice) => {
    setDevice(dev);
    setStatus('connecting');
    try {
      await provider.connect(dev);
      // Surface the pairing channel hash so the user can compare it
      // against the value on the BitBox display before any sensitive
      // operation runs. Without that comparison the Noise XX pairing's
      // MITM-resistance is not realised.
      setChannelHash(provider.getChannelHash());
      setStatus('verifying');
      // Receive-address with displayOnDevice + verifyByXpub:
      //  - on-device verify: BitBox screen shows the address.
      //  - xpub verify: we re-derive it client-side from ethXpub and
      //    throw HwAddressMismatchError if the device-returned string
      //    differs. Both layers together protect against a malicious
      //    WASM that lies via the JSON-RPC bridge.
      const address = await provider.getEthAddress({
        chainId: 1n,
        displayOnDevice: true,
        verifyByXpub: true,
      });
      setAddress(address);
      setStatus('connected');
    } catch (err) {
      setErrorState(userMessage(err, t));
    }
  };

  useEffect(() => {
    const unsubscribe = provider.subscribeTransport((event) => {
      if (event === 'disconnected') {
        setStatus('reconnecting');
      } else if (event === 'fatal') {
        setErrorState(t('hardware.error.transport'));
      }
    });
    return () => {
      unsubscribe();
      void provider.disconnect();
    };
  }, [provider, setErrorState, setStatus, t]);

  return (
    <DfxBackgroundScreen contentStyle={styles.screen} testID="hardware-connect-screen">
      <View style={styles.content}>
        <AppHeader title={t('hardware.connect')} onBack={() => router.back()} testID="hardware" />

        <View style={styles.body}>
          <View style={styles.illustration}>
            <Text style={styles.illustrationText}>BitBox02</Text>
          </View>

          <View style={styles.statusContainer}>
            {status === 'scanning' && <ActivityIndicator color={colors.primary} />}
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

          {status === 'verifying' && (
            <View style={styles.verifyingContainer} testID="hardware-verifying">
              <Text style={styles.hint}>{t('hardware.pairingHint')}</Text>
              {channelHash ? (
                <>
                  <Text style={styles.channelHashLabel}>{t('hardware.channelHashLabel')}</Text>
                  <Text style={styles.channelHashValue} testID="hardware-channel-hash" selectable>
                    {formatChannelHash(channelHash)}
                  </Text>
                  <Text style={styles.hint}>{t('hardware.channelHashCompare')}</Text>
                </>
              ) : (
                <Text style={styles.hint}>{t('hardware.channelHashMissing')}</Text>
              )}
            </View>
          )}

          {status === 'connected' && (
            <View style={styles.successContainer}>
              <Text style={styles.successIcon}>{'\u2705'}</Text>
              <Text style={styles.successText}>
                {device?.name} connected via {device?.transport.toUpperCase()}
              </Text>
            </View>
          )}

          {status === 'error' && error && (
            <View style={styles.errorBanner} testID="hardware-error-banner">
              <Text style={styles.errorText}>{error}</Text>
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
          {(status === 'error' || status === 'reconnecting') && (
            <PrimaryButton
              title={t('hardware.retry')}
              onPress={() => {
                reset();
                void handleScan();
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

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
    verifyingContainer: {
      gap: 12,
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    channelHashLabel: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    channelHashValue: {
      ...Typography.bodyLarge,
      color: colors.text,
      backgroundColor: colors.surfaceLight,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      letterSpacing: 2,
      fontFamily: 'Menlo',
    },
    errorBanner: {
      width: '100%',
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.error,
      backgroundColor: colors.surfaceLight,
    },
    errorText: {
      ...Typography.bodyMedium,
      color: colors.error,
      textAlign: 'center',
    },
    illustration: {
      width: 200,
      height: 120,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.9)',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    illustrationText: {
      ...Typography.headlineSmall,
      color: colors.textTertiary,
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusText: {
      ...Typography.bodyLarge,
      fontWeight: '600',
      color: colors.text,
    },
    description: {
      ...Typography.bodyMedium,
      color: colors.textSecondary,
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
      backgroundColor: colors.info,
    },
    bleBadge: {
      backgroundColor: colors.success,
    },
    transportBadgeText: {
      ...Typography.bodySmall,
      fontWeight: '700',
      color: colors.black,
    },
    transportLabel: {
      ...Typography.bodyMedium,
      color: colors.textSecondary,
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
      borderColor: colors.border,
    },
    deviceInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    deviceName: {
      ...Typography.bodyLarge,
      fontWeight: '600',
      color: colors.text,
    },
    connectText: {
      ...Typography.bodyMedium,
      fontWeight: '600',
      color: colors.primary,
    },
    hint: {
      ...Typography.bodyMedium,
      color: colors.warning,
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
      color: colors.success,
    },
    actions: {
      gap: 12,
    },
  });
