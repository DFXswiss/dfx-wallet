import { ReactNode } from 'react';
import { ImageBackground, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DfxColors } from '@/theme';

type Props = {
  children: ReactNode;
  scrollable?: boolean;
  testID?: string;
};

export function ScreenContainer({ children, scrollable = false, testID }: Props) {
  const content = scrollable ? (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
  );

  return (
    <ImageBackground
      source={require('../../assets/dashboard-bg.png')}
      style={styles.container}
      resizeMode="cover"
      testID={testID}
    >
      <SafeAreaView style={styles.safeArea}>{content}</SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
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
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
});
