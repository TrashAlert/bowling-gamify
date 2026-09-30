import { Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { migrate } from '@/db/migrations';
import { SettingsProvider } from '@/features/settings/settings-context';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="bowling.db" onInit={migrate}>
      <WithSettings>
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
          {/*
            A normal pushed screen, so an edge swipe (or Android back) leaves the game. That's safe:
            every ball is already saved, and the tab bar's play/pause button offers to continue it.
          */}
          <Stack.Screen name="session/[id]" />
          <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings', headerBackTitle: 'Back' }} />
          <Stack.Screen name="game/[id]" options={{ headerShown: true, title: 'Game report' }} />
          {/* A sheet, so it can open on top of anything, including a live session's report. */}
          <Stack.Screen name="leave/[mask]" options={{ presentation: 'modal', headerShown: true, title: 'Monster' }} />
        </Stack>
      </WithSettings>
    </SQLiteProvider>
  );
}

/** Settings need the database, so the provider sits inside SQLiteProvider. */
function WithSettings({ children }: { children: ReactNode }) {
  return <SettingsProvider db={useSQLiteContext()}>{children}</SettingsProvider>;
}
