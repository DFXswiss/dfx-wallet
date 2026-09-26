import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Typography, useColors } from '@/theme';
import { MobileFeesPanel } from './MobileFeesPanel';
import { TradeAmountPanels, TradeSelectorPill } from './TradeAmountPanels';
import { TRADE_STEP_GAP } from './tradePanelStyles';
import type { TradeShellReport } from './TradeScreenShell';

const SWAP_STEPS = ['amount'] as const;

export type SwapTradeAdapterProps = {
  /** Reports the shell chrome (title, back action, step progress, whether
   *  the tab bar should show) this adapter wants; `TradeScreen` feeds it
   *  into the one shared shell. */
  onShellChange: (shell: TradeShellReport) => void;
};

export function SwapTradeAdapter({ onShellChange }: SwapTradeAdapterProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = makeStyles(colors);
  const router = useRouter();

  const onBack = useCallback(() => router.back(), [router]);

  // Swap has a single, always-active step — report the shell chrome once on
  // mount (and again whenever `t`/`onBack` change identity; harmless, see
  // BuyTradeAdapter — `onShellChange` in `TradeScreen` bails out when the
  // reported shell hasn't actually changed).
  useEffect(() => {
    onShellChange({
      title: t('swap.title'),
      onBack,
      headerTestID: 'swap-header',
      activeStep: 0,
      showTabs: true,
      steps: SWAP_STEPS,
    });
  }, [t, onBack, onShellChange]);

  return (
    <View style={styles.screen} testID="swap-screen">
      <View style={styles.stepContent} testID="swap-step-content">
        <TradeAmountPanels
          testID="swap-amount-panels"
          flipTestID="swap-flip"
          flipAccessibilityLabel={t('swap.title')}
          payLabel={
            <Text style={[styles.label, { color: colors.textTertiary }]}>{t('buy.youPay')}</Text>
          }
          payAmount={
            <TextInput
              style={[styles.amount, { color: colors.text }]}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              editable={false}
              accessibilityLabel={t('buy.youPay')}
              testID="swap-pay-amount"
            />
          }
          paySelector={
            <TradeSelectorPill disabled testID="swap-pay-asset-pill">
              <Text style={[styles.pillTitle, { color: colors.text }]}>—</Text>
              <Text style={[styles.pillSubtitle, { color: colors.textTertiary }]}>—</Text>
            </TradeSelectorPill>
          }
          receiveLabel={
            <Text style={[styles.label, { color: colors.textTertiary }]}>
              {t('buy.receiveLabel')}
            </Text>
          }
          receiveAmount={
            <TextInput
              style={[styles.amount, { color: colors.text }]}
              value=""
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              editable={false}
              accessibilityLabel={t('buy.receiveLabel')}
              testID="swap-receive-amount"
            />
          }
          receiveSelector={
            <TradeSelectorPill disabled testID="swap-receive-asset-pill">
              <Text style={[styles.pillTitle, { color: colors.text }]}>—</Text>
              <Text style={[styles.pillSubtitle, { color: colors.textTertiary }]}>—</Text>
            </TradeSelectorPill>
          }
        />
        <MobileFeesPanel
          mode="swap"
          quote={null}
          payAssetCode=""
          receiveAssetCode=""
          currencyCode=""
          expanded={false}
          onToggle={() => undefined}
          testID="swap-fees-panel"
        />
        <Pressable
          style={styles.cta}
          disabled
          accessibilityState={{ disabled: true }}
          accessibilityLabel={t('swap.title')}
          testID="swap-cta"
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>{t('swap.title')}</Text>
        </Pressable>
        <Text style={[styles.security, { color: colors.textTertiary }]}>
          {t('swap.comingSoon')}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    screen: { flex: 1 },
    stepContent: { gap: TRADE_STEP_GAP },
    label: { ...Typography.bodySmall, fontWeight: '600', color: colors.textTertiary },
    amount: { flex: 1, minWidth: 0, ...Typography.headlineMedium, padding: 0 },
    pillTitle: { ...Typography.bodyLarge, fontWeight: '700', flex: 1 },
    pillSubtitle: { ...Typography.bodySmall, fontWeight: '600', flex: 1 },
    security: { ...Typography.bodySmall, textAlign: 'center', marginTop: 12 },
    cta: {
      height: 56,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.borderLight,
    },
    ctaText: { ...Typography.bodyLarge, fontWeight: '600', color: colors.textTertiary },
  });
