import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DarkBackdrop } from '@/components/DarkBackdrop';
import { Icon } from '@/components/Icon';
import { Typography, useColors, useResolvedScheme, type ThemeColors } from '@/theme';
import TradeModeTabs from './TradeModeTabs';

export default function SwapScreenImpl() {
  const { t } = useTranslation();
  const colors = useColors();
  const scheme = useResolvedScheme();
  const styles = makeStyles(colors);

  return (
    <View style={styles.background}>
      {scheme === 'dark' ? (
        <DarkBackdrop baseColor={colors.background} />
      ) : (
        <ImageBackground
          source={require('../../../assets/dashboard-bg.png')}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      )}
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']} testID="swap-screen">
        <TradeModeTabs active="swap" />
        <View style={styles.placeholder}>
          <Icon name="wallet" />
          <Text style={styles.title}>{t('swap.title')}</Text>
          <Text style={styles.description}>{t('swap.comingSoon')}</Text>
        </View>
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
    screen: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    placeholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingBottom: 48,
    },
    title: {
      ...Typography.headlineSmall,
      color: colors.text,
      marginTop: 16,
      textAlign: 'center',
    },
    description: {
      ...Typography.bodyLarge,
      color: colors.textTertiary,
      marginTop: 8,
      textAlign: 'center',
    },
  });
