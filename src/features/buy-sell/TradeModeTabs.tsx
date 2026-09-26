import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { GlassPill } from '@/components/GlassPill';
import { GlassSurface } from '@/components/GlassSurface';

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

  return (
    <View accessibilityRole="tablist" testID="trade-mode-tabs">
      <GlassSurface variant="quiet" radius={15} style={styles.container}>
        {tradeModes.map((mode) => {
          const selected = mode.key === active;

          return (
            <GlassPill
              key={mode.key}
              selected={selected}
              onPress={() => {
                if (!selected) {
                  onChange(mode.key);
                }
              }}
              style={styles.tab}
              testID={`trade-tab-${mode.key}`}
              accessibilityRole="tab"
            >
              {t(mode.label)}
            </GlassPill>
          );
        })}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 4,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
  },
});
