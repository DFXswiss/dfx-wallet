import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ImageBackground, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { AppHeader, Icon, PrimaryButton } from '@/components';
import { useCloisterTxStore } from '@/store/cloister-tx';
import { DfxColors, Typography } from '@/theme';

// Cloister carries the DFX brand blue — the shielded identity reads through
// the shield iconography, not a separate accent colour.
const ACCENT = DfxColors.primary;
const ACCENT_BG = DfxColors.primaryLight;
const ASSET = 'USDC';

// Watchdog windows — a payment must never be able to hang forever. If the
// (locally cached) engine doesn't announce itself, READY_TIMEOUT_MS trips; if
// it loads but never reports a result (stalled RPC / dead relayer),
// PAY_TIMEOUT_MS does. Both surface a clear, retryable error.
const READY_TIMEOUT_MS = 20_000;
const PAY_TIMEOUT_MS = 90_000;
// First-run artifact download (~32 MB over HTTPS) gets its own generous window.
const PREPARE_TIMEOUT_MS = 120_000;

type Phase = 'review' | 'paying' | 'success' | 'error';

export default function CloisterPayScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ config?: string; amount?: string }>();
  const addCloisterTx = useCloisterTxStore((s) => s.add);

  const config = typeof params.config === 'string' ? params.config : '';
  const amountStr = typeof params.amount === 'string' ? params.amount : '0';
  const amountNum = Number(amountStr) || 0;

  const [phase, setPhase] = useState<Phase>('review');
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<{
    txHash?: string | undefined;
    scan?: string | undefined;
    ms?: number | undefined;
  } | null>(null);
  const [error, setError] = useState('');
  // Bump to force a fresh WebView mount on retry.
  const [runId, setRunId] = useState(0);
  // Engine URL (same origin as relayer/indexer) once resolved from config.
  const [engineUri, setEngineUri] = useState<string | null>(null);
  const recordedRef = useRef(false);
  // Watchdog bookkeeping. `settledRef` flips the moment a terminal outcome
  // (paid / failed / cancelled) is reached so a late timer can't override it;
  // `readyRef` tracks whether the engine ever loaded.
  const settledRef = useRef(false);
  const readyRef = useRef(false);
  const readyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const payTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (readyTimer.current) clearTimeout(readyTimer.current);
    if (payTimer.current) clearTimeout(payTimer.current);
    readyTimer.current = null;
    payTimer.current = null;
  }, []);

  // Always tear timers down on unmount so a backgrounded screen never fires.
  useEffect(() => clearTimers, [clearTimers]);

  const failWith = useCallback(
    (message: string) => {
      if (settledRef.current) return;
      settledRef.current = true;
      clearTimers();
      setError(message);
      setPhase('error');
    },
    [clearTimers],
  );

  const startPaying = useCallback(async () => {
    recordedRef.current = false;
    settledRef.current = false;
    readyRef.current = false;
    setError('');
    setResult(null);
    setEngineUri(null);
    setStatus(t('cloister.preparing'));
    setRunId((n) => n + 1);
    setPhase('paying');
    clearTimers();

    // Resolve the engine origin from config. The engine is served on the SAME
    // origin as the relayer/indexer, so over an HTTPS tunnel the whole flow
    // (engine load + its relayer/config fetches) works through ANY network —
    // VPN, cellular, foreign WiFi — with no cross-origin/cleartext issues.
    payTimer.current = setTimeout(() => failWith(t('cloister.errorTimeout')), PREPARE_TIMEOUT_MS);
    try {
      const cfgRes = await fetch(config);
      if (!cfgRes.ok) throw new Error(`config HTTP ${cfgRes.status}`);
      const cfg = (await cfgRes.json()) as { engine?: string };
      const origin = (cfg.engine || config.replace(/\/config.*$/, '')).replace(/\/$/, '');
      if (settledRef.current) return; // cancelled meanwhile

      setEngineUri(
        `${origin}/cloister-pay.html?auto=1&amount=${encodeURIComponent(amountStr)}&config=${encodeURIComponent(config)}`,
      );
      setStatus(t('cloister.proving'));
      clearTimers();
      readyTimer.current = setTimeout(() => {
        if (!readyRef.current) failWith(t('cloister.errorEngine'));
      }, READY_TIMEOUT_MS);
      payTimer.current = setTimeout(() => failWith(t('cloister.errorTimeout')), PAY_TIMEOUT_MS);
    } catch {
      failWith(t('cloister.errorEngine'));
    }
  }, [config, amountStr, t, clearTimers, failWith]);

  const cancelPaying = useCallback(() => {
    settledRef.current = true;
    clearTimers();
    setStatus('');
    setPhase('review');
  }, [clearTimers]);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: {
      type?: string;
      ok?: boolean;
      txHash?: string;
      scan?: string;
      ms?: number;
      error?: string;
    };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'ready') {
      readyRef.current = true;
      if (readyTimer.current) clearTimeout(readyTimer.current);
      readyTimer.current = null;
      setStatus(t('cloister.proving'));
      return;
    }
    if (msg.type === 'paid') {
      if (settledRef.current) return;
      settledRef.current = true;
      clearTimers();
      if (msg.ok) {
        setStatus(t('cloister.submitting'));
        setResult({ txHash: msg.txHash, scan: msg.scan, ms: msg.ms });
        if (!recordedRef.current) {
          recordedRef.current = true;
          addCloisterTx({
            amount: amountNum,
            asset: ASSET,
            merchant: t('cloister.merchant'),
            network: t('cloister.network'),
            badge: t('cloister.historyBadge'),
            ...(msg.txHash ? { txId: msg.txHash } : {}),
            ...(msg.scan ? { explorerUrl: msg.scan } : {}),
          });
        }
        setPhase('success');
      } else {
        setError(msg.error ?? t('cloister.errorGeneric'));
        setPhase('error');
      }
    }
  };

  const amountHeader = (
    <View style={styles.amountBlock}>
      <View style={styles.badge}>
        <Icon name="shield" size={13} color={ACCENT} strokeWidth={2.4} />
        <Text style={styles.badgeText}>{t('cloister.privateBadge')}</Text>
      </View>
      <Text style={styles.amount}>
        {amountStr} <Text style={styles.amountAsset}>{ASSET}</Text>
      </Text>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <ImageBackground
        source={require('../../../assets/dashboard-bg.png')}
        style={styles.bg}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
          <AppHeader
            title={phase === 'success' ? t('cloister.successTitle') : t('cloister.confirmTitle')}
            onBack={() => router.back()}
            testID="cloister-pay-header"
          />

          {/* Off-screen prover engine — served from the relayer origin (HTTPS via
              tunnel → reachable through any VPN/network). cacheEnabled lets the
              WebView reuse the heavy wasm/zkey across payments. */}
          {phase === 'paying' && engineUri && (
            <WebView
              key={runId}
              source={{ uri: engineUri }}
              onMessage={onMessage}
              onError={(ev) => failWith(ev.nativeEvent.description || t('cloister.errorEngine'))}
              onHttpError={() => failWith(t('cloister.errorEngine'))}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              mixedContentMode="always"
              cacheEnabled
              style={styles.hiddenWebview}
            />
          )}

          <View style={styles.body}>
            {phase === 'review' ? (
              <>
                {amountHeader}
                <View style={styles.card}>
                  <DetailRow label={t('opencryptopay.payTo')} value={t('cloister.merchant')} />
                  <View style={styles.divider} />
                  <DetailRow label={t('opencryptopay.methodLabel')} value={t('cloister.network')} />
                </View>
                <View style={styles.privacyNote}>
                  <Icon name="shield" size={15} color={ACCENT} strokeWidth={2.2} />
                  <Text style={styles.privacyText}>{t('cloister.privacyNote')}</Text>
                </View>
                <View style={styles.actions}>
                  <PrimaryButton
                    title={t('cloister.confirmPay')}
                    onPress={() => void startPaying()}
                    testID="cloister-confirm"
                  />
                </View>
              </>
            ) : (
              <>
                {/* Amount stays near the top (consistent with the review
                    screen); the live status sits centred in the space below;
                    action buttons stay pinned to the bottom. */}
                {amountHeader}
                <View style={styles.statusCenter}>
                  {phase === 'paying' && (
                    <View style={styles.statusGroup}>
                      <ActivityIndicator size="large" color={ACCENT} />
                      <Text style={styles.statusText}>{status || t('cloister.proving')}</Text>
                      <Text style={styles.statusSub}>{t('cloister.privacyNote')}</Text>
                    </View>
                  )}

                  {phase === 'success' && (
                    <View style={styles.statusGroup}>
                      <View style={styles.successCircle}>
                        <Icon name="check" size={40} color={DfxColors.white} strokeWidth={3} />
                      </View>
                      <Text style={styles.successTitle}>{t('cloister.successSubtitle')}</Text>
                      {result?.ms ? <Text style={styles.statusSub}>{result.ms} ms</Text> : null}
                    </View>
                  )}

                  {phase === 'error' && (
                    <View style={styles.statusGroup}>
                      <View style={styles.errorCircle}>
                        <Icon name="close" size={36} color={DfxColors.white} strokeWidth={3} />
                      </View>
                      <Text style={styles.errorTitle}>{t('cloister.failedTitle')}</Text>
                      <Text style={styles.statusSub} numberOfLines={3}>
                        {error}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.bottomActions}>
                  {phase === 'paying' && (
                    <PrimaryButton
                      title={t('common.cancel')}
                      variant="outlined"
                      onPress={cancelPaying}
                      testID="cloister-cancel-paying"
                    />
                  )}
                  {phase === 'success' && (
                    <>
                      {result?.scan ? (
                        <PrimaryButton
                          title={t('cloister.viewOnExplorer')}
                          variant="outlined"
                          onPress={() => result.scan && void Linking.openURL(result.scan)}
                          testID="cloister-explorer"
                        />
                      ) : null}
                      <PrimaryButton
                        title={t('cloister.done')}
                        onPress={() => router.replace('/(auth)/(tabs)/dashboard')}
                        testID="cloister-done"
                      />
                    </>
                  )}
                  {phase === 'error' && (
                    <>
                      <PrimaryButton
                        title={t('cloister.retry')}
                        onPress={() => void startPaying()}
                      />
                      <PrimaryButton
                        title={t('common.cancel')}
                        variant="outlined"
                        onPress={() => router.back()}
                      />
                    </>
                  )}
                </View>
              </>
            )}
          </View>
        </SafeAreaView>
      </ImageBackground>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: DfxColors.background },
  safe: { flex: 1 },
  hiddenWebview: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  amountBlock: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ACCENT_BG,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    ...Typography.bodySmall,
    color: ACCENT,
    fontWeight: '700',
  },
  amount: {
    fontSize: 46,
    lineHeight: 52,
    fontWeight: '800',
    color: DfxColors.text,
  },
  amountAsset: {
    fontSize: 24,
    fontWeight: '600',
    color: DfxColors.textSecondary,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: DfxColors.border,
    paddingHorizontal: 18,
    shadowColor: '#0B1426',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    gap: 12,
  },
  detailLabel: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
  },
  detailValue: {
    ...Typography.bodyMedium,
    color: DfxColors.text,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DfxColors.border,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  privacyText: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
    textAlign: 'center',
    flexShrink: 1,
  },
  actions: {
    marginTop: 'auto',
    paddingBottom: 8,
    gap: 12,
  },
  // Non-review phases: the live status (spinner / check / error) is centred
  // in the space between the top amount and the bottom buttons.
  statusCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusGroup: {
    alignItems: 'center',
    gap: 14,
  },
  // …and pin the action buttons to the bottom.
  bottomActions: {
    paddingBottom: 8,
    gap: 12,
  },
  statusText: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
    textAlign: 'center',
    marginTop: 8,
  },
  statusSub: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  successCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: ACCENT,
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  successTitle: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
    textAlign: 'center',
    marginTop: 4,
  },
  errorCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: DfxColors.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  errorTitle: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
    textAlign: 'center',
  },
});
