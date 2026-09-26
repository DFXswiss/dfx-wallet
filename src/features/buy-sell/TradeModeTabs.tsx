import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Radius, Spacing, Typography, useColors } from '@/theme';

export type TradeMode = 'buy' | 'sell' | 'swap';

type TradeModeTabsProps = {
  active: TradeMode;
  onChange: (mode: TradeMode) => void;
};

const tradeModes = [
  { key: 'buy', label: 'buy.title' },
  { key: 'sell', label: 'sell.title' },
  { key: 'swap', label: 'swap.title' },
] as const;

export default function TradeModeTabs({ active, onChange }: TradeModeTabsProps) {
  const { t } = useTranslation();
  const colors = useColors();

  const assetParam = keepNonEmptyString(asset);
  const chainParam = keepNonEmptyString(chain);
  const targetAddressParam = keepNonEmptyString(targetAddress);
  const targetBlockchainParam = keepNonEmptyString(targetBlockchain);
  const params = {
    ...(assetParam === undefined ? {} : { asset: assetParam }),
    ...(chainParam === undefined ? {} : { chain: chainParam }),
    ...(targetAddressParam === undefined ? {} : { targetAddress: targetAddressParam }),
    ...(targetBlockchainParam === undefined ? {} : { targetBlockchain: targetBlockchainParam }),
  };

  return (
    <View
      accessibilityRole="tablist"
      testID="trade-mode-tabs"
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceLight,
          borderColor: colors.border,
        },
      ]}
    >
      {tradeModes.map((mode) => {
        const selected = mode.key === active;

        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={mode.key}
            onPress={() => {
              if (!selected) {
                onChange(mode.key);
              }
            }}
            style={[styles.tab, { backgroundColor: selected ? colors.card : colors.transparent }]}
            testID={`trade-tab-${mode.key}`}
          >
            <Text style={[styles.label, { color: selected ? colors.text : colors.textTertiary }]}>
              {t(mode.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    padding: Spacing.xs,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...Typography.bodyMedium,
    fontWeight: '600',
  },
});
