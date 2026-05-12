import { MMKV } from "react-native-mmkv";

export const mmkv = new MMKV();

/**
 * Storage adapter compatible with Supabase Auth
 */
export const supabaseStorageAdapter = {
  getItem: (key: string) => {
    const value = mmkv.getString(key);
    return value ?? null;
  },
  setItem: (key: string, value: string) => {
    mmkv.set(key, value);
  },
  removeItem: (key: string) => {
    mmkv.delete(key);
  },
};

/**
 * Storage adapter compatible with TanStack Query Persister
 */
export const queryStorageAdapter = {
  getItem: (key: string) => {
    const value = mmkv.getString(key);
    return value ?? null;
  },
  setItem: (key: string, value: string) => {
    mmkv.set(key, value);
  },
  removeItem: (key: string) => {
    mmkv.delete(key);
  },
};
