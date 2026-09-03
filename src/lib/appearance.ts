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
const LS_ATTENUATION = "pokeidle-bg-attenuation";

/** Default black-overlay alpha over the background image (0 = full colour). */
export const BG_ATTENUATION_DEFAULT = 0.35;

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

const IMG_EXT = /\.(png|jpe?g|gif|webp|avif|bmp)(\?.*)?$/i;

/** Best-effort: turn a link we can safely rewrite into a direct image URL.
 *  Only conversions whose id is actually present in the URL — anything else
 *  (Imgur gallery/post pages, Tenor pages) is returned untouched so the caller
 *  can tell the user to grab the real image address. */
export function normalizeImageUrl(raw: string): string {
  const u = raw.trim();

  // i.imgur.com video wrappers → the actual gif (same hash)
  const gifv = u.match(/^(https?:\/\/i\.imgur\.com\/[A-Za-z0-9]+)\.(?:gifv|mp4)(?:\?.*)?$/i);
  if (gifv) return `${gifv[1]}.gif`;

  // Giphy page → media gif (the trailing token IS the media id)
  const giphy = u.match(
    /^https?:\/\/(?:[a-z0-9.]+\.)?giphy\.com\/(?:gifs|clips|embed)\/(?:[a-z0-9-]*-)?([A-Za-z0-9]{10,})(?:[/?#].*)?$/i,
  );
  if (giphy) return `https://media.giphy.com/media/${giphy[1]}/giphy.gif`;

  return u;
}

/** A page URL we know can't be used directly (id isn't in the link). */
function isUnusablePage(u: string): boolean {
  return (
    /^https?:\/\/(?:www\.)?imgur\.com\//i.test(u) && !/^https?:\/\/i\.imgur\.com\//i.test(u)
  ) || /^https?:\/\/(?:www\.)?tenor\.com\/view\//i.test(u);
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

function readAttenuation(): number {
  try {
    const v = Number(localStorage.getItem(LS_ATTENUATION));
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : BG_ATTENUATION_DEFAULT;
  } catch {
    return BG_ATTENUATION_DEFAULT;
  }
}

type AppearanceState = {
  /** Current background image src (object URL or plain URL), or null for default. */
  url: string | null;
  /** True when `url` is an object URL we own and must revoke. */
  isObjectUrl: boolean;
  ready: boolean;
  translucentPanels: boolean;
  /** Black-overlay alpha over the background image: 0 = full natural colour,
   *  1 = fully dimmed. */
  bgAttenuation: number;
  init: () => Promise<void>;
  /** Returns an error message, or null on success. */
  setFromFile: (file: File) => Promise<string | null>;
  setFromUrl: (raw: string) => Promise<string | null>;
  clearBackground: () => Promise<void>;
  setTranslucentPanels: (on: boolean) => void;
  setBgAttenuation: (v: number) => void;
};

function revoke(url: string | null, isObjectUrl: boolean) {
  if (url && isObjectUrl) URL.revokeObjectURL(url);
}

export const useAppearance = create<AppearanceState>((set, get) => ({
  url: null,
  isObjectUrl: false,
  ready: false,
  translucentPanels: readTranslucent(),
  bgAttenuation: readAttenuation(),

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
    const input = raw.trim();
    if (!/^https?:\/\/\S+$/i.test(input)) {
      return "Enter a full http(s):// image link.";
    }
    if (isUnusablePage(input)) {
      return "That's a web page, not an image. Open the image/GIF, right-click it → “Copy image address”, and paste that (it ends in .gif / .png / .jpg).";
    }

    // Rewrite Giphy/.gifv links to their direct media, then apply — a CSS
    // background URL is more permissive than a JS probe, so we don't hard-block
    // on the probe, but we do warn if it (and the raw link) both fail to load.
    const link = normalizeImageUrl(input);
    try {
      await idbPut(KEY_URL, link);
      await idbDelete(KEY_BLOB);
    } catch {
      /* not persisted, but still usable this session */
    }
    revoke(get().url, get().isObjectUrl);
    set({ url: link, isObjectUrl: false });

    const ok = (await testImage(link)) || (link !== input && (await testImage(input)));
    return ok
      ? null
      : IMG_EXT.test(link)
        ? "Applied — but the image didn't load. The host may block hotlinking; try a different one (imgur direct links, Discord, a raw GitHub URL)."
        : "Applied — but that link isn't a direct image. Use a URL ending in .gif / .png / .jpg.";
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

  setBgAttenuation: (v) => {
    const a = Math.max(0, Math.min(1, Number(v) || 0));
    try {
      localStorage.setItem(LS_ATTENUATION, String(a));
    } catch {
      /* ignore */
    }
    set({ bgAttenuation: a });
  },
}));
