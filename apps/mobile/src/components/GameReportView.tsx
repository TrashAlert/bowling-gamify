import type { GameReport, XpGain } from '@bowling-rpg/progression';
import type { PinMask } from '@bowling-rpg/scoring';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '@/theme';
import { MonsterRow } from './MonsterRow';
import { XpBar } from './XpBar';

export interface GameReportViewProps {
  readonly report: GameReport;
  /** The XP this game earned. Omit to leave XP out of the report. */
  readonly xp?: XpGain;
  /** The bestiary's monster list. Off while the bestiary is hidden. */
  readonly showMonsters?: boolean;
  readonly onMonsterPress?: (leave: PinMask) => void;
}

/** The after-action report: what the game was worth. */
export function GameReportView({ report, xp, showMonsters = false, onMonsterPress }: GameReportViewProps) {
  const leveledUp = xp !== undefined && xp.levelsGained > 0;

  useEffect(() => {
    if (leveledUp) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [leveledUp]);

  return (
    <View style={styles.report}>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>{report.isComplete ? 'Final score' : 'Unfinished game'}</Text>
        <Text style={styles.heroScore}>{report.score}</Text>
      </View>

      {xp && (
        <View style={styles.xp}>
          {report.isComplete ? (
            <>
              <Text style={styles.xpGained}>+{xp.xp} XP</Text>
              {leveledUp && (
                <Text style={styles.levelUp} accessibilityRole="header">
                  LEVEL UP · Level {xp.after.level}
                </Text>
              )}
              {/* After a level-up the bar belongs to the new level, so it fills from empty. */}
              <XpBar progress={xp.after} animateFrom={leveledUp ? 0 : xp.before.fraction} />
            </>
          ) : (
            <Text style={styles.muted}>Finish a game to earn XP.</Text>
          )}
        </View>
      )}

      <View style={styles.stats}>
        <Stat label="Strikes" value={String(report.strikes)} />
        <Stat label="Spares" value={String(report.spares)} />
        <Stat label="Open" value={String(report.openFrames)} />
        <Stat label="Splits" value={`${report.splitsConverted}/${report.splitsFaced}`} />
      </View>

      {showMonsters && <Monsters report={report} onMonsterPress={onMonsterPress} />}
    </View>
  );
}

function Monsters({ report, onMonsterPress }: { report: GameReport; onMonsterPress: ((leave: PinMask) => void) | undefined }) {
  const slain = report.monsters.filter((m) => m.converted).length;
  const discovered = report.monsters.filter((m) => m.isNew).length;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        Monsters · {slain} of {report.monsters.length} slain
        {discovered > 0 ? ` · ${discovered} new` : ''}
      </Text>
      {report.monsters.length === 0 ? (
        <Text style={styles.muted}>No spares needed. Nothing survived the first ball.</Text>
      ) : (
        report.monsters.map((monster, i) => (
          <MonsterRow
            key={`${monster.frameNumber}-${i}`}
            leave={monster.leave}
            name={monster.name}
            tier={monster.tier}
            isNew={monster.isNew}
            detail={monster.converted ? '✓ Slain' : '✗ Escaped'}
            tone={monster.converted ? 'good' : 'bad'}
            onPress={() => onMonsterPress?.(monster.leave)}
          />
        ))
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  report: { gap: space.xl },
  hero: { alignItems: 'center', gap: space.xs },
  heroLabel: { color: colors.textMuted, fontSize: font.small, textTransform: 'uppercase', letterSpacing: 1 },
  heroScore: { color: colors.text, fontSize: font.score * 1.4, fontWeight: '900' },
  xp: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  xpGained: { color: colors.accent, fontSize: font.title * 1.4, fontWeight: '900', textAlign: 'center' },
  levelUp: {
    color: colors.accentText,
    backgroundColor: colors.accent,
    fontSize: font.body,
    fontWeight: '900',
    textAlign: 'center',
    paddingVertical: space.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
    letterSpacing: 1,
  },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: space.md, alignItems: 'center' },
  statValue: { color: colors.text, fontSize: font.title, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: font.small },
  section: { gap: space.sm },
  sectionTitle: { color: colors.textMuted, fontSize: font.small, textTransform: 'uppercase', letterSpacing: 1 },
  muted: { color: colors.textMuted, fontSize: font.body, textAlign: 'center' },
});
