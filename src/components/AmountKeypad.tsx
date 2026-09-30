import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import { PIN_KEY_MARGIN, PIN_KEY_SIZE, PIN_PAD_WIDTH } from './PinPad';
import { Typography, useColors, type ThemeColors } from '@/theme';

export type AmountKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'del';

// Digits 1-9, decimal separator, 0, delete — the PIN pad's 3x4 order.
const KEYS: readonly AmountKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];

// Same column raster as the PIN pad (three columns of key size + 2 * margin
// inside its 280 px width); only the row height is lower so the pad leaves
// room for the amount above it.
const CELL_WIDTH = PIN_KEY_SIZE + 2 * PIN_KEY_MARGIN;
const KEY_HEIGHT = 56;
const ICON_SIZE = 22;

type Props = {
  onKey: (key: AmountKey) => void;
  disabled?: boolean;
  testID?: string;
};

const keyTestID = (key: AmountKey): string => {
  if (key === 'del') return 'amount-key-delete';
  if (key === '.') return 'amount-key-dot';
  return `amount-key-${key}`;
};

const keyLabel = (key: AmountKey): string => {
  if (key === 'del') return 'Delete';
  if (key === '.') return 'Decimal separator';
  return key;
};

/**
 * Light numeric keypad for amount entry: plain text keys, no glass surface
 * per key, centred on the PIN pad's raster. Feedback is a dimmed key while
 * pressed; like the PIN pad it gives no haptic tick per digit.
 */
export function AmountKeypad({ onKey, disabled = false, testID }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.pad} {...(testID ? { testID } : {})}>
      {KEYS.map((key) => (
        <Pressable
          key={key}
          testID={keyTestID(key)}
          style={({ pressed }) => [styles.key, pressed && styles.pressed]}
          disabled={disabled}
          onPress={() => onKey(key)}
          accessibilityRole="button"
          accessibilityLabel={keyLabel(key)}
        >
          {key === 'del' ? (
            <Icon name="backspace" size={ICON_SIZE} color={colors.textSecondary} />
          ) : (
            <Text style={[styles.keyText, key === '.' && styles.keyTextOperator]}>{key}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    pad: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignSelf: 'center',
      width: PIN_PAD_WIDTH,
    },
    key: {
      width: CELL_WIDTH,
      height: KEY_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: {
      opacity: 0.4,
    },
    keyText: {
      ...Typography.headlineMedium,
      fontWeight: '500',
      color: colors.text,
      textAlign: 'center',
      includeFontPadding: false,
    },
    keyTextOperator: {
      color: colors.textSecondary,
    },
  });
