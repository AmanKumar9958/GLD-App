import { createMMKV, MMKV } from "react-native-mmkv";
import * as SecureStore from "expo-secure-store";

// ─── Lazy + safe singleton ─────────────────────────────────────────────────────
// `new MMKV()` is deferred and wrapped in try/catch.
// If MMKV is unavailable (wrong dev client, architecture mismatch, etc.),
// all storage operations silently fall back to an in-memory Map so the app
// keeps running instead of crashing.

let _mmkv: MMKV | null = null;
let _mmkvFailed = false;

// Simple in-memory fallback (data won't persist across restarts, but no crash)
const _memStore = new Map<string, string>();

function getMMKV(): MMKV | null {
  if (_mmkvFailed) return null;
  if (_mmkv) return _mmkv;
  try {
    _mmkv = createMMKV();
    return _mmkv;
  } catch (e) {
    console.warn(
      "[storage] MMKV native module failed to initialize. " +
        "Falling back to in-memory storage. " +
        "Rebuild your dev client to restore persistence.",
      e
    );
    _mmkvFailed = true;
    return null;
  }
}

// ─── Exported mmkv proxy (drop-in replacement for `createMMKV()`) ───────────────
export const mmkv = new Proxy({} as MMKV, {
  get(_target, prop) {
    const instance = getMMKV();
    if (instance) {
      const value = (instance as any)[prop];
      return typeof value === "function" ? value.bind(instance) : value;
    }
    // In-memory fallback for the methods we actually use:
    if (prop === "getString") return (key: string) => _memStore.get(key) ?? undefined;
    if (prop === "set") return (key: string, value: string | number | boolean) => {
      _memStore.set(key, String(value));
    };
    if (prop === "remove") return (key: string) => { _memStore.delete(key); };
    if (prop === "contains") return (key: string) => _memStore.has(key);
    if (prop === "getAllKeys") return () => Array.from(_memStore.keys());
    return undefined;
  },
  set(_target, prop, value) {
    const instance = getMMKV();
    if (instance) {
      (instance as any)[prop] = value;
    }
    return true;
  },
});

// ─── Secure Supabase auth storage adapter ────────────────────────────────────
// Stores auth tokens in a dedicated, encrypted MMKV instance (AES-128 CFB).
// The encryption key itself is generated once and saved into the device's
// hardware-backed secure storage (iOS Keychain / Android Keystore) via expo-secure-store.

const SECURE_AUTH_MMKV_ID = "gld.supabase.auth";
const SECURE_STORE_KEY = "gld_auth_mmkv_encryption_key";

let _secureAuthMMKV: MMKV | null = null;
let _secureAuthInitPromise: Promise<MMKV | null> | null = null;

function generateSecureRandomHex(length: number = 32): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(length / 2);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  let result = "";
  const chars = "abcdef0123456789";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function getOrCreateAuthEncryptionKey(): Promise<string> {
  try {
    let key = await SecureStore.getItemAsync(SECURE_STORE_KEY);
    if (!key) {
      key = generateSecureRandomHex(32);
      await SecureStore.setItemAsync(SECURE_STORE_KEY, key);
    }
    return key;
  } catch (err) {
    console.warn("[storage] SecureStore unavailable, using fallback key for auth MMKV encryption.", err);
    return "gld_fallback_device_key_secure_2026";
  }
}

async function getSecureAuthMMKV(): Promise<MMKV | null> {
  if (_secureAuthMMKV) return _secureAuthMMKV;
  if (_secureAuthInitPromise) return _secureAuthInitPromise;

  _secureAuthInitPromise = (async () => {
    try {
      const encryptionKey = await getOrCreateAuthEncryptionKey();
      _secureAuthMMKV = createMMKV({
        id: SECURE_AUTH_MMKV_ID,
        encryptionKey,
      });
      return _secureAuthMMKV;
    } catch (err) {
      console.warn("[storage] Failed to initialize encrypted MMKV for auth.", err);
      return null;
    }
  })();

  return _secureAuthInitPromise;
}

export const supabaseStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const secureInstance = await getSecureAuthMMKV();
      if (secureInstance) {
        const secureVal = secureInstance.getString(key);
        if (secureVal) return secureVal;

        // Auto-migration: If an unencrypted session token exists in standard MMKV, migrate it
        const defaultInstance = getMMKV();
        const oldVal = defaultInstance ? defaultInstance.getString(key) : _memStore.get(key);
        if (oldVal) {
          console.log(`[storage] Migrating session key '${key}' to encrypted MMKV storage.`);
          secureInstance.set(key, oldVal);
          if (defaultInstance && defaultInstance.contains(key)) {
            defaultInstance.remove(key);
          }
          _memStore.delete(key);
          return oldVal;
        }
        return null;
      }
    } catch (err) {
      console.warn(`[storage] Error reading encrypted key '${key}':`, err);
    }
    return _memStore.get(key) ?? null;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      const secureInstance = await getSecureAuthMMKV();
      if (secureInstance) {
        secureInstance.set(key, value);
        // Ensure old unencrypted key is removed if it existed
        const defaultInstance = getMMKV();
        if (defaultInstance && defaultInstance.contains(key)) {
          defaultInstance.remove(key);
        }
        return;
      }
    } catch (err) {
      console.warn(`[storage] Error saving encrypted key '${key}':`, err);
    }
    _memStore.set(key, value);
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      const secureInstance = await getSecureAuthMMKV();
      if (secureInstance && secureInstance.contains(key)) {
        secureInstance.remove(key);
      }
    } catch (err) {
      console.warn(`[storage] Error removing encrypted key '${key}':`, err);
    }

    // Clean up unencrypted store as well
    const defaultInstance = getMMKV();
    if (defaultInstance && defaultInstance.contains(key)) {
      defaultInstance.remove(key);
    }
    _memStore.delete(key);
  },
};


// ─── TanStack Query persister storage adapter ─────────────────────────────────

export const queryStorageAdapter = {
  getItem: (key: string): string | null => {
    const instance = getMMKV();
    if (instance) return instance.getString(key) ?? null;
    return _memStore.get(key) ?? null;
  },
  setItem: (key: string, value: string): void => {
    const instance = getMMKV();
    if (instance) { instance.set(key, value); return; }
    _memStore.set(key, value);
  },
  removeItem: (key: string): void => {
    const instance = getMMKV();
    if (instance) { instance.remove(key); return; }
    _memStore.delete(key);
  },
};
