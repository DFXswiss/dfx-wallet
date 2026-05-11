import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppHeader, PrimaryButton, ScreenContainer } from '@/components';
import { useDfxAuth, useKycFlow } from '@/hooks';
import { isAllowedDfxHost, isSafeHttpsUrl } from '@/services/security/safe-url';
import { DfxColors, Typography } from '@/theme';

/**
 * Try the in-app WebView for KYC URLs whose host is on the DFX-vetted
 * allow-list (Sumsub, IDnow, lightning.space and DFX itself). Anything
 * outside that list still goes through the OS browser. Keeping the
 * verification inside the app means the user comes back to the same
 * screen with state preserved instead of being yanked to Safari mid-
 * flow.
 *
 * Any non-https or malformed URL is dropped — KYC redirects come from
 * the DFX backend and a non-https value here is either a backend
 * mistake or a tampered response.
 */
async function openKycUrl(url: string, openInApp: (u: string) => void): Promise<void> {
  if (!isSafeHttpsUrl(url)) return;
  try {
    const host = new URL(url).host;
    if (isAllowedDfxHost(host)) {
      openInApp(url);
      return;
    }
  } catch {
    // Malformed URL — fall through to the OS-handler which will silently
    // reject it anyway. We don't want to bail entirely because the user
    // is mid-flow.
  }
  await Linking.openURL(url);
}

const STEP_LABELS: Record<string, string> = {
  ContactData: 'Contact',
  PersonalData: 'Personal Data',
  NationalityData: 'Nationality',
  FinancialData: 'Financial Info',
  Ident: 'Identity Check',
};

const STATUS_COLORS: Record<string, string> = {
  Completed: DfxColors.success,
  InProgress: DfxColors.warning,
  InReview: DfxColors.info,
  Failed: DfxColors.error,
  NotStarted: DfxColors.textTertiary,
  // DFX returns this when a step that was already done is asking for a
  // periodic refresh (e.g. Ident expired after N months). The user
  // historically passed it — coloring it grey-tertiary to signal
  // "renewal pending, no action blocked yet".
  Outdated: DfxColors.textTertiary,
};

/**
 * Map DFX' raw step status to a user-facing key. The raw values
 * (`InProgress`, `Outdated`, `InReview`) confuse non-technical users —
 * especially at Level 50, where DFX shows `InProgress` for renewal
 * cycles that don't actually un-verify the user. Any step that the
 * server will accept again later is labelled "Auffrischung" (renewal)
 * rather than "in progress".
 */
function statusLabelKey(status: string, overallLevel: number): string {
  // At Level 50 the user is fully verified — InProgress/Outdated steps
  // are renewal cycles, not pending verifications.
  const isRenewal = overallLevel >= 50 && (status === 'InProgress' || status === 'Outdated');
  if (isRenewal) return 'kyc.status.renewal';
  return `kyc.status.${status.charAt(0).toLowerCase() + status.slice(1)}`;
}

/**
 * Level-tier descriptions mirror DFX' KYC scheme (`KycLevel` 0–50, plus
 * the negative terminated/rejected states). The labels are localised; the
 * limits below come from DFX' published policy and stay in sync with what
 * the realunit-app surfaces. Numeric value 10 = anonymous wallet sign-in
 * with no contact data; each step (email → personal → nationality →
 * financial → ident) bumps the level by 10.
 */
type KycTier = {
  threshold: number;
  titleKey: string;
  bodyKey: string;
};
const KYC_TIERS: KycTier[] = [
  { threshold: 0, titleKey: 'kyc.level.0.title', bodyKey: 'kyc.level.0.body' },
  { threshold: 10, titleKey: 'kyc.level.10.title', bodyKey: 'kyc.level.10.body' },
  { threshold: 20, titleKey: 'kyc.level.20.title', bodyKey: 'kyc.level.20.body' },
  { threshold: 30, titleKey: 'kyc.level.30.title', bodyKey: 'kyc.level.30.body' },
  { threshold: 40, titleKey: 'kyc.level.40.title', bodyKey: 'kyc.level.40.body' },
  { threshold: 50, titleKey: 'kyc.level.50.title', bodyKey: 'kyc.level.50.body' },
];

function isMergedError(err: string | null | undefined): boolean {
  return !!err && /user is merged/i.test(err);
}

