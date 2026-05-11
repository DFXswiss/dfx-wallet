import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DfxColors, Typography } from '@/theme';

type Props = {
  visible: boolean;
  /**
   * The asset symbol the user is about to send (BUY) or receive (SELL).
   * Surfaced verbatim so the modal copies match the rest of the buy screen
   * ("BTC", "ZCHF", etc.).
   */
  assetLabel: string;
  /** Truncated wallet address shown in the modal body. */
  walletAddressShort: string;
  /** Optional blockchain hint shown beneath the address. */
  walletBlockchain?: string;
  /** Whether the modal is in the middle of a re-auth round-trip. */
  loading?: boolean;
  /** Optional inline error to surface (e.g. "addressMismatch"). */
  error?: string | null;
  /** Distinguishes the buy / sell copy variants. */
  flow: 'buy' | 'sell';
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Final-step confirmation that the buy (or sell) is destined for the linked
 * wallet the user picked from Portfolio.
 *
 * The user explicitly asked for a *pop-up* that gates the transition from
 * the Angebot screen to the bank-data step — a misdirected SEPA wire is
 * unrecoverable, so we want the user to read the asset+wallet pairing once
 * more before any DFX session-switch happens. Custom Modal instead of the
 * RN Alert primitive because Alert can't render the truncated monospace
 * address, and inheriting our DfxColors keeps the look on-brand.
 */
export function ConfirmTargetWalletModal({
  visible,
  assetLabel,
  walletAddressShort,
  walletBlockchain,
  loading,
  error,
  flow,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={() => {
        if (!loading) onCancel();
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t(`linkedWallet.confirm.${flow}.title`)}</Text>
          <Text style={styles.body}>
            {t(`linkedWallet.confirm.${flow}.body`, { asset: assetLabel })}
          </Text>

          <View style={styles.walletBlock}>
            <Text style={styles.walletAddress}>{walletAddressShort}</Text>
            {walletBlockchain ? (
              <Text style={styles.walletBlockchain}>{walletBlockchain}</Text>
            ) : null}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.buttonGhost,
                pressed && styles.pressed,
              ]}
              onPress={onCancel}
              disabled={loading}
              testID="confirm-target-cancel"
            >
              <Text style={[styles.buttonLabel, styles.buttonGhostLabel]}>
                {t('common.cancel')}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.buttonPrimary,
                pressed && styles.pressed,
              ]}
              onPress={onConfirm}
              disabled={loading}
              testID="confirm-target-confirm"
            >
              {loading ? (
                <ActivityIndicator color={DfxColors.white} />
              ) : (
                <Text style={[styles.buttonLabel, styles.buttonPrimaryLabel]}>
                  {t('common.confirm')}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 20, 38, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: DfxColors.surface,
    borderRadius: 20,
    padding: 22,
    gap: 14,
  },
  title: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
  },
  body: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    lineHeight: 22,
  },
  walletBlock: {
    backgroundColor: DfxColors.background,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  walletAddress: {
    ...Typography.bodyMedium,
    color: DfxColors.text,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  walletBlockchain: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
  },
  errorText: {
    ...Typography.bodySmall,
    color: DfxColors.error,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonGhost: {
    backgroundColor: DfxColors.background,
    borderWidth: 1,
    borderColor: DfxColors.border,
  },
  buttonPrimary: {
    backgroundColor: DfxColors.primary,
  },
  buttonLabel: {
    ...Typography.bodyMedium,
    fontWeight: '700',
  },
  buttonGhostLabel: {
    color: DfxColors.textSecondary,
  },
  buttonPrimaryLabel: {
    color: DfxColors.white,
  },
  pressed: {
    opacity: 0.7,
  },
});
