// Copyright (c) 2026 DFX AG. Licensed under the MIT License.
//
// Private ("shielded") payments opt-in + info screen. The toggle that turns on
// the Cloister shielded-pay rail is gated on the highest DFX KYC level
// (KycLevel 50); unverified users are routed into KYC first. Honest copy: what
// shielding hides, what it does NOT, and that KYC is mandatory.

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components';
import { useKycFlow } from '@/features/dfx-backend/useKycFlow';
import { useAuthStore } from '@/store';
import { DfxColors, Typography } from '@/theme';

// Shielded payments require the highest level of identification — a
// deliberate compliance bar for a privacy-preserving rail.
const REQUIRED_KYC_LEVEL = 50;

// Testnet evaluation builds have no real DFX KYC session, so the level-50 gate
// would make the feature impossible to try. This flag (set only on eval builds)
// lets the user opt in without KYC; production builds leave it unset and the
// strict gate applies.
const EVAL_BYPASS = process.env.EXPO_PUBLIC_CLOISTER_EVAL === '1';

export default function PrivatePaymentsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { cloisterEnabled, setCloisterEnabled, isDfxAuthenticated } = useAuthStore();
  const { loadKycStatus } = useKycFlow();

  const [kycLevel, setKycLevel] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!isDfxAuthenticated) {
      setKycLevel(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void loadKycStatus()
      .then((dto) => setKycLevel(dto?.kycLevel ?? null))
      .catch(() => setKycLevel(null))
      .finally(() => setLoading(false));
  }, [isDfxAuthenticated, loadKycStatus]);

  // Reload on focus so returning from the KYC flow reflects a new level.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const kycOk = kycLevel !== null && kycLevel >= REQUIRED_KYC_LEVEL;
  const verified = EVAL_BYPASS || kycOk;

  // If the user is no longer verified (e.g. KYC reset) but the opt-in is still
  // on, turn it off — the pay flow gate would block it anyway; keep state honest.
  useEffect(() => {
    if (!loading && !verified && cloisterEnabled) void setCloisterEnabled(false);
  }, [loading, verified, cloisterEnabled, setCloisterEnabled]);

  const handleToggle = (next: boolean) => {
    if (next && !verified) return; // guarded by `disabled`, belt-and-braces
    void setCloisterEnabled(next);
  };

  const bullets = [
    t('privatePayments.detailAmount'),
    t('privatePayments.detailLink'),
    t('privatePayments.detailCompliant'),
    t('privatePayments.detailOnDevice'),
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <ImageBackground
        source={require('../../../assets/dashboard-bg.png')}
        style={styles.container}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <View style={styles.header}>
            <Pressable
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/(auth)/(tabs)/settings')
              }
              hitSlop={12}
              style={styles.backBtn}
            >
              <Icon name="arrow-left" size={24} color={DfxColors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>{t('settings.privatePayments')}</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {/* Hero / what it is */}
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <Icon name="shield" size={28} color={DfxColors.primary} />
              </View>
              <Text style={styles.heroTitle}>{t('privatePayments.heroTitle')}</Text>
              <Text style={styles.heroBody}>{t('privatePayments.heroBody')}</Text>
            </View>

            {/* Opt-in toggle (gated on KYC) */}
            <View style={styles.card}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleText}>
                  <Text style={styles.toggleLabel}>{t('privatePayments.enableLabel')}</Text>
                  <Text style={styles.toggleHint}>
                    {EVAL_BYPASS && !kycOk
                      ? t('privatePayments.evalBypassHint')
                      : verified
                        ? t('privatePayments.enableHint')
                        : t('privatePayments.kycRequiredHint')}
                  </Text>
                </View>
                {loading ? (
                  <ActivityIndicator color={DfxColors.primary} />
                ) : (
                  <Switch
                    testID="private-payments-toggle"
                    value={cloisterEnabled && verified}
                    onValueChange={handleToggle}
                    disabled={!verified}
                    trackColor={{ true: DfxColors.primary, false: DfxColors.border }}
                    ios_backgroundColor={DfxColors.border}
                  />
                )}
              </View>

              {!loading && !verified ? (
                <Pressable
                  testID="private-payments-verify"
                  style={({ pressed }) => [styles.kycBtn, pressed && styles.pressed]}
                  onPress={() => router.push('/(auth)/kyc')}
                >
                  <Text style={styles.kycBtnText}>
                    {isDfxAuthenticated
                      ? t('privatePayments.verifyCta')
                      : t('privatePayments.loginCta')}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {/* How it works / what is and isn't hidden */}
            <Text style={styles.sectionTitle}>{t('privatePayments.howTitle')}</Text>
            <View style={styles.card}>
              {bullets.map((b, i) => (
                <View
                  key={i}
                  style={[styles.bulletRow, i < bullets.length - 1 && styles.bulletDivider]}
                >
                  <Icon name="shield" size={15} color={DfxColors.primary} strokeWidth={2.3} />
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.footnote}>{t('privatePayments.testnetNote')}</Text>
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DfxColors.background },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: DfxColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 40, height: 40 },
  headerTitle: { flex: 1, textAlign: 'center', ...Typography.headlineSmall, color: DfxColors.text },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 120, gap: 18 },
  hero: { alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingTop: 8 },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: DfxColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { ...Typography.headlineSmall, color: DfxColors.text, textAlign: 'center' },
  heroBody: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DfxColors.border,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 4,
    shadowColor: '#0B1426',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  toggleText: { flex: 1, gap: 3 },
  toggleLabel: { ...Typography.bodyMedium, color: DfxColors.text, fontWeight: '600' },
  toggleHint: { ...Typography.bodySmall, color: DfxColors.textSecondary, lineHeight: 18 },
  kycBtn: {
    marginBottom: 12,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: DfxColors.primary,
    alignItems: 'center',
  },
  kycBtnText: { ...Typography.bodyLarge, color: DfxColors.white, fontWeight: '700' },
  sectionTitle: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12 },
  bulletDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DfxColors.border,
  },
  bulletText: { flex: 1, ...Typography.bodyMedium, color: DfxColors.text, lineHeight: 20 },
  footnote: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  pressed: { opacity: 0.7 },
});
