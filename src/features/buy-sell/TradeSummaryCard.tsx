import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components';
import { useColors } from '@/theme';
import { makeTradeSharedStyles } from './tradeSharedStyles';

type CopyRowProps = {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  highlight?: boolean;
};

/**
 * One copyable field in the payment/bank-details card (IBAN, BIC, deposit
 * address, …). Shared by Buy's payment step and Sell's confirm step — the
 * two previously kept byte-identical local copies.
 */
export function CopyRow({ label, value, copied, onCopy, highlight }: CopyRowProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useMemo(() => makeTradeSharedStyles(colors), [colors]);

  return (
    <Pressable
      style={({ pressed }) => [styles.copyRow, pressed && styles.pressed]}
      onPress={onCopy}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.copyLabel}>{label}</Text>
        <Text
          style={[styles.copyValue, highlight && styles.copyValueHighlight]}
          numberOfLines={1}
          selectable
        >
          {value}
        </Text>
      </View>
      <View style={styles.copyBadge}>
        <Icon name="document" size={14} color={colors.primary} />
        <Text style={styles.copyBadgeText}>{copied ? t('common.copied') : t('common.copy')}</Text>
      </View>
    </Pressable>
  );
}

type QuoteRowProps = {
  label: string;
  value: string;
  sub?: string;
  emphasis?: boolean;
  accent?: boolean;
};

/** One row in the quote-summary card (amount, rate, total received, …). */
export function QuoteRow({ label, value, sub, emphasis, accent }: QuoteRowProps) {
  const colors = useColors();
  const styles = useMemo(() => makeTradeSharedStyles(colors), [colors]);

  return (
    <View style={styles.quoteRow}>
      <Text style={styles.quoteLabel}>{label}</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text
          style={[
            styles.quoteValue,
            emphasis && styles.quoteValueEmphasis,
            accent && styles.quoteValueAccent,
          ]}
        >
          {value}
        </Text>
        {sub ? <Text style={styles.quoteSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}
