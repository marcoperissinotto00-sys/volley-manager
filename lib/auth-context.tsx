'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type UserRole = 'admin' | 'coach' | 'player';

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  user_role: UserRole;
  court_role: string | null;
  jersey_number: number | null;
  is_active: boolean;
  avatar_url: string | null;
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isCoach: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  isCoach: false,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      setProfile(data as Profile);
      return;
    }

    if (!error && !data) {
      // Account autenticato ma senza riga in "users" (es. un atleta eliminato che
      // torna ad accedere): ricrea il profilo come una nuova iscrizione in attesa
      // di approvazione, così non resta bloccato senza via di recupero.
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData.user;
      if (!authUser) return;
      const meta = authUser.user_metadata || {};
      const { data: created } = await supabase
        .from('users')
        .insert({
          id: userId,
          first_name: meta.first_name || meta.given_name || '',
          last_name: meta.last_name || meta.family_name || '',
          email: authUser.email || '',
          user_role: 'player',
          is_active: false,
        })
        .select()
        .single();
      if (created) setProfile(created as Profile);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadProfile(session.user.id);
      }
      setLoading(false);
    }
    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function refreshProfile() {
    if (user) await loadProfile(user.id);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const isCoach = profile?.user_role === 'coach' || profile?.user_role === 'admin';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isCoach, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
