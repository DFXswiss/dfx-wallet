import { useEffect, useMemo, useState } from 'react';
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
import { Typography, useColors, type ThemeColors } from '@/theme';

type Props = {
  visible: boolean;
  initialName: string;
  defaultName: string;
  walletAddressShort: string;
  loading?: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
};

/**
 * Inline rename dialog for a DFX-linked wallet. Mirrors the
 * `ConfirmTargetWalletModal` aesthetic for cross-modal consistency.
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
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [value, setValue] = useState(initialName);

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
            placeholderTextColor={colors.textTertiary}
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
                <ActivityIndicator color={colors.white} />
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
    input: {
      ...Typography.bodyLarge,
      backgroundColor: colors.surfaceLight,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    address: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
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
