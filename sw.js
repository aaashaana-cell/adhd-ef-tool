/* Service worker for the ADHD & Executive Function tool.
   Goal: make the tool genuinely load offline and installable, WITHOUT ever
   trapping users on a stale build.

   Strategy:
   - Page navigations: network-first. When online you always get the latest
     deploy; the cached copy is only used as an offline fallback.
   - Other same-origin assets (icons, manifest, sibling pages once visited):
     stale-while-revalidate, so they load instantly and refresh in the
     background.
   - Cross-origin requests (e.g. the anonymous GoatCounter counter) are not
     intercepted at all, so nothing third-party is cached and they fail
     gracefully when offline.
*/
const CACHE = "ef-tool-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function putInCache(req, res) {
  if (!res || res.status !== 200 || res.type === "opaque") return;
  caches.open(CACHE).then((c) => c.put(req, res));
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;   // leave analytics / external links to the network

  if (req.mode === "navigate") {
    // network-first: latest deploy wins online; cache (then app shell) covers offline
    e.respondWith(
      fetch(req)
        .then((res) => { putInCache(req, res.clone()); return res; })
        .catch(() => caches.match(req).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  // static assets: stale-while-revalidate
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => { putInCache(req, res.clone()); return res; })
        .catch(() => cached);
      return cached || network;
    })
  );
});
