import type { ReactNode } from 'react';
import { ImageBackground, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { DarkBackdrop } from '@/components/DarkBackdrop';
import { useColors, useResolvedScheme, type ThemeColors } from '@/theme';
import { TRADE_STEP_GAP } from './tradePanelStyles';

type Props = {
  title: string;
  onBack: () => void;
  headerTestID: string;
  activeStep: number;
  steps: readonly string[];
  children: ReactNode;
};

export function TradeScreenShell({
  title,
  onBack,
  headerTestID,
  activeStep,
  steps,
  children,
}: Props) {
  const colors = useColors();
  const scheme = useResolvedScheme();
  const styles = makeStyles(colors);

  return (
    <View style={styles.background} testID={`${headerTestID}-background`}>
      {scheme === 'dark' ? (
        <DarkBackdrop baseColor={colors.background} />
      ) : (
        <ImageBackground
          source={require('../../../assets/dashboard-bg.png')}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      )}
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <AppHeader title={title} onBack={onBack} testID={headerTestID} />
        <View style={styles.progressRow} testID={`${headerTestID}-progress`}>
          {steps.map((step, index) => (
            <View
              key={step}
              style={[styles.progressStep, index <= activeStep && styles.progressActive]}
            />
          ))}
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    background: {
      flex: 1,
      backgroundColor: colors.background,
    },
    safeArea: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: {
      paddingTop: 2,
      paddingHorizontal: 16,
      paddingBottom: 26,
      gap: TRADE_STEP_GAP,
    },
    progressRow: {
      flexDirection: 'row',
      alignSelf: 'center',
      gap: 8,
      paddingTop: 4,
      paddingBottom: 12,
    },
    progressStep: {
      width: 34,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.cardOverlay,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    progressActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
  });
