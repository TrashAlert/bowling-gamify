import { Stack, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { HeaderButton } from '@/components/FormField';
import { AchievementList, BadgeGrid, BallCard } from '@/components/ProfileSections';
import { useHistory } from '@/features/history/use-history';
import { ACHIEVEMENTS, BADGES } from '@/features/profile/placeholders';
import { useProfile } from '@/features/profile/profile-context';
import { colors, font, radius, space } from '@/theme';

const HAND_LABEL = { right: 'Right-handed', left: 'Left-handed' } as const;

export default function ProfileScreen() {
  const { profile } = useProfile();
  const history = useHistory(useSQLiteContext());
  const edit = () => router.push('/profile/edit');

  const meta = [history ? `Level ${history.progression.current.level}` : null, profile.hand ? HAND_LABEL[profile.hand] : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerRight: () => <HeaderButton label="Edit" onPress={edit} /> }} />

      <View style={styles.hero}>
        <Avatar name={profile.displayName} size={88} />
        <Text style={styles.name}>{profile.displayName ?? 'Bowler'}</Text>
        {meta !== '' && <Text style={styles.meta}>{meta}</Text>}
      </View>

      <Section title="Favourite ball">
        <BallCard ball={profile.ball} onAdd={edit} />
      </Section>

      <Section title="Badges" comingSoon>
        <BadgeGrid badges={BADGES} />
      </Section>

      <Section title="Achievements" comingSoon>
        <AchievementList achievements={ACHIEVEMENTS} />
      </Section>
    </ScrollView>
  );
}

function Section({ title, comingSoon = false, children }: { title: string; comingSoon?: boolean; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        {comingSoon && <Text style={styles.soon}>Coming soon</Text>}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.xl },
  hero: { alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  name: { color: colors.text, fontSize: font.title, fontWeight: '800', marginTop: space.xs },
  meta: { color: colors.textMuted, fontSize: font.body },
  section: { gap: space.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sectionTitle: { color: colors.textMuted, fontSize: font.small, textTransform: 'uppercase', letterSpacing: 1 },
  soon: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 1,
    overflow: 'hidden',
  },
});
