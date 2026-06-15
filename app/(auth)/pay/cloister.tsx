import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ImageBackground, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAccount } from '@tetherto/wdk-react-native-core';
import { runDeposit } from '@/features/cloister/deposit';
import { getOwnerKey } from '@/features/cloister/ownerKey';
import { AppHeader, Icon, PrimaryButton } from '@/components';
import { useCloisterTxStore } from '@/store/cloister-tx';
import { DfxColors, Typography } from '@/theme';

// Cloister carries the DFX brand blue — the shielded identity reads through
// the shield iconography, not a separate accent colour.
const ACCENT = DfxColors.primary;
const ACCENT_BG = DfxColors.primaryLight;
const ASSET = 'USDC';

// Watchdog window — a payment must never hang forever. Proving runs on-device
// (~0.4s); the only network steps are the relayer prepare + submit. If anything
// stalls (dead relayer / RPC), PAY_TIMEOUT_MS trips with a clear, retryable error.
const PAY_TIMEOUT_MS = 90_000;

// Direct-to-RPC config (relayer-optional fallback): the app proves on-device AND
// broadcasts straight to the public Base Sepolia RPC — works on any network (WiFi or
// cellular), no relayer/LAN needed. Injected at build time (EXPO_PUBLIC_*) so no
// addresses/keys live in source.
// NOTE: the deployer key here is a TESTNET demo key only — production signs with the
// user's own wallet key (the wallet already manages keys).
const RPC = process.env.EXPO_PUBLIC_CLOISTER_RPC ?? 'https://base-sepolia-rpc.publicnode.com';
const POOL = process.env.EXPO_PUBLIC_CLOISTER_POOL ?? '';
// TESTNET PILOT ONLY: embedded demo key (the user's mainnet WDK wallet can't transact on
// the Sepolia pilot pool). Empty in a production build → the user's own wallet signs (WDK).
const DEPLOYER_KEY = process.env.EXPO_PUBLIC_CLOISTER_KEY ?? '';
// Relayer that serves the tree-insertion context (/v1/deposit/prepare). Optional —
// if unset/unreachable the warm on-device leaf cache is used instead.
const RELAYER_URL = process.env.EXPO_PUBLIC_CLOISTER_RELAYER || undefined;
// Pool deploy block — the tree-sync (relayer or fallback cache) scans NewCommitment
// events from here so the full Merkle tree is rebuilt, not just a recent window.
const FROM_BLOCK = Number(process.env.EXPO_PUBLIC_CLOISTER_FROM_BLOCK ?? '0');
const CHAIN_ID = Number(process.env.EXPO_PUBLIC_CLOISTER_CHAINID ?? '84532');

type Phase = 'review' | 'paying' | 'success' | 'error';

export default function CloisterPayScreen() {
  const router = useRouter();
  // Production signer: the user's own ERC-4337 wallet (no embedded key). Used only when
  // no pilot DEPLOYER_KEY is present (mainnet). Safe to call on the pilot — unused there.
  const evmAccount = useAccount({ network: 'base', accountIndex: 0 });
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ config?: string; amount?: string }>();
  const addCloisterTx = useCloisterTxStore((s) => s.add);

  const amountStr = typeof params.amount === 'string' ? params.amount : '0';
  const amountNum = Number(amountStr) || 0;

  const [phase, setPhase] = useState<Phase>('review');
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<{ txHash?: string; scan?: string; ms?: number } | null>(
    null,
  );
  const [error, setError] = useState('');
  // `settledRef` flips on the first terminal outcome so a late watchdog can't override it.
  const settledRef = useRef(false);
  const recordedRef = useRef(false);
  const payTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (payTimer.current) clearTimeout(payTimer.current);
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

  // Native shielded deposit, fully on-device + direct-to-RPC: the proof is generated on
  // the phone (~0.4s) and the transaction is broadcast straight to the public Base Sepolia
  // RPC. No relayer, no LAN, no WebView — works on any network. The private witness never
  // leaves the device.
  const startPaying = useCallback(async () => {
    settledRef.current = false;
    recordedRef.current = false;
    setError('');
    setResult(null);
    setStatus(t('cloister.preparing'));
    setPhase('paying');
    clearTimers();
    payTimer.current = setTimeout(() => failWith(t('cloister.errorTimeout')), PAY_TIMEOUT_MS);

    const t0 = Date.now();
    try {
      if (!POOL) throw new Error('missing build config (pool)');

      // Production signs with the user's own wallet (WDK); the pilot uses the embedded
      // demo key on Sepolia. Per-install note-owner key (never a constant).
      const ownerPriv = await getOwnerKey();
      const sendTx = DEPLOYER_KEY
        ? undefined
        : async ({ to, data }: { to: string; data: string }) => {
            const evm = evmAccount.extension() as {
              sendTransaction: (tx: {
                to: string;
                data: string;
                gasLimit?: bigint;
              }) => Promise<{ hash: string }>;
            };
            const r = await evm.sendTransaction({ to, data, gasLimit: 900000n });
            return { hash: r.hash };
          };

      // prove on-device (gnark) then broadcast transact() with the wallet's signer.
      // Tree context comes from the relayer (primary) or the warm leaf cache (fallback).
      setStatus(t('cloister.proving'));
      const res = await runDeposit(amountStr, {
        rpc: RPC,
        pool: POOL,
        chainId: CHAIN_ID,
        ownerPriv,
        fromBlock: FROM_BLOCK,
        relayerUrl: RELAYER_URL,
        deployerKey: DEPLOYER_KEY || undefined,
        sendTx,
      });
      if (settledRef.current) return;
      if (!res.txHash) throw new Error('submit failed');

      settledRef.current = true;
      clearTimers();
      setResult({ txHash: res.txHash, scan: res.basescan, ms: Date.now() - t0 });
      if (!recordedRef.current) {
        recordedRef.current = true;
        addCloisterTx({
          amount: amountNum,
          asset: ASSET,
          merchant: t('cloister.merchant'),
          network: t('cloister.network'),
          badge: t('cloister.historyBadge'),
          ...(res.txHash ? { txId: res.txHash } : {}),
          ...(res.basescan ? { explorerUrl: res.basescan } : {}),
        });
      }
      setPhase('success');
    } catch (e: unknown) {
      failWith(e instanceof Error && e.message ? e.message : t('cloister.errorGeneric'));
    }
  }, [amountStr, amountNum, t, clearTimers, failWith, addCloisterTx, evmAccount]);

  const cancelPaying = useCallback(() => {
    settledRef.current = true;
    clearTimers();
    setStatus('');
    setPhase('review');
  }, [clearTimers]);

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

          {/* Proving runs on-device via the native module — no off-screen WebView. */}

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
