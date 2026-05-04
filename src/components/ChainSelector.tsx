import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { ChainId } from '@/config/chains';
import { DfxColors, Typography } from '@/theme';

type Props = {
  selected: ChainId;
  onSelect: (chain: ChainId) => void;
  chains?: ChainId[];
};

const CHAIN_INFO: Record<string, { label: string; short: string }> = {
  bitcoin: { label: 'Bitcoin', short: 'BTC' },
  ethereum: { label: 'Ethereum', short: 'ETH' },
  arbitrum: { label: 'Arbitrum', short: 'ARB' },
  polygon: { label: 'Polygon', short: 'POL' },
  optimism: { label: 'Optimism', short: 'OP' },
  base: { label: 'Base', short: 'BASE' },
};

const DEFAULT_CHAINS: ChainId[] = ['bitcoin', 'ethereum', 'arbitrum', 'polygon'];

export function ChainSelector({ selected, onSelect, chains = DEFAULT_CHAINS }: Props) {
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

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: DfxColors.surface,
  },
  chipSelected: {
    backgroundColor: DfxColors.primary,
  },
  chipText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: DfxColors.textSecondary,
  },
  chipTextSelected: {
    color: DfxColors.white,
  },
});
