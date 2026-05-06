import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import type { TransactionDto } from '@/services/dfx';
import { DfxColors, Typography } from '@/theme';

const STATE_COLORS = new Map<string, string>([
  ['Completed', DfxColors.success],
  ['Processing', DfxColors.warning],
  ['AmlCheck', DfxColors.warning],
  ['Created', DfxColors.info],
  ['Failed', DfxColors.error],
  ['Returned', DfxColors.error],
]);

type Props = {
  tx: TransactionDto;
  onPress?: () => void;
  showState?: boolean;
  testID?: string;
};

/**
 * Compact TrustWallet-style transaction row used by the home screen
 * preview, the global history list, and per-asset filtered lists.
 */
export function TransactionRow({ tx, onPress, showState = true, testID }: Props) {
  const isOutgoing = tx.type === 'Sell';
  const stateColor = STATE_COLORS.get(tx.state) ?? DfxColors.textTertiary;

  const Container = onPress ? Pressable : View;
  const containerProps = onPress
    ? {
        onPress,
        testID,
        style: ({ pressed }: { pressed: boolean }) => [styles.row, pressed && styles.pressed],
      }
    : { style: styles.row, testID };

  return (
    <Container {...(containerProps as object)}>
      <View style={[styles.icon, { backgroundColor: isOutgoing ? '#FEE2E2' : '#DCFCE7' }]}>
        <Icon
          name={isOutgoing ? 'send' : 'receive'}
          size={18}
          color={isOutgoing ? DfxColors.error : DfxColors.success}
          strokeWidth={2.2}
        />
      </View>
      <View style={styles.info}>
        <Text style={styles.type}>{tx.type}</Text>
        <Text style={styles.date}>{new Date(tx.date).toLocaleDateString()}</Text>
      </View>
      <View style={styles.amountColumn}>
        <Text
          style={[styles.amount, { color: isOutgoing ? DfxColors.error : DfxColors.success }]}
          numberOfLines={1}
        >
          {isOutgoing ? '-' : '+'}
          {tx.outputAmount} {tx.outputAsset}
        </Text>
        {showState ? (
          <Text style={[styles.state, { color: stateColor }]} numberOfLines={1}>
            {tx.state}
          </Text>
        ) : null}
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 12,
  },
  pressed: {
    opacity: 0.6,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  type: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: DfxColors.text,
  },
  date: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
  },
  amountColumn: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 110,
  },
  amount: {
    ...Typography.bodyMedium,
    fontWeight: '600',
  },
  state: {
    ...Typography.bodySmall,
    fontWeight: '500',
  },
});
