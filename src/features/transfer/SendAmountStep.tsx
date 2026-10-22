import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AmountKeypad, GlassPill, GlassSurface, PrimaryButton, type AmountKey } from '@/components';
import type { ChainId } from '@/config/chains';
import { ContactAvatar } from './ContactAvatar';
import { UnitBar } from './UnitBar';
import { formatInputDisplay } from './amount';
import { shortenAddress } from './address';
import type { SendAssetOption } from './assets';
import { Layout, Radius, Spacing, Typography, useColors, type ThemeColors } from '@/theme';

const AVATAR_SIZE = 40;

type Props = {
  /** Contact behind the address, if there is one. */
  contactName?: string;
  /** "zuletzt vor 2 Tagen" for a contact, already translated. */
  lastUsedLabel?: string;
  address: string;
  asset: SendAssetOption;
  selectedChain: ChainId;
  units: string[];
  unit: string;
  input: string;
  equivalents: string | null;
  /** Fee preview line, already translated. */
  feeLine: string;
  error: string | null;
  ctaTitle: string;
  ctaDisabled: boolean;
  /** More than one asset can be picked for this address. */
  assetSelectable: boolean;
  onKey: (key: AmountKey) => void;
  onUnitSelect: (unit: string) => void;
  onChainSelect: (chain: ChainId) => void;
  onContinue: () => void;
};

/**
 * Amount step: a centred column (avatar, name, address, the big number, unit
 * bar, fee line) between the header and the keypad, with the send button
 * below. The column takes the space the keypad leaves, split evenly above
 * and below through two equal spacers.
 */
export function SendAmountStep({
  contactName,
  lastUsedLabel,
  address,
  asset,
  selectedChain,
  units,
  unit,
  input,
  equivalents,
  feeLine,
  error,
  ctaTitle,
  ctaDisabled,
  assetSelectable,
  onKey,
  onUnitSelect,
  onChainSelect,
  onContinue,
}: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const shortAddress = shortenAddress(address);
  const recipientMeta = lastUsedLabel ? `${shortAddress} · ${lastUsedLabel}` : shortAddress;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      bounces={false}
      testID="send-amount-step"
    >
      <View style={styles.spacer} />

      <View style={styles.group}>
        <View style={styles.recipient}>
          <ContactAvatar size={AVATAR_SIZE} {...(contactName ? { name: contactName } : {})} />
          <Text style={styles.recipientName} numberOfLines={1}>
            {contactName ?? t('send.newAddress')}
          </Text>
          <Text style={styles.recipientMeta} numberOfLines={1} testID="send-recipient-meta">
            {recipientMeta}
          </Text>
        </View>

        <View style={styles.amountBlock}>
          <View style={styles.amountRow}>
            <Text style={styles.amountUnit}>{unit}</Text>
            <Text
              style={[styles.amountValue, input === '' && styles.amountValueEmpty]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.4}
              testID="send-amount-value"
            >
              {formatInputDisplay(input)}
            </Text>
          </View>
          <Text style={styles.equivalents} testID="send-equivalents">
            {equivalents ?? ' '}
          </Text>
        </View>

        <View style={styles.unitBar}>
          <UnitBar
            units={units}
            active={unit}
            assetSymbol={asset.symbol}
            assetSelectable={assetSelectable}
            onSelect={onUnitSelect}
          />
        </View>

        {asset.chains.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chainBar}
            contentContainerStyle={styles.chainBarContent}
            testID="send-chain-bar"
          >
            {asset.chains.map((c) => {
              const isSelected = selectedChain === c.chain;
              return (
                <GlassPill
                  key={c.chain}
                  testID={`send-chain-${c.chain}`}
                  selected={isSelected}
                  shape="rounded"
                  onPress={() => onChainSelect(c.chain)}
                >
                  <Text style={[styles.chainText, isSelected && styles.chainTextActive]}>
                    {c.label}
                  </Text>
                </GlassPill>
              );
            })}
          </ScrollView>
        )}

        <GlassSurface variant="quiet" radius={Radius.sm} style={styles.infoLine}>
          <Text style={styles.infoText} testID="send-fee-line">
            {feeLine}
          </Text>
        </GlassSurface>

        {error && (
          <Text testID="send-input-error" style={styles.errorText}>
            {error}
          </Text>
        )}
      </View>

      <View style={styles.spacer} />

      <AmountKeypad onKey={onKey} />

      <View style={styles.cta}>
        <PrimaryButton
          testID="send-continue-button"
          title={ctaTitle}
          onPress={onContinue}
          disabled={ctaDisabled}
        />
      </View>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: Layout.screenPadding,
      paddingBottom: Spacing.sm,
    },
    spacer: {
      flex: 1,
    },
    group: {
      alignItems: 'center',
    },
    recipient: {
      alignItems: 'center',
      gap: Spacing.sm,
    },
    recipientName: {
      ...Typography.bodyLarge,
      fontWeight: '700',
      color: colors.text,
    },
    recipientMeta: {
      ...Typography.mono,
      color: colors.textSecondary,
    },
    amountBlock: {
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: Layout.sectionGap,
      alignSelf: 'stretch',
    },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    amountUnit: {
      ...Typography.bodyLarge,
      fontWeight: '700',
      color: colors.textSecondary,
      marginTop: Spacing.base,
    },
    amountValue: {
      ...Typography.displayLarge,
      flexShrink: 1,
      color: colors.text,
    },
    amountValueEmpty: {
      color: colors.textTertiary,
    },
    equivalents: {
      ...Typography.mono,
      color: colors.textSecondary,
    },
    unitBar: {
      alignSelf: 'stretch',
      marginTop: Spacing.md,
    },
    chainBar: {
      flexGrow: 0,
      marginTop: Spacing.md,
    },
    chainBarContent: {
      flexGrow: 1,
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    chainText: {
      ...Typography.bodyMedium,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    chainTextActive: {
      fontWeight: '600',
      color: colors.primary,
    },
    infoLine: {
      marginTop: Spacing.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.base,
    },
    infoText: {
      ...Typography.bodySmall,
      fontWeight: '500',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    errorText: {
      ...Typography.bodySmall,
      color: colors.error,
      textAlign: 'center',
      marginTop: Spacing.sm,
    },
    cta: {
      marginTop: Spacing.sm,
    },
  });
