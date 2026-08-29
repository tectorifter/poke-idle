# Getting a self-sufficient app (no Termux, no server)

The game itself never needs a server — it's a static build (HTML/JS/CSS/JSON)
with a service worker that caches everything for offline play. The only
reason it needs to be *hosted* at all, even briefly, is that app-builder
tools (PWABuilder) need a real URL to crawl your manifest from. Once that's
done once, the resulting app runs standalone.

## 1. Push this repo to GitHub

```
git init
git add .
git commit -m "PokeIdle"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

## 2. Turn on GitHub Pages

Repo → Settings → Pages → Source → "GitHub Actions". The included
`.github/workflows/deploy.yml` builds and deploys automatically on every
push to `main`. After the first run finishes (check the Actions tab), your
game is live at:

```
https://<you>.github.io/<repo>/
```

Open that URL once, on any device, over Wi-Fi — this lets the service worker
finish its first cache pass (app shell + any sprites you view). From then on
that URL itself already works offline as an installed PWA if you just want
"Add to Home Screen" from Chrome.

## 3. Generate a real .apk with PWABuilder

1. Go to **pwabuilder.com** in any browser (desktop is easiest for this one step).
2. Paste your GitHub Pages URL and let it scan — it should report your
   manifest and service worker as valid ("Green" score).
3. Click **Package for Stores → Android**.
4. Leave the defaults, but under signing choose **"Generate new signing
   key" / signed package** (not unsigned) — this skips the manual
   `assetlinks.json` signing dance and gives you a plain-install `.apk`.
5. Download the `.apk`. Transfer it to your phone (or just download it
   directly if you did this step from the phone's browser) and install it
   (Android will ask you to allow installing from that source once).

That `.apk` is a real installed app: its own icon, no browser chrome, and it
runs entirely from the service worker cache after the first launch — no
Termux, no `npm run dev`, no process you have to keep alive.

## Notes

- `vite.config.ts` uses `base: "./"` and the manifest uses relative
  `start_url`/`scope`/icon paths specifically so this works unmodified at a
  GitHub Pages *project* URL (`/repo-name/` subpath) — no editing needed.
- Species you haven't encountered yet still need one online view to cache
  their sprite (see `public/sw.js`). Everything else — game logic, dex,
  routes, league, your save — is local JSON, no network calls ever.
- If you'd rather not use GitHub Pages, any static host works the same way
  (Netlify, Vercel, Cloudflare Pages) — just point PWABuilder at that URL
  instead.
