import { ReactNode, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors, useResolvedScheme, type ThemeColors } from '@/theme';
import { DarkBackdrop } from './DarkBackdrop';

type Props = {
  children: ReactNode;
  scrollable?: boolean;
  testID?: string;
};

export function ScreenContainer({ children, scrollable = false, testID }: Props) {
  const colors = useColors();
  const scheme = useResolvedScheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const content = scrollable ? (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
  );

  return (
    <View style={styles.container} testID={testID}>
      {scheme === 'dark' ? <DarkBackdrop baseColor={colors.background} /> : null}
      <SafeAreaView style={styles.safeArea}>{content}</SafeAreaView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    safeArea: {
      flex: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
    },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: 24,
    },
  });
