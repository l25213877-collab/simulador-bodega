// Service worker: guarda el simulador en el teléfono para que funcione sin red.
// Estrategia "red primero": si hay internet se usa la versión más nueva y se
// actualiza la copia; si no hay, se usa la copia guardada.
const CACHE = "simulador-bodega-v3";
const ARCHIVOS = [
  "./", "index.html", "simulador.html", "jurado.html", "modelo.js", "escena.js", "graficas.js",
  "vendor/three.min.js", "vendor/OrbitControls.js", "vendor/GLTFLoader.js",
  "modelos/trabajador.glb", "modelos/camion.glb", "modelos/rack.glb", "modelos/planta.glb",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ARCHIVOS.map(a => c.add(a).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
