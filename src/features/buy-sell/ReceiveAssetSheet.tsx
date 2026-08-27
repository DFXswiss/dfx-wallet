import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components';
import { Typography, useColors, type ThemeColors } from '@/theme';
import type { BuyAsset } from './BuyScreenImpl';

type Props = {
  visible: boolean;
  onClose: () => void;
  assets: BuyAsset[];
  selectedAssetSymbol?: string | undefined;
  selectedChainIndex: number;
  onSelect: (asset: BuyAsset, chainIndex: number) => void;
};

export function ReceiveAssetSheet({
  visible,
  onClose,
  assets,
  selectedAssetSymbol,
  selectedChainIndex,
  onSelect,
}: Props) {
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
            <Text style={styles.title}>{t('buy.receiveLabel')}</Text>
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
                <Text style={styles.sectionTitle}>{asset.label}</Text>
                {asset.chains.map((chain, chainIndex) => {
                  const isSelected =
                    selectedAssetSymbol === asset.symbol && selectedChainIndex === chainIndex;
                  return (
                    <Pressable
                      key={`${asset.symbol}-${chain.chain}`}
                      style={[styles.option, chain.unsupported && styles.optionUnsupported]}
                      onPress={() => onSelect(asset, chainIndex)}
                      testID={`receive-asset-option-${asset.symbol}-${chain.chain}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{chain.blockchain.slice(0, 1)}</Text>
                      </View>
                      <Text
                        style={[
                          styles.optionLabel,
                          chain.unsupported && styles.optionLabelUnsupported,
                        ]}
                      >
                        {chain.label}
                      </Text>
                      {isSelected ? <Icon name="check" size={20} color={colors.primary} /> : null}
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
    badge: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
    },
    badgeText: {
      ...Typography.bodyMedium,
      fontWeight: '700',
      color: colors.primary,
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
  });
