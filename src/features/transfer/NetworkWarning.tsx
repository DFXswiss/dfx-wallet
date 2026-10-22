import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Radius, Spacing, Typography, useColors, type ThemeColors } from '@/theme';

type Props = {
  text: string;
  testID?: string;
};

export function NetworkWarning({ text, testID }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container} testID={testID}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 3l10 18H2L12 3z"
          stroke={colors.warning}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <Path d="M12 10v5M12 18v.5" stroke={colors.warning} strokeWidth={2} strokeLinecap="round" />
      </Svg>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: colors.warningBorder,
      backgroundColor: colors.warningSurface,
    },
    text: {
      ...Typography.warning,
      flex: 1,
      color: colors.text,
    },
  });
