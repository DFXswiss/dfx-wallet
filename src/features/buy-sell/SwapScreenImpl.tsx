import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { useColors } from '@/theme';
import TradeModeTabs from './TradeModeTabs';

export default function SwapScreenImpl() {
  const { t } = useTranslation();
  const colors = useColors();

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']} testID="swap-screen">
      <TradeModeTabs active="swap" />
      <View style={styles.placeholder}>
        <Icon name="wallet" />
        <Text style={[styles.title, { color: colors.text }]}>{t('swap.title')}</Text>
        <Text style={[styles.description, { color: colors.textTertiary }]}>
          {t('swap.comingSoon')}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    marginTop: 16,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  description: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
});
