"use client"

import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";

interface UserProfile {
  email: string;
  uid: string;
  name?: string;
  subscribed?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  sendOTP: (email: string) => Promise<boolean>;
  verifyOTP: (email: string, otp: string) => Promise<boolean>;
  toggleAlertsSubscription: (subscribed: boolean) => Promise<boolean>;
  loginWithFirebaseMock: (email: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Backend API base URL — set NEXT_PUBLIC_API_URL in website/.env.local
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Restore user from localStorage on load
  useEffect(() => {
    const savedUser = localStorage.getItem("glaciowatch_user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Failed to restore user from localStorage:", e);
      }
    }
    
    // Listen to genuine Firebase Auth state changes if configured
    if (isFirebaseConfigured) {
      const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
        if (fbUser) {
          try {
            const token = await fbUser.getIdToken();
            await loginWithFirebaseToken(token);
          } catch (e) {
            console.error("Firebase auth sync failed:", e);
          }
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  const loginWithFirebaseToken = async (token: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/firebase-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Firebase login failed");
      }
      
      setUser(data.user);
      localStorage.setItem("glaciowatch_user", JSON.stringify(data.user));
      return true;
    } catch (err: any) {
      setError(err.message || "Connection to backend failed");
      return false;
    }
  };

  const loginWithFirebaseMock = async (email: string): Promise<boolean> => {
    // Generate a mock token for verification by the backend
    const mockToken = `mock-token-${email}`;
    return loginWithFirebaseToken(mockToken);
  };

  const sendOTP = async (email: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to send OTP");
      }
      return true;
    } catch (err: any) {
      setError(err.message || "Connection to backend failed");
      return false;
    }
  };

  const verifyOTP = async (email: string, otp: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Verification failed");
      }
      
      setUser(data.user);
      localStorage.setItem("glaciowatch_user", JSON.stringify(data.user));
      return true;
    } catch (err: any) {
      setError(err.message || "Connection to backend failed");
      return false;
    }
  };

  const toggleAlertsSubscription = async (subscribed: boolean): Promise<boolean> => {
    if (!user) return false;
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/notifications/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, subscribed }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to update subscription");
      }
      
      const updatedUser = { ...user, subscribed: data.subscribed };
      setUser(updatedUser);
      localStorage.setItem("glaciowatch_user", JSON.stringify(updatedUser));
      return true;
    } catch (err: any) {
      setError(err.message || "Failed to update notification preference");
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("glaciowatch_user");
    if (isFirebaseConfigured) {
      auth.signOut();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        sendOTP,
        verifyOTP,
        toggleAlertsSubscription,
        loginWithFirebaseMock,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
