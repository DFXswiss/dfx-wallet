import { useMemo } from 'react';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DarkBackdrop, Icon } from '@/components';
import type { ChainId } from '@/config/chains';
import { ALWAYS_ON_CHAINS, SELECTABLE_CHAINS } from '@/config/tokens';
import { useEnabledChains } from './useEnabledChains';
import { Typography, useColors, useResolvedScheme, type ThemeColors } from '@/theme';

const CHAIN_LABEL = new Map<ChainId, string>([
  ['ethereum', 'Ethereum'],
  ['arbitrum', 'Arbitrum'],
  ['polygon', 'Polygon'],
  ['base', 'Base'],
  ['bitcoin', 'Bitcoin'],
  ['bitcoin-taproot', 'Bitcoin (Taproot)'],
  ['spark', 'Bitcoin Lightning'],
  ['plasma', 'Plasma'],
  ['sepolia', 'Sepolia'],
]);

const CHAIN_DESCRIPTION = new Map<ChainId, string>([]);

export default function ManageChainsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useColors();
  const scheme = useResolvedScheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { enabledChains, toggleChain } = useEnabledChains();

  const body = (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.headerIcon}
          testID="manage-back-button"
        >
          <Icon name="arrow-left" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('portfolio.manageChains')}</Text>
        <View style={styles.headerPlaceholder} pointerEvents="none" />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>{t('portfolio.alwaysOn')}</Text>
        {ALWAYS_ON_CHAINS.map((chain) => (
          <View key={chain} style={[styles.row, styles.rowDisabled]}>
            <View style={styles.info}>
              <Text style={styles.label}>{CHAIN_LABEL.get(chain) ?? chain}</Text>
            </View>
            <Switch value disabled />
          </View>
        ))}

        <Text style={styles.sectionLabel}>{t('portfolio.optional')}</Text>
        {SELECTABLE_CHAINS.map((chain) => {
          const enabled = enabledChains.includes(chain);
          const description = CHAIN_DESCRIPTION.get(chain);
          return (
            <View key={chain} style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.label}>{CHAIN_LABEL.get(chain) ?? chain}</Text>
                {description && <Text style={styles.description}>{description}</Text>}
              </View>
              <Switch
                value={enabled}
                onValueChange={() => toggleChain(chain)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.white}
                testID={`manage-chain-${chain}`}
              />
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      {scheme === 'dark' ? (
        <View style={styles.bg}>
          <DarkBackdrop baseColor={colors.background} />
          {body}
        </View>
      ) : (
        <ImageBackground
          source={require('../../../assets/dashboard-bg.png')}
          style={styles.bg}
          resizeMode="cover"
        >
          {body}
        </ImageBackground>
      )}
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    bg: {
      flex: 1,
      backgroundColor: colors.background,
    },
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 8,
    },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.78)',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerPlaceholder: {
      width: 40,
      height: 40,
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      ...Typography.headlineSmall,
      color: colors.text,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 48,
      gap: 8,
    },
    sectionLabel: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      fontWeight: '600',
      marginTop: 16,
      marginBottom: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.92)',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 12,
      shadowColor: '#0B1426',
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 1,
    },
    rowDisabled: {
      opacity: 0.65,
    },
    info: {
      flex: 1,
      gap: 4,
    },
    label: {
      ...Typography.bodyLarge,
      fontWeight: '600',
      color: colors.text,
    },
    description: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
    },
    lockedHint: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
      fontStyle: 'italic',
    },
  });
