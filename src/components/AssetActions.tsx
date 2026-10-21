import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Interaction, Radius, Spacing, useColors, type ThemeColors, Typography } from '@/theme';
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
 * Uses the opaque `pillSurface` fill so the row stays readable on the photo
 * backdrop. `primaryLight` remains the in-card tint and is not used here.
 *
 * Both pills route to the existing Buy/Sell flows. Optional `asset` and
 * `chain` params are passed through so the Buy/Sell screen can preselect
 * the right token on mount (when those screens read the route params).
 */
export function AssetActions({ asset, chain, testID }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
        <Icon name="arrow-down" size={16} color={colors.primary} strokeWidth={2.4} />
        <Text style={styles.label}>{t('buy.title')}</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
        onPress={() => navigate('/(auth)/sell')}
        accessibilityRole="button"
        accessibilityLabel={t('sell.title')}
        testID={testID ? `${testID}-sell` : undefined}
      >
        <Icon name="arrow-up" size={16} color={colors.primary} strokeWidth={2.4} />
        <Text style={styles.label}>{t('sell.title')}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignSelf: 'stretch',
      gap: Spacing.md,
    },
    pill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      minHeight: 44,
      paddingHorizontal: Spacing.base,
      paddingVertical: 0,
      backgroundColor: colors.pillSurface,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.pillBorder,
    },
    pressed: {
      opacity: Interaction.pressedOpacity,
    },
    label: {
      ...Typography.bodyMedium,
      color: colors.primary,
      fontWeight: '600',
    },
  });
