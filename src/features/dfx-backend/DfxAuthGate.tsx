import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { ChainId } from '@/config/chains';
import type { DfxAuthGateState } from '@/features/dfx-backend/services';
import { DfxColors, Typography } from '@/theme';
import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';

type Props = {
  /** Non-null state means the modal is visible. */
  gate: DfxAuthGateState | null;
  /** Called when the user dismisses the modal. */
  onClose: () => void;
  /**
   * Sign and attach the given chain's wallet address to the active DFX
   * account. Buy/Sell screens implement this with a per-chain WDK
   * `useAccount` instance because the gate has no chain context itself.
   */
  onLinkChain?: (chain: ChainId) => Promise<void>;
};

/**
 * Recovery modal for DFX auth/onboarding errors that block the Buy/Sell flow.
 *
 * - `login` / `registration` → email sign-in screen
 * - `kyc` → KYC screen
 * - `linkChain` → sign with the missing chain's wallet so DFX adds it to
 *   the user's `jwt.blockchains` (resolves "Asset blockchain mismatch")
 */
export function DfxAuthGate({ gate, onClose, onLinkChain }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!gate) return null;

  const titleKey = `dfxAuthGate.${gate.kind}.title`;
  const bodyKey = `dfxAuthGate.${gate.kind}.body`;
  const ctaKey = `dfxAuthGate.${gate.kind}.cta`;

  const chainLabel = gate.chain ? t(`dfxAuthGate.chainLabel.${gate.chain}`) : '';

  const handlePrimary = async () => {
    if (gate.kind === 'kyc') {
      onClose();
      router.push('/(auth)/kyc');
      return;
    }
    if (gate.kind === 'email') {
      onClose();
      router.push('/(auth)/email');
      return;
    }
    if (gate.kind === 'linkChain') {
      if (!gate.chain || !onLinkChain) {
        onClose();
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await onLinkChain(gate.chain as ChainId);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : t('dfxAuthGate.linkChain.failed'));
      } finally {
        setBusy(false);
      }
      return;
    }
    // login + registration both go to the email sign-in screen.
    onClose();
    router.push('/(auth)/dfx-login');
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} testID="dfx-auth-gate">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Icon name="shield" size={28} color={DfxColors.white} strokeWidth={2.5} />
          </View>
          <Text style={styles.title}>{t(titleKey, { chain: chainLabel })}</Text>
          <Text style={styles.body}>{t(bodyKey, { chain: chainLabel })}</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.actions}>
            <PrimaryButton
              title={t(ctaKey, { chain: chainLabel })}
              onPress={handlePrimary}
              loading={busy}
              testID="dfx-auth-gate-primary"
            />
            <Pressable onPress={onClose} hitSlop={8} testID="dfx-auth-gate-cancel">
              <Text style={styles.cancelButton}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 20, 38, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: DfxColors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 380,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: DfxColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
    textAlign: 'center',
  },
  body: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 4,
  },
  errorText: {
    ...Typography.bodySmall,
    color: DfxColors.error,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  cancelButton: {
    ...Typography.bodyMedium,
    color: DfxColors.textTertiary,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
