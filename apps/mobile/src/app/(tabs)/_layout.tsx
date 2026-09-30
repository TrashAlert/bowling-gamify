import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { features } from '@/features';
import { colors } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: 'Progress', tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="bestiary"
        options={
          features.bestiary
            ? { title: 'Bestiary', tabBarIcon: ({ color, size }) => <Ionicons name="skull" size={size} color={color} /> }
            : { href: null }
        }
      />
    </Tabs>
  );
}
