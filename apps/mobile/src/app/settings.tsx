import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionRow, InfoRow, SettingsSection, SwitchRow } from '@/components/SettingRow';
import { countGames, deleteAllGames } from '@/db/backup';
import { useSettings } from '@/features/settings/settings-context';
import { shareExport } from '@/features/settings/share-export';
import { colors, space } from '@/theme';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { settings, update } = useSettings();
  const [games, setGames] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const refreshCount = useCallback(() => {
    void countGames(db).then(setGames);
  }, [db]);
  useFocusEffect(refreshCount);

  const exportGames = async () => {
    setExporting(true);
    try {
      if ((await shareExport(db)) === 'unavailable') {
        Alert.alert('Can’t share on this device', 'This device has no share sheet to send the file to.');
      }
    } catch {
      Alert.alert('Export failed', 'Your games are still safe on this phone. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert(
      'Delete all games?',
      `This permanently deletes ${games} ${games === 1 ? 'game' : 'games'} and your XP from this phone. They aren't saved anywhere else, so export them first if you want to keep them.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => void deleteAllGames(db).then(refreshCount),
        },
      ],
    );

  return (
    // The stack header covers the top; no tab bar below, so pad for the home indicator.
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <SettingsSection title="While bowling">
          <SwitchRow
            label="Vibration"
            description="On pin taps, recorded balls and level-ups."
            value={settings.haptics}
            onChange={(value) => void update('haptics', value)}
          />
          <SwitchRow
            label="Keep screen awake"
            description="Stops the phone sleeping between frames."
            value={settings.keepAwake}
            onChange={(value) => void update('keepAwake', value)}
          />
          <SwitchRow
            label="Show best possible score"
            description="The highest score you can still reach this game."
            value={settings.showBestPossible}
            onChange={(value) => void update('showBestPossible', value)}
          />
        </SettingsSection>

        <SettingsSection title="Your data">
          <ActionRow
            label={exporting ? 'Exporting…' : 'Export all games'}
            description="Save a file of every ball you've logged. Games are only stored on this phone for now."
            onPress={() => void exportGames()}
            disabled={exporting || !games}
          />
          <ActionRow
            label="Delete all games"
            description="Removes every game and your XP from this phone."
            onPress={confirmDelete}
            disabled={!games}
            destructive
          />
        </SettingsSection>

        <SettingsSection title="About">
          <InfoRow label="Games on this phone" value={games === null ? '…' : String(games)} />
          <InfoRow label="Version" value={Constants.expoConfig?.version ?? 'unknown'} />
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.xl },
});
