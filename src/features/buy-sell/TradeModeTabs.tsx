import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Typography, useColors } from '@/theme';

export type TradeMode = 'buy' | 'sell' | 'swap';

type TradeModeTabsProps = {
  active: TradeMode;
};

const tradeModes = [
  { key: 'buy', label: 'buy.title', route: '/(auth)/buy' },
  { key: 'sell', label: 'sell.title', route: '/(auth)/sell' },
  { key: 'swap', label: 'swap.title', route: '/(auth)/swap' },
] as const;

const keepNonEmptyString = (value: unknown) =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

export default function TradeModeTabs({ active }: TradeModeTabsProps) {
  const router = useRouter();
  const { asset, chain, targetAddress, targetBlockchain } = useLocalSearchParams();
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
                router.replace({ pathname: mode.route, params });
              }
            }}
            style={[
              styles.tab,
              { backgroundColor: selected ? colors.card : 'transparent' },
            ]}
            testID={`trade-tab-${mode.key}`}
          >
            <Text
              style={[
                styles.label,
                { color: selected ? colors.text : colors.textTertiary },
              ]}
            >
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
    ...Typography.bodyMedium,
    fontWeight: '600',
  },
});
