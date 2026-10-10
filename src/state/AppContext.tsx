import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Answers } from '../core/router';
import type { Profile, Triage } from '../core/types';
import i18n from '../i18n';
import { refreshCountyData } from '../services/county';
import { removeStaleModels } from '../services/models';
import { useOnline } from '../services/network';
import { loadProfile, saveProfile } from '../services/storage';

/** The request being handled: what the resident said, and what triage returned. */
export type Session = {
  text: string;
  english: string;
  photoBase64?: string;
  photoUri?: string;
  triage: Triage;
  answers: Answers;
};

type AppState = {
  ready: boolean;
  profile: Profile | null;
  setProfile: (p: Profile) => Promise<void>;
  online: boolean;
  session: Session | null;
  setSession: (s: Session | null) => void;
};

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const online = useOnline();

  useEffect(() => {
    try {
      removeStaleModels();
    } catch {}
    loadProfile()
      .then((p) => {
        setProfileState(p);
        if (p) i18n.changeLanguage(p.language);
      })
      .finally(() => setReady(true));
  }, []);

  // Cache county data whenever a connection is available, for use offline.
  useEffect(() => {
    if (online) refreshCountyData(profile?.addressCoords ?? null);
  }, [online, profile?.addressCoords]);

  const setProfile = useCallback(async (p: Profile) => {
    await saveProfile(p);
    setProfileState(p);
    await i18n.changeLanguage(p.language);
  }, []);

  const value = useMemo(
    () => ({ ready, profile, setProfile, online, session, setSession }),
    [ready, profile, setProfile, online, session],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}
