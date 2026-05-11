import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from './Icon';
import { DfxColors, Typography } from '@/theme';

type Props = {
  title: string;
  onBack?: () => void;
  rightAction?: ReactNode;
  testID?: string;
};

/**
 * Consistent screen header used across the app.
 *
 * Renders a 32x32 back button in the top-left, the screen title centred,
 * and an optional right-aligned slot. Position the component as the first
 * child inside a SafeAreaView so the back button respects the safe area.
 */
export function AppHeader({ title, onBack, rightAction, testID }: Props) {
  const router = useRouter();
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

  return (
    <View style={styles.container} testID={testID}>
      <Pressable
        onPress={handleBack}
        hitSlop={12}
        style={[styles.iconSlot, styles.iconButton]}
        accessibilityRole="button"
        accessibilityLabel="Back"
        testID={testID ? `${testID}-back` : undefined}
      >
        <Icon name="arrow-left" size={26} color={DfxColors.text} />
      </Pressable>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <View style={[styles.iconSlot, styles.iconButton]}>{rightAction}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  iconSlot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: DfxColors.border,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    ...Typography.headlineSmall,
    color: DfxColors.text,
  },
});
