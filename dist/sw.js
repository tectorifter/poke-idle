const CACHE = "pokeidle-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isSpriteHost(url) {
  return (
    url.hostname.endsWith("pokemondb.net") ||
    url.hostname.endsWith("githubusercontent.com") ||
    url.hostname.endsWith("pokemonshowdown.com")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // App shell / same-origin navigation: network-first, falling back to cache
  // when offline, so you get updates when online and the game still loads
  // without a connection. Cached under its own URL — works whether the app
  // sits at a domain root or a subpath (e.g. a GitHub Pages project page).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req)),
    );
    return;
  }

  // Same-origin build assets and data (hashed JS/CSS, /data/*.json) and
  // sprite CDNs: cache-first. Sprite images are only cached once you've
  // actually seen them online at least once — there's no way to bulk-fetch
  // ~1200 external images up front from here.
  if (url.origin === self.location.origin || isSpriteHost(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req, { mode: isSpriteHost(url) ? "no-cors" : "cors" })
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          })
          .catch(() => cached);
      }),
    );
  }
});
