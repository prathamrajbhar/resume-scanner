'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { clearStoredAuth, getStoredToken, getStoredUser, setStoredToken, setStoredUser } from '@/lib/storage';

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  google_id?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogleToken: (credential: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  loginWithGoogleToken: async () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check valid token on load
  useEffect(() => {
    const checkAuth = async () => {
      const token = getStoredToken();
      if (token) {
        try {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          const res = await axios.get('http://localhost:8000/api/auth/me');
          setUser(res.data);
        } catch (error) {
          console.error("Invalid token", error);
          clearStoredAuth();
        }
      } else {
        const storedUser = getStoredUser();
        if (storedUser) {
          setUser(storedUser);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const loginWithGoogleToken = async (credential: string) => {
    try {
      const response = await axios.post('http://localhost:8000/api/auth/google/login', {
        credential
      });
      const { access_token, user } = response.data;
      setStoredToken(access_token);
      setStoredUser(user);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      setUser(user);
    } catch (error) {
      console.error("Google login failed", error);
      throw error;
    }
  };

  const logout = () => {
    clearStoredAuth();
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'dummy-client-id'}>
      <AuthContext.Provider value={{ user, loading, loginWithGoogleToken, logout }}>
        {children}
      </AuthContext.Provider>
    </GoogleOAuthProvider>
  );
}
