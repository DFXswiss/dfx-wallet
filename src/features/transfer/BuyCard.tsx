import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DfxMark, Icon } from '@/components';
import { FEATURES } from '@/config/features';
import {
  Interaction,
  Radius,
  Spacing,
  Typography,
  useColors,
  useResolvedScheme,
  type ThemeColors,
} from '@/theme';

type Props = {
  title: string;
  onPress: () => void;
};

export function BuyCard({ title, onPress }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const scheme = useResolvedScheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const foreground = scheme === 'dark' ? colors.background : colors.white;

  if (!FEATURES.BUY_SELL) return null;

  return (
    <Pressable
      testID="receive-buy"
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.markTile}>
        <DfxMark size={21} color={foreground} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, { color: foreground }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: foreground }]}>
          {t('receive.buyFromBankShort')}
        </Text>
      </View>
      <Icon name="arrow-right" size={16} color={foreground} />
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: 14,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.md,
      backgroundColor: colors.primary,
      shadowColor: colors.primaryDark,
      shadowOpacity: 0.22,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    pressed: {
      opacity: Interaction.pressedOpacity,
      transform: [{ scale: 0.99 }],
    },
    markTile: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryDark,
    },
    text: {
      flex: 1,
    },
    title: {
      ...Typography.bodyLarge,
      fontWeight: '700',
    },
    subtitle: {
      ...Typography.bodySmall,
      opacity: 0.85,
    },
  });
