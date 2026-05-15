import { useEffect, useRef, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DashboardHeader, Icon, ShortcutAction } from '@/components';
import { FEATURES } from '@/config/features';
import { useDfxAuth, useTotalPortfolioFiat } from '@/hooks';
import { useAuthStore, useWalletStore } from '@/store';
import { DfxColors, Typography } from '@/theme';

const CURRENCY_SYMBOLS = new Map<string, string>([
  ['USD', '$'],
  ['EUR', '€'],
  ['CHF', 'CHF'],
]);

const insertThousandsSeparators = (whole: string): string => {
  if (whole.length <= 3) return whole;
  const result: string[] = [];
  for (let i = whole.length; i > 0; i -= 3) {
    result.unshift(whole.slice(Math.max(0, i - 3), i));
  }
  return result.join("'");
};

const splitBalance = (value: string): { whole: string; fraction: string } => {
  const num = parseFloat(value);
  if (!Number.isFinite(num) || num === 0) return { whole: '0', fraction: '00' };
  const abs = Math.abs(num);
  const wholeNum = Math.floor(abs);
  const frac = Math.round((abs - wholeNum) * 100);
  return {
    whole: insertThousandsSeparators(wholeNum.toString()),
    fraction: frac.toString().padStart(2, '0'),
  };
};

export default function DashboardScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { selectedCurrency } = useWalletStore();
  const { isDfxAuthenticated } = useAuthStore();
  const { authenticate, isAuthenticating } = useDfxAuth();
  const totalPortfolioFiat = useTotalPortfolioFiat();

  const [balanceVisible, setBalanceVisible] = useState(true);

  const hasAttemptedAuthRef = useRef(false);
  useEffect(() => {
    if (isDfxAuthenticated || isAuthenticating || hasAttemptedAuthRef.current) return;
    hasAttemptedAuthRef.current = true;
    authenticate().catch(() => {
      // Auth retried on demand from buy/sell flows.
    });
  }, [isDfxAuthenticated, isAuthenticating, authenticate]);

  const symbol = CURRENCY_SYMBOLS.get(selectedCurrency) ?? selectedCurrency;
  const displayBalance = Number.isFinite(totalPortfolioFiat)
    ? String(Math.round(totalPortfolioFiat * 100) / 100)
    : '0';
  const { whole, fraction } = splitBalance(displayBalance);

  return (
    <ImageBackground
      source={require('../../../assets/dashboard-bg.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.content} testID="dashboard-screen">
          <DashboardHeader
            onMenuPress={FEATURES.SETTINGS ? () => router.push('/settings') : undefined}
            onShieldPress={FEATURES.MULTISIG ? () => router.push('/(auth)/multi-sig') : undefined}
          />

          <View style={styles.balanceSection}>
            <Pressable
              style={styles.balanceLabelRow}
              onPress={() => setBalanceVisible((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.toggleBalance')}
              testID="dashboard-balance-toggle"
              hitSlop={8}
            >
              <Text style={styles.balanceLabel}>{t('dashboard.totalBalance')}</Text>
              <Icon name={balanceVisible ? 'eye' : 'eye-off'} size={18} color={DfxColors.primary} />
            </Pressable>

            <View style={styles.balanceValueRow}>
              <Text style={styles.balanceSymbol}>{symbol}</Text>
              {balanceVisible ? (
                <>
                  <Text testID="dashboard-balance-value" style={styles.balanceWhole}>
                    {whole}
                  </Text>
                  <Text style={styles.balanceFraction}>.{fraction}</Text>
                </>
              ) : (
                <Text testID="dashboard-balance-hidden" style={styles.balanceHidden}>
                  ••••
                </Text>
              )}
            </View>
          </View>

          {(FEATURES.PORTFOLIO || FEATURES.PAY) && (
            <View style={styles.actions}>
              {FEATURES.PORTFOLIO && (
                <ShortcutAction
                  icon={<Icon name="wallet" size={18} color={DfxColors.white} strokeWidth={2.2} />}
                  label={t('dashboard.portfolio')}
                  testID="dashboard-action-portfolio"
                  onPress={() => router.push('/(auth)/portfolio')}
                  style={styles.actionPill}
                />
              )}
              {FEATURES.PAY && (
                <ShortcutAction
                  icon={<Icon name="grid" size={18} color={DfxColors.white} strokeWidth={2.2} />}
                  label={t('dashboard.pay')}
                  testID="dashboard-action-pay"
                  onPress={() => router.push('/(auth)/pay')}
                  style={styles.actionPill}
                />
              )}
            </View>
          )}

          {FEATURES.TX_HISTORY && (
            <Pressable
              style={styles.transactions}
              onPress={() => router.push('/(auth)/transaction-history')}
              testID="dashboard-action-transactions"
              accessibilityRole="button"
            >
              <Icon name="swap" size={18} color={DfxColors.primary} />
              <Text style={styles.transactionsLabel}>{t('dashboard.transactions')}</Text>
            </Pressable>
          )}

          <View style={styles.footer}>
            <View style={styles.bottomPill}>
              <Pressable
                style={styles.bottomPillItem}
                onPress={() => router.push('/(auth)/receive')}
                testID="dashboard-action-receive"
                accessibilityRole="button"
                accessibilityLabel={t('receive.title')}
              >
                <Icon name="receive" size={22} color={DfxColors.primary} />
                <Text style={styles.bottomPillLabel}>{t('receive.title')}</Text>
              </Pressable>
              <View style={styles.bottomPillSeparator} />
              <Pressable
                style={styles.bottomPillItem}
                onPress={() => router.push('/(auth)/send')}
                testID="dashboard-action-send"
                accessibilityRole="button"
                accessibilityLabel={t('send.title')}
              >
                <Icon name="send" size={22} color={DfxColors.primary} />
                <Text style={styles.bottomPillLabel}>{t('send.title')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: DfxColors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  balanceSection: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 28,
  },
  balanceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  balanceLabel: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    fontWeight: '500',
  },
  balanceValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
    maxWidth: '100%',
  },
  balanceSymbol: {
    fontSize: 32,
    lineHeight: 54,
    fontWeight: '500',
    color: DfxColors.primary,
    marginRight: 6,
  },
  balanceWhole: {
    fontSize: 54,
    lineHeight: 58,
    fontWeight: '700',
    color: DfxColors.text,
    flexShrink: 1,
  },
  balanceFraction: {
    fontSize: 24,
    lineHeight: 48,
    fontWeight: '500',
    color: DfxColors.textSecondary,
  },
  balanceHidden: {
    fontSize: 52,
    lineHeight: 56,
    fontWeight: '600',
    color: DfxColors.text,
    letterSpacing: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionPill: {
    flex: 1,
  },
  transactions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 54,
    paddingVertical: 14,
    marginTop: 10,
  },
  transactionsLabel: {
    ...Typography.bodyLarge,
    color: DfxColors.primary,
    fontWeight: '600',
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingBottom: 22,
  },
  bottomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(221,229,240,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 8,
    width: '100%',
    maxWidth: 336,
    shadowColor: '#0B1426',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  bottomPillItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 58,
    paddingVertical: 8,
    borderRadius: 18,
  },
  bottomPillSeparator: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: DfxColors.border,
  },
  bottomPillLabel: {
    ...Typography.bodyMedium,
    color: DfxColors.text,
    fontWeight: '600',
  },
});
