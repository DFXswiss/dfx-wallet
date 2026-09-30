import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { UnitGlyph } from './UnitGlyph';
import { GlassCard, GlassListGroup, Icon, SectionTitle } from '@/components';
import { IconTile, Spacing, Typography, useColors, type ThemeColors } from '@/theme';

// The only new literal this module introduces (see the task's "Verbote") —
// every other dimension comes from a theme token.
const GLYPH_SIZE = 32;

export type AssetPickerAsset = {
  symbol: string;
};

type BankAction = {
  title: string;
  subtitle: string;
  onPress: () => void;
  testID: string;
};

type Props = {
  heading: string;
  assets: AssetPickerAsset[];
  selectedSymbol?: string;
  onSelect: (symbol: string) => void;
  testIDPrefix: 'send' | 'receive';
  bankAction?: BankAction;
};

/**
 * Shared "pick an asset" step for the Send and Receive wizards. Replaces the
 * near-identical `renderAssetStep` that used to be copied between the two
 * screens: one glass list with a row per asset (symbol + full i18n name),
 * plus an optional bank-account shortcut card under its own section title.
 */
export function AssetPickerStep({
  heading,
  assets,
  selectedSymbol,
  onSelect,
  testIDPrefix,
  bankAction,
}: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{heading}</Text>

      <GlassListGroup testID={`${testIDPrefix}-asset-list`}>
        {assets.map((asset, index) => {
          const isSelected = selectedSymbol === asset.symbol;
          return (
            <GlassListGroup.Row
              key={asset.symbol}
              onPress={() => onSelect(asset.symbol)}
              last={index === assets.length - 1}
              testID={`${testIDPrefix}-asset-${asset.symbol.toLowerCase()}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={styles.row}
            >
              <UnitGlyph symbol={asset.symbol} size={GLYPH_SIZE} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{asset.symbol}</Text>
                <Text style={styles.rowSubtitle}>{t(`transfer.assetName.${asset.symbol}`)}</Text>
              </View>
              {isSelected ? (
                <Icon name="check" size={20} color={colors.primary} />
              ) : (
                <Icon name="chevron-right" size={18} color={colors.textTertiary} />
              )}
            </GlassListGroup.Row>
          );
        })}
      </GlassListGroup>

      {bankAction && (
        <View style={styles.bankSection}>
          <SectionTitle title={t('transfer.bankSection')} />
          <GlassCard
            tone="accent"
            contentStyle={styles.bankCard}
            onPress={bankAction.onPress}
            testID={bankAction.testID}
            accessibilityRole="button"
            accessibilityLabel={bankAction.title}
          >
            <View style={styles.bankIcon}>
              <Icon name="bank" size={20} color={colors.primary} strokeWidth={2.2} />
            </View>
            <View style={styles.bankText}>
              <Text style={styles.bankTitle}>{bankAction.title}</Text>
              <Text style={styles.bankSubtitle}>{bankAction.subtitle}</Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.textTertiary} />
          </GlassCard>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      gap: Spacing.lg,
    },
    heading: {
      ...Typography.bodyLarge,
      color: colors.textSecondary,
      fontWeight: '500',
      marginBottom: Spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      ...Typography.bodyLarge,
      color: colors.text,
      fontWeight: '700',
    },
    rowSubtitle: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
    },
    bankSection: {
      gap: Spacing.sm,
    },
    bankCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    bankIcon: {
      width: IconTile.sm.size,
      height: IconTile.sm.size,
      borderRadius: IconTile.sm.radius,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bankText: {
      flex: 1,
      gap: 2,
    },
    bankTitle: {
      ...Typography.bodyLarge,
      color: colors.text,
      fontWeight: '600',
    },
    bankSubtitle: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
    },
  });
