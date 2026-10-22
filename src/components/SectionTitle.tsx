import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Spacing, useColors, type ThemeColors } from '@/theme';

type Props = {
  title: string;
  testID?: string;
};

/**
 * Uppercase, letter-spaced label above a grouped list of rows (settings
 * sections, grouped summaries). Pulled out of `SettingsScreenImpl`'s local
 * `sectionTitle` style so every section header across the app reads the
 * same, instead of each screen re-declaring the same literal values.
 */
export function SectionTitle({ title, testID }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Text style={styles.sectionTitle} {...(testID ? { testID } : {})}>
      {title}
    </Text>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    sectionTitle: {
      fontSize: 13,
      lineHeight: 16,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      fontWeight: '700',
      paddingHorizontal: Spacing.xs,
    },
  });
