import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, Pressable } from 'react-native';
import { AddGameButton } from '@/components/AddGameButton';
import { Avatar } from '@/components/Avatar';
import { endSession } from '@/db/games';
import { features } from '@/features';
import { useAddGame } from '@/features/live-scoring/use-add-game';
import { useGameInProgress } from '@/features/live-scoring/use-game-in-progress';
import { useProfile } from '@/features/profile/profile-context';
import { colors, space, touch } from '@/theme';

/**
 * The app opens on Home even though it isn't the first tab: the starting URL
 * is "/", which is (tabs)/index.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        // A bare header: the Settings gear top left, your profile top right, on every tab.
        headerShown: true,
        headerTitle: '',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerLeft: () => <SettingsButton />,
        headerRight: () => <ProfileButton />,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="progress"
        options={{ title: 'Progress', tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} /> }}
      />
      {/* Not a page: the button adds a game, or offers to continue or stop an unfinished one. */}
      <Tabs.Screen name="add" options={{ title: 'Add game', tabBarButton: () => <AddGameTab /> }} />
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }}
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

function AddGameTab() {
  const db = useSQLiteContext();
  const addGame = useAddGame(db);
  const { game, refresh } = useGameInProgress(db);

  if (!game) return <AddGameButton mode="add" onPress={() => void addGame()} />;

  const frame = game.scored.next?.frameNumber ?? 10;
  const choose = () =>
    Alert.alert(
      `Game ${game.gameNumber} in progress`,
      `Frame ${frame}, score ${game.scored.scoreSoFar}. Every ball so far is saved. Stopping ends the session and keeps this game as unfinished.`,
      [
        { text: 'Stop game', style: 'destructive', onPress: () => void endSession(db, game.sessionId).then(refresh) },
        { text: 'Continue', isPreferred: true, onPress: () => router.push(`/session/${game.sessionId}`) },
      ],
      { cancelable: true },
    );
  return <AddGameButton mode="paused" onPress={choose} />;
}

function ProfileButton() {
  const { profile } = useProfile();
  return (
    <Pressable
      onPress={() => router.push('/profile')}
      accessibilityRole="button"
      accessibilityLabel="Profile"
      hitSlop={space.sm}
      style={({ pressed }) => ({
        width: touch.min,
        height: touch.min,
        marginRight: space.sm,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Avatar name={profile.displayName} size={32} />
    </Pressable>
  );
}

function SettingsButton() {
  return (
    <Pressable
      onPress={() => router.push('/settings')}
      accessibilityRole="button"
      accessibilityLabel="Settings"
      hitSlop={space.sm}
      style={({ pressed }) => ({
        width: touch.min,
        height: touch.min,
        marginLeft: space.sm,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name="settings-outline" size={24} color={colors.text} />
    </Pressable>
  );
}
