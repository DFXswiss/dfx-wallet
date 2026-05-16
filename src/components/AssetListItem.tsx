import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SYMBOL_COLORS, SYMBOL_GLYPH } from '@/config/portfolio-presentation';
import { Typography, useColors, type ThemeColors } from '@/theme';

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
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const upperSymbol = symbol.toUpperCase();
  const tint = SYMBOL_COLORS.get(upperSymbol);
  const glyph = SYMBOL_GLYPH.get(upperSymbol);

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={[styles.iconContainer, tint ? { backgroundColor: tint } : null]}>
        <Text style={[styles.iconText, tint ? styles.iconTextOnTint : null]}>
          {glyph ?? upperSymbol.slice(0, 2)}
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        {/* eslint-disable-next-line security/detect-object-injection -- CHAIN_LABELS is a Record<string, string>, lookup yields a label string only */}
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

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.surface,
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
      backgroundColor: colors.surfaceLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconText: {
      ...Typography.bodyMedium,
      fontWeight: '700',
      color: colors.text,
      fontSize: 18,
    },
    iconTextOnTint: {
      color: colors.white,
    },
    info: {
      flex: 1,
      gap: 2,
    },
    name: {
      ...Typography.bodyLarge,
      fontWeight: '600',
      color: colors.text,
    },
    chain: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
    },
    balanceContainer: {
      alignItems: 'flex-end',
      gap: 2,
    },
    // Tabular figures keep the right-edge of the balance column aligned
    // across rows even when one row reads `1.234` and another `12.045`.
    balance: {
      ...Typography.bodyMedium,
      fontWeight: '600',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    balanceFiat: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
  });
