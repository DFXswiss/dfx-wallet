import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppHeader, Icon, ScreenContainer } from '@/components';
import { useDfxAuth } from '@/hooks';
import { DfxApiError, dfxUserService } from '@/services/dfx';
import { DfxColors, Typography } from '@/theme';

/**
 * Read-only user-data page mirroring realunit-app's
 * `settings_user_data_page.dart`:
 *
 * - Shows the fields DFX exposes via /v2/user (email, phone) as plain
 *   rows instead of an inline edit form.
 * - Each editable field has a small edit button that hands off to the
 *   KYC flow's ContactData step — that's where DFX actually accepts
 *   changes via /v1/kyc/contact-data + email-confirmation otp.
 * - When the JWT points to a merged-away user, /v2/user returns 403
 *   "User is merged" and we surface the same one-tap re-auth CTA the
 *   Wallets and KYC screens use.
 *
 * Title stays "E-Mail" because it remains the primary entry point users
 * tap from Settings; the screen itself is the user-data summary.
 */
export default function UserDataScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [mail, setMail] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [isMergedState, setIsMergedState] = useState(false);
  const { reauthenticateAsOwner, isAuthenticating, error: authError } = useDfxAuth();

  const loadUser = useCallback(async () => {
    setLoadingUser(true);
    setIsMergedState(false);
    try {
      const user = await dfxUserService.getUser();
      setMail(user.mail);
      setPhone(user.phone);
    } catch (err) {
      if (err instanceof DfxApiError && /user is merged/i.test(err.message)) {
        setIsMergedState(true);
      }
      setMail(null);
      setPhone(null);
    } finally {
      setLoadingUser(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const reauthenticate = useCallback(async () => {
    try {
      await reauthenticateAsOwner();
      await loadUser();
    } catch {
      // Surfaced via authError below.
    }
  }, [reauthenticateAsOwner, loadUser]);

  const editInKyc = () => {
    // KYC has the actual ContactData / phone update steps. We hand off
    // there instead of building a parallel input form.
    router.push('/(auth)/kyc');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <ScreenContainer scrollable testID="email-screen">
        <AppHeader title={t('email.title')} testID="email" />

        <View style={styles.content}>
          {loadingUser ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={DfxColors.primary} />
            </View>
          ) : isMergedState ? (
            <View style={styles.mergedCard}>
              <Text style={styles.mergedText}>{t('wallets.mergedExplanation')}</Text>
              <Pressable
                style={({ pressed }) => [styles.reauthBtn, pressed && styles.pressed]}
                onPress={() => {
                  void reauthenticate();
                }}
                disabled={isAuthenticating}
                testID="email-reauth"
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
            <>
              <UserDataRow
                label={t('email.currentLabel')}
                value={mail ?? t('email.notSet')}
                onEdit={editInKyc}
                editTestID="email-edit"
              />
              <UserDataRow
                label={t('email.phoneLabel')}
                value={phone ?? t('email.notSet')}
                onEdit={editInKyc}
                editTestID="email-edit-phone"
              />
            </>
          )}
        </View>
      </ScreenContainer>
    </>
  );
}

type UserDataRowProps = {
  label: string;
  value: string;
  onEdit?: () => void;
  editTestID?: string;
};

function UserDataRow({ label, value, onEdit, editTestID }: UserDataRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
      {onEdit ? (
        <Pressable
          style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
          onPress={onEdit}
          testID={editTestID}
          accessibilityLabel="Edit"
        >
          <Icon name="document" size={18} color={DfxColors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 16,
    paddingBottom: 32,
    gap: 16,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DfxColors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowLabel: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: DfxColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  rowValue: {
    ...Typography.bodyLarge,
    color: DfxColors.text,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DfxColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  mergedCard: {
    backgroundColor: DfxColors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  mergedText: {
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
  errorText: {
    ...Typography.bodySmall,
    color: DfxColors.error,
    textAlign: 'center',
  },
});
