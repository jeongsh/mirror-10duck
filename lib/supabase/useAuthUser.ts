"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getProfileRole, isAdminRole, type ProfileRole } from "@/lib/supabase/admin";
import { supabase } from "@/lib/supabase/client";

type AuthState = {
  session: Session | null | undefined;
  user: User | null | undefined;
  /** 로그인 유저의 `profiles.role` (미로그인 null, 로딩 undefined) */
  profileRole: ProfileRole | null | undefined;
  refreshProfileRole: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profileRole, setProfileRole] = useState<ProfileRole | null | undefined>(undefined);

  const refreshProfileRole = useCallback(async () => {
    if (user === undefined) {
      setProfileRole(undefined);
      return;
    }
    if (!user) {
      setProfileRole(null);
      return;
    }
    const role = await getProfileRole(supabase, user.id);
    setProfileRole(role ?? "USER");
  }, [user]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (user === undefined) {
      setProfileRole(undefined);
      return;
    }
    if (!user) {
      setProfileRole(null);
      return;
    }

    void getProfileRole(supabase, user.id).then((role) => {
      if (!cancelled) setProfileRole(role ?? "USER");
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id, user === undefined ? "loading" : user ? "signed-in" : "signed-out"]);

  const value = useMemo<AuthState>(
    () => ({ session, user, profileRole, refreshProfileRole }),
    [session, user, profileRole, refreshProfileRole],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuthState(): AuthState {
  const state = useContext(AuthContext);
  if (!state) {
    return {
      session: undefined,
      user: undefined,
      profileRole: undefined,
      refreshProfileRole: async () => {},
    };
  }
  return state;
}

export function useAuthUser(): User | null | undefined {
  return useAuthState().user;
}

/** `profiles.role === 'ADMIN'` — 로딩 중 undefined */
export function useIsAdmin(): boolean | undefined {
  const { user, profileRole } = useAuthState();
  if (user === undefined) return undefined;
  if (!user) return false;
  if (profileRole === undefined) return undefined;
  return isAdminRole(profileRole);
}

export function useProfileRole(): ProfileRole | null | undefined {
  return useAuthState().profileRole;
}
