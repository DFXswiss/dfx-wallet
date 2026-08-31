import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { useColors } from '@/theme';
import TradeModeTabs from './TradeModeTabs';
import { MobileFeesPanel } from './MobileFeesPanel';
import { SELECTOR_PILL_LAYOUT } from './tradePanelStyles';

export default function SwapScreenImpl() {
  const { t } = useTranslation();
  const colors = useColors();

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']} testID="swap-screen">
      <TradeModeTabs active="swap" />
      <View style={styles.panels} testID="swap-amount-panels">
        <View style={styles.panel}>
          <Text style={[styles.label, { color: colors.textTertiary }]}>{t('buy.youPay')}</Text>
          <View style={styles.pinput}>
            <TextInput
              style={[styles.amount, { color: colors.text }]}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              editable={false}
              accessibilityLabel={t('buy.youPay')}
              testID="swap-pay-amount"
            />
            <Pressable
              style={styles.pill}
              accessibilityRole="button"
              disabled
              testID="swap-pay-asset-pill"
            >
              <Text style={[styles.pillTitle, { color: colors.text }]}>—</Text>
              <Text style={[styles.pillSubtitle, { color: colors.textTertiary }]}>—</Text>
              <Icon name="chevron-right" size={16} color={colors.textTertiary} />
            </Pressable>
          </View>
        </View>
        <View style={styles.fab}>
          <Icon name="swap" size={18} color={colors.primary} />
        </View>
        <View style={[styles.panel, styles.receivePanel]}>
          <Text style={[styles.label, { color: colors.textTertiary }]}>
            {t('buy.receiveLabel')}
          </Text>
          <View style={styles.pinput}>
            <TextInput
              style={[styles.amount, { color: colors.text }]}
              value=""
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              editable={false}
              accessibilityLabel={t('buy.receiveLabel')}
              testID="swap-receive-amount"
            />
            <Pressable
              style={styles.pill}
              accessibilityRole="button"
              disabled
              testID="swap-receive-asset-pill"
            >
              <Text style={[styles.pillTitle, { color: colors.text }]}>—</Text>
              <Text style={[styles.pillSubtitle, { color: colors.textTertiary }]}>—</Text>
              <Icon name="chevron-right" size={16} color={colors.textTertiary} />
            </Pressable>
          </View>
        </View>
      </View>
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
        testID="swap-cta"
        accessibilityRole="button"
      >
        <Text style={styles.ctaText}>{t('swap.title')}</Text>
      </Pressable>
      <Text style={[styles.security, { color: colors.textTertiary }]}>{t('swap.comingSoon')}</Text>
      <View style={styles.placeholder}>
        <Icon name="wallet" />
        <Text style={[styles.title, { color: colors.text }]}>{t('swap.title')}</Text>
        <Text style={[styles.description, { color: colors.textTertiary }]}>
          {t('swap.comingSoon')}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 2,
  },
  panels: {
    position: 'relative',
    borderWidth: 1,
    borderColor: '#00000022',
    backgroundColor: '#00000008',
    borderRadius: 22,
    overflow: 'hidden',
  },
  panel: {
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  receivePanel: { borderTopWidth: 1, borderTopColor: '#00000022' },
  label: { fontSize: 12.5, fontWeight: '600' },
  pinput: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 9 },
  amount: { flex: 1, minWidth: 0, fontSize: 33, fontWeight: '700', padding: 0 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#00000022',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    ...SELECTOR_PILL_LAYOUT,
  },
  pillTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  pillSubtitle: { fontSize: 11, fontWeight: '600', flex: 1 },
  fab: {
    alignSelf: 'center',
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    marginBottom: -20,
    zIndex: 2,
  },
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
