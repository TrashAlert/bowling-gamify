import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { migrate } from '@/db/migrations';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="bowling.db" onInit={migrate}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      >
        <Stack.Screen name="(tabs)" />
        {/* No swipe-back: an accidental swipe mid-frame is the worst bug this screen could have. */}
        <Stack.Screen name="session/[id]" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="game/[id]" options={{ headerShown: true, title: 'Game report' }} />
        {/* A sheet, so it can open on top of anything, including a live session's report. */}
        <Stack.Screen name="leave/[mask]" options={{ presentation: 'modal', headerShown: true, title: 'Monster' }} />
      </Stack>
    </SQLiteProvider>
  );
}
