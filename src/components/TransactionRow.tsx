import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import { computeFiatValue } from '@/config/portfolio-presentation';
import { getCanonicalForSymbol } from '@/config/tokens';
import { FiatCurrency, pricingService } from '@/services/pricing-service';
import type { TransactionDto } from '@/services/dfx';
import { useWalletStore } from '@/store';
import { DfxColors, Typography } from '@/theme';

const FIAT_LABEL = new Map<string, string>([
  ['CHF', 'CHF'],
  ['EUR', '€'],
  ['USD', '$'],
]);

type IconConfig = {
  iconName: 'arrow-down' | 'arrow-up' | 'swap' | 'storefront' | 'send' | 'receive';
  fg: string;
  bg: string;
};

// Buy/Sell are reserved for DFX on-/off-ramp.
// Send/Receive are on-chain transfers between addresses.
// Swap is in-wallet asset conversion. Pay is a merchant payment.
const TYPE_ICON = new Map<TransactionDto['type'], IconConfig>([
  ['Buy', { iconName: 'arrow-down', fg: DfxColors.success, bg: '#DCFCE7' }],
  ['Sell', { iconName: 'arrow-up', fg: DfxColors.error, bg: '#FEE2E2' }],
  ['Swap', { iconName: 'swap', fg: DfxColors.primary, bg: '#DCEAFE' }],
  ['Pay', { iconName: 'storefront', fg: '#7C3AED', bg: '#EDE9FE' }],
  ['Send', { iconName: 'send', fg: DfxColors.error, bg: '#FEE2E2' }],
  ['Receive', { iconName: 'receive', fg: DfxColors.success, bg: '#DCFCE7' }],
]);

const OUTGOING_TYPES = new Set<TransactionDto['type']>(['Sell', 'Pay', 'Send']);

type Props = {
  tx: TransactionDto;
  onPress?: () => void;
  showState?: boolean;
  testID?: string;
};

/**
 * Compact TrustWallet-style transaction row used by the home screen
 * preview, the global history list, and per-asset filtered lists.
 */
export function TransactionRow({ tx, onPress, showState = true, testID }: Props) {
  const isOutgoing = OUTGOING_TYPES.has(tx.type);
  const isPay = tx.type === 'Pay';
  const iconConfig =
    TYPE_ICON.get(tx.type) ??
    ({ iconName: 'swap', fg: DfxColors.primary, bg: '#DCEAFE' } satisfies IconConfig);

  const { selectedCurrency } = useWalletStore();
  const fiatCurrency = selectedCurrency === 'CHF' ? FiatCurrency.CHF : FiatCurrency.USD;
  const [pricingReady, setPricingReady] = useState(pricingService.isReady());
  useEffect(() => {
    if (pricingService.isReady()) {
      setPricingReady(true);
      return;
    }
    void pricingService
      .initialize()
      .then(() => setPricingReady(true))
      .catch(() => setPricingReady(false));
  }, []);

  // Pay rows lead with the merchant — that's the answer to "where did I spend?".
  // Other rows lead with the type and surface the counterparty as a subtitle.
  const primaryLabel = isPay && tx.counterparty ? tx.counterparty : tx.type;

  // Fiat estimate so a Pay in BTC/USDC also shows the CHF/EUR/USD value the
  // user has configured. Falls back gracefully when pricing isn't available
  // or when the asset symbol isn't in the canonical map.
  const canonical = getCanonicalForSymbol(tx.outputAsset);
  const fiatEstimate = canonical
    ? computeFiatValue(tx.outputAmount, canonical, fiatCurrency, pricingReady)
    : 0;
  const fiatLabel =
    fiatEstimate > 0
      ? `≈ ${FIAT_LABEL.get(selectedCurrency) ?? selectedCurrency} ${fiatEstimate.toFixed(2)}`
      : '';

  const dateStr = new Date(tx.date).toLocaleDateString();
  const secondaryLabel = isPay
    ? fiatLabel
      ? `${tx.type} · ${dateStr} · ${fiatLabel}`
      : `${tx.type} · ${dateStr}`
    : tx.counterparty
      ? tx.counterparty
      : dateStr;

  const Container = onPress ? Pressable : View;
  const containerProps = onPress
    ? {
        onPress,
        testID,
        style: ({ pressed }: { pressed: boolean }) => [styles.row, pressed && styles.pressed],
      }
    : { style: styles.row, testID };

  return (
    <Container {...(containerProps as object)}>
      <View style={[styles.icon, { backgroundColor: iconConfig.bg }]}>
        <Icon name={iconConfig.iconName} size={18} color={iconConfig.fg} strokeWidth={2.2} />
      </View>
      <View style={styles.info}>
        <Text style={isPay ? styles.payPrimary : styles.type} numberOfLines={1}>
          {primaryLabel}
        </Text>
        <View style={styles.subtitleRow}>
          {isPay ? <View style={styles.payDot} /> : null}
          <Text style={styles.subtitle} numberOfLines={1}>
            {secondaryLabel}
          </Text>
        </View>
      </View>
      <View style={styles.amountColumn}>
        <Text style={styles.amount} numberOfLines={1}>
          {isOutgoing ? '-' : '+'}
          {tx.outputAmount} {tx.outputAsset}
        </Text>
        {showState ? (
          <Text style={styles.state} numberOfLines={1}>
            {tx.state}
          </Text>
        ) : null}
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 12,
  },
  pressed: {
    opacity: 0.6,
  },
  payPrimary: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: DfxColors.text,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  type: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: DfxColors.text,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  payDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7C3AED',
  },
  subtitle: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
    flexShrink: 1,
  },
  amountColumn: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 110,
  },
  amount: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: DfxColors.text,
  },
  state: {
    ...Typography.bodySmall,
    fontWeight: '500',
    color: DfxColors.textTertiary,
  },
});
