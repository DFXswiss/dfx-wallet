import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components';
import { Typography, useColors, type ThemeColors } from '@/theme';
import { AssetGlyph } from './AssetGlyph';
import { CurrencyGlyph } from './CurrencyGlyph';

export type TradeAssetOption = {
  symbol: string;
  label?: string;
  chains: ReadonlyArray<{
    chain: string;
    label: string;
    blockchain: string;
    tokens: ReadonlyArray<{ assetSymbol: string; label: string }>;
    unsupported?: boolean;
  }>;
};

const CURRENCY_CODES = ['CHF', 'EUR', 'USD'] as const;
type CurrencyCode = (typeof CURRENCY_CODES)[number];

function isCurrencyCode(symbol: string): symbol is CurrencyCode {
  return (CURRENCY_CODES as readonly string[]).includes(symbol);
}

type Props<T extends TradeAssetOption> = {
  visible: boolean;
  onClose: () => void;
  assets: ReadonlyArray<T>;
  selectedAssetSymbol?: string | undefined;
  selectedChainIndex: number;
  selectedTokenIndex?: number;
  onSelect: (asset: T, chainIndex: number, tokenIndex: number) => void;
  titleKey?: string;
  optionTestIDPrefix?: string;
};

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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalContent}>
        <Pressable
          testID="receive-asset-sheet-backdrop"
          style={styles.backdrop}
          onPress={onClose}
        />
        <SafeAreaView
          style={styles.sheet}
          edges={['bottom', 'left', 'right']}
          accessibilityViewIsModal
        >
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

          <ScrollView showsVerticalScrollIndicator={false}>
            {assets.map((asset) => (
              <View key={asset.symbol} style={styles.section}>
                <Text style={styles.sectionTitle}>{asset.label ?? asset.symbol}</Text>
                {asset.chains.map((chain, chainIndex) => {
                  const isChainSelected =
                    selectedAssetSymbol === asset.symbol && selectedChainIndex === chainIndex;

                  if (chain.tokens.length > 1) {
                    return (
                      <View key={`${asset.symbol}-${chain.chain}`} style={styles.tokenGroup}>
                        <Text style={styles.tokenGroupTitle}>{chain.label}</Text>
                        {chain.tokens.map((token, tokenIndex) => {
                          const isSelected = isChainSelected && selectedTokenIndex === tokenIndex;
                          return (
                            <Pressable
                              key={`${asset.symbol}-${chain.chain}-${token.assetSymbol}`}
                              style={styles.option}
                              onPress={() => onSelect(asset, chainIndex, tokenIndex)}
                              testID={`${optionTestIDPrefix}-${asset.symbol}-${chain.chain}-${token.assetSymbol}`}
                              accessibilityRole="button"
                              accessibilityState={{ selected: isSelected }}
                            >
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
                              {isSelected ? (
                                <Icon name="check" size={20} color={colors.primary} />
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    );
                  }

                  return (
                    <Pressable
                      key={`${asset.symbol}-${chain.chain}`}
                      style={[styles.option, chain.unsupported && styles.optionUnsupported]}
                      onPress={() => onSelect(asset, chainIndex, 0)}
                      testID={`${optionTestIDPrefix}-${asset.symbol}-${chain.chain}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isChainSelected && selectedTokenIndex === 0 }}
                    >
                      {isCurrencyCode(asset.symbol) ? (
                        <CurrencyGlyph code={asset.symbol} size={32} />
                      ) : (
                        <AssetGlyph symbol={asset.symbol} size={32} />
                      )}
                      <Text
                        style={[
                          styles.optionLabel,
                          chain.unsupported && styles.optionLabelUnsupported,
                        ]}
                      >
                        {chain.label}
                      </Text>
                      {isChainSelected && selectedTokenIndex === 0 ? (
                        <Icon name="check" size={20} color={colors.primary} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    modalContent: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(11, 20, 38, 0.35)',
    },
    sheet: {
      width: '100%',
      maxHeight: '82%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 8,
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
    tokenGroup: {
      paddingBottom: 4,
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
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
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
