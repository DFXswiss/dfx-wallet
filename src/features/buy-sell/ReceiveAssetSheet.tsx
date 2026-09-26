import { useMemo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components';
import { GlassListGroup } from '@/components/GlassListGroup';
import { GlassSheet } from '@/components/GlassSheet';
import { Typography, useColors, type ThemeColors } from '@/theme';
import { AssetGlyph } from './AssetGlyph';
import { CurrencyGlyph } from './CurrencyGlyph';

export type TradeAssetOption = {
  symbol: string;
  label?: string;
  chains: readonly {
    chain: string;
    label: string;
    blockchain: string;
    tokens: readonly { assetSymbol: string; label: string }[];
    unsupported?: boolean;
  }[];
};

const CURRENCY_CODES = ['CHF', 'EUR', 'USD'] as const;
type CurrencyCode = (typeof CURRENCY_CODES)[number];

function isCurrencyCode(symbol: string): symbol is CurrencyCode {
  return (CURRENCY_CODES as readonly string[]).includes(symbol);
}

type Props<T extends TradeAssetOption> = {
  visible: boolean;
  onClose: () => void;
  assets: readonly T[];
  selectedAssetSymbol?: string | undefined;
  selectedChainIndex: number;
  selectedTokenIndex?: number;
  onSelect: (asset: T, chainIndex: number, tokenIndex: number) => void;
  titleKey?: string;
  optionTestIDPrefix?: string;
};

// One entry rendered inside an asset's `GlassListGroup`: either a
// non-interactive sub-group label (multi-token chains) or a selectable row.
// Built as plain data first so the group can mark its last *row* (`last`
// suppresses `GlassListGroup.Row`'s own divider) without counting labels.
type AssetEntry =
  | { kind: 'label'; key: string; text: string }
  | {
      kind: 'row';
      key: string;
      testID: string;
      selected: boolean;
      unsupported?: boolean;
      onPress: () => void;
      content: ReactNode;
    };

function buildAssetEntries<T extends TradeAssetOption>(
  asset: T,
  selectedAssetSymbol: string | undefined,
  selectedChainIndex: number,
  selectedTokenIndex: number,
  onSelect: (asset: T, chainIndex: number, tokenIndex: number) => void,
  optionTestIDPrefix: string,
  colors: ThemeColors,
  styles: ReturnType<typeof makeStyles>,
): AssetEntry[] {
  const entries: AssetEntry[] = [];

  asset.chains.forEach((chain, chainIndex) => {
    const isChainSelected =
      selectedAssetSymbol === asset.symbol && selectedChainIndex === chainIndex;

    if (chain.tokens.length > 1) {
      entries.push({
        kind: 'label',
        key: `${asset.symbol}-${chain.chain}-title`,
        text: chain.label,
      });
      chain.tokens.forEach((token, tokenIndex) => {
        const isSelected = isChainSelected && selectedTokenIndex === tokenIndex;
        entries.push({
          kind: 'row',
          key: `${asset.symbol}-${chain.chain}-${token.assetSymbol}`,
          testID: `${optionTestIDPrefix}-${asset.symbol}-${chain.chain}-${token.assetSymbol}`,
          selected: isSelected,
          onPress: () => onSelect(asset, chainIndex, tokenIndex),
          content: (
            <>
              {isCurrencyCode(asset.symbol) ? (
                <CurrencyGlyph code={asset.symbol} size={32} />
              ) : (
                <AssetGlyph symbol={token.assetSymbol} size={32} />
              )}
              <View style={styles.tokenMeta}>
                <Text style={styles.optionLabel} numberOfLines={1}>
                  {token.label}
                </Text>
                <Text style={styles.tokenChainLabel} numberOfLines={1}>
                  {chain.label}
                </Text>
              </View>
              {isSelected ? <Icon name="check" size={20} color={colors.primary} /> : null}
            </>
          ),
        });
      });
    } else {
      const isSelected = isChainSelected && selectedTokenIndex === 0;
      entries.push({
        kind: 'row',
        key: `${asset.symbol}-${chain.chain}`,
        testID: `${optionTestIDPrefix}-${asset.symbol}-${chain.chain}`,
        selected: isSelected,
        ...(chain.unsupported ? { unsupported: chain.unsupported } : {}),
        onPress: () => onSelect(asset, chainIndex, 0),
        content: (
          <>
            {isCurrencyCode(asset.symbol) ? (
              <CurrencyGlyph code={asset.symbol} size={32} />
            ) : (
              <AssetGlyph symbol={asset.symbol} size={32} />
            )}
            <Text style={[styles.optionLabel, chain.unsupported && styles.optionLabelUnsupported]}>
              {chain.label}
            </Text>
            {isSelected ? <Icon name="check" size={20} color={colors.primary} /> : null}
          </>
        ),
      });
    }
  });

  return entries;
}

export function ReceiveAssetSheet<T extends TradeAssetOption>({
  visible,
  onClose,
  assets,
  selectedAssetSymbol,
  selectedChainIndex,
  selectedTokenIndex = 0,
  onSelect,
  titleKey = 'buy.receiveLabel',
  optionTestIDPrefix = 'receive-asset-option',
}: Props<T>) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();

  return (
    <GlassSheet
      visible={visible}
      onRequestClose={onClose}
      position="bottom"
      testID="receive-asset-sheet"
    >
      <SafeAreaView style={styles.sheetBody} edges={['bottom', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.title}>{t(titleKey)}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Icon name="close" size={22} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {assets.map((asset) => {
            const entries = buildAssetEntries(
              asset,
              selectedAssetSymbol,
              selectedChainIndex,
              selectedTokenIndex,
              onSelect,
              optionTestIDPrefix,
              colors,
              styles,
            );
            const rowKeys = entries
              .filter((entry) => entry.kind === 'row')
              .map((entry) => entry.key);
            const lastRowKey = rowKeys[rowKeys.length - 1];

            return (
              <View key={asset.symbol} style={styles.section}>
                <Text style={styles.sectionTitle}>{asset.label ?? asset.symbol}</Text>
                <GlassListGroup>
                  {entries.map((entry) =>
                    entry.kind === 'label' ? (
                      <Text key={entry.key} style={styles.tokenGroupTitle}>
                        {entry.text}
                      </Text>
                    ) : (
                      <GlassListGroup.Row
                        key={entry.key}
                        onPress={entry.onPress}
                        last={entry.key === lastRowKey}
                        testID={entry.testID}
                        accessibilityRole="button"
                        accessibilityState={{ selected: entry.selected }}
                        style={[styles.option, entry.unsupported && styles.optionUnsupported]}
                      >
                        {entry.content}
                      </GlassListGroup.Row>
                    ),
                  )}
                </GlassListGroup>
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </GlassSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    sheetBody: {
      maxHeight: '82%',
      gap: 8,
    },
    header: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      ...Typography.headlineSmall,
      color: colors.text,
    },
    scroll: {
      flexGrow: 0,
    },
    section: {
      paddingBottom: 8,
    },
    sectionTitle: {
      ...Typography.bodySmall,
      paddingTop: 12,
      paddingBottom: 6,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    tokenGroupTitle: {
      ...Typography.bodySmall,
      paddingTop: 8,
      paddingBottom: 4,
      paddingLeft: 44,
      color: colors.textSecondary,
    },
    option: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    optionUnsupported: {
      opacity: 0.45,
    },
    optionLabel: {
      ...Typography.bodyLarge,
      flex: 1,
      fontWeight: '600',
      color: colors.text,
    },
    optionLabelUnsupported: {
      color: colors.textTertiary,
    },
    tokenMeta: {
      flex: 1,
    },
    tokenChainLabel: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
    },
  });
