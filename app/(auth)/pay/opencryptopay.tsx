import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppHeader, PrimaryButton, ScreenContainer } from '@/components';
import {
  cancelQuote,
  fetchQuote,
  lnurlToEndpoint,
  OpenCryptoPayError,
  type OpenCryptoPayInvoice,
} from '@/services/opencryptopay';
import { DfxColors, Typography } from '@/theme';

/**
 * OpenCryptoPay payment confirmation screen.
 *
 * Reached from the Pay scanner via `router.replace('/(auth)/pay/opencryptopay',
 * { lnurl })`. The screen decodes the LNURL → endpoint, fetches the
 * provider's quote (display name + transfer options + expiry), and lets
 * the user pick an asset/chain to pay with.
 *
 * The on-chain broadcast step (sign the resulting ERC-681 URI, submit
 * via WDK, then commit the tx hex back to the OCP provider) is wired
 * up in a follow-up — first iteration's contract is "scan a DFX
 * `LNURL1…` QR and land on the right invoice screen, with the right
 * amount in the right currency, instead of the generic Coming-Soon
 * alert". The Continue CTA today persists the asset/chain pick to a
 * "Coming soon: signing" hint, the API surface for the next iteration
 * is already in place via `getPaymentTarget` + `commitTx`.
 */

const FALLBACK_EXPIRY_MS = 5 * 60 * 1000;

