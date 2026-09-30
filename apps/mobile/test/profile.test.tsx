import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Text } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { FormField, HeaderButton } from '@/components/FormField';
import { AchievementList, BadgeGrid, BallCard } from '@/components/ProfileSections';
import { deleteAllGames } from '@/db/backup';
import { startSession } from '@/db/games';
import { EMPTY_PROFILE, type Profile, fetchProfile, saveProfile } from '@/db/profile';
import { type ProfileDraft, draftFrom, initials, parseDraft } from '@/features/profile/draft';
import { ACHIEVEMENTS, BADGES } from '@/features/profile/placeholders';
import { ProfileProvider, useProfile } from '@/features/profile/profile-context';
import { createMemoryDb } from './memory-db';

const FULL: Profile = { displayName: 'Syah', hand: 'right', ball: { name: 'Phaze II', brand: 'Storm', weightLb: 15 } };

let db: SQLiteDatabase;
beforeEach(async () => {
  db = await createMemoryDb();
});

describe('the stored profile', () => {
  it('is empty on a fresh install', async () => {
    expect(await fetchProfile(db)).toEqual(EMPTY_PROFILE);
  });

  it('round-trips, and saving again replaces it', async () => {
    await saveProfile(db, FULL);
    expect(await fetchProfile(db)).toEqual(FULL);

    await saveProfile(db, { ...FULL, hand: null, ball: null });
    expect(await fetchProfile(db)).toEqual({ displayName: 'Syah', hand: null, ball: null });
  });

  it('keeps a ball with no brand or weight', async () => {
    await saveProfile(db, { ...FULL, ball: { name: 'House ball', brand: null, weightLb: null } });
    expect((await fetchProfile(db)).ball).toEqual({ name: 'House ball', brand: null, weightLb: null });
  });

  it('refuses an illegal weight even if the form let it through', async () => {
    await expect(saveProfile(db, { ...FULL, ball: { name: 'Anvil', brand: null, weightLb: 17 } })).rejects.toThrow(/CHECK constraint/);
  });

  it('survives deleting all games', async () => {
    await saveProfile(db, FULL);
    await startSession(db);
    await deleteAllGames(db);
    expect(await fetchProfile(db)).toEqual(FULL);
  });
});

