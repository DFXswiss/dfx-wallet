import { useState, useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import {
  AppHeader,
  GlassCard,
  GlassInputField,
  GlassPill,
  Icon,
  PrimaryButton,
  ScreenBackdrop,
} from '@/components';
import { useMultiSigStore } from './store';
import { Radius, Typography, useColors, type ThemeColors } from '@/theme';

type Step = 'intro' | 'concept' | 'quorum' | 'cosigners' | 'backup' | 'success';

type Quorum = { required: number; total: number };

const QUORUM_OPTIONS: Quorum[] = [
  { required: 2, total: 3 },
  { required: 2, total: 2 },
  { required: 3, total: 5 },
];

const CUSTOM_IDX = -1;
const MIN_TOTAL = 2;
const MAX_TOTAL = 9;

export default function MultiSigSetupScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { t } = useTranslation();
  const addVault = useMultiSigStore((s) => s.addVault);
  const [step, setStep] = useState<Step>('intro');
  const [quorumIdx, setQuorumIdx] = useState<number>(0);
  const [customRequired, setCustomRequired] = useState(2);
  const [customTotal, setCustomTotal] = useState(4);
  const [cosignerInputs, setCosignerInputs] = useState<string[]>([]);
  const [backupConfirmed, setBackupConfirmed] = useState(false);

  const isCustomQuorum = quorumIdx === CUSTOM_IDX;
  const quorum: Quorum = isCustomQuorum
    ? { required: customRequired, total: customTotal }
    : // eslint-disable-next-line security/detect-object-injection -- quorumIdx is bounded
      QUORUM_OPTIONS[quorumIdx]!;
  const requiredCosigners = Math.max(0, quorum.total - 1);
  const cosigners = Array.from(
    { length: requiredCosigners },
    // eslint-disable-next-line security/detect-object-injection -- bounded by Array.from length
    (_, i) => cosignerInputs[i] ?? '',
  );
  const cosignersValid = cosigners.every((c) => c.trim().length >= 26);

  const setCosignerAt = (idx: number, value: string) => {
    setCosignerInputs((prev) => {
      const next = prev.slice();
      while (next.length <= idx) next.push('');
      // eslint-disable-next-line security/detect-object-injection -- idx is bounded above
      next[idx] = value;
      return next;
    });
  };

  const updateCustomTotal = (next: number) => {
    setCustomTotal(next);
    if (customRequired > next) setCustomRequired(next);
  };

  const onBack = () => {
    if (step === 'success') {
      router.back();
      return;
    }
    const order: Step[] = ['intro', 'concept', 'quorum', 'cosigners', 'backup'];
    const idx = order.indexOf(step);
    if (idx > 0) setStep(order[idx - 1]!);
    else router.back();
  };

  const vaultName = isCustomQuorum
    ? t('multiSig.quorum.option_custom_title')
    : t(`multiSig.quorum.option_${quorum.required}_${quorum.total}_title`);

  const finish = () => {
    addVault({
      name: vaultName,
      required: quorum.required,
      total: quorum.total,
      cosigners: cosigners.map((address, i) => ({
        id: `c${i}-${Date.now()}`,
        address: address.trim(),
      })),
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStep('success');
  };

  const body = (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader title={t('multiSig.title')} onBack={onBack} testID="multi-sig" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'intro' && (
          <View style={styles.stepContent}>
            <View style={styles.heroCard}>
              <View style={styles.heroIcon}>
                <Icon name="shield" size={36} color={colors.primary} strokeWidth={2} />
              </View>
              <Text style={styles.heroTitle}>{t('multiSig.intro.title')}</Text>
              <Text style={styles.heroBody}>{t('multiSig.intro.body')}</Text>
            </View>
            <Bullet text={t('multiSig.intro.bullet1')} />
            <Bullet text={t('multiSig.intro.bullet2')} />
            <Bullet text={t('multiSig.intro.bullet3')} />
            <View style={styles.spacer} />
            <PrimaryButton title={t('multiSig.intro.cta')} onPress={() => setStep('concept')} />
          </View>
        )}

        {step === 'concept' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('multiSig.concept.title')}</Text>
            <Text style={styles.stepBody}>{t('multiSig.concept.body')}</Text>
            <GlassCard style={styles.analogyCard} testID="multi-sig-analogy-card">
              <Text style={styles.analogyEmoji}>{'🔐'}</Text>
              <Text style={styles.analogyTitle}>{t('multiSig.concept.analogyTitle')}</Text>
              <Text style={styles.analogyBody}>{t('multiSig.concept.analogyBody')}</Text>
            </GlassCard>

            <GlassCard style={styles.diagramCard} testID="multi-sig-diagram-card">
              <Text style={styles.diagramHeader}>{t('multiSig.concept.exampleTitle')}</Text>
              <View style={styles.diagramRow}>
                <DiagramSigner
                  label={t('multiSig.concept.diagramYou')}
                  status={t('multiSig.concept.diagramApproved')}
                  approved
                />
                <DiagramSigner
                  label={t('multiSig.concept.diagramPartner')}
                  status={t('multiSig.concept.diagramApproved')}
                  approved
                />
                <DiagramSigner
                  label={t('multiSig.concept.diagramBackup')}
                  status={t('multiSig.concept.diagramPending')}
                  approved={false}
                />
              </View>
              <View style={styles.diagramArrow}>
                <Icon name="arrow-down" size={20} color={colors.primary} />
              </View>
              <GlassCard
                variant="lead"
                style={styles.diagramResultCard}
                testID="multi-sig-diagram-result-card"
              >
                <View style={styles.diagramResultIcon}>
                  <Icon name="shield" size={20} color={colors.white} strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.diagramResultTitle}>
                    {t('multiSig.concept.diagramResult')}
                  </Text>
                  <Text style={styles.diagramResultBody}>
                    {t('multiSig.concept.diagramSubResult')}
                  </Text>
                </View>
              </GlassCard>
            </GlassCard>

            <Text style={styles.exampleCaption}>{t('multiSig.concept.exampleCaption')}</Text>
            <View style={styles.spacer} />
            <PrimaryButton title={t('multiSig.concept.cta')} onPress={() => setStep('quorum')} />
          </View>
        )}

        {step === 'quorum' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('multiSig.quorum.title')}</Text>
            <Text style={styles.stepBody}>{t('multiSig.quorum.body')}</Text>
            {QUORUM_OPTIONS.map((opt, i) => {
              const isActive = quorumIdx === i;
              return (
                <GlassPill
                  key={`${opt.required}-of-${opt.total}`}
                  shape="tile"
                  selected={isActive}
                  onPress={() => setQuorumIdx(i)}
                  contentStyle={styles.optionCard}
                  testID={`quorum-${opt.required}-${opt.total}`}
                >
                  <View style={styles.optionLead}>
                    <Text style={[styles.optionNum, isActive && styles.optionNumActive]}>
                      {opt.required}/{opt.total}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>
                      {t(`multiSig.quorum.option_${opt.required}_${opt.total}_title`)}
                    </Text>
                    <Text style={styles.optionDesc}>
                      {t(`multiSig.quorum.option_${opt.required}_${opt.total}_desc`)}
                    </Text>
                  </View>
                  {isActive ? <Icon name="shield" size={18} color={colors.primary} /> : null}
                </GlassPill>
              );
            })}

            <GlassPill
              shape="tile"
              selected={isCustomQuorum}
              onPress={() => setQuorumIdx(CUSTOM_IDX)}
              contentStyle={styles.optionCard}
              testID="quorum-custom"
            >
              <View style={styles.optionLead}>
                <Text style={[styles.optionNum, isCustomQuorum && styles.optionNumActive]}>
                  {customRequired}/{customTotal}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>{t('multiSig.quorum.option_custom_title')}</Text>
                <Text style={styles.optionDesc}>{t('multiSig.quorum.option_custom_desc')}</Text>
              </View>
              {isCustomQuorum ? <Icon name="shield" size={18} color={colors.primary} /> : null}
            </GlassPill>

            {isCustomQuorum && (
              <GlassCard
                variant="lead"
                tone="accent"
                style={styles.customCard}
                testID="multi-sig-custom-card"
              >
                <Stepper
                  label={t('multiSig.quorum.customTotalLabel')}
                  value={customTotal}
                  min={MIN_TOTAL}
                  max={MAX_TOTAL}
                  onChange={updateCustomTotal}
                  testID="quorum-custom-total"
                />
                <Stepper
                  label={t('multiSig.quorum.customRequiredLabel')}
                  value={customRequired}
                  min={1}
                  max={customTotal}
                  onChange={setCustomRequired}
                  testID="quorum-custom-required"
                />
                <Text style={styles.customSummary}>
                  {t('multiSig.quorum.customSummary', {
                    required: customRequired,
                    total: customTotal,
                  })}
                </Text>
              </GlassCard>
            )}

            <View style={styles.spacer} />
            <PrimaryButton title={t('common.continue')} onPress={() => setStep('cosigners')} />
          </View>
        )}

        {step === 'cosigners' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('multiSig.cosigners.title')}</Text>
            <Text style={styles.stepBody}>
              {t('multiSig.cosigners.body', { count: requiredCosigners })}
            </Text>

            <GlassCard
              variant="lead"
              tone="accent"
              style={styles.youCard}
              testID="multi-sig-you-card"
            >
              <View style={styles.youAvatar}>
                <Icon name="user" size={20} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.youLabel}>{t('multiSig.cosigners.youLabel')}</Text>
                <Text style={styles.youDesc}>{t('multiSig.cosigners.youDesc')}</Text>
              </View>
            </GlassCard>

            {Array.from({ length: requiredCosigners }).map((_, idx) => (
              <View key={idx} style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {t('multiSig.cosigners.cosignerLabel', { n: idx + 1 })}
                </Text>
                <GlassInputField
                  // eslint-disable-next-line security/detect-object-injection -- bounded by requiredCosigners
                  value={cosignerInputs[idx] ?? ''}
                  onChangeText={(v) => setCosignerAt(idx, v)}
                  placeholder={t('multiSig.cosigners.placeholder')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
              </View>
            ))}

            <Text style={styles.helperHint}>{t('multiSig.cosigners.hint')}</Text>

            <View style={styles.spacer} />
            <PrimaryButton
              title={t('common.continue')}
              onPress={() => setStep('backup')}
              disabled={!cosignersValid}
            />
          </View>
        )}

        {step === 'backup' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('multiSig.backup.title')}</Text>
            <Text style={styles.stepBody}>{t('multiSig.backup.body')}</Text>

            <GlassCard testID="multi-sig-checklist-card">
              <BackupItem
                icon="document"
                title={t('multiSig.backup.item1Title')}
                desc={t('multiSig.backup.item1Desc')}
              />
              <BackupItem
                icon="shield"
                title={t('multiSig.backup.item2Title')}
                desc={t('multiSig.backup.item2Desc')}
              />
              <BackupItem
                icon="user"
                title={t('multiSig.backup.item3Title')}
                desc={t('multiSig.backup.item3Desc')}
              />
            </GlassCard>

            <GlassCard
              variant={backupConfirmed ? 'lead' : 'default'}
              tone={backupConfirmed ? 'success' : 'default'}
              contentStyle={styles.confirmRow}
              onPress={() => setBackupConfirmed((v) => !v)}
              testID="multi-sig-confirm-backup"
            >
              <View style={[styles.checkbox, backupConfirmed && styles.checkboxActive]}>
                {backupConfirmed ? <Icon name="shield" size={14} color={colors.white} /> : null}
              </View>
              <Text style={styles.confirmText}>{t('multiSig.backup.confirm')}</Text>
            </GlassCard>

            <View style={styles.spacer} />
            <PrimaryButton
              title={t('multiSig.backup.cta')}
              onPress={() => {
                Alert.alert(
                  t('multiSig.backup.alertTitle'),
                  t('multiSig.backup.alertBody', {
                    required: quorum.required,
                    total: quorum.total,
                  }),
                  [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('multiSig.backup.cta'), onPress: finish },
                  ],
                );
              }}
              disabled={!backupConfirmed}
            />
          </View>
        )}

        {step === 'success' && (
          <View style={styles.stepContent}>
            <View style={styles.successIcon}>
              <Icon name="shield" size={64} color={colors.primary} strokeWidth={2} />
            </View>
            <Text style={styles.successTitle}>{t('multiSig.success.title')}</Text>
            <Text style={styles.successBody}>
              {t('multiSig.success.body', {
                required: quorum.required,
                total: quorum.total,
              })}
            </Text>
            <GlassCard style={styles.successCard} testID="multi-sig-success-card">
              <Text style={styles.successCardLabel}>{t('multiSig.success.nextLabel')}</Text>
              <Text style={styles.successCardBody}>{t('multiSig.success.nextBody')}</Text>
            </GlassCard>
            <View style={styles.spacer} />
            <PrimaryButton title={t('common.done')} onPress={() => router.back()} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <View style={styles.bg}>
        <ScreenBackdrop />
        {body}
      </View>
    </>
  );
}

