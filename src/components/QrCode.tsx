import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

type Props = {
  value: string;
  size?: number;
};

// QR codes intentionally render with a white-on-black palette regardless of
// theme so camera scanners on either side reliably decode them. Theming the
// QR would lower decode reliability in low-light scans.
export function QrCode({ value, size = 200 }: Props) {
  return (
    <View style={styles.container}>
      <QRCode
        value={value || ' '}
        size={size}
        backgroundColor="#FFFFFF"
        color="#000000"
        quietZone={16}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
});
