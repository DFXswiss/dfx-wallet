import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useColors } from '@/theme';

type Props = {
  value: string;
  size?: number;
  /** White margin around the code in px. The scan-size default (16) leaves
   *  no room for a code below ~100 px, so compact previews pass a small one. */
  quietZone?: number;
};

export function QrCode({ value, size = 200, quietZone = 16 }: Props) {
  const colors = useColors();
  return (
    <View style={styles.container}>
      <QRCode
        value={value || ' '}
        size={size}
        backgroundColor={colors.white}
        color={colors.black}
        quietZone={quietZone}
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
  },
});
