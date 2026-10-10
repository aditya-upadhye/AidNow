import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { colors } from '../../components/theme';

type IonName = ComponentProps<typeof Ionicons>['name'];

/** The five places in the app. Order is the order on the bar: the emergency flow first, setup last. */
const TABS: { name: string; label: string; icon: IonName; active: IonName }[] = [
  { name: 'home', label: 'help', icon: 'medkit-outline', active: 'medkit' },
  { name: 'family', label: 'family', icon: 'heart-outline', active: 'heart' },
  { name: 'community', label: 'community', icon: 'people-outline', active: 'people' },
  { name: 'prepare', label: 'prepare', icon: 'shield-checkmark-outline', active: 'shield-checkmark' },
  { name: 'profile', label: 'profile', icon: 'person-circle-outline', active: 'person-circle' },
];

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(`nav.${tab.label}`),
            tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? tab.active : tab.icon} size={24} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
