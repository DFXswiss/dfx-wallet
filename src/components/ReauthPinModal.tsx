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

export type ReauthPinModalProps = {
  visible: boolean;
  error: string | null;
  locked: boolean;
  verifying: boolean;
  onCancel: () => void;
  onSubmit: (pin: string) => void;
};

export function ReauthPinModal({
  visible,
  error,
  locked,
  verifying,
  onCancel,
  onSubmit,
}: ReauthPinModalProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (!visible) setPin('');
  }, [visible]);

  const clearAndCancel = () => {
    setPin('');
    onCancel();
  };

  const submit = () => {
    if (pin.length !== 6 || locked || verifying) return;
    const submittedPin = pin;
    setPin('');
    onSubmit(submittedPin);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={clearAndCancel}
      testID="reauth-pin-modal"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>{t('reauth.title')}</Text>
          <Text style={styles.description}>{t('reauth.description')}</Text>
          <TextInput
            testID="reauth-pin-input"
            style={styles.input}
            value={pin}
            onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 6))}
            onSubmitEditing={submit}
            editable={!locked && !verifying}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            textContentType="password"
            accessibilityLabel={t('reauth.pinLabel')}
          />
          {error ? (
            <Text style={styles.error} testID="reauth-pin-error">
              {error}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Pressable
              testID="reauth-pin-cancel"
              style={[styles.button, styles.cancelButton]}
              onPress={clearAndCancel}
              disabled={verifying}
            >
              <Text style={styles.cancelLabel}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              testID="reauth-pin-confirm"
              style={[styles.button, styles.confirmButton]}
              onPress={submit}
              disabled={pin.length !== 6 || locked || verifying}
            >
              {verifying ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.confirmLabel}>{t('common.confirm')}</Text>
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
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: colors.background,
    },
    card: {
      width: '100%',
      maxWidth: 380,
      padding: 20,
      gap: 14,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
    },
    title: {
      ...Typography.headlineSmall,
      color: colors.text,
    },
    description: {
      ...Typography.bodyMedium,
      color: colors.textSecondary,
    },
    input: {
      ...Typography.headlineSmall,
      color: colors.text,
      backgroundColor: colors.surfaceLight,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      textAlign: 'center',
      letterSpacing: 8,
    },
    error: {
      ...Typography.bodySmall,
      color: colors.error,
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
    },
    button: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      borderRadius: 999,
    },
    cancelButton: {
      backgroundColor: colors.surfaceLight,
      borderColor: colors.border,
      borderWidth: 1,
    },
    confirmButton: {
      backgroundColor: colors.primary,
    },
    cancelLabel: {
      ...Typography.bodyMedium,
      color: colors.textSecondary,
      fontWeight: '700',
    },
    confirmLabel: {
      ...Typography.bodyMedium,
      color: colors.white,
      fontWeight: '700',
    },
  });
