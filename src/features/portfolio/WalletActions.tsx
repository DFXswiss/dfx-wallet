import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { DfxMark, GlassSurface, Icon } from '@/components';
import { FEATURES } from '@/config/features';
import { Interaction, Typography, useColors, type ThemeColors } from '@/theme';

type Props = {
  asset?: string;
};

type ActionProps = {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  testID: string;
  whiteTile?: boolean;
};

function WalletAction({ icon, label, onPress, testID, whiteTile = false }: ActionProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      testID={testID}
    >
      <GlassSurface
        radius={14}
        style={[styles.tile, whiteTile && styles.whiteTile]}
        variant="default"
      >
        {icon}
      </GlassSurface>
      <Text numberOfLines={1} style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

export function WalletActions({ asset }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View style={styles.row} testID="wallet-actions">
      <WalletAction
        icon={<Icon color={colors.primary} name="receive" size={20} />}
        label={t('portfolio.actionReceive')}
        onPress={() => router.push('/(auth)/receive')}
        testID="wallet-action-receive"
      />
      <WalletAction
        icon={<Icon color={colors.primary} name="send" size={20} />}
        label={t('portfolio.actionSend')}
        onPress={() => router.push('/(auth)/send')}
        testID="wallet-action-send"
      />
      {FEATURES.BUY_SELL ? (
        <>
          <WalletAction
            icon={<DfxMark size={22} />}
            label={t('portfolio.actionBuy')}
            onPress={() => router.push({ pathname: '/(auth)/buy', params: asset ? { asset } : {} })}
            testID="wallet-action-buy"
            whiteTile
          />
          <WalletAction
            icon={<Icon color={colors.primary} name="bank" size={20} strokeWidth={1.8} />}
            label={t('portfolio.actionPayout')}
            onPress={() => router.push('/(auth)/sell')}
            testID="wallet-action-payout"
          />
        </>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    action: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
    },
    tile: {
      width: 46,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
    },
    whiteTile: {
      backgroundColor: colors.white,
    },
    pressed: {
      opacity: Interaction.pressedOpacity,
    },
    label: {
      ...Typography.bodySmall,
      color: colors.text,
      fontWeight: '600',
    },
  });
