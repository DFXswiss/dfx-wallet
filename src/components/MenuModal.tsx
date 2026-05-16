import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { Typography, useColors, type ThemeColors } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function MenuModal({ visible, onClose }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const goToSettings = () => {
    onClose();
    router.push('/(auth)/(tabs)/settings');
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'right']}>
          <Pressable
            style={styles.sheet}
            onPress={(e) => e.stopPropagation()}
            accessibilityViewIsModal
          >
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
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'flex-end',
    },
    safeArea: {
      flex: 1,
      width: '78%',
    },
    sheet: {
      flex: 1,
      backgroundColor: colors.surface,
      paddingHorizontal: 20,
      paddingTop: 8,
      shadowColor: colors.shadow,
      shadowOpacity: 0.18,
      shadowRadius: 24,
      shadowOffset: { width: -4, height: 0 },
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
      borderBottomColor: colors.border,
    },
    itemLabel: {
      ...Typography.bodyLarge,
      fontWeight: '600',
      color: colors.text,
    },
  });
