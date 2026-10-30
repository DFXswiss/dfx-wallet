import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useColors } from '@/theme';

type Props = {
  value: string;
  size?: number;
};

export function QrCode({ value, size = 200 }: Props) {
  const colors = useColors();
  return (
    <View style={styles.container}>
      <QRCode
        value={value || ' '}
        size={size}
        backgroundColor={colors.white}
        color={colors.black}
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
  },
});
