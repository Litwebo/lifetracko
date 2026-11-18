import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Role } from '../types.ts';
import { useToast } from './ToastContext.tsx';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import {
  isDemoSession,
  startDemoSession,
  endDemoSession,
  getDemoData,
  saveDemoData,
} from '../lib/demoStore.ts';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isDemo: boolean;
  login: (email: string, pass: string, role: Role) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  loginAsDemo: () => void;
  register: (name: string, email: string, pass: string, confirm: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUserData: (partial: Partial<User>) => void;
  setAdminAccess: (allowAdminView: boolean) => Promise<{ success: boolean; error?: string }>;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    if (isDemoSession()) {
      return 'demo_member_session_token';
    }
    return localStorage.getItem('lifetrack_jwt');
  });
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  const isDemo = Boolean(user?.isDemo || isDemoSession());

  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (isDemoSession()) {
      return {
        'Content-Type': 'application/json',
        Authorization: 'Bearer demo_member_session_token',
        'X-Demo-Session': 'true',
      };
    }

    const activeToken = token || localStorage.getItem('lifetrack_jwt');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }
    return headers;
  }, [token]);

  const refreshUser = useCallback(async () => {
    // 1. If currently in an ephemeral demo session, load from demo store
    if (isDemoSession()) {
      const demoData = getDemoData();
      setUser(demoData.user);
      setToken('demo_member_session_token');
      setIsLoading(false);
      return;
    }

    // 2. Otherwise load authenticated user from server
    const activeToken = token || localStorage.getItem('lifetrack_jwt');
    if (!activeToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${activeToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        // Token expired or invalid
        localStorage.removeItem('lifetrack_jwt');
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const loginAsDemo = () => {
    // Clear any previous regular login tokens
    localStorage.removeItem('lifetrack_jwt');
    const demoUser = startDemoSession();
    setToken('demo_member_session_token');
    setUser(demoUser);
    toast.success('Welcome to Demo Mode! Explore member features freely — no data is stored permanently.');
  };

  const login = async (email: string, pass: string, role: Role): Promise<{ success: boolean; error?: string }> => {
    // If exiting demo mode
    if (isDemoSession()) {
      endDemoSession();
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed.' };
      }

      localStorage.setItem('lifetrack_jwt', data.token);
      setToken(data.token);
      setUser(data.user);
      toast.success(`Welcome back, ${data.user.name}!`);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    if (isDemoSession()) {
      endDemoSession();
    }

    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await result.user.getIdToken();

      const res = await fetch('/api/auth/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Google login failed.' };
      }

      localStorage.setItem('lifetrack_jwt', data.token);
      setToken(data.token);
      setUser(data.user);
      toast.success(`Welcome back, ${data.user.name}! Connected with Google.`);
      return { success: true };
    } catch (err: any) {
      console.error('Google Sign-In error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        return { success: false, error: 'Google sign-in popup was closed.' };
      }
      return { success: false, error: err.message || 'Google sign-in failed. Please try again or use Gmail/password.' };
    }
  };

  const register = async (name: string, email: string, pass: string, confirm: string): Promise<{ success: boolean; error?: string }> => {
    if (isDemoSession()) {
      endDemoSession();
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password: pass, confirmPassword: confirm }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Registration failed.' };
      }

      localStorage.setItem('lifetrack_jwt', data.token);
      setToken(data.token);
      setUser(data.user);
      toast.success('Registration successful! Welcome to Life Tracko.');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: 'Network error during registration.' };
    }
  };

  const logout = async () => {
    if (isDemoSession()) {
      endDemoSession();
      setToken(null);
      setUser(null);
      toast.info('Exited Demo mode. All temporary data has been cleared.');
      return;
    }

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('lifetrack_jwt');
    setToken(null);
    setUser(null);
    toast.info('Logged out successfully.');
  };

  const updateUserData = (partial: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...partial };
      if (isDemoSession()) {
        const store = getDemoData();
        store.user = updated;
        saveDemoData(store);
      }
      return updated;
    });
  };

  const setAdminAccess = async (allowAdminView: boolean): Promise<{ success: boolean; error?: string }> => {
    if (isDemoSession()) {
      updateUserData({ allowAdminView, adminAccessDecided: true });
      toast.info(allowAdminView ? 'Demo data set to visible (demo only).' : 'Demo data set to private.');
      return { success: true };
    }

    try {
      const res = await fetch('/api/user/admin-access', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ allowAdminView }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to update admin access.' };
      }
      updateUserData({ allowAdminView, adminAccessDecided: true });
      toast.success(data.message || (allowAdminView ? 'Admin access granted.' : 'Data set to private.'));
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Network error updating privacy settings.' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isDemo,
        login,
        loginWithGoogle,
        loginAsDemo,
        register,
        logout,
        refreshUser,
        updateUserData,
        setAdminAccess,
        getAuthHeaders,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
