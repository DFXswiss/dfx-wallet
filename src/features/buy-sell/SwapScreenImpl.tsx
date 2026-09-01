import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { useColors } from '@/theme';
import TradeModeTabs from './TradeModeTabs';
import { MobileFeesPanel } from './MobileFeesPanel';
import { TradeAmountPanels, TradeSelectorPill } from './TradeAmountPanels';
import { TRADE_STEP_GAP } from './tradePanelStyles';
import { TradeScreenShell } from './TradeScreenShell';

export default function SwapScreenImpl() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <View style={styles.screen} testID="swap-screen">
        <TradeScreenShell
          title={t('swap.title')}
          onBack={() => router.back()}
          headerTestID="swap-header"
          activeStep={0}
          steps={['amount']}
        >
          <TradeModeTabs active="swap" />
          <View style={styles.stepContent} testID="swap-step-content">
            <TradeAmountPanels
              testID="swap-amount-panels"
              flipTestID="swap-flip"
              flipAccessibilityLabel={t('swap.title')}
              payLabel={
                <Text style={[styles.label, { color: colors.textTertiary }]}>
                  {t('buy.youPay')}
                </Text>
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
            <View style={styles.placeholder}>
              <Icon name="wallet" />
              <Text style={[styles.title, { color: colors.text }]}>{t('swap.title')}</Text>
              <Text style={[styles.description, { color: colors.textTertiary }]}>
                {t('swap.comingSoon')}
              </Text>
            </View>
          </View>
        </TradeScreenShell>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  stepContent: { gap: TRADE_STEP_GAP },
  label: { fontSize: 12.5, fontWeight: '600' },
  amount: { flex: 1, minWidth: 0, fontSize: 33, fontWeight: '700', padding: 0 },
  pillTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  pillSubtitle: { fontSize: 11, fontWeight: '600', flex: 1 },
  security: { textAlign: 'center', marginTop: 12, fontSize: 12 },
  cta: {
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00000022',
  },
  ctaText: { fontSize: 16, fontWeight: '600', color: '#ffffff88' },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  title: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  description: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
});
