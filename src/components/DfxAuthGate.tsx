import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDfxAuth } from '@/hooks';
import type { DfxAuthGateState } from '@/services/dfx';
import { DfxColors, Typography } from '@/theme';
import { Icon } from './Icon';
import { PrimaryButton } from './PrimaryButton';

type Props = {
  /** Non-null state means the modal is visible. */
  gate: DfxAuthGateState | null;
  /** Called when the user dismisses the modal or after a successful re-auth. */
  onClose: () => void;
  /** Called after a successful sign-in so the calling screen can retry. */
  onAuthenticated?: () => void;
};

/**
 * Recovery modal for DFX auth/onboarding errors that block the Buy/Sell flow.
 *
 * Three variants depending on the error returned by the backend:
 * - `login`         — the JWT is missing or expired. Re-sign with the active address.
 * - `registration`  — there's no DFX account for this address yet. Sign + auto-create.
 * - `kyc`           — the requested action needs a higher KYC level. Route to /kyc.
 *
 * Always offers a "Wallet wechseln" link to /(auth)/wallets so the user can
 * pick a different DFX-linked address or attach a new one when the active
 * address belongs to the wrong DFX account.
 */
export function DfxAuthGate({ gate, onClose, onAuthenticated }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { authenticate } = useDfxAuth();
  const [busy, setBusy] = useState(false);

  if (!gate) return null;

  const titleKey = `dfxAuthGate.${gate.kind}.title`;
  const bodyKey = `dfxAuthGate.${gate.kind}.body`;
  const ctaKey = `dfxAuthGate.${gate.kind}.cta`;

  const handlePrimary = async () => {
    if (gate.kind === 'kyc') {
      onClose();
      router.push('/(auth)/kyc');
      return;
    }
    // login + registration both run the sign-in flow.
    setBusy(true);
    try {
      const token = await authenticate();
      if (token) {
        onClose();
        onAuthenticated?.();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSwitchWallet = () => {
    onClose();
    router.push('/(auth)/wallets');
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} testID="dfx-auth-gate">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Icon name="shield" size={28} color={DfxColors.white} strokeWidth={2.5} />
          </View>
          <Text style={styles.title}>{t(titleKey)}</Text>
          <Text style={styles.body}>{t(bodyKey)}</Text>
          {gate.message ? <Text style={styles.detail}>{gate.message}</Text> : null}

          <View style={styles.actions}>
            <PrimaryButton
              title={t(ctaKey)}
              onPress={handlePrimary}
              loading={busy}
              testID="dfx-auth-gate-primary"
            />
            <Pressable onPress={handleSwitchWallet} hitSlop={8} testID="dfx-auth-gate-switch">
              <Text style={styles.linkButton}>{t('dfxAuthGate.switchWallet')}</Text>
            </Pressable>
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
  detail: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  actions: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  linkButton: {
    ...Typography.bodyMedium,
    color: DfxColors.primary,
    textAlign: 'center',
    fontWeight: '600',
    paddingVertical: 8,
  },
  cancelButton: {
    ...Typography.bodyMedium,
    color: DfxColors.textTertiary,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
