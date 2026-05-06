import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import { formatCompact } from '@/config/portfolio-presentation';
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

type IconConfig = {
  iconName: 'arrow-down' | 'arrow-up' | 'swap' | 'storefront' | 'send' | 'receive';
  fg: string;
  bg: string;
};

// Buy / Sell = DFX on-/off-ramp (fiat ↔ crypto, brand-colored).
// Send / Receive = on-chain transfer with another address.
// Swap = in-wallet asset conversion. Pay = merchant payment.
const TYPE_ICON = new Map<TransactionDto['type'], IconConfig>([
  ['Buy', { iconName: 'arrow-down', fg: DfxColors.success, bg: '#DCFCE7' }],
  ['Sell', { iconName: 'arrow-up', fg: DfxColors.error, bg: '#FEE2E2' }],
  ['Swap', { iconName: 'swap', fg: DfxColors.primary, bg: '#DCEAFE' }],
  ['Pay', { iconName: 'storefront', fg: '#7C3AED', bg: '#EDE9FE' }],
  ['Send', { iconName: 'send', fg: DfxColors.error, bg: '#FEE2E2' }],
  ['Receive', { iconName: 'receive', fg: DfxColors.success, bg: '#DCFCE7' }],
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
  const isOutgoing = tx.type === 'Sell' || tx.type === 'Pay' || tx.type === 'Send';
  const stateColor = STATE_COLORS.get(tx.state) ?? DfxColors.textTertiary;
  const iconConfig =
    TYPE_ICON.get(tx.type) ??
    ({ iconName: 'swap', fg: DfxColors.primary, bg: '#DCEAFE' } satisfies IconConfig);
  const subtitle =
    tx.type === 'Pay' && tx.recipient ? tx.recipient : new Date(tx.date).toLocaleDateString();

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
      <View style={[styles.icon, { backgroundColor: iconConfig.bg }]}>
        <Icon name={iconConfig.iconName} size={18} color={iconConfig.fg} strokeWidth={2.2} />
      </View>
      <View style={styles.info}>
        <Text style={styles.type}>{tx.type}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <View style={styles.amountColumn}>
        <Text
          style={[styles.amount, { color: isOutgoing ? DfxColors.error : DfxColors.success }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {isOutgoing ? '-' : '+'}
          {formatCompact(tx.outputAmount)} {tx.outputAsset}
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
  subtitle: {
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
