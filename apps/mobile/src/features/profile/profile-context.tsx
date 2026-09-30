import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Db } from '@/db/games';
import { EMPTY_PROFILE, type Profile, fetchProfile, saveProfile } from '@/db/profile';

interface ProfileContextValue {
  readonly profile: Profile;
  readonly save: (profile: Profile) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue>({ profile: EMPTY_PROFILE, save: async () => {} });

/** The bowler's profile, shared so the header avatar updates the moment it's saved. */
export function ProfileProvider({ db, children }: { db: Db; children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);

  useEffect(() => {
    let cancelled = false;
    void fetchProfile(db).then((loaded) => {
      if (!cancelled) setProfile(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const save = useCallback(
    async (next: Profile) => {
      await saveProfile(db, next);
      setProfile(next);
    },
    [db],
  );

  const value = useMemo(() => ({ profile, save }), [profile, save]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  return useContext(ProfileContext);
}