describe('the edit form', () => {
  const draft = (overrides: Partial<ProfileDraft>): ProfileDraft => ({ ...draftFrom(EMPTY_PROFILE), ...overrides });

  it('starts from the saved profile', () => {
    expect(draftFrom(FULL)).toEqual({ displayName: 'Syah', hand: 'right', ballName: 'Phaze II', ballBrand: 'Storm', ballWeight: '15' });
    expect(draftFrom(EMPTY_PROFILE)).toEqual({ displayName: '', hand: null, ballName: '', ballBrand: '', ballWeight: '' });
  });

  it('trims fields and treats blanks as not set', () => {
    expect(parseDraft(draft({ displayName: '  Syah  ', ballName: ' Phaze II ', ballWeight: ' 15 ' }))).toEqual({
      ok: true,
      profile: { displayName: 'Syah', hand: null, ball: { name: 'Phaze II', brand: null, weightLb: 15 } },
    });
    expect(parseDraft(draft({ displayName: '   ' }))).toEqual({ ok: true, profile: EMPTY_PROFILE });
  });

  it.each([
    ['5', 'Enter a whole number from 6 to 16.'],
    ['17', 'Enter a whole number from 6 to 16.'],
    ['15.5', 'Enter a whole number from 6 to 16.'],
    ['heavy', 'Enter a whole number from 6 to 16.'],
  ])('rejects a weight of %j', (ballWeight, message) => {
    expect(parseDraft(draft({ ballName: 'Phaze II', ballWeight }))).toEqual({ ok: false, errors: { ballWeight: message } });
  });

  it('asks for a ball name when only a brand or weight is given', () => {
    expect(parseDraft(draft({ ballBrand: 'Storm' }))).toEqual({ ok: false, errors: { ballName: 'Give the ball a name.' } });
    expect(parseDraft(draft({ ballWeight: '15' }))).toEqual({ ok: false, errors: { ballName: 'Give the ball a name.' } });
  });

  it('caps the length of every text field', () => {
    const result = parseDraft(draft({ displayName: 'x'.repeat(31), ballName: 'y'.repeat(41), ballBrand: 'z'.repeat(41) }));
    expect(result).toEqual({
      ok: false,
      errors: {
        displayName: 'Keep it to 30 characters.',
        ballName: 'Keep it to 40 characters.',
        ballBrand: 'Keep it to 40 characters.',
      },
    });
  });

  it.each([
    ['Syahmi Samad', 'SS'],
    ['syah', 'S'],
    ['  Ali  bin  Abu ', 'AB'],
    ['', null],
    [null, null],
  ])('makes initials from %j', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe('the profile provider', () => {
  function Probe() {
    const { profile, save } = useProfile();
    return <Text onPress={() => void save({ ...profile, displayName: 'Renamed' })}>name:{profile.displayName ?? 'none'}</Text>;
  }

  it('loads the stored profile and saves changes', async () => {
    await saveProfile(db, FULL);
    await render(
      <ProfileProvider db={db}>
        <Probe />
      </ProfileProvider>,
    );
    await act(async () => {});
    expect(screen.getByText('name:Syah')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('name:Syah'));
    expect(screen.getByText('name:Renamed')).toBeOnTheScreen();
    expect((await fetchProfile(db)).displayName).toBe('Renamed');
  });
});

describe('profile components', () => {
  it('the avatar shows initials, or a person before a name is set', async () => {
    await render(<Avatar name="Syahmi Samad" />);
    expect(screen.getByText('SS')).toBeOnTheScreen();
    await render(<Avatar name={null} />);
    expect(screen.getByTestId('avatar-placeholder')).toBeOnTheScreen();
  });

  it('the ball card describes the ball, or invites you to add one', async () => {
    await render(<BallCard ball={FULL.ball} onAdd={jest.fn()} />);
    expect(screen.getByLabelText('Favourite ball: Phaze II, Storm · 15 lb')).toBeOnTheScreen();

    const onAdd = jest.fn();
    await render(<BallCard ball={null} onAdd={onAdd} />);
    await fireEvent.press(screen.getByText('Add your favourite ball'));
    expect(onAdd).toHaveBeenCalled();
  });

  it('badges and achievements are all shown locked', async () => {
    await render(<BadgeGrid badges={BADGES} />);
    expect(screen.getAllByLabelText(/, locked$/)).toHaveLength(BADGES.length);

    await render(<AchievementList achievements={ACHIEVEMENTS} />);
    expect(screen.getAllByLabelText(/Locked\.$/)).toHaveLength(ACHIEVEMENTS.length);
    expect(screen.getByText('Finish a game with no open frames.')).toBeOnTheScreen();
  });

  it('a form field shows its hint, swaps it for an error, and reports typing', async () => {
    const onChangeText = jest.fn();
    await render(<FormField label="Weight (lb)" value="" onChangeText={onChangeText} hint="6 to 16 lb" />);
    expect(screen.getByText('6 to 16 lb')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Weight (lb)'), '15');
    expect(onChangeText).toHaveBeenCalledWith('15');

    await render(<FormField label="Weight (lb)" value="17" hint="6 to 16 lb" error="Enter a whole number from 6 to 16." />);
    expect(screen.getByText('Enter a whole number from 6 to 16.')).toBeOnTheScreen();
    expect(screen.queryByText('6 to 16 lb')).toBeNull();
  });

  it('a disabled header button does nothing', async () => {
    const onPress = jest.fn();
    await render(<HeaderButton label="Save" onPress={onPress} disabled bold />);
    await fireEvent.press(screen.getByText('Save'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
