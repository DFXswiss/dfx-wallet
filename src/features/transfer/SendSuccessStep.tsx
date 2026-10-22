import { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GlassSurface, Icon, PrimaryButton } from '@/components';
import { Layout, Radius, Spacing, Typography, useColors, type ThemeColors } from '@/theme';

const CHECK_SIZE = 96;
const CHECK_ICON_SIZE = 44;
const GLOW_SIZE = CHECK_SIZE + 20;

type Props = {
  /** Contact name or the shortened address, already resolved by the screen. */
  recipientLabel: string;
  /** The amount as typed, with its unit ("CHF 180"). */
  amountLabel: string;
  /** What the typed fiat amount is worth in the asset ("≈ 0.00295 BTC"); `null` for asset input. */
  equivalentLabel: string | null;
  /** Explorer link for the transaction, if the chain has one. */
  explorerUrl?: string;
  txHash: string | null;
  copiedHash: boolean;
  /** The recipient is not in the address book yet. */
  canSaveAddress: boolean;
  onSaveAddress: () => void;
  onCopyHash: () => void;
  onDone: () => void;
};

/**
 * Sent screen: the check circle carries the only glow of the flow, the amount
 * is the headline number. Content is centred in the space above the button.
 */
export function SendSuccessStep({
  recipientLabel,
  amountLabel,
  equivalentLabel,
  explorerUrl,
  txHash,
  copiedHash,
  canSaveAddress,
  onSaveAddress,
  onCopyHash,
  onDone,
}: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const hasTx = txHash !== null && txHash !== '';
  const txAction = explorerUrl ? (
    <Pressable
      onPress={() => void Linking.openURL(explorerUrl)}
      testID="send-view-tx"
      accessibilityRole="link"
    >
      <Text style={styles.metaLink}>{t('send.viewTransaction')}</Text>
    </Pressable>
  ) : (
    <Pressable onPress={onCopyHash} testID="send-copy-tx" accessibilityRole="button">
      <Text style={styles.metaLink}>{copiedHash ? t('common.copied') : t('send.copyHash')}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container} testID="send-success-step">
      <View style={styles.content}>
        <View style={styles.glow}>
          <View style={styles.check}>
            <Icon name="check" size={CHECK_ICON_SIZE} color={colors.white} strokeWidth={2.6} />
          </View>
        </View>
        <Text style={styles.title}>{t('send.onTheWayTo', { name: recipientLabel })}</Text>
        <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4}>
          {amountLabel}
        </Text>

        {(equivalentLabel !== null || hasTx) && (
          <GlassSurface variant="quiet" radius={Radius.sm} style={styles.meta}>
            {equivalentLabel !== null && <Text style={styles.metaText}>{equivalentLabel}</Text>}
            {equivalentLabel !== null && hasTx && <Text style={styles.metaText}> · </Text>}
            {hasTx && txAction}
          </GlassSurface>
        )}

        {canSaveAddress && (
          <Pressable
            onPress={onSaveAddress}
            testID="send-save-address"
            accessibilityRole="button"
            style={styles.saveAddress}
          >
            <Icon name="plus" size={16} color={colors.primary} />
            <Text style={styles.saveAddressText}>{t('send.saveAddress')}</Text>
          </Pressable>
        )}
      </View>

      <PrimaryButton testID="send-done-button" title={t('common.done')} onPress={onDone} />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: Layout.screenPadding,
      paddingBottom: Spacing.sm,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.base,
    },
    // The one glow of the whole flow: a soft halo ring around the check
    // circle plus a drop shadow, both in the success colour.
    glow: {
      width: GLOW_SIZE,
      height: GLOW_SIZE,
      borderRadius: GLOW_SIZE / 2,
      backgroundColor: colors.successGlow,
      alignItems: 'center',
      justifyContent: 'center',
    },
    check: {
      width: CHECK_SIZE,
      height: CHECK_SIZE,
      borderRadius: CHECK_SIZE / 2,
      backgroundColor: colors.success,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.success,
      shadowOpacity: 0.4,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 8,
    },
    title: {
      ...Typography.bodyLarge,
      fontWeight: '700',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    amount: {
      ...Typography.displayLarge,
      color: colors.text,
      alignSelf: 'stretch',
      textAlign: 'center',
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.base,
    },
    metaText: {
      ...Typography.bodySmall,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    metaLink: {
      ...Typography.bodySmall,
      fontWeight: '700',
      color: colors.primary,
    },
    saveAddress: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
    },
    saveAddressText: {
      ...Typography.bodyMedium,
      fontWeight: '600',
      color: colors.primary,
    },
  });