export default function OpenCryptoPayScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ lnurl?: string }>();
  const lnurl = typeof params.lnurl === 'string' ? params.lnurl : '';

  const [invoice, setInvoice] = useState<OpenCryptoPayInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickedMethod, setPickedMethod] = useState<string | null>(null);
  const [pickedAsset, setPickedAsset] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!lnurl) {
      setError(t('opencryptopay.errors.invalidQr'));
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const endpoint = lnurlToEndpoint(lnurl);
        const inv = await fetchQuote(endpoint);
        if (cancelled) return;
        setInvoice(inv);
        // Default pick: first method + its first asset. The Flutter
        // reference defaults to ZCHF on Polygon but DFX' merchants
        // frequently offer multiple, so we don't hard-code the asset —
        // the user's wallet may have one but not the other.
        const firstMethod = inv.transferAmounts[0];
        if (firstMethod) {
          setPickedMethod(firstMethod.method);
          setPickedAsset(firstMethod.assets[0]?.asset ?? null);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof OpenCryptoPayError) {
          setError(messageForError(err, t));
        } else {
          setError(err instanceof Error ? err.message : t('opencryptopay.errors.fetchFailed'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lnurl, t]);

  // 1 Hz tick so the expiry countdown decrements visibly. Stopped on
  // unmount; the React Query refetch path isn't relevant here because
  // the OCP quote is single-shot per scan.
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const expiresInMs = useMemo(() => {
    if (!invoice) return 0;
    const target = invoice.quote.expiresAt || now + FALLBACK_EXPIRY_MS;
    return Math.max(0, target - now);
  }, [invoice, now]);

  const isExpired = invoice !== null && invoice.quote.expiresAt > 0 && expiresInMs <= 0;

  const activeMethod = useMemo(
    () => invoice?.transferAmounts.find((tm) => tm.method === pickedMethod) ?? null,
    [invoice, pickedMethod],
  );
  const activeAmount = useMemo(
    () => activeMethod?.assets.find((a) => a.asset === pickedAsset)?.amount ?? null,
    [activeMethod, pickedAsset],
  );

  const handleCancel = () => {
    if (invoice?.callbackUrl) void cancelQuote(invoice.callbackUrl);
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/(tabs)/dashboard');
  };

  const handleConfirm = () => {
    // First iteration: confirm prepares for the next step (sign + broadcast
    // via WDK). We surface a transparent hint instead of pretending the
    // payment went through. Subsequent PR wires `getPaymentTarget` →
    // WDK send → `commitTx` once the wallet-side signing harness exists.
    setError(t('opencryptopay.confirmHint'));
  };

  return (
    <ScreenContainer scrollable>
      <AppHeader title={t('opencryptopay.title')} onBack={handleCancel} testID="opencryptopay" />
      <View style={styles.content}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={DfxColors.primary} />
            <Text style={styles.muted}>{t('opencryptopay.loading')}</Text>
          </View>
        ) : !invoice ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error ?? t('opencryptopay.errors.fetchFailed')}</Text>
            <PrimaryButton
              title={t('common.close')}
              onPress={handleCancel}
              testID="opencryptopay-close"
            />
          </View>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{t('opencryptopay.payTo')}</Text>
              <Text style={styles.summaryName}>
                {invoice.displayName || t('opencryptopay.unknownMerchant')}
              </Text>
              {invoice.quote.expiresAt > 0 ? (
                <Text style={[styles.summaryHint, isExpired && styles.summaryHintError]}>
                  {isExpired
                    ? t('opencryptopay.expired')
                    : t('opencryptopay.expiresIn', { time: formatMs(expiresInMs) })}
                </Text>
              ) : null}
            </View>

            <Text style={styles.sectionLabel}>{t('opencryptopay.methodLabel')}</Text>
            <View style={styles.methodList}>
              {invoice.transferAmounts.map((tm) => {
                const active = tm.method === pickedMethod;
                return (
                  <Pressable
                    key={tm.method}
                    style={[styles.methodChip, active && styles.methodChipActive]}
                    onPress={() => {
                      setPickedMethod(tm.method);
                      setPickedAsset(tm.assets[0]?.asset ?? null);
                    }}
                    testID={`opencryptopay-method-${tm.method}`}
                  >
                    <Text
                      style={[styles.methodChipText, active && styles.methodChipTextActive]}
                      numberOfLines={1}
                    >
                      {tm.method}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {activeMethod ? (
              <>
                <Text style={styles.sectionLabel}>{t('opencryptopay.assetLabel')}</Text>
                <View style={styles.assetList}>
                  {activeMethod.assets.map((a) => {
                    const active = a.asset === pickedAsset;
                    return (
                      <Pressable
                        key={a.asset}
                        style={[styles.assetRow, active && styles.assetRowActive]}
                        onPress={() => setPickedAsset(a.asset)}
                        testID={`opencryptopay-asset-${a.asset}`}
                      >
                        <View style={[styles.radio, active && styles.radioActive]}>
                          {active ? <View style={styles.radioDot} /> : null}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.assetSymbol}>{a.asset}</Text>
                          <Text style={styles.assetAmount}>
                            {a.amount} {a.asset}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            {error ? <Text style={styles.errorInline}>{error}</Text> : null}

            <PrimaryButton
              title={t('opencryptopay.confirm', {
                amount: activeAmount ?? '',
                asset: pickedAsset ?? '',
              })}
              onPress={handleConfirm}
              disabled={isExpired || !pickedAsset || !pickedMethod}
              testID="opencryptopay-confirm"
            />

            <Pressable
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              onPress={handleCancel}
              testID="opencryptopay-cancel"
            >
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

function messageForError(err: OpenCryptoPayError, t: (k: string) => string): string {
  switch (err.code) {
    case 'invalid-qr':
      return t('opencryptopay.errors.invalidQr');
    case 'invalid-response':
      return t('opencryptopay.errors.invalidResponse');
    case 'expired':
      return t('opencryptopay.expired');
    case 'commit-failed':
      return t('opencryptopay.errors.commitFailed');
    case 'fetch-failed':
    default:
      return t('opencryptopay.errors.fetchFailed');
  }
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: 32, gap: 18 },
  center: { paddingVertical: 32, alignItems: 'center', gap: 16 },
  muted: { ...Typography.bodyMedium, color: DfxColors.textSecondary },
  errorText: { ...Typography.bodyMedium, color: DfxColors.error, textAlign: 'center' },
  errorInline: {
    ...Typography.bodySmall,
    color: DfxColors.error,
    textAlign: 'center',
    marginTop: -4,
  },
  summaryCard: {
    backgroundColor: DfxColors.primaryLight,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  summaryLabel: {
    ...Typography.bodySmall,
    color: DfxColors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  summaryName: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
  },
  summaryHint: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
    marginTop: 6,
  },
  summaryHintError: { color: DfxColors.error },
  sectionLabel: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  methodList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: DfxColors.border,
    backgroundColor: DfxColors.surface,
  },
  methodChipActive: {
    borderColor: DfxColors.primary,
    backgroundColor: DfxColors.primaryLight,
  },
  methodChipText: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    fontWeight: '600',
  },
  methodChipTextActive: { color: DfxColors.primary },
  assetList: {
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DfxColors.border,
  },
  assetRowActive: { backgroundColor: DfxColors.primaryLight },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: DfxColors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: DfxColors.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: DfxColors.primary,
  },
  assetSymbol: { ...Typography.bodyLarge, fontWeight: '600', color: DfxColors.text },
  assetAmount: { ...Typography.bodySmall, color: DfxColors.textSecondary },
  cancelButton: { alignSelf: 'center', paddingVertical: 12 },
  cancelText: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
  },
  pressed: { opacity: 0.7 },
});
