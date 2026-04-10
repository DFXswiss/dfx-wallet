import { TextStyle } from 'react-native';

export const Typography = {
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
} as const;
