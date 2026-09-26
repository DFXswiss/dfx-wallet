import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassSheet } from './GlassSheet';
import { Icon } from './Icon';
import { useColors, type ThemeColors, Typography } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function MenuModal({ visible, onClose }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { t } = useTranslation();

  const goToSettings = () => {
    onClose();
    router.push('/(auth)/(tabs)/settings');
  };

  return (
    <GlassSheet visible={visible} onRequestClose={onClose} position="side" testID="menu-modal">
      <SafeAreaView style={styles.safeArea} edges={['top', 'right']}>
        <View style={styles.header}>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            testID="menu-close-button"
          >
            <Icon name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <Pressable style={styles.item} onPress={goToSettings} testID="menu-item-settings">
          <Text style={styles.itemLabel}>{t('settings.title')}</Text>
          <Icon name="chevron-right" size={20} color={colors.textTertiary} />
        </Pressable>
      </SafeAreaView>
    </GlassSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 44,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    itemLabel: {
      ...Typography.bodyLarge,
      fontWeight: '600',
      color: colors.text,
    },
  });