export default function KycScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    kycLevel,
    currentSession,
    isLoading,
    error,
    loadKycStatus,
    continueKyc,
    submitContactData,
    submitPersonalData,
    request2fa,
    verify2fa,
  } = useKycFlow();

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [tfaCode, setTfaCode] = useState('');
  const [tfaRequested, setTfaRequested] = useState(false);

  const { reauthenticateAsOwner, isAuthenticating, error: authError } = useDfxAuth();

  const openInAppWebView = useCallback(
    (url: string) => {
      router.push({
        pathname: '/(auth)/webview',
        params: { url, title: t('kyc.title') },
      });
    },
    [router, t],
  );

  useEffect(() => {
    void loadKycStatus();
  }, [loadKycStatus]);

  const reauthenticate = useCallback(async () => {
    try {
      await reauthenticateAsOwner();
      await loadKycStatus();
    } catch {
      // Surfaced via authError below.
    }
  }, [reauthenticateAsOwner, loadKycStatus]);

  const handleContinue = async () => {
    const session = await continueKyc();
    if (session?.currentStep?.session) {
      const { type, url } = session.currentStep.session;
      if (type === 'Browser') {
        // Prefer the bundled WebView when the URL points at a DFX-vetted
        // KYC provider (Sumsub, IDnow). Falls through to the OS browser
        // for anything else so we never silently swallow a malformed or
        // unexpected destination.
        await openKycUrl(url, openInAppWebView);
      }
    }
  };

  const handleSubmitStep = async () => {
    const step = currentSession?.currentStep;
    if (!step) return;

    let success = false;
    if (step.name === 'ContactData') {
      success = await submitContactData(step.sequenceNumber, email);
    } else if (step.name === 'PersonalData') {
      const phoneTrimmed = phone.trim();
      success = await submitPersonalData(step.sequenceNumber, {
        firstName,
        lastName,
        ...(phoneTrimmed.length > 0 ? { phone: phoneTrimmed } : {}),
      });
    }

    if (success) {
      // After an API step is submitted, immediately advance — the next
      // step (Browser/Ident or another API form) shows up without the
      // user having to tap Continue again.
      await continueKyc();
    }
  };

  const handle2faRequest = async () => {
    const ok = await request2fa();
    if (ok) setTfaRequested(true);
  };

  const handle2faVerify = async () => {
    const ok = await verify2fa(tfaCode.trim());
    if (ok) {
      setTfaCode('');
      setTfaRequested(false);
      await continueKyc();
    }
  };

  const isMerged = isMergedError(error);

  if (isLoading && !kycLevel) {
    return (
      <ScreenContainer>
        <AppHeader title={t('kyc.title')} testID="kyc-screen" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DfxColors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  const steps = kycLevel?.kycSteps ?? [];
  const currentStep = currentSession?.currentStep;
  const currentLevel = kycLevel?.kycLevel ?? 0;
  const matchingTier =
    KYC_TIERS.slice()
      .reverse()
      .find((tier) => currentLevel >= tier.threshold) ?? KYC_TIERS[0]!;

  return (
    <ScreenContainer scrollable>
      <AppHeader title={t('kyc.title')} testID="kyc-screen" />

      <View style={styles.content}>
        {/*
         * Merged-state recovery — when /v2/user returned 403 "User is
         * merged", we cannot trust `kycLevel` (the JWT points to the
         * merged-away user, not the actual KYC-bearing one). Showing
         * "Level 0 / Anonym" then is a lie: the real level lives on the
         * merged-target account. Skip the level card entirely and just
         * surface the re-auth CTA — once the JWT rotates, the real level
         * comes through on the next loadKycStatus().
         */}
        {isMerged ? (
          <View style={styles.errorBlock}>
            <Text style={styles.mergedTitle}>{t('kyc.mergedTitle')}</Text>
            <Text style={styles.helperText}>{t('wallets.mergedExplanation')}</Text>
            <Pressable
              style={({ pressed }) => [styles.reauthBtn, pressed && styles.pressed]}
              onPress={() => {
                void reauthenticate();
              }}
              disabled={isAuthenticating}
              testID="kyc-reauth"
            >
              {isAuthenticating ? (
                <ActivityIndicator color={DfxColors.white} />
              ) : (
                <Text style={styles.reauthLabel}>{t('wallets.reauthCta')}</Text>
              )}
            </Pressable>
            {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
          </View>
        ) : (
          <View style={styles.levelCard}>
            <Text style={styles.levelLabel}>{t('kyc.currentLevel')}</Text>
            <Text style={styles.levelValue}>{currentLevel}</Text>
            <Text style={styles.tierTitle}>{t(matchingTier.titleKey)}</Text>
            <Text style={styles.tierBody}>{t(matchingTier.bodyKey)}</Text>
          </View>
        )}

        {/* Steps overview */}
        {!isMerged && steps.length > 0 ? (
          <View style={styles.stepsContainer}>
            <Text style={styles.sectionLabel}>{t('kyc.stepsLabel')}</Text>
            {steps.map((step) => (
              <View key={step.name} style={styles.stepRow}>
                <View
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor: STATUS_COLORS[step.status] ?? DfxColors.textTertiary,
                    },
                  ]}
                />
                <Text style={styles.stepName}>{STEP_LABELS[step.name] ?? step.name}</Text>
                <Text style={styles.stepStatus}>
                  {t([statusLabelKey(step.status, currentLevel), 'kyc.status.unknown'], {
                    raw: step.status,
                  })}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Current step form */}
        {!isMerged && currentStep?.session?.type === 'API' && (
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>
              {STEP_LABELS[currentStep.name] ?? currentStep.name}
            </Text>

            {currentStep.name === 'ContactData' && (
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email address"
                placeholderTextColor={DfxColors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            )}

            {currentStep.name === 'PersonalData' && (
              <>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder={t('kyc.firstName')}
                  placeholderTextColor={DfxColors.textTertiary}
                />
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder={t('kyc.lastName')}
                  placeholderTextColor={DfxColors.textTertiary}
                />
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder={t('kyc.phone')}
                  placeholderTextColor={DfxColors.textTertiary}
                  keyboardType="phone-pad"
                  autoCorrect={false}
                />
              </>
            )}

            <PrimaryButton
              title={t('common.submit')}
              onPress={handleSubmitStep}
              loading={isLoading}
              disabled={
                (currentStep.name === 'ContactData' && email.trim().length === 0) ||
                (currentStep.name === 'PersonalData' &&
                  (firstName.trim().length === 0 || lastName.trim().length === 0))
              }
            />
          </View>
        )}

        {/*
         * 2FA gate — DFX requires phone-OTP verification once before a
         * sensitive step (KycStepName === 'TfaSetup' on the backend). We
         * fold it into the same screen as a dedicated form so the user
         * doesn't get bounced to a Browser step for what's effectively a
         * 6-digit code entry.
         */}
        {!isMerged &&
          currentStep?.name === 'PhoneChange' &&
          currentStep.session?.type === 'API' && (
            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>{t('kyc.tfaTitle')}</Text>
              <Text style={styles.formDescription}>
                {tfaRequested ? t('kyc.tfaCodePrompt') : t('kyc.tfaDescription')}
              </Text>
              {tfaRequested ? (
                <>
                  <TextInput
                    style={styles.input}
                    value={tfaCode}
                    onChangeText={setTfaCode}
                    placeholder={t('kyc.tfaCodePlaceholder')}
                    placeholderTextColor={DfxColors.textTertiary}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <PrimaryButton
                    title={t('common.confirm')}
                    onPress={handle2faVerify}
                    disabled={tfaCode.trim().length < 4}
                    loading={isLoading}
                  />
                </>
              ) : (
                <PrimaryButton
                  title={t('kyc.tfaRequestCta')}
                  onPress={handle2faRequest}
                  loading={isLoading}
                />
              )}
            </View>
          )}

        {!isMerged && currentStep?.session?.type === 'Browser' && (
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>
              {STEP_LABELS[currentStep.name] ?? currentStep.name}
            </Text>
            <Text style={styles.formDescription}>
              This step requires identity verification in your browser.
            </Text>
            <PrimaryButton
              title={t('kyc.openVerification')}
              onPress={() => {
                void openKycUrl(currentStep.session!.url, openInAppWebView);
              }}
            />
          </View>
        )}

        {!isMerged && error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Continue button only when a step actually awaits user action.
         * At Level 50 the user is fully verified and DFX may flag
         * InProgress/Outdated as renewal — pushing them to "Continue
         * Verification" is a misleading nag. */}
        {!isMerged && !currentStep && steps.length > 0 && currentLevel < 50 && (
          <PrimaryButton
            title={t('kyc.continueCta')}
            onPress={handleContinue}
            loading={isLoading}
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 12,
    paddingBottom: 32,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelCard: {
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 4,
  },
  levelLabel: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  levelValue: {
    ...Typography.headlineLarge,
    color: DfxColors.primary,
    fontSize: 56,
    lineHeight: 64,
  },
  tierTitle: {
    ...Typography.bodyLarge,
    color: DfxColors.text,
    fontWeight: '700',
    marginTop: 4,
  },
  tierBody: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 8,
    lineHeight: 20,
  },
  sectionLabel: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
    marginBottom: 8,
  },
  stepsContainer: {
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    padding: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stepName: {
    flex: 1,
    ...Typography.bodyMedium,
    color: DfxColors.text,
  },
  stepStatus: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
  },
  formContainer: {
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  formTitle: {
    ...Typography.bodyLarge,
    color: DfxColors.text,
    fontWeight: '600',
  },
  formDescription: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    lineHeight: 20,
  },
  input: {
    backgroundColor: DfxColors.background,
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
  errorBlock: {
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  mergedTitle: {
    ...Typography.bodyLarge,
    color: DfxColors.text,
    fontWeight: '700',
  },
  helperText: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    lineHeight: 20,
  },
  reauthBtn: {
    backgroundColor: DfxColors.primary,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  reauthLabel: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: DfxColors.white,
  },
  pressed: { opacity: 0.7 },
});
