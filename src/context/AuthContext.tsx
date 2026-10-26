import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Subscription, User } from '../types/index.js';
import { supabase } from '../services/supabase.js';
import { api } from '../services/api.js';
import { useToast } from './ToastContext.js';

interface AuthContextType {
  user: User | null;
  subscription: Subscription | null;
  status: 'active' | 'pending' | 'disabled' | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// SECURITY (pre-merge review): seeded pilot credentials were previously
// hard-coded here so a one-tap "persona switch" could sign anyone in —
// including the Director/Admin role. That is removed. All sign-ins now go
// through the normal credential entry, validated server-side (see
// server/db/store.ts — seeded passwords are provisioned via server
// environment, never shipped to the client).
const PILOT_SESSION_KEY = 'aether_pilot_session';

interface PilotSession {
  token: string;
  user: User;
  subscription: Subscription | null;
}

function persistPilotSession(session: PilotSession | null) {
  try {
    if (session) {
      localStorage.setItem(PILOT_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(PILOT_SESSION_KEY);
    }
  } catch {
    // storage unavailable (private mode) — session stays in-memory only
  }
}

function readPilotSession(): PilotSession | null {
  try {
    const raw = localStorage.getItem(PILOT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PilotSession;
    if (!parsed?.token || !parsed?.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [status, setStatus] = useState<'active' | 'pending' | 'disabled' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  const loadUserContext = useCallback(async (userId: string) => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }
    try {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
      const { data: member } = await supabase.from('private_members').select('status').eq('user_id', userId).single();
      const { data: sub } = await supabase.from('subscriptions').select('*').eq('user_id', userId).single();

      if (profile) {
        setUser({
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.role,
          avatarUrl: profile.avatar_url,
          createdAt: profile.created_at,
        });
        setStatus(member?.status || 'pending');
        setSubscription(sub);
      }
    } catch (err) {
      console.error('Context load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // 1) Restore an existing backend pilot session (pilot login)
    const pilotSession = readPilotSession();
    if (pilotSession) {
      api
        .getMe(pilotSession.token)
        .then((me) => {
          setUser(me.user);
          setSubscription(me.subscription);
          setStatus('active');
          setIsLoading(false);
        })
        .catch(() => {
          persistPilotSession(null);
          continueSupabaseRestore();
        });
      return;
    }

    // 2) Restore a Supabase session if present
    continueSupabaseRestore();

    function continueSupabaseRestore() {
      if (!supabase) {
        setIsLoading(false);
        return;
      }
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          loadUserContext(session.user.id);
        } else {
          setIsLoading(false);
        }
      });

      const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          loadUserContext(session.user.id);
        } else {
          setUser(null);
          setSubscription(null);
          setStatus(null);
          setIsLoading(false);
        }
      });

      return () => authSubscription.unsubscribe();
    }
  }, [loadUserContext]);

  const login = async (email: string, password: string): Promise<boolean> => {
    // Path A — Supabase auth (primary, when the client is configured)
    if (supabase) {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) {
          showToast(`Welcome!`, 'success');
          return true;
        }
        // Fall through to the private-pilot backend for seeded pilot members
        // that live in the server-side pilot store.
      } catch (err: any) {
        // Fall through to backend pilot auth below.
      }
    }

    // Path B — Backend private-pilot API (seeded approved household members)
    try {
      const res = await api.login(email, password);
      if (res.success && res.user) {
        const session: PilotSession = {
          token: res.token,
          user: res.user,
          subscription: res.subscription ?? null,
        };
        persistPilotSession(session);
        setUser(session.user);
        setSubscription(session.subscription);
        setStatus('active');
        showToast(`Welcome back, ${session.user.name.split(' ')[0]}!`, 'success');
        return true;
      }
      return false;
    } catch (err: any) {
      showToast(err.message || 'Login failed', 'error');
      return false;
    }
  };

  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    if (!supabase) {
      // Private pilot mode — registration handled by backend (disabled when
      // PUBLIC_REGISTRATION=false, which is the required pilot setting).
      try {
        await api.register(name, email, password);
        showToast('Account requested. Please wait for admin approval.', 'success');
        return true;
      } catch (err: any) {
        showToast(err.message || 'Registration failed', 'error');
        return false;
      }
    }
    try {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
      if (error) throw error;
      if (data.user) {
        await supabase.from('profiles').insert([{ id: data.user.id, email, name, role: 'customer' }]);
        await supabase.from('private_members').insert([{ user_id: data.user.id, email, name, status: 'pending' }]);
      }
      showToast(`Account requested. Please wait for admin approval.`, 'success');
      return true;
    } catch (err: any) {
      showToast(err.message || 'Registration failed', 'error');
      return false;
    }
  };

  const logout = async () => {
    persistPilotSession(null);
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore network/auth errors during sign-out
      }
    }
    setUser(null);
    setSubscription(null);
    setStatus(null);
    showToast('Signed out', 'info');
  };

  const refreshSubscription = useCallback(async () => {
    try {
      const pilotSession = readPilotSession();
      if (pilotSession) {
        const me = await api.getMe(pilotSession.token);
        setUser(me.user);
        setSubscription(me.subscription);
        setStatus('active');
        return;
      }
      if (user) {
        const data = await api.getMySubscription(user.id);
        if (data?.subscription) {
          setSubscription(data.subscription);
        }
      }
    } catch (err) {
      console.warn('Subscription refresh failed:', err);
    }
  }, [user]);

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        subscription,
        status,
        isLoading,
        isAdmin,
        login,
        register,
        logout,
        refreshSubscription,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
