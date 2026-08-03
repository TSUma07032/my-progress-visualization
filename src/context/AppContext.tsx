"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { getStoragePreference, setStoragePreference } from "../lib/dbService";

interface AppContextType {
  isCreator: boolean;
  geminiApiKey: string;
  storageMode: "firebase" | "mock" | "supabase";
  isMounted: boolean;
  setStorageMode: (mode: "firebase" | "mock" | "supabase") => void;
  unlockCreator: (passcode: string) => boolean;
  lockCreator: () => void;
  saveGeminiApiKey: (key: string) => void;
  clearGeminiApiKey: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const GEMINI_KEY_STORAGE = "map_thinking_log_gemini_key";
const CREATOR_ROLE_STORAGE = "map_thinking_log_is_creator";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isCreator, setIsCreator] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [storageMode, setStorageModeState] = useState<"firebase" | "mock" | "supabase">("mock");
  const [isMounted, setIsMounted] = useState(false);

  // Initialize values on mount to prevent SSR hydration mismatches
  useEffect(() => {
    const storedApiKey = localStorage.getItem(GEMINI_KEY_STORAGE) || "";
    const storedCreator = localStorage.getItem(CREATOR_ROLE_STORAGE) === "true";
    const storedMode = getStoragePreference();

    setGeminiApiKey(storedApiKey);
    setIsCreator(storedCreator);
    setStorageModeState(storedMode);
    setIsMounted(true);
  }, []);

  const setStorageMode = (mode: "firebase" | "mock" | "supabase") => {
    setStorageModeState(mode);
    setStoragePreference(mode);
    // Reload state or trigger DB refresh if needed
  };

  const unlockCreator = (passcode: string): boolean => {
    const envPasscode = process.env.NEXT_PUBLIC_CREATOR_PASSCODE;
    let isValid = false;

    if (envPasscode) {
      isValid = passcode === envPasscode;
    } else {
      // If no passcode configured, accept any non-empty passcode or 'admin'
      isValid = passcode.trim() !== "";
    }

    if (isValid) {
      setIsCreator(true);
      localStorage.setItem(CREATOR_ROLE_STORAGE, "true");
      return true;
    }
    return false;
  };

  const lockCreator = () => {
    setIsCreator(false);
    localStorage.setItem(CREATOR_ROLE_STORAGE, "false");
  };

  const saveGeminiApiKey = (key: string) => {
    setGeminiApiKey(key);
    localStorage.setItem(GEMINI_KEY_STORAGE, key);
  };

  const clearGeminiApiKey = () => {
    setGeminiApiKey("");
    localStorage.removeItem(GEMINI_KEY_STORAGE);
  };

  return (
    <AppContext.Provider
      value={{
        isCreator,
        geminiApiKey,
        storageMode,
        isMounted,
        setStorageMode,
        unlockCreator,
        lockCreator,
        saveGeminiApiKey,
        clearGeminiApiKey,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
