import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import {
  formatCryptoAmount as fmtCrypto,
  formatFiat as fmtFiat,
} from '@/config/portfolio-presentation';
import { useColors, type ThemeColors } from '@/theme';
import type { FeeDto } from '@/features/dfx-backend/services/dto';

export type MobileTradeMode = 'buy' | 'sell' | 'swap';

export type MobileTradeQuote = {
  amount: number;
  estimatedAmount: number;
  exchangeRate: number;
  rate?: number;
  isValid?: boolean;
  fees?: FeeDto;
  feesTarget?: FeeDto;
};

type Props = {
  mode: MobileTradeMode;
  quote: MobileTradeQuote | null;
  payAssetCode: string;
  receiveAssetCode: string;
  currencyCode: string;
  expanded: boolean;
  onToggle: () => void;
  testID: string;
  statusMessage?: string | null;
};

export function MobileFeesPanel({
  mode,
  quote,
  payAssetCode,
  receiveAssetCode,
  currencyCode,
  expanded,
  onToggle,
  testID,
  statusMessage,
}: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = makeStyles(colors);
  const valid = !!quote && quote.isValid !== false && !!quote.fees;
  const fees = valid ? (mode === 'sell' ? (quote!.feesTarget ?? quote!.fees) : quote!.fees) : null;
  const hasRate = valid && typeof quote!.rate === 'number' && quote!.rate > 0;
  const summary =
    valid && hasRate
      ? summaryRate(
          mode,
          quote!,
          payAssetCode,
          receiveAssetCode,
          currencyCode,
          t('common.inclFees'),
        )
      : '—';

  const formatFee = (value: number) =>
    mode === 'swap' ? `${fmtCrypto(value)} ${payAssetCode}` : `${fmtFiat(value)} ${currencyCode}`;
  const payValue = valid
    ? mode === 'buy'
      ? `${fmtFiat(quote!.amount)} ${currencyCode}`
      : `${fmtCrypto(quote!.amount)} ${payAssetCode}`
    : '—';
  const receiveValue = valid
    ? mode === 'sell'
      ? `${fmtFiat(quote!.estimatedAmount)} ${currencyCode}`
      : `${fmtCrypto(quote!.estimatedAmount)} ${receiveAssetCode}`
    : '—';
  const dfxLabel = `${mode === 'buy' ? t('buy.feeDfx') : mode === 'sell' ? t('sell.feeDfx') : t('buy.feeDfx')}${fees?.rate ? ` · ${(fees.rate * 100).toFixed(2)}%` : ''}`;

  return (
    <View style={styles.card} testID={testID}>
      <Pressable style={styles.summaryRow} onPress={onToggle} accessibilityRole="button">
        <Icon name="shield" size={18} color={colors.primary} />
        <Text style={styles.summaryText} numberOfLines={2}>
          {summary}
        </Text>
        <Text style={styles.badge}>{valid ? formatFee(fees!.total) : '—'}</Text>
        <View style={expanded ? styles.open : undefined}>
          <Icon name="chevron-right" size={16} color={colors.textTertiary} />
        </View>
      </Pressable>
      {expanded && (valid || statusMessage) ? (
        <View style={styles.body}>
          {statusMessage ? <Text style={styles.status}>{statusMessage}</Text> : null}
          {valid ? (
            <>
              <FeeRow label={t('buy.youPay')} value={payValue} styles={styles} />
              <FeeRow label={dfxLabel} value={`−${formatFee(fees!.dfx)}`} styles={styles} />
              {mode !== 'swap' && (fees!.bank > 0 || mode === 'sell') ? (
                <FeeRow
                  label={mode === 'buy' ? t('buy.feeBank') : t('sell.feeBank')}
                  value={fees!.bank > 0 ? `−${formatFee(fees!.bank)}` : t('common.free')}
                  positive={!fees!.bank}
                  styles={styles}
                />
              ) : null}
              <FeeRow
                label={
                  mode === 'buy'
                    ? t('buy.feeNetwork')
                    : mode === 'sell'
                      ? t('sell.feeNetwork')
                      : t('buy.feeNetwork')
                }
                value={fees!.network > 0 ? `−${formatFee(fees!.network)}` : t('common.included')}
                positive={!fees!.network}
                styles={styles}
              />
              <FeeRow
                label={
                  mode === 'buy'
                    ? t('buy.feeTotal')
                    : mode === 'sell'
                      ? t('sell.feeTotal')
                      : t('buy.feeTotal')
                }
                value={`−${formatFee(fees!.total)}`}
                styles={styles}
              />
              <FeeRow
                label={
                  mode === 'buy'
                    ? t('buy.exchangeRate')
                    : mode === 'sell'
                      ? t('sell.exchangeRate')
                      : t('buy.exchangeRate')
                }
                value={rateValue(mode, quote!, payAssetCode, receiveAssetCode)}
                styles={styles}
              />
              <FeeRow
                label={
                  mode === 'buy'
                    ? t('buy.youReceive')
                    : mode === 'sell'
                      ? t('sell.youReceive')
                      : t('buy.youReceive')
                }
                value={receiveValue}
                emphasis
                styles={styles}
              />
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function summaryRate(
  mode: MobileTradeMode,
  quote: MobileTradeQuote,
  pay: string,
  receive: string,
  currency: string,
  qualifier: string,
) {
  const rate = quote.rate!;
  if (mode === 'buy') return `1 ${receive} ≈ ${fmtFiat(rate)} ${currency} (${qualifier})`;
  if (mode === 'sell') return `1 ${pay} ≈ ${fmtFiat(1 / rate)} ${currency} (${qualifier})`;
  return `1 ${pay} ≈ ${fmtCrypto(1 / rate)} ${receive} (${qualifier})`;
}

function rateValue(mode: MobileTradeMode, quote: MobileTradeQuote, pay: string, receive: string) {
  if (!quote.exchangeRate) return '—';
  if (mode === 'buy') return `${fmtFiat(quote.exchangeRate)} / ${receive}`;
  if (mode === 'sell') return `${fmtFiat(1 / quote.exchangeRate)} / ${pay}`;
  return `${fmtCrypto(1 / quote.exchangeRate)} ${receive} / ${pay}`;
}

function FeeRow({
  label,
  value,
  emphasis,
  positive,
  styles,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  positive?: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, emphasis && styles.emphasis, positive && styles.positive]}>
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.cardOverlay,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
    summaryText: {
      flex: 1,
      ...StyleSheet.flatten({ fontSize: 14, color: colors.text, fontWeight: '500' }),
    },
    badge: {
      fontSize: 11,
      color: colors.primary,
      backgroundColor: colors.primaryLight,
      fontWeight: '700',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 7,
    },
    open: { transform: [{ rotate: '90deg' }] },
    body: {
      padding: 14,
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
    },
    label: { fontSize: 14, color: colors.textSecondary },
    value: {
      flexShrink: 1,
      fontSize: 14,
      color: colors.text,
      fontWeight: '500',
      textAlign: 'right',
    },
    emphasis: { fontWeight: '700' },
    positive: { color: colors.success },
    status: { fontSize: 14, color: colors.textSecondary },
  });
