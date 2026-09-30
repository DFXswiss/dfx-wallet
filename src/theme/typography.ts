import { Platform, TextStyle } from 'react-native';

// System monospace face per platform: iOS has no font family named "monospace".
const MONO_FAMILY = Platform.select({ ios: 'Menlo', default: 'monospace' });

export const Typography = {
  // Amount hero of the send flow (the one big number on a screen).
  displayLarge: {
    fontSize: 64,
    fontWeight: '800',
    lineHeight: 68,
    letterSpacing: -1.3,
  } as TextStyle,
  // Editorial screen headline ("An wen?").
  displayMedium: {
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 38,
    letterSpacing: -1,
  } as TextStyle,
  headlineLarge: {
    fontSize: 30,
    fontWeight: '600',
    lineHeight: 36,
  } as TextStyle,
  headlineMedium: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
  } as TextStyle,
  headlineSmall: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
  } as TextStyle,
  bodyLarge: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  } as TextStyle,
  bodyMedium: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  } as TextStyle,
  bodySmall: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  } as TextStyle,
  // Monospace metadata: addresses, IBANs, tabular balances.
  mono: {
    fontFamily: MONO_FAMILY,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
  monoLarge: {
    fontFamily: MONO_FAMILY,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  } as TextStyle,
} as const;
