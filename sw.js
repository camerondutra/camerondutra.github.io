/* Frontier service worker — offline shell + always-fresh feed */
var CACHE = "frontier-v1";
var SHELL = ["news.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).catch(function () {}));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  // feed.json: network-first, fall back to cache (so it opens offline with last data)
  if (url.pathname.endsWith("feed.json")) {
    e.respondWith(
      fetch(e.request).then(function (r) {
        var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put("feed.json", copy); });
        return r;
      }).catch(function () { return caches.match("feed.json"); })
    );
    return;
  }

  // shell: cache-first, update in background
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      var net = fetch(e.request).then(function (r) {
        var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return r;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
