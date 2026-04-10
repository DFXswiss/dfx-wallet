import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DfxColors } from '@/theme';

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: DfxColors.surface,
          borderTopColor: DfxColors.border,
        },
        tabBarActiveTintColor: DfxColors.primary,
        tabBarInactiveTintColor: DfxColors.textTertiary,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('dashboard.title'),
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings.title'),
          tabBarIcon: () => null,
        }}
      />
    </Tabs>
  );
}
