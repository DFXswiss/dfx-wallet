import { ReactNode, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from './Icon';
import { Header, Typography, useColors, type ThemeColors } from '@/theme';

type Props = {
  title: string;
  onBack?: () => void;
  /**
   * Hide the back button entirely (e.g. consent screens that may only be
   * left forwards via an explicit action). The left slot keeps its width
   * so the title stays optically centred.
   */
  hideBack?: boolean;
  rightAction?: ReactNode;
  /**
   * Render `rightAction` without the 40×40 icon-button chrome. Use for
   * text links (e.g. "Verwalten") so they sit in the side slot without a
   * card frame around the label.
   */
  rightActionPlain?: boolean;
  testID?: string;
};

/**
 * Consistent screen header used across the app.
 *
 * Renders a 40x40 back button in the top-left, the screen title centred,
 * and an optional right-aligned slot. Position the component as the first
 * child inside a SafeAreaView so the back button respects the safe area.
 */
export function AppHeader({
  title,
  onBack,
  hideBack = false,
  rightAction,
  rightActionPlain = false,
  testID,
}: Props) {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // When a screen is mounted directly via deep-link (e.g. simctl openurl,
  // a push-notification tap, or app-clip launch), the navigation stack has
  // no parent — `router.back()` then crashes the navigator with
  // "GO_BACK was not handled". Falling back to the dashboard keeps the
  // user out of a dead-end without any visible back affordance.
  const handleBack =
    onBack ??
    (() => {
      if (router.canGoBack()) router.back();
      else router.replace('/(auth)/(tabs)/dashboard');
    });

  const left = hideBack ? (
    <View style={styles.sideSlot} pointerEvents="none" />
  ) : (
    <View style={styles.sideSlot}>
      <Pressable
        onPress={handleBack}
        hitSlop={12}
        style={[styles.iconSlot, styles.iconButton]}
        accessibilityRole="button"
        accessibilityLabel="Back"
        testID={testID ? `${testID}-back` : undefined}
      >
        <Icon name="arrow-left" size={26} color={colors.text} />
      </Pressable>
    </View>
  );

  const right = rightAction ? (
    <View style={[styles.sideSlot, styles.sideSlotEnd]}>
      {rightActionPlain ? (
        rightAction
      ) : (
        <View style={[styles.iconSlot, styles.iconButton]}>{rightAction}</View>
      )}
    </View>
  ) : (
    <View style={[styles.sideSlot, styles.sideSlotEnd]} pointerEvents="none" />
  );

  return (
    <View style={styles.container} testID={testID}>
      {left}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Header.paddingHorizontal,
      paddingTop: Header.paddingTop,
      paddingBottom: Header.paddingBottom,
    },
    sideSlot: {
      flexGrow: 1,
      flexBasis: 0,
      minWidth: 0,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    sideSlotEnd: {
      alignItems: 'flex-end',
    },
    iconSlot: {
      width: Header.slotSize,
      height: Header.slotSize,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconButton: {
      borderRadius: Header.slotRadius,
      backgroundColor: colors.cardOverlay,
      borderWidth: 1,
      borderColor: colors.cardOverlayBorder,
    },
    title: {
      flexShrink: 1,
      minWidth: 0,
      textAlign: 'center',
      ...Typography.headlineSmall,
      color: colors.text,
    },
  });
