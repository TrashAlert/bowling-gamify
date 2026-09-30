import { Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { migrate } from '@/db/migrations';
import { ProfileProvider } from '@/features/profile/profile-context';
import { SettingsProvider } from '@/features/settings/settings-context';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="bowling.db" onInit={migrate}>
      <AppProviders>
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
          <Stack.Screen name="profile/index" options={{ headerShown: true, title: 'Profile', headerBackTitle: 'Back' }} />
          <Stack.Screen name="profile/edit" options={{ presentation: 'modal', headerShown: true, title: 'Edit profile' }} />
          <Stack.Screen name="game/[id]" options={{ headerShown: true, title: 'Game report' }} />
          {/* A sheet, so it can open on top of anything, including a live session's report. */}
          <Stack.Screen name="leave/[mask]" options={{ presentation: 'modal', headerShown: true, title: 'Monster' }} />
        </Stack>
      </AppProviders>
    </SQLiteProvider>
  );
}

/** App-wide state read from the database, so these sit inside SQLiteProvider. */
function AppProviders({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  return (
    <SettingsProvider db={db}>
      <ProfileProvider db={db}>{children}</ProfileProvider>
    </SettingsProvider>
  );
}
