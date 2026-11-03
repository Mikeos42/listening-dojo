// Listening Dojo offline: everything is cached at install, then served from the cache.
// Audio requests carry a Range header on iOS, so cached mp3s are answered with 206 slices.
const V = "dojo-e50606f08e";
const FILES = ["/listening-dojo/index.html", "/listening-dojo/manifest.webmanifest", "/listening-dojo/icon.png", "/listening-dojo/audio/01.mp3", "/listening-dojo/audio/02.mp3", "/listening-dojo/audio/03.mp3", "/listening-dojo/episodes/01.json", "/listening-dojo/episodes/02.json", "/listening-dojo/episodes/03.json", "/listening-dojo/episodes/index.json"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
async function ranged(req, res){
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") || "");
  if (!m) return res;
  const buf = await res.arrayBuffer(), size = buf.byteLength;
  const start = m[1] ? +m[1] : 0, end = m[2] ? Math.min(+m[2], size - 1) : size - 1;
  return new Response(buf.slice(start, end + 1), { status: 206, headers: {
    "Content-Type": res.headers.get("Content-Type") || "audio/mpeg",
    "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes" } });
}
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (url.origin === location.origin){
    e.respondWith((async () => {
      const key = url.pathname.endsWith("/") ? url.pathname + "index.html" : url.pathname;
      const hit = await caches.match(key, { ignoreSearch: true });
      if (hit) return req.headers.has("range") ? ranged(req, hit) : hit;
      return fetch(req);
    })());
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){
    // fonts: keep a copy after the first online open
    e.respondWith(caches.open(V + "-fonts").then(async c => (await c.match(req)) || fetch(req).then(r => { c.put(req, r.clone()); return r; })));
  }
});
