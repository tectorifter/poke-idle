import { create } from "zustand";

// Custom app background image. Stored as a Blob in IndexedDB (localStorage can't
// hold a multi-MB GIF); exposed to the UI as an object URL. Not part of the save
// export — it's a per-device visual preference.

const DB_NAME = "pokeidle-appearance";
const STORE = "kv";
const KEY = "background";

export const BG_MAX_BYTES = 20 * 1024 * 1024; // 20 MB
export const BG_OK_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("no IndexedDB"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<Blob | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const rq = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    rq.onsuccess = () => resolve(rq.result as Blob | undefined);
    rq.onerror = () => reject(rq.error);
  });
}

async function idbPut(key: string, value: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

type BackgroundState = {
  /** Object URL for the current custom background, or null for the default. */
  url: string | null;
  /** True once the initial load from IndexedDB has run. */
  ready: boolean;
  init: () => Promise<void>;
  /** Save a picked file. Returns an error message, or null on success. */
  setFromFile: (file: File) => Promise<string | null>;
  clear: () => Promise<void>;
};

export const useBackground = create<BackgroundState>((set, get) => ({
  url: null,
  ready: false,

  init: async () => {
    if (get().ready) return;
    try {
      const blob = await idbGet(KEY);
      if (blob) set({ url: URL.createObjectURL(blob) });
    } catch {
      /* private mode / unsupported — just use the default */
    }
    set({ ready: true });
  },

  setFromFile: async (file) => {
    if (!BG_OK_TYPES.includes(file.type)) {
      return "Please choose a PNG, JPG, GIF or WebP image.";
    }
    if (file.size > BG_MAX_BYTES) {
      return `Image is too large (max ${Math.round(BG_MAX_BYTES / 1024 / 1024)} MB).`;
    }
    try {
      await idbPut(KEY, file);
    } catch {
      return "Could not save the image (storage unavailable).";
    }
    const prev = get().url;
    set({ url: URL.createObjectURL(file) });
    if (prev) URL.revokeObjectURL(prev);
    return null;
  },

  clear: async () => {
    try {
      await idbDelete(KEY);
    } catch {
      /* ignore */
    }
    const prev = get().url;
    set({ url: null });
    if (prev) URL.revokeObjectURL(prev);
  },
}));
