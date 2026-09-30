import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { fetchExport } from '@/db/backup';
import type { Db } from '@/db/games';

export type ShareResult = 'shared' | 'unavailable';

/**
 * Writes every game to a JSON file and opens the share sheet, so the bowler can
 * save it to Files, AirDrop it, or email it to themselves. The file goes in the
 * cache directory: the share sheet makes its own copy wherever it's sent.
 */
export async function shareExport(db: Db, now: Date = new Date()): Promise<ShareResult> {
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';

  const data = await fetchExport(db, now);
  const file = new File(Paths.cache, `bowling-rpg-${now.toISOString().slice(0, 10)}.json`);
  file.create({ overwrite: true });
  file.write(JSON.stringify(data, null, 2));

  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Export your games' });
  return 'shared';
}
