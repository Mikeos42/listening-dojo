// Listening Dojo offline: everything is cached at install, then served from the cache.
// Audio requests carry a Range header on iOS, so cached mp3s are answered with 206 slices.
const V = "dojo-49878a9983";
const FILES = ["/listening-dojo/index.html", "/listening-dojo/manifest.webmanifest", "/listening-dojo/icon.png", "/listening-dojo/audio/01.mp3", "/listening-dojo/audio/02.mp3", "/listening-dojo/audio/03.mp3", "/listening-dojo/episodes/01.json", "/listening-dojo/episodes/02.json", "/listening-dojo/episodes/03.json", "/listening-dojo/episodes/index.json"];
const INDEX = FILES[0];
self.addEventListener("install", e => {
  // one file at a time, so a single failed download never cancels the whole install
  e.waitUntil(caches.open(V).then(c => Promise.all(FILES.map(f => c.add(new Request(f, { cache: "reload" })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== V + "-fonts").map(k => caches.delete(k)))).then(() => self.clients.claim()));
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
const fail = () => new Response("offline", { status: 503 });
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (req.mode === "navigate" && url.origin === location.origin){
    // the app is one page: any launch, whatever the exact URL iOS uses, gets the cached page
    e.respondWith(caches.match(INDEX).then(hit => hit || fetch(req)).catch(fail));
  } else if (url.origin === location.origin){
    e.respondWith((async () => {
      const hit = await caches.match(url.pathname, { ignoreSearch: true });
      if (hit) return req.headers.has("range") ? ranged(req, hit) : hit;
      return fetch(req).catch(fail);
    })());
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){
    // fonts: keep a copy after the first online open
    e.respondWith(caches.open(V + "-fonts").then(async c => (await c.match(req)) || fetch(req).then(r => { c.put(req, r.clone()); return r; })).catch(fail));
  }
});
