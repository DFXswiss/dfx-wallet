import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GlassCard, PrimaryButton } from '@/components';
import { Layout, Spacing, Typography, useColors, type ThemeColors } from '@/theme';

type Row = {
  key: string;
  label: string;
  value: string;
};

type Props = {
  rows: Row[];
  error: string | null;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Confirm step: the summary rows (recipient, network, amount, typed fiat
 * value, fee) on one glass card, the irreversibility note and the two
 * buttons. The screen builds the rows so this component stays presentational.
 */
export function SendConfirmStep({ rows, error, isLoading, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container} testID="send-confirm-step">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t('send.confirmTransaction')}</Text>

        <GlassCard padding={Spacing.lg} contentStyle={styles.summary}>
          {rows.map((row) => (
            <View key={row.key} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{row.label}</Text>
              <Text
                style={styles.summaryValue}
                numberOfLines={1}
                testID={`send-confirm-${row.key}`}
              >
                {row.value}
              </Text>
            </View>
          ))}
        </GlassCard>

        <Text style={styles.warning}>{t('send.irreversible')}</Text>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      <View style={styles.actions}>
        <PrimaryButton
          testID="send-confirm-button"
          title={t('common.confirm')}
          onPress={onConfirm}
          loading={isLoading}
        />
        <PrimaryButton
          testID="send-cancel-button"
          title={t('common.cancel')}
          variant="outlined"
          onPress={onCancel}
        />
      </View>
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
    scroll: {
      flex: 1,
    },
    content: {
      gap: Layout.screenPadding,
      paddingTop: Spacing.base,
    },
    title: {
      ...Typography.headlineMedium,
      color: colors.text,
    },
    summary: {
      gap: Spacing.base,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: Spacing.base,
    },
    summaryLabel: {
      ...Typography.bodyMedium,
      color: colors.textTertiary,
    },
    summaryValue: {
      ...Typography.bodyMedium,
      fontWeight: '600',
      color: colors.text,
      flexShrink: 1,
      textAlign: 'right',
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
    actions: {
      gap: Spacing.md,
      paddingTop: Spacing.base,
    },
  });
