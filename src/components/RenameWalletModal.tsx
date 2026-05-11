import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { DfxColors, Typography } from '@/theme';

type Props = {
  visible: boolean;
  /** Current value displayed in the input on open. Empty string falls back
   *  to placeholder so the user types a fresh name without first having to
   *  clear the default. */
  initialName: string;
  /** Default name shown as placeholder so the user can preview the
   *  fallback they'd get by leaving the input blank. */
  defaultName: string;
  /** Truncated address shown beneath the input as context — important when
   *  the user has multiple wallets on the same chain. */
  walletAddressShort: string;
  loading?: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
};

/**
 * Inline rename dialog for a DFX-linked wallet. Designed to mirror the
 * existing `ConfirmTargetWalletModal` aesthetic so the Settings flow
 * stays visually coherent — same overlay, card radius, button pair.
 *
 * Saving an empty string is treated as "reset to default" so the user can
 * undo a rename without retyping the blockchain-derived label.
 */
export function RenameWalletModal({
  visible,
  initialName,
  defaultName,
  walletAddressShort,
  loading,
  onSave,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialName);

  // Re-seed the input every time the modal re-opens. Without this, a second
  // rename attempt on the same screen would reuse whatever the user last
  // typed (even after Cancel) instead of the wallet's current saved name.
  useEffect(() => {
    if (visible) setValue(initialName);
  }, [visible, initialName]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={() => {
        if (!loading) onClose();
      }}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{t('linkedWallet.rename.title')}</Text>
          <Text style={styles.body}>{t('linkedWallet.rename.body')}</Text>

          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={defaultName}
            placeholderTextColor={DfxColors.textTertiary}
            style={styles.input}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => {
              if (!loading) onSave(value);
            }}
            maxLength={48}
            testID="rename-wallet-input"
          />

          <Text style={styles.address}>{walletAddressShort}</Text>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.buttonGhost,
                pressed && styles.pressed,
              ]}
              onPress={onClose}
              disabled={loading}
              testID="rename-wallet-cancel"
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
              onPress={() => onSave(value)}
              disabled={loading}
              testID="rename-wallet-save"
            >
              {loading ? (
                <ActivityIndicator color={DfxColors.white} />
              ) : (
                <Text style={[styles.buttonLabel, styles.buttonPrimaryLabel]}>
                  {t('common.save')}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  input: {
    ...Typography.bodyLarge,
    backgroundColor: DfxColors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: DfxColors.text,
    borderWidth: 1.5,
    borderColor: DfxColors.border,
  },
  address: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
    fontFamily: 'monospace',
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
