import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DfxColors, Typography } from '@/theme';
import { Icon } from './Icon';

type Props = {
  /** Optional asset symbol to preselect on the Buy/Sell screen (e.g. 'BTC'). */
  asset?: string;
  /** Optional chain id to preselect (e.g. 'bitcoin', 'spark', 'ethereum'). */
  chain?: string;
  testID?: string;
};

/**
 * Compact Kaufen / Verkaufen pill row for wallet- and asset-detail screens.
 *
 * Uses the same `primaryLight` + `primary` visual language as the existing
 * copyBadge / quickAmount chips so the row sits naturally inside the
 * surrounding card stack without competing for attention.
 *
 * Both pills route to the existing Buy/Sell flows. Optional `asset` and
 * `chain` params are passed through so the Buy/Sell screen can preselect
 * the right token on mount (when those screens read the route params).
 */
export function AssetActions({ asset, chain, testID }: Props) {
  const router = useRouter();
  const { t } = useTranslation();

  const navigate = (path: '/(auth)/buy' | '/(auth)/sell') => {
    const params: Record<string, string> = {};
    if (asset) params.asset = asset;
    if (chain) params.chain = chain;
    router.push({ pathname: path, params });
  };

  return (
    <View style={styles.row} testID={testID}>
      <Pressable
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
        onPress={() => navigate('/(auth)/buy')}
        accessibilityRole="button"
        accessibilityLabel={t('buy.title')}
        testID={testID ? `${testID}-buy` : undefined}
      >
        <Icon name="arrow-down" size={16} color={DfxColors.primary} strokeWidth={2.4} />
        <Text style={styles.label}>{t('buy.title')}</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
        onPress={() => navigate('/(auth)/sell')}
        accessibilityRole="button"
        accessibilityLabel={t('sell.title')}
        testID={testID ? `${testID}-sell` : undefined}
      >
        <Icon name="arrow-up" size={16} color={DfxColors.primary} strokeWidth={2.4} />
        <Text style={styles.label}>{t('sell.title')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: DfxColors.primaryLight,
    borderRadius: 999,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    ...Typography.bodyMedium,
    color: DfxColors.primary,
    fontWeight: '600',
  },
});
