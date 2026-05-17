import { createMMKV, MMKV } from "react-native-mmkv";

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

// ─── Supabase auth storage adapter ────────────────────────────────────────────

export const supabaseStorageAdapter = {
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
