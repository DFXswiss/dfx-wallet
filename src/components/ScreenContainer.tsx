import { ReactNode, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Layout, useColors, type ThemeColors } from '@/theme';
import { ScreenBackdrop } from './ScreenBackdrop';

type Props = {
  children: ReactNode;
  scrollable?: boolean;
  testID?: string;
};

export function ScreenContainer({ children, scrollable = false, testID }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const content = scrollable ? (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
  );

  // Light now gets the same photo backdrop as dark — previously this
  // container rendered nothing at all in light, the one screen background
  // that did not match the rest of the app.
  return (
    <View style={styles.container} testID={testID}>
      <ScreenBackdrop />
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
      paddingHorizontal: Layout.screenPadding,
    },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: Layout.screenPadding,
    },
  });
