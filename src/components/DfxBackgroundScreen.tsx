import { ReactNode } from 'react';
import { ImageBackground, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { DfxColors } from '@/theme';

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
  return (
    <ImageBackground
      source={require('../../assets/dashboard-bg.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <StatusBar style="dark" />
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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: DfxColors.background,
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
