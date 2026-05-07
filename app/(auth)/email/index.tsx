import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppHeader, Icon, PrimaryButton, ScreenContainer } from '@/components';
import { dfxUserService } from '@/services/dfx';
import { DfxColors, Typography } from '@/theme';

type Stage = 'idle' | 'enterCode' | 'success';

export default function EmailScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [currentMail, setCurrentMail] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [mail, setMail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void dfxUserService
      .getUser()
      .then((user) => {
        if (!cancelled) setCurrentMail(user.mail);
      })
      .catch(() => {
        if (!cancelled) setCurrentMail(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingUser(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isValidEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail.trim());

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      await dfxUserService.updateMail(mail.trim());
      setStage('enterCode');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('email.sendError'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      await dfxUserService.verifyMail(code.trim());
      setStage('success');
      setCurrentMail(mail.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('email.verifyError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <ScreenContainer scrollable testID="email-screen">
        <AppHeader title={t('email.title')} onBack={() => router.back()} testID="email" />

        <View style={styles.content}>
          <View style={styles.currentRow}>
            <Text style={styles.sectionLabel}>{t('email.currentLabel')}</Text>
            {loadingUser ? (
              <ActivityIndicator color={DfxColors.primary} />
            ) : (
              <Text style={styles.currentValue}>{currentMail ?? t('email.notSet')}</Text>
            )}
          </View>

          {stage === 'success' ? (
            <View style={styles.successCard}>
              <View style={styles.successIcon}>
                <Icon name="shield" size={28} color={DfxColors.white} strokeWidth={2.5} />
              </View>
              <Text style={styles.successTitle}>{t('email.successTitle')}</Text>
              <Text style={styles.successBody}>
                {t('email.successBody', { mail: mail.trim() })}
              </Text>
              <PrimaryButton title={t('common.done')} onPress={() => router.back()} />
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>{t('email.newLabel')}</Text>
              <TextInput
                style={styles.input}
                value={mail}
                onChangeText={setMail}
                placeholder={t('email.placeholder')}
                placeholderTextColor={DfxColors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={stage === 'idle'}
                testID="email-input"
              />

              {stage === 'idle' && (
                <PrimaryButton
                  title={t('email.sendCta')}
                  onPress={sendCode}
                  disabled={!isValidEmail || busy}
                  loading={busy}
                  testID="email-send"
                />
              )}

              {stage === 'enterCode' && (
                <>
                  <Text style={styles.helperText}>
                    {t('email.codeHint', { mail: mail.trim() })}
                  </Text>
                  <Text style={styles.sectionLabel}>{t('email.codeLabel')}</Text>
                  <TextInput
                    style={[styles.input, styles.codeInput]}
                    value={code}
                    onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    placeholderTextColor={DfxColors.textTertiary}
                    keyboardType="number-pad"
                    autoFocus
                    testID="email-code-input"
                  />
                  <PrimaryButton
                    title={t('email.verifyCta')}
                    onPress={verify}
                    disabled={code.length !== 6 || busy}
                    loading={busy}
                    testID="email-verify"
                  />
                </>
              )}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </>
          )}
        </View>
      </ScreenContainer>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 16,
    paddingBottom: 32,
    gap: 14,
  },
  currentRow: {
    backgroundColor: DfxColors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  sectionLabel: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: DfxColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  currentValue: {
    ...Typography.bodyLarge,
    color: DfxColors.text,
    fontWeight: '500',
  },
  input: {
    backgroundColor: DfxColors.surface,
    borderRadius: 12,
    padding: 14,
    color: DfxColors.text,
    ...Typography.bodyLarge,
  },
  codeInput: {
    fontFamily: 'monospace',
    letterSpacing: 6,
    textAlign: 'center',
    fontSize: 24,
  },
  helperText: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    lineHeight: 22,
  },
  errorText: {
    ...Typography.bodySmall,
    color: DfxColors.error,
    textAlign: 'center',
  },
  successCard: {
    backgroundColor: DfxColors.surface,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: DfxColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
    textAlign: 'center',
  },
  successBody: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 8,
    lineHeight: 22,
  },
});
