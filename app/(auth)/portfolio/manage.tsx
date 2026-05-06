import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components';
import type { ChainId } from '@/config/chains';
import { DEFAULT_ENABLED_CHAINS, SELECTABLE_CHAINS } from '@/config/tokens';
import { useEnabledChains } from '@/hooks';
import { DfxColors, Typography } from '@/theme';

const CHAIN_LABEL = new Map<ChainId, string>([
  ['ethereum', 'Ethereum'],
  ['arbitrum', 'Arbitrum'],
  ['polygon', 'Polygon'],
  ['spark', 'Lightning (Spark)'],
  ['plasma', 'Plasma'],
  ['sepolia', 'Sepolia'],
]);

const CHAIN_DESCRIPTION = new Map<ChainId, string>([
  ['arbitrum', 'L2 — ETH, USDT'],
  ['polygon', 'POS chain — MATIC, USDT'],
]);

export default function ManageChainsScreen() {
  const { t } = useTranslation();
  const { enabledChains, toggleChain } = useEnabledChains();

  return (
    <>
      <Stack.Screen
        options={{
          title: t('portfolio.manageChains'),
          headerShown: true,
        }}
      />
      <ScreenContainer testID="manage-chains-screen">
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionLabel}>{t('portfolio.alwaysOn')}</Text>
          {DEFAULT_ENABLED_CHAINS.map((chain) => (
            <View key={chain} style={[styles.row, styles.rowDisabled]}>
              <View style={styles.info}>
                <Text style={styles.label}>{CHAIN_LABEL.get(chain) ?? chain}</Text>
                <Text style={styles.lockedHint}>{t('portfolio.alwaysOnHint')}</Text>
              </View>
              <Switch value disabled />
            </View>
          ))}

          <Text style={styles.sectionLabel}>{t('portfolio.optional')}</Text>
          {SELECTABLE_CHAINS.map((chain) => {
            const enabled = enabledChains.includes(chain);
            const description = CHAIN_DESCRIPTION.get(chain);
            return (
              <View key={chain} style={styles.row}>
                <View style={styles.info}>
                  <Text style={styles.label}>{CHAIN_LABEL.get(chain) ?? chain}</Text>
                  {description && <Text style={styles.description}>{description}</Text>}
                </View>
                <Switch
                  value={enabled}
                  onValueChange={() => toggleChain(chain)}
                  trackColor={{ false: DfxColors.border, true: DfxColors.primary }}
                  thumbColor={DfxColors.white}
                  testID={`manage-chain-${chain}`}
                />
              </View>
            );
          })}
        </ScrollView>
      </ScreenContainer>
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 16,
    gap: 8,
  },
  sectionLabel: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DfxColors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  rowDisabled: {
    opacity: 0.65,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  label: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: DfxColors.text,
  },
  description: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
  },
  lockedHint: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
    fontStyle: 'italic',
  },
});
