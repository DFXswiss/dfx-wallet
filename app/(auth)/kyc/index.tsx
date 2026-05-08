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
import { useTranslation } from 'react-i18next';
import { AppHeader, PrimaryButton, ScreenContainer } from '@/components';
import { useDfxAuth, useKycFlow } from '@/hooks';
import { isSafeHttpsUrl } from '@/services/security/safe-url';
import { DfxColors, Typography } from '@/theme';

/**
 * Hand a server-supplied URL to the OS only after we've verified it's a
 * proper https:// URL. Anything else (javascript:, data:, http:, malformed)
 * is dropped silently — KYC redirects come from the DFX backend and any
 * non-https value here is a backend mistake or a tampered response.
 */
async function openExternal(url: string): Promise<void> {
  if (!isSafeHttpsUrl(url)) return;
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
  const {
    kycLevel,
    currentSession,
    isLoading,
    error,
    loadKycStatus,
    continueKyc,
    submitContactData,
    submitPersonalData,
  } = useKycFlow();

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const { reauthenticateAsOwner, isAuthenticating, error: authError } = useDfxAuth();

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
        await openExternal(url);
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
      success = await submitPersonalData(step.sequenceNumber, { firstName, lastName });
    }

    if (success) {
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
                  placeholder="First name"
                  placeholderTextColor={DfxColors.textTertiary}
                />
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  placeholderTextColor={DfxColors.textTertiary}
                />
              </>
            )}

            <PrimaryButton title="Submit" onPress={handleSubmitStep} loading={isLoading} />
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
              title="Open Verification"
              onPress={() => {
                void openExternal(currentStep.session!.url);
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