function Bullet({ text }: { text: string }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.bullet}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  testID,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  testID?: string;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const decDisabled = value <= min;
  const incDisabled = value >= max;
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <GlassCard variant="quiet" padding={6} radius={Radius.sm} style={styles.stepperControls}>
        <Pressable
          style={[styles.stepperButton, decDisabled && styles.stepperButtonDisabled]}
          onPress={() => !decDisabled && onChange(value - 1)}
          disabled={decDisabled}
          accessibilityRole="button"
          testID={testID ? `${testID}-dec` : undefined}
        >
          <Text style={styles.stepperButtonText}>{'−'}</Text>
        </Pressable>
        <Text style={styles.stepperValue} testID={testID ? `${testID}-value` : undefined}>
          {value}
        </Text>
        <Pressable
          style={[styles.stepperButton, incDisabled && styles.stepperButtonDisabled]}
          onPress={() => !incDisabled && onChange(value + 1)}
          disabled={incDisabled}
          accessibilityRole="button"
          testID={testID ? `${testID}-inc` : undefined}
        >
          <Text style={styles.stepperButtonText}>{'+'}</Text>
        </Pressable>
      </GlassCard>
    </View>
  );
}

function DiagramSigner({
  label,
  status,
  approved,
}: {
  label: string;
  status: string;
  approved: boolean;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.diagramSigner}>
      <View style={[styles.diagramAvatar, approved && styles.diagramAvatarApproved]}>
        <Icon
          name="user"
          size={22}
          color={approved ? colors.white : colors.textTertiary}
          strokeWidth={2}
        />
        {approved ? (
          <View style={styles.diagramBadge}>
            <Text style={styles.diagramBadgeText}>{'✓'}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.diagramSignerLabel}>{label}</Text>
      <Text style={[styles.diagramSignerStatus, approved && styles.diagramSignerStatusApproved]}>
        {status}
      </Text>
    </View>
  );
}

