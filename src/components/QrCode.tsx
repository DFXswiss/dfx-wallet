import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { DfxColors } from '@/theme';

type Props = {
  value: string;
  size?: number;
};

export function QrCode({ value, size = 200 }: Props) {
  return (
    <View style={styles.container}>
      <QRCode
        value={value || ' '}
        size={size}
        backgroundColor={DfxColors.white}
        color={DfxColors.black}
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
