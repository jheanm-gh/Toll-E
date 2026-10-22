import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui';
import { colors, fonts } from '@/theme/tokens';

const tab = (title: string, icon: IconName, activeIcon: IconName) => ({
  title,
  tabBarAccessibilityLabel: title,
  tabBarIcon: ({ focused, color }: { focused: boolean; color: ColorValue }) => (
    <Icon name={focused ? activeIcon : icon} size={24} color={color} />
  ),
});

export default function TabsLayout() {
  // An explicit height keeps labels from being clipped on devices with a gesture bar or home indicator.
  const { bottom } = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navy900,
        tabBarInactiveTintColor: colors.ink500,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11.5 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          // Icon (about 28) + label (about 15) + the item's own padding need about 53 points.
          height: 64 + bottom,
          paddingTop: 0,
          paddingBottom: bottom > 0 ? bottom : 6,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen name="index" options={tab('Home', 'home-variant-outline', 'home-variant')} />
      <Tabs.Screen name="map" options={tab('Toll map', 'map-outline', 'map')} />
      <Tabs.Screen name="calculate" options={tab('Calculate', 'calculator-variant-outline', 'calculator-variant')} />
      <Tabs.Screen name="saved" options={tab('Saved', 'bookmark-outline', 'bookmark')} />
      <Tabs.Screen name="more" options={tab('More', 'dots-horizontal-circle-outline', 'dots-horizontal-circle')} />
    </Tabs>
  );
}
