import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components';
import { Typography, useColors, type ThemeColors } from '@/theme';
import { CURRENCIES } from './BuyScreenImpl';
import { CurrencyGlyph } from './CurrencyGlyph';

type PayCurrency = (typeof CURRENCIES)[number];

type Props = {
  visible: boolean;
  onClose: () => void;
  selected: PayCurrency;
  onSelect: (currency: PayCurrency) => void;
};

export function PayCurrencySheet({ visible, onClose, selected, onSelect }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalContent}>
        <Pressable testID="pay-currency-sheet-backdrop" style={styles.backdrop} onPress={onClose} />
        <SafeAreaView
          style={styles.sheet}
          edges={['bottom', 'left', 'right']}
          accessibilityViewIsModal
        >
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

          {CURRENCIES.map((currency) => {
            const isSelected = currency === selected;
            return (
              <Pressable
                key={currency}
                style={styles.option}
                onPress={() => onSelect(currency)}
                testID={`pay-currency-option-${currency}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <CurrencyGlyph code={currency} size={32} />
                <Text style={styles.optionLabel}>{currency}</Text>
                {isSelected ? (
                  <View testID={`pay-currency-option-${currency}-check`}>
                    <Icon name="check" size={20} color={colors.primary} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    modalContent: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(11, 20, 38, 0.35)',
    },
    sheet: {
      width: '100%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 8,
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
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    optionLabel: {
      ...Typography.bodyLarge,
      flex: 1,
      fontWeight: '600',
      color: colors.text,
    },
  });
