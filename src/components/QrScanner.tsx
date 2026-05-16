import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import { Typography, useColors, type ThemeColors } from '@/theme';

type Props = {
  visible: boolean;
  onScan: (data: string) => void;
  onClose: () => void;
};

export function QrScanner({ visible, onScan, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    if (visible && !permission?.granted) {
      void requestPermission();
    }
    if (visible) setScanned(false);
  }, [visible, permission, requestPermission]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    onScan(data);
    onClose();
  };

  const handlePasteFromClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      onScan(text);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        {permission?.granted ? (
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarCodeScanned}
          >
            <View style={styles.overlay}>
              <View style={styles.cutout} />
            </View>
          </CameraView>
        ) : (
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>
              Camera permission is required to scan QR codes.
            </Text>
            <Pressable style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </Pressable>
          </View>
        )}

        <Pressable style={styles.pasteButton} onPress={handlePasteFromClipboard}>
          <Text style={styles.pasteText}>Paste from clipboard</Text>
        </Pressable>

        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      // Camera viewfinder always has a black bezel regardless of app theme
      // — that's how every native QR-scanner reads.
      backgroundColor: '#000000',
    },
    camera: {
      flex: 1,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cutout: {
      width: 250,
      height: 250,
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: 16,
      backgroundColor: 'transparent',
    },
    permissionContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: 32,
    },
    permissionText: {
      ...Typography.bodyLarge,
      color: colors.white,
      textAlign: 'center',
    },
    permissionButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
    },
    permissionButtonText: {
      ...Typography.bodyMedium,
      fontWeight: '600',
      color: colors.white,
    },
    pasteButton: {
      position: 'absolute',
      bottom: 100,
      alignSelf: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
    },
    pasteText: {
      ...Typography.bodyMedium,
      color: colors.white,
      fontWeight: '600',
    },
    closeButton: {
      position: 'absolute',
      top: 60,
      right: 20,
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
    },
    closeText: {
      ...Typography.bodyMedium,
      color: colors.white,
      fontWeight: '600',
    },
  });
