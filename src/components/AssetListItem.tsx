import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, IconTile, Interaction, Typography, useColors, type ThemeColors } from '@/theme';

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
      padding: Card.padding,
      backgroundColor: colors.cardOverlay,
      borderRadius: Card.radius,
      borderWidth: Card.borderWidth,
      borderColor: colors.cardOverlayBorder,
      gap: Card.gap,
    },
    pressed: {
      opacity: Interaction.pressedCardOpacity,
    },
    iconContainer: {
      width: IconTile.md.size,
      height: IconTile.md.size,
      borderRadius: IconTile.md.radius,
      backgroundColor: colors.surfaceLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconText: {
      ...Typography.bodyMedium,
      fontWeight: '700',
      color: colors.text,
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
    balance: {
      ...Typography.bodyMedium,
      fontWeight: '600',
      color: colors.text,
    },
    balanceFiat: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
    },
  });
