import { Stack } from 'expo-router';
import { DfxColors } from '@/theme';

export default function PinLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: DfxColors.background },
        gestureEnabled: false,
      }}
    />
  );
}
