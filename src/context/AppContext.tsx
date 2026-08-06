"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { setStoragePreference } from "../lib/dbService";
import { initSupabase } from "../lib/supabase";

interface AppContextType {
  isCreator: boolean;
  geminiApiKey: string;
  storageMode: "supabase";
  isMounted: boolean;
  setStorageMode: () => void;
  unlockCreator: (passcode: string) => boolean;
  lockCreator: () => void;
  saveGeminiApiKey: (key: string) => void;
  clearGeminiApiKey: () => void;
  supabaseUrl: string;
  supabaseKey: string;
  saveSupabaseConfig: (url: string, key: string) => void;
  clearSupabaseConfig: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const GEMINI_KEY_STORAGE = "map_thinking_log_gemini_key";
const CREATOR_ROLE_STORAGE = "map_thinking_log_is_creator";
const SUPABASE_URL_STORAGE = "map_thinking_log_supabase_url";
const SUPABASE_KEY_STORAGE = "map_thinking_log_supabase_key";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isCreator, setIsCreator] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [storageMode, setStorageModeState] = useState<"supabase">("supabase");
  const [isMounted, setIsMounted] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseKey, setSupabaseKey] = useState("");

  // Initialize values on mount to prevent SSR hydration mismatches
  useEffect(() => {
    const storedApiKey = localStorage.getItem(GEMINI_KEY_STORAGE) || "";
    const storedCreator = localStorage.getItem(CREATOR_ROLE_STORAGE) === "true";
    const storedMode = "supabase";
    const storedSupabaseUrl = localStorage.getItem(SUPABASE_URL_STORAGE) || "";
    const storedSupabaseKey = localStorage.getItem(SUPABASE_KEY_STORAGE) || "";
    if (storedSupabaseUrl && storedSupabaseKey) {
      initSupabase(storedSupabaseUrl, storedSupabaseKey);
    }

    setGeminiApiKey(storedApiKey);
    setIsCreator(storedCreator);
    setStorageModeState(storedMode);
    setSupabaseUrl(storedSupabaseUrl);
    setSupabaseKey(storedSupabaseKey);
    setIsMounted(true);
  }, []);

  const setStorageMode = () => {
    setStorageModeState("supabase");
    setStoragePreference("supabase");
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

  const saveSupabaseConfig = (url: string, key: string) => {
    setSupabaseUrl(url);
    setSupabaseKey(key);
    localStorage.setItem(SUPABASE_URL_STORAGE, url);
    localStorage.setItem(SUPABASE_KEY_STORAGE, key);
    initSupabase(url, key);
  };

  const clearSupabaseConfig = () => {
    setSupabaseUrl("");
    setSupabaseKey("");
    localStorage.removeItem(SUPABASE_URL_STORAGE);
    localStorage.removeItem(SUPABASE_KEY_STORAGE);
    initSupabase("", "");
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
        supabaseUrl,
        supabaseKey,
        saveSupabaseConfig,
        clearSupabaseConfig,
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
