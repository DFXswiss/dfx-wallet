import { useMemo } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Typography, useColors, type ThemeColors } from '@/theme';

type Props = {
  visible: boolean;
  assetLabel: string;
  walletAddressShort: string;
  walletBlockchain?: string;
  loading?: boolean;
  error?: string | null;
  flow: 'buy' | 'sell';
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Final-step confirmation that the buy (or sell) is destined for the linked
 * wallet the user picked from Portfolio.
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
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
                <ActivityIndicator color={colors.white} />
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

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    card: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 22,
      gap: 14,
    },
    title: {
      ...Typography.headlineSmall,
      color: colors.text,
    },
    body: {
      ...Typography.bodyMedium,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    walletBlock: {
      backgroundColor: colors.surfaceLight,
      borderRadius: 14,
      padding: 14,
      gap: 4,
    },
    walletAddress: {
      ...Typography.bodyMedium,
      color: colors.text,
      fontWeight: '600',
      fontFamily: 'monospace',
    },
    walletBlockchain: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
    },
    errorText: {
      ...Typography.bodySmall,
      color: colors.error,
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
      backgroundColor: colors.surfaceLight,
      borderWidth: 1,
      borderColor: colors.border,
    },
    buttonPrimary: {
      backgroundColor: colors.primary,
    },
    buttonLabel: {
      ...Typography.bodyMedium,
      fontWeight: '700',
    },
    buttonGhostLabel: {
      color: colors.textSecondary,
    },
    buttonPrimaryLabel: {
      color: colors.white,
    },
    pressed: {
      opacity: 0.7,
    },
  });
