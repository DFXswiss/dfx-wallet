import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppHeader, Icon, PrimaryButton, ScreenContainer } from '@/components';
import { useDfxAuth } from '@/hooks';
import { dfxApi, dfxAuthService, decodeDfxJwt } from '@/features/dfx-backend/services';
import { DfxColors, Typography } from '@/theme';

type Stage = 'enterMail' | 'sending' | 'verify' | 'success';

/**
 * Mirrors the realunit-app email confirmation pattern:
 *
 * 1. User types email and taps "Bestätigungslink senden".
 * 2. App ensures the wallet is authenticated (silent /v1/auth) so the backend
 *    has a session to bind the email to, then POSTs /v1/auth/mail.
 * 3. User opens the email and clicks the confirmation link (which hits the
 *    DFX backend and merges the wallet-only account into an email-bound one).
 * 4. User taps "E-Mail bestätigt" in the app.
 * 5. App invalidates the current token, re-authenticates the wallet, and
 *    compares the `account` claim of the new JWT against the old one. If
 *    they differ, the merge succeeded and the wallet is now part of the
 *    email user — done. If they match, the link hasn't been clicked yet.
 */
export default function DfxLoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { authenticate } = useDfxAuth();

  const [mail, setMail] = useState('');
  const [stage, setStage] = useState<Stage>('enterMail');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oldAccountId, setOldAccountId] = useState<number | null>(null);

  const isValidEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail.trim());

  const sendMail = async () => {
    setBusy(true);
    setStage('sending');
    setError(null);
    try {
      // Use the existing token if we have one, otherwise sign in fresh. The
      // backend needs an authenticated session attached when /v1/auth/mail
      // is called so it can bind the email to this wallet's account.
      const token = dfxAuthService.getAccessToken() ?? (await authenticate());
      setOldAccountId(decodeDfxJwt(token)?.account ?? null);

      await dfxAuthService.requestMailLogin(mail.trim(), { wallet: 'DFX Wallet' });
      setStage('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dfxLogin.sendError'));
      setStage('enterMail');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      // Drop the current token so the next /v1/auth call returns the
      // post-merge session for the wallet (the backend has now linked the
      // wallet's account to the email-bound user).
      dfxAuthService.logout();
      dfxApi.clearAuthToken();

      const token = await authenticate();
      const newAccountId = decodeDfxJwt(token)?.account ?? null;
      const merged =
        newAccountId !== null && (oldAccountId === null || newAccountId !== oldAccountId);
      if (merged) {
        setStage('success');
      } else {
        setError(t('dfxLogin.notVerifiedYet'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dfxLogin.verifyError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <ScreenContainer scrollable testID="dfx-login-screen">
        <AppHeader title={t('dfxLogin.title')} testID="dfx-login" />

        <View style={styles.content}>
          <View style={styles.heroIcon}>
            <Icon name="shield" size={32} color={DfxColors.white} strokeWidth={2.5} />
          </View>

          {stage === 'enterMail' && (
            <>
              <Text style={styles.title}>{t('dfxLogin.mailTitle')}</Text>
              <Text style={styles.body}>{t('dfxLogin.mailBody')}</Text>
              <Text style={styles.label}>{t('dfxLogin.mailLabel')}</Text>
              <TextInput
                style={styles.input}
                value={mail}
                onChangeText={setMail}
                placeholder="name@example.com"
                placeholderTextColor={DfxColors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                testID="dfx-login-mail-input"
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <PrimaryButton
                title={t('dfxLogin.sendCta')}
                onPress={sendMail}
                disabled={!isValidEmail || busy}
                loading={busy}
                testID="dfx-login-send"
              />
            </>
          )}

          {stage === 'sending' && (
            <View style={styles.centered}>
              <ActivityIndicator color={DfxColors.primary} size="large" />
              <Text style={styles.body}>{t('dfxLogin.sendingBody')}</Text>
            </View>
          )}

          {stage === 'verify' && (
            <>
              <Text style={styles.title}>{t('dfxLogin.verifyTitle')}</Text>
              <Text style={styles.body}>{t('dfxLogin.verifyBody', { mail: mail.trim() })}</Text>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <PrimaryButton
                title={t('dfxLogin.verifyCta')}
                onPress={verify}
                loading={busy}
                testID="dfx-login-verify"
              />
            </>
          )}

          {stage === 'success' && (
            <>
              <Text style={styles.title}>{t('dfxLogin.successTitle')}</Text>
              <Text style={styles.body}>{t('dfxLogin.successBody')}</Text>
              <PrimaryButton
                title={t('common.continue')}
                onPress={() => router.back()}
                testID="dfx-login-continue"
              />
            </>
          )}
        </View>
      </ScreenContainer>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 24,
    paddingBottom: 32,
    gap: 14,
    alignItems: 'stretch',
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: DfxColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 8,
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
  label: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: DfxColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 8,
  },
  input: {
    backgroundColor: DfxColors.surface,
    borderRadius: 12,
    padding: 14,
    color: DfxColors.text,
    ...Typography.bodyLarge,
  },
  errorText: {
    ...Typography.bodySmall,
    color: DfxColors.error,
    textAlign: 'center',
  },
  centered: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 32,
  },
});
