import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DfxColors, Typography } from '@/theme';

type Props = {
  symbol: string;
  name: string;
  chain: string;
  balance: string;
  balanceFiat: string;
  onPress?: () => void;
};

const CHAIN_LABELS: Record<string, string> = {
  bitcoin: 'Bitcoin',
  ethereum: 'Ethereum',
  arbitrum: 'Arbitrum',
  polygon: 'Polygon',
  optimism: 'Optimism',
  base: 'Base',
};

export function AssetListItem({ symbol, name, chain, balance, balanceFiat, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.iconText}>{symbol.slice(0, 2)}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.chain}>{CHAIN_LABELS[chain] ?? chain}</Text>
      </View>

      <View style={styles.balanceContainer}>
        <Text style={styles.balance}>
          {balance} {symbol}
        </Text>
        <Text style={styles.balanceFiat}>{balanceFiat}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: DfxColors.surface,
    borderRadius: 12,
    gap: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: DfxColors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: DfxColors.text,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: DfxColors.text,
  },
  chain: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
  },
  balanceContainer: {
    alignItems: 'flex-end',
    gap: 2,
  },
  balance: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: DfxColors.text,
  },
  balanceFiat: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
  },
});
