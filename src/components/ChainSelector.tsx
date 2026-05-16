import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { ChainId } from '@/config/chains';
import { Typography, useColors, type ThemeColors } from '@/theme';

type Props = {
  selected: ChainId;
  onSelect: (chain: ChainId) => void;
  chains?: ChainId[];
};

const CHAIN_INFO: Record<string, { label: string; short: string }> = {
  ethereum: { label: 'Ethereum', short: 'ETH' },
  arbitrum: { label: 'Arbitrum', short: 'ARB' },
  polygon: { label: 'Polygon', short: 'POL' },
  spark: { label: 'Spark BTC', short: 'BTC' },
};

const DEFAULT_CHAINS: ChainId[] = ['ethereum', 'arbitrum', 'polygon', 'spark'];

export function ChainSelector({ selected, onSelect, chains = DEFAULT_CHAINS }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {chains.map((chain) => {
        // eslint-disable-next-line security/detect-object-injection -- chain is a ChainId literal union
        const info = CHAIN_INFO[chain];
        const isSelected = chain === selected;

        return (
          <Pressable
            key={chain}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => onSelect(chain)}
          >
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
              {info?.short ?? chain}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      gap: 8,
      paddingVertical: 4,
    },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: colors.surface,
    },
    chipSelected: {
      backgroundColor: colors.primary,
    },
    chipText: {
      ...Typography.bodySmall,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    chipTextSelected: {
      color: colors.white,
    },
  });