function BackupItem({
  icon,
  title,
  desc,
}: {
  icon: 'document' | 'shield' | 'user';
  title: string;
  desc: string;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.checklistItem}>
      <View style={styles.checklistIcon}>
        <Icon name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.checklistTitle}>{title}</Text>
        <Text style={styles.checklistDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    bg: { flex: 1, backgroundColor: colors.background },
    safeArea: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 32, gap: 18 },
    stepContent: { gap: 18 },
    heroCard: {
      alignItems: 'center',
      gap: 12,
      paddingVertical: 24,
    },
    heroIcon: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTitle: {
      ...Typography.headlineMedium,
      color: colors.text,
      textAlign: 'center',
    },
    heroBody: {
      ...Typography.bodyLarge,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 8,
    },
    bullet: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
      paddingHorizontal: 4,
    },
    bulletDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
      marginTop: 8,
    },
    bulletText: {
      ...Typography.bodyMedium,
      color: colors.text,
      flex: 1,
      lineHeight: 22,
    },
    stepTitle: {
      ...Typography.headlineSmall,
      color: colors.text,
    },
    stepBody: {
      ...Typography.bodyLarge,
      color: colors.textSecondary,
      lineHeight: 24,
    },
    analogyCard: {
      gap: 8,
      alignItems: 'center',
    },
    analogyEmoji: { fontSize: 40 },
    analogyTitle: {
      ...Typography.bodyLarge,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    analogyBody: {
      ...Typography.bodyMedium,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    exampleCaption: {
      ...Typography.bodyMedium,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 8,
      lineHeight: 22,
    },
    diagramCard: {
      gap: 12,
    },
    diagramHeader: {
      ...Typography.bodySmall,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      textAlign: 'center',
    },
    diagramRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'flex-start',
      paddingTop: 4,
    },
    diagramSigner: {
      alignItems: 'center',
      gap: 6,
      flex: 1,
    },
    diagramAvatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.background,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    diagramAvatarApproved: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    diagramBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.success,
      borderWidth: 2,
      borderColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    diagramBadgeText: {
      color: colors.white,
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 14,
    },
    diagramSignerLabel: {
      ...Typography.bodySmall,
      fontWeight: '600',
      color: colors.text,
    },
    diagramSignerStatus: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
      fontSize: 11,
    },
    diagramSignerStatusApproved: {
      color: colors.success,
      fontWeight: '600',
    },
    diagramArrow: {
      alignItems: 'center',
      paddingVertical: 4,
    },
    diagramResultCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    diagramResultIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    diagramResultTitle: {
      ...Typography.bodyMedium,
      fontWeight: '700',
      color: colors.text,
    },
    diagramResultBody: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
      marginTop: 2,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    optionLead: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionNum: {
      ...Typography.bodyLarge,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    optionNumActive: {
      color: colors.primary,
    },
    optionTitle: {
      ...Typography.bodyLarge,
      fontWeight: '600',
      color: colors.text,
    },
    optionDesc: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
      marginTop: 2,
      lineHeight: 18,
    },
    customCard: {
      gap: 14,
    },
    stepperRow: { gap: 8 },
    stepperLabel: {
      ...Typography.bodySmall,
      fontWeight: '700',
      color: colors.text,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    stepperControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    stepperButton: {
      width: 44,
      height: 36,
      borderRadius: 8,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperButtonDisabled: {
      opacity: 0.35,
    },
    stepperButtonText: {
      fontSize: 22,
      fontWeight: '600',
      color: colors.primary,
      lineHeight: 26,
    },
    stepperValue: {
      ...Typography.headlineSmall,
      fontWeight: '700',
      color: colors.text,
      minWidth: 40,
      textAlign: 'center',
    },
    customSummary: {
      ...Typography.bodyMedium,
      color: colors.textSecondary,
      textAlign: 'center',
      fontWeight: '500',
    },
    youCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    youAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    youLabel: {
      ...Typography.bodyMedium,
      fontWeight: '600',
      color: colors.primary,
    },
    youDesc: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
    },
    inputGroup: { gap: 6 },
    inputLabel: {
      ...Typography.bodySmall,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    input: {
      fontFamily: 'monospace',
    },
    helperHint: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
      paddingHorizontal: 4,
      lineHeight: 18,
    },
    checklistItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: 14,
    },
    checklistIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checklistTitle: {
      ...Typography.bodyMedium,
      fontWeight: '600',
      color: colors.text,
    },
    checklistDesc: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
      marginTop: 2,
      lineHeight: 18,
    },
    confirmRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    confirmText: {
      ...Typography.bodyMedium,
      color: colors.text,
      flex: 1,
      lineHeight: 22,
    },
    successIcon: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginVertical: 24,
    },
    successTitle: {
      ...Typography.headlineMedium,
      color: colors.text,
      textAlign: 'center',
    },
    successBody: {
      ...Typography.bodyLarge,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    successCard: {
      gap: 6,
    },
    successCardLabel: {
      ...Typography.bodySmall,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    successCardBody: {
      ...Typography.bodyMedium,
      color: colors.text,
      lineHeight: 22,
    },
    spacer: { minHeight: 16 },
  });
