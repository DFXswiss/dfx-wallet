import { Stack } from 'expo-router';
import { useColors } from '@/theme';

export default function PinLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        gestureEnabled: false,
      }}
    />
  );
}
