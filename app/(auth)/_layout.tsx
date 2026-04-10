import { Stack } from 'expo-router';
import { DfxColors } from '@/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: DfxColors.background },
      }}
    />
  );
}
