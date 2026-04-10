import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components';
import { DfxColors, Typography } from '@/theme';

export default function HardwareConnectScreen() {
  // TODO: Port BitBox connect flow from RealUnit
  // Reference: screens/hardware_connect_bitbox/
  // Flow: Scan USB → Detect → Connect → Verify Channel → Get Address → Create View Wallet
  //
  // States (from RealUnit connect_bitbox_state.dart):
  //   BitboxNotConnected → BitboxFound → BitboxConnecting → BitboxConnected

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text style={styles.title}>Connect Hardware Wallet</Text>
        <View style={styles.illustration}>
          <Text style={styles.illustrationText}>BitBox02</Text>
        </View>
        <Text style={styles.description}>
          Connect your BitBox02 via USB to use it as a signing device.
        </Text>
        <Text style={styles.hint}>
          Your private keys never leave the hardware wallet.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 24,
  },
  title: {
    ...Typography.headlineMedium,
    color: DfxColors.text,
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
  description: {
    ...Typography.bodyLarge,
    color: DfxColors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  hint: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
    textAlign: 'center',
  },
});
