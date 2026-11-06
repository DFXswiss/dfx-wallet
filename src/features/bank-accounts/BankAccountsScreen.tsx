import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppHeader, DfxBackgroundScreen, GlassListGroup, GlassSurface, Icon } from '@/components';
import { maskIban } from '@/features/transfer/address';
import { useBankAccounts } from '@/features/transfer/useBankAccounts';
import { Radius, Spacing, Typography, useColors, type ThemeColors } from '@/theme';

const ACCOUNT_ICON_SIZE = 36;

export default function BankAccountsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const accounts = useBankAccounts();

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <DfxBackgroundScreen scrollable contentStyle={styles.screen} testID="bank-accounts-screen">
        <AppHeader title={t('bankAccounts.title')} testID="bank-accounts" />

        <View style={styles.content}>
          <GlassListGroup>
            {accounts.map((account) => (
              <GlassListGroup.Row
                key={account.id}
                style={styles.row}
                testID={`bank-accounts-row-${account.id}`}
              >
                <View style={styles.bankIcon}>
                  <Icon name="bank" size={18} color={colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.title}>{account.label ?? t('send.accountBank')}</Text>
                  <Text style={styles.iban}>{maskIban(account.iban)}</Text>
                </View>
              </GlassListGroup.Row>
            ))}
            <GlassListGroup.Row
              style={styles.row}
              onPress={() => router.push('/(auth)/bank-accounts/add')}
              accessibilityRole="button"
              accessibilityLabel={t('send.accountBankAdd')}
              testID="bank-accounts-add"
              last
            >
              <GlassSurface variant="quiet" radius={Radius.sm} style={styles.addIcon}>
                <Icon name="plus" size={18} color={colors.primary} />
              </GlassSurface>
              <Text style={styles.title}>{t('send.accountBankAdd')}</Text>
              <Icon name="chevron-right" size={18} color={colors.textTertiary} />
            </GlassListGroup.Row>
          </GlassListGroup>

          <Text style={styles.hint}>{t('bankAccounts.listHint')}</Text>
        </View>
      </DfxBackgroundScreen>
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      paddingBottom: Spacing.xxl,
    },
    content: {
      gap: Spacing.md,
      paddingTop: Spacing.base,
    },
    row: {
      minHeight: ACCOUNT_ICON_SIZE + 2 * Spacing.md,
      paddingVertical: Spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    bankIcon: {
      width: ACCOUNT_ICON_SIZE,
      height: ACCOUNT_ICON_SIZE,
      borderRadius: Radius.sm,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addIcon: {
      width: ACCOUNT_ICON_SIZE,
      height: ACCOUNT_ICON_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    title: {
      flex: 1,
      ...Typography.bodyLarge,
      fontWeight: '600',
      color: colors.text,
    },
    iban: {
      ...Typography.mono,
      color: colors.textSecondary,
    },
    hint: {
      ...Typography.bodyMedium,
      color: colors.textSecondary,
    },
  });
