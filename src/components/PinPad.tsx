import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassSurface } from './GlassSurface';
import { useColors, type ThemeColors } from '@/theme';

const KEY_SIZE = 72;
const KEY_RADIUS = 36;
const KEY_MARGIN = 8;

// Grid constants shared with `AmountKeypad` so both keypads sit on the same
// 280 px raster (three columns of `KEY_SIZE + 2 * KEY_MARGIN`).
export const PIN_PAD_WIDTH = 280;
export const PIN_KEY_SIZE = KEY_SIZE;
export const PIN_KEY_MARGIN = KEY_MARGIN;

// Standard 3x4 keypad: digits 1-9, a blank spacer, then 0 and delete.
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

type Props = {
  /** Current PIN input; drives how many dots are filled. */
  value: string;
  /** Dot count / max digits. */
  length?: number;
  error?: boolean;
  disabled?: boolean;
  onDigit: (digit: string) => void;
  onDelete: () => void;
  /** testID for the dot row; screens keep their existing IDs here. */
  dotsTestID: string;
};

/**
 * Shared PIN entry module: dot row + glass numpad. Setup and verify screens
 * both render only this, so the keypad recipe lives in exactly one place.
 */
export function PinPad({
  value,
  length = 6,
  error = false,
  disabled = false,
  onDigit,
  onDelete,
  dotsTestID,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <>
      <View style={styles.dots} testID={dotsTestID}>
        {Array.from({ length }).map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i < value.length && styles.dotFilled, error && styles.dotError]}
          />
        ))}
      </View>

      <View style={styles.numpad}>
        {KEYS.map((key) => {
          if (key === '') {
            return <View key="pin-pad-spacer" testID="pin-pad-spacer" style={styles.cell} />;
          }
          const testID = key === 'del' ? 'pin-key-delete' : `pin-key-${key}`;
          const label = key === 'del' ? 'Delete' : key;
          return (
            <Pressable
              key={key}
              testID={testID}
              style={styles.key}
              disabled={disabled}
              onPress={() => (key === 'del' ? onDelete() : onDigit(key))}
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              {({ pressed }) => (
                <GlassSurface
                  variant={pressed ? 'lead' : 'quiet'}
                  radius={KEY_RADIUS}
                  style={styles.glass}
                >
                  <Text style={styles.keyText}>{key === 'del' ? '⌫' : key}</Text>
                </GlassSurface>
              )}
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    dots: {
      flexDirection: 'row',
      gap: 16,
      marginVertical: 24,
    },
    dot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    dotFilled: {
      backgroundColor: colors.primary,
    },
    dotError: {
      borderColor: colors.error,
    },
    numpad: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      width: PIN_PAD_WIDTH,
      marginTop: 32,
    },
    // Outer hit target: margin only, the glass recipe supplies the shape.
    key: {
      margin: KEY_MARGIN,
    },
    cell: {
      width: KEY_SIZE,
      height: KEY_SIZE,
      margin: KEY_MARGIN,
    },
    glass: {
      width: KEY_SIZE,
      height: KEY_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyText: {
      color: colors.text,
      fontSize: 28,
      fontWeight: '600',
      lineHeight: 32,
      textAlign: 'center',
      includeFontPadding: false,
    },
  });
