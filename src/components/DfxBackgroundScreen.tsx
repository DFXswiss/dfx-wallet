import { ReactNode, useMemo } from 'react';
import { ImageBackground, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { useColors, useResolvedScheme, type ThemeColors } from '@/theme';
import { DarkBackdrop } from './DarkBackdrop';

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

  if (scheme === 'dark') {
    return (
      <View style={styles.background}>
        <DarkBackdrop baseColor={colors.background} />
        <StatusBar style="light" />
        {inner}
      </View>
    );
  }

  return (
    <ImageBackground
      source={require('../../assets/dashboard-bg.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <StatusBar style="dark" />
      {inner}
    </ImageBackground>
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
      paddingHorizontal: 24,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 24,
    },
  });
