import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppHeader, DfxBackgroundScreen, GlassInputField, PrimaryButton } from '@/components';
import { DfxAuthGate } from '@/features/dfx-backend/DfxAuthGate';
import {
  dfxPaymentService,
  interpretDfxAuthError,
  type DfxAuthGateState,
} from '@/features/dfx-backend/services';
import { isIban } from '@/features/transfer/address';
import { useAuthStore } from '@/store';
import { Spacing, Typography, useColors, type ThemeColors } from '@/theme';

type SaveParams = {
  iban: string;
  label?: string;
};

export default function AddBankAccountScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isDfxAuthenticated = useAuthStore((state) => state.isDfxAuthenticated);
  const [iban, setIban] = useState('');
  const [label, setLabel] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [authGate, setAuthGate] = useState<DfxAuthGateState | null>(null);
  const [saveError, setSaveError] = useState(false);
  const lastSave = useRef<SaveParams | null>(null);

  const save = useCallback(
    async (params: SaveParams) => {
      lastSave.current = params;
      setIsSaving(true);
      setAuthGate(null);
      setSaveError(false);
      try {
        await dfxPaymentService.createBankAccount(params.iban, params.label);
        router.back();
      } catch (error) {
        const gate = interpretDfxAuthError(error);
        if (gate) setAuthGate(gate);
        else setSaveError(true);
      } finally {
        setIsSaving(false);
      }
    },
    [router],
  );

  const retryLast = useCallback(async () => {
    if (lastSave.current) await save(lastSave.current);
  }, [save]);

  useFocusEffect(
    useCallback(() => {
      if (isDfxAuthenticated) void retryLast();
    }, [isDfxAuthenticated, retryLast]),
  );

  const compactIban = iban.replace(/\s/g, '');

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <DfxBackgroundScreen scrollable contentStyle={styles.screen} testID="add-bank-account-screen">
        <AppHeader title={t('send.accountBankAdd')} testID="add-bank-account" />

        <View style={styles.content}>
          <Text style={styles.intro}>{t('bankAccounts.addIntro')}</Text>

          <View style={styles.field}>
            <Text style={styles.label}>{t('bankAccounts.iban')}</Text>
            <GlassInputField
              value={iban}
              onChangeText={setIban}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.ibanInput}
              testID="bank-account-iban"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('bankAccounts.label')}</Text>
            <GlassInputField
              value={label}
              onChangeText={setLabel}
              placeholder={t('bankAccounts.labelPlaceholder')}
              testID="bank-account-label"
            />
          </View>

          {saveError ? (
            <Text style={styles.error} testID="bank-account-error">
              {t('bankAccounts.saveError')}
            </Text>
          ) : null}

          <View style={styles.spacer} />

          <PrimaryButton
            title={t('common.save')}
            onPress={() => {
              void save({ iban: compactIban, ...(label ? { label } : {}) });
            }}
            disabled={!isIban(iban)}
            loading={isSaving}
            testID="bank-account-save"
          />
        </View>
      </DfxBackgroundScreen>

      <DfxAuthGate
        gate={authGate}
        onClose={() => {
          setAuthGate(null);
        }}
      />
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      paddingBottom: Spacing.xxl,
    },
    content: {
      flex: 1,
      gap: Spacing.base,
      paddingTop: Spacing.base,
    },
    intro: {
      ...Typography.bodyLarge,
      color: colors.textSecondary,
      marginBottom: Spacing.sm,
    },
    field: {
      gap: Spacing.sm,
    },
    label: {
      ...Typography.bodyMedium,
      fontWeight: '600',
      color: colors.text,
    },
    ibanInput: {
      ...Typography.monoLarge,
      letterSpacing: 1,
    },
    error: {
      ...Typography.bodyMedium,
      color: colors.error,
    },
    spacer: {
      flex: 1,
      minHeight: Spacing.xl,
    },
  });
