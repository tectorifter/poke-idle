import { create } from "zustand";

// Per-device visual preferences — NOT part of the save export.
//  • custom app background: a Blob (uploaded file) or a plain URL (pasted link),
//    persisted in IndexedDB; exposed to the UI as `url`.
//  • translucent panels: overrides the dark theme colours with semi-transparent
//    ones so the background shows through the GUI windows.

const DB_NAME = "pokeidle-appearance";
const STORE = "kv";
const KEY_BLOB = "background";
const KEY_URL = "background-url";
const LS_TRANSLUCENT = "pokeidle-translucent-panels";

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

async function idbGet(key: string): Promise<Blob | string | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const rq = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    rq.onsuccess = () => resolve(rq.result as Blob | string | undefined);
    rq.onerror = () => reject(rq.error);
  });
}

async function idbPut(key: string, value: Blob | string): Promise<void> {
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

/** Resolve true if `src` loads as an image within 10s. */
function testImage(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const finish = (ok: boolean) => {
      img.onload = null;
      img.onerror = null;
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), 10_000);
    img.onload = () => {
      clearTimeout(timer);
      finish(true);
    };
    img.onerror = () => {
      clearTimeout(timer);
      finish(false);
    };
    img.src = src;
  });
}

function readTranslucent(): boolean {
  try {
    return localStorage.getItem(LS_TRANSLUCENT) === "1";
  } catch {
    return false;
  }
}

type AppearanceState = {
  /** Current background image src (object URL or plain URL), or null for default. */
  url: string | null;
  /** True when `url` is an object URL we own and must revoke. */
  isObjectUrl: boolean;
  ready: boolean;
  translucentPanels: boolean;
  init: () => Promise<void>;
  /** Returns an error message, or null on success. */
  setFromFile: (file: File) => Promise<string | null>;
  setFromUrl: (raw: string) => Promise<string | null>;
  clearBackground: () => Promise<void>;
  setTranslucentPanels: (on: boolean) => void;
};

function revoke(url: string | null, isObjectUrl: boolean) {
  if (url && isObjectUrl) URL.revokeObjectURL(url);
}

export const useAppearance = create<AppearanceState>((set, get) => ({
  url: null,
  isObjectUrl: false,
  ready: false,
  translucentPanels: readTranslucent(),

  init: async () => {
    if (get().ready) return;
    try {
      const blob = await idbGet(KEY_BLOB);
      if (blob instanceof Blob) {
        set({ url: URL.createObjectURL(blob), isObjectUrl: true });
      } else {
        const link = await idbGet(KEY_URL);
        if (typeof link === "string" && link) set({ url: link, isObjectUrl: false });
      }
    } catch {
      /* private mode / unsupported — use the default */
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
      await idbPut(KEY_BLOB, file);
      await idbDelete(KEY_URL);
    } catch {
      return "Could not save the image (storage unavailable).";
    }
    revoke(get().url, get().isObjectUrl);
    set({ url: URL.createObjectURL(file), isObjectUrl: true });
    return null;
  },

  setFromUrl: async (raw) => {
    const link = raw.trim();
    if (!/^https?:\/\/\S+$/i.test(link)) {
      return "Enter a full http(s):// image link.";
    }
    // Apply it right away — a background-image URL is more permissive than a JS
    // Image() probe (referrer/CORS quirks), so we don't hard-block on the test.
    try {
      await idbPut(KEY_URL, link);
      await idbDelete(KEY_BLOB);
    } catch {
      /* not persisted, but still usable this session */
    }
    revoke(get().url, get().isObjectUrl);
    set({ url: link, isObjectUrl: false });

    const ok = await testImage(link);
    return ok
      ? null
      : "Applied — but that link didn't verify as an image. If nothing shows, use a direct .png/.jpg/.gif URL.";
  },

  clearBackground: async () => {
    try {
      await idbDelete(KEY_BLOB);
      await idbDelete(KEY_URL);
    } catch {
      /* ignore */
    }
    revoke(get().url, get().isObjectUrl);
    set({ url: null, isObjectUrl: false });
  },

  setTranslucentPanels: (on) => {
    try {
      localStorage.setItem(LS_TRANSLUCENT, on ? "1" : "0");
    } catch {
      /* ignore */
    }
    set({ translucentPanels: on });
  },
}));
