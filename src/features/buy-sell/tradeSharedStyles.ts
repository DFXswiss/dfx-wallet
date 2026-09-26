import { StyleSheet } from 'react-native';
import { Typography, type ThemeColors } from '@/theme';

/**
 * Styles shared by the post-amount steps of Buy and Sell (payment/bank
 * details, quote summary, target-wallet banner). Buy and Sell used to keep
 * separate copies that drifted apart — e.g. Buy's `copyRow` had a
 * `borderBottomWidth` divider between rows, Sell's didn't. The Buy variant
 * is kept as canonical (see AUFTRAG report for the full list of decided
 * differences); Sell's rows now render the same divider.
 */
export const makeTradeSharedStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    bankCard: {
      backgroundColor: colors.cardOverlay,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 4,
    },
    copyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    copyLabel: {
      ...Typography.bodySmall,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    copyValue: {
      ...Typography.bodyMedium,
      color: colors.text,
      fontFamily: 'monospace',
    },
    copyValueHighlight: {
      color: colors.primary,
      fontWeight: '700',
    },
    copyBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: colors.primaryLight,
      borderRadius: 999,
    },
    copyBadgeText: {
      ...Typography.bodySmall,
      color: colors.primary,
      fontWeight: '600',
    },
    pressed: {
      opacity: 0.7,
    },
    quoteCard: {
      backgroundColor: colors.cardOverlay,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 14,
    },
    quoteTitle: {
      ...Typography.bodySmall,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    quoteRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
    },
    quoteLabel: {
      ...Typography.bodyMedium,
      color: colors.textSecondary,
    },
    quoteValue: {
      ...Typography.bodyMedium,
      color: colors.text,
      fontWeight: '500',
      textAlign: 'right',
    },
    quoteValueEmphasis: {
      fontWeight: '700',
    },
    quoteValueAccent: {
      color: colors.primary,
    },
    quoteSub: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
      textAlign: 'right',
      marginTop: 2,
    },
    quoteDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
    targetBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.cardOverlay,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    targetIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    targetBody: {
      flex: 1,
      gap: 2,
    },
    targetLabel: {
      ...Typography.bodySmall,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    targetAddress: {
      ...Typography.bodyMedium,
      fontWeight: '600',
      color: colors.text,
      fontFamily: 'monospace',
    },
    hint: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
      textAlign: 'center',
      paddingHorizontal: 16,
    },
    warning: {
      ...Typography.bodySmall,
      color: colors.warning,
      textAlign: 'center',
    },
    errorText: {
      ...Typography.bodySmall,
      color: colors.error,
      textAlign: 'center',
    },
    spacer: {
      minHeight: 16,
    },
    securityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      marginTop: 12,
    },
    securityText: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
      textAlign: 'center',
    },
  });

export type TradeSharedStyles = ReturnType<typeof makeTradeSharedStyles>;
