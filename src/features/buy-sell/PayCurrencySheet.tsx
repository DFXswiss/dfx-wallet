import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components';
import { GlassListGroup } from '@/components/GlassListGroup';
import { GlassSheet } from '@/components/GlassSheet';
import { Typography, useColors, type ThemeColors } from '@/theme';
import { CurrencyGlyph } from './CurrencyGlyph';

/** Buy's pay-currency selection — bank-transfer rails only support these two. */
type PayCurrencyCode = 'CHF' | 'EUR';

type Props = {
  visible: boolean;
  onClose: () => void;
  currencies: readonly PayCurrencyCode[];
  selected: PayCurrencyCode;
  onSelect: (currency: PayCurrencyCode) => void;
};

export function PayCurrencySheet({ visible, onClose, currencies, selected, onSelect }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();

  return (
    <GlassSheet
      visible={visible}
      onRequestClose={onClose}
      position="bottom"
      testID="pay-currency-sheet"
    >
      <SafeAreaView style={styles.sheetBody} edges={['bottom', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('buy.youPay')}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Icon name="close" size={22} color={colors.text} />
          </Pressable>
        </View>

        <GlassListGroup>
          {currencies.map((currency, index) => {
            const isSelected = currency === selected;
            return (
              <GlassListGroup.Row
                key={currency}
                onPress={() => onSelect(currency)}
                last={index === currencies.length - 1}
                testID={`pay-currency-option-${currency}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={styles.option}
              >
                <CurrencyGlyph code={currency} size={32} />
                <Text style={styles.optionLabel}>{currency}</Text>
                {isSelected ? (
                  <View testID={`pay-currency-option-${currency}-check`}>
                    <Icon name="check" size={20} color={colors.primary} />
                  </View>
                ) : null}
              </GlassListGroup.Row>
            );
          })}
        </GlassListGroup>
      </SafeAreaView>
    </GlassSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    sheetBody: {
      gap: 8,
    },
    header: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      ...Typography.headlineSmall,
      color: colors.text,
    },
    option: {
      minHeight: 60,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    optionLabel: {
      ...Typography.bodyLarge,
      flex: 1,
      fontWeight: '600',
      color: colors.text,
    },
  });
