import { ReactNode, useMemo } from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { Layout, useColors, useResolvedScheme, type ThemeColors } from '@/theme';
import { ScreenBackdrop } from './ScreenBackdrop';

type Props = {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  scrollable?: boolean;
  testID?: string;
};

export function DfxBackgroundScreen({
  children,
  contentStyle,
  edges = ['top', 'left', 'right', 'bottom'],
  scrollable = false,
  testID,
}: Props) {
  const colors = useColors();
  const scheme = useResolvedScheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const inner = (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      {scrollable ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          testID={testID}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, contentStyle]} testID={testID}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );

  return (
    <View style={styles.background}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ScreenBackdrop />
      {inner}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    background: {
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
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Layout.screenPadding,
    },
  });
