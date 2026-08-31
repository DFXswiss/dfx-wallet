import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/theme';

export type TradeMode = 'buy' | 'sell' | 'swap';

type TradeModeTabsProps = {
  active: TradeMode;
};

const tradeModes = [
  { key: 'buy', label: 'buy.title', route: '/(auth)/buy' },
  { key: 'sell', label: 'sell.title', route: '/(auth)/sell' },
  { key: 'swap', label: 'swap.title', route: '/(auth)/swap' },
] as const;

export default function TradeModeTabs({ active }: TradeModeTabsProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useColors();

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
                router.replace(mode.route);
              }
            }}
            style={[styles.tab, { backgroundColor: selected ? colors.card : 'transparent' }]}
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
    borderRadius: 15,
    padding: 4,
    borderWidth: 1,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    borderRadius: 11,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600',
    fontSize: 14,
  },
});
