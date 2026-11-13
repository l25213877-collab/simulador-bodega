// Modelo compartido por index.html y simulador.html (idéntico a simulacion_bodega.py)
// ---------------------------------------------------------------------------
// Modelo (idéntico a simulacion_bodega.py)
// ---------------------------------------------------------------------------
const GENERADORES = { mixto: [1664525, 1013904223, 4294967296], multiplicativo: [16807, 0, 2147483647] };
const SEMILLA = 25213877, SEMILLA_LLEGADAS = 24213119;

class Generador {
  constructor(metodo, semilla) { [this.a, this.c, this.m] = GENERADORES[metodo]; this.x = semilla; }
  u() { this.x = (this.a * this.x + this.c) % this.m; return this.x / this.m; }
  ab(a, b) { return a + (b - a) * this.u(); }
  exp(media) { return -media * Math.log(1 - this.u()); }
  tri(a, moda, b) {
    const u = this.u(), fc = (moda - a) / (b - a);
    return u < fc ? a + Math.sqrt(u * (b - a) * (moda - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - moda));
  }
  discreta(valores, probs) {
    const u = this.u(); let acum = 0;
    for (let i = 0; i < valores.length; i++) { acum += probs[i]; if (u < acum) return valores[i]; }
    return valores[valores.length - 1];
  }
  bernoulli(p) { return this.u() < p; }
}

const P = {
  jornada: 480, mediaLlegadas: 4,
  lineas: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  probLineas: [0.15, 0.15, 0.13, 0.12, 0.10, 0.09, 0.08, 0.07, 0.06, 0.05],
  probFaltante: 0.05, reabasto: [10, 20], plazo: 90,
};
const ETAPAS = ["Recepción", "Surtido", "Verificación", "Empaque", "Carga y despacho"];
const RECURSO = ["capturista", "surtidores", "verificador", "empacadores", "muelles"];

function tiempoServicio(k, p, r) {
  const n = p.lineas;
  if (k === 0) return r.tri(1, 2, 4);
  if (k === 1) { const traslado = r.ab(2, 4); let s = 0; for (let i = 0; i < n; i++) s += r.ab(1, 2); return traslado + s; }
  if (k === 2) return r.tri(0.5, 1, 2) + 0.35 * n;
  if (k === 3) return r.tri(2, 3.5, 6);
  return r.ab(2, 4);
}

class Jornada {
  constructor(cap, rng, rngLlegadas, alEvento = null) {
    this.rng = rng; this.rl = rngLlegadas; this.alEvento = alEvento;
    this.T = P.jornada; this.t = 0; this.heap = []; this.seq = 0; this.pedidos = [];
    this.est = cap.map((c, i) => ({ nombre: ETAPAS[i], cap: c, ocup: 0, fila: [], slots: Array(c).fill(null), ult: 0, aFila: 0, aOcup: 0, esperas: [] }));
    this.programar(this.rl.exp(P.mediaLlegadas), "llegada");
  }
  programar(t, tipo, p = null, k = null) {
    const h = this.heap, e = [t, ++this.seq, tipo, p, k];
    h.push(e); let i = h.length - 1;
    while (i > 0) { const j = (i - 1) >> 1; if (menor(h[i], h[j])) { [h[i], h[j]] = [h[j], h[i]]; i = j; } else break; }
  }
  sacar() {
    const h = this.heap, top = h[0], last = h.pop();
    if (h.length) {
      h[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < h.length && menor(h[l], h[m])) m = l;
        if (r < h.length && menor(h[r], h[m])) m = r;
        if (m === i) break; [h[i], h[m]] = [h[m], h[i]]; i = m;
      }
    }
    return top;
  }
  proximo() { return this.heap.length ? this.heap[0][0] : Infinity; }
  actualizar(e, t) { const dt = t - e.ult; e.aFila += e.fila.length * dt; e.aOcup += e.ocup * dt; e.ult = t; }
  iniciar(k, p, t) {
    const e = this.est[k];
    e.ocup++; const s = e.slots.indexOf(null); e.slots[s] = p;
    p.slot = s; p.donde = { k, en: "servicio" }; p.inicio[k] = t;
    e.esperas.push(t - p.llega[k]);
    const ts = tiempoServicio(k, p, this.rng);
    p.servIni = t; p.servFin = t + ts;
    this.programar(t + ts, "fin", p, k);
  }
  solicitar(k, p, t) {
    const e = this.est[k];
    this.actualizar(e, t); p.llega[k] = t;
    if (e.ocup < e.cap) this.iniciar(k, p, t);
    else { e.fila.push(p); p.donde = { k, en: "fila" }; }
  }
  // Procesa el siguiente evento si ocurre dentro de la jornada
  paso() {
    if (this.proximo() > this.T) return null;
    const [t, , tipo, p0, k] = this.sacar(); this.t = t;
    let p = p0;
    if (tipo === "llegada") {
      p = { id: this.pedidos.length + 1, llegada: t,
            lineas: this.rl.discreta(P.lineas, P.probLineas),
            faltante: this.rl.bernoulli(P.probFaltante),
            llega: Array(5).fill(null), inicio: Array(5).fill(null), fin: Array(5).fill(null), despacho: null };
      p.comprometida = t + P.plazo;
      this.pedidos.push(p);
      this.solicitar(0, p, t);
      this.programar(t + this.rl.exp(P.mediaLlegadas), "llegada");
    } else if (tipo === "fin") {
      const e = this.est[k];
      this.actualizar(e, t); e.ocup--; e.slots[p.slot] = null; p.fin[k] = t;
      if (e.fila.length) this.iniciar(k, e.fila.shift(), t);
      if (k === 0 && p.faltante) { p.donde = { en: "reabasto" }; this.programar(t + this.rng.ab(...P.reabasto), "reabasto", p); }
      else if (k < 4) this.solicitar(k + 1, p, t);
      else { p.despacho = t; p.donde = { en: "salida" }; }
    } else {
      this.solicitar(1, p, t);
    }
    if (this.alEvento) this.alEvento(tipo, t, p, k);
    return tipo;
  }
  cerrar() { for (const e of this.est) this.actualizar(e, this.T); this.t = this.T; }
  correr() { while (this.paso()); this.cerrar(); return this; }
}
function menor(a, b) { return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]); }
const promedio = xs => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;

function indicadores(j) {
  const T = P.jornada, desp = j.pedidos.filter(p => p.despacho !== null);
  const r = {
    llegados: j.pedidos.length, despachados: desp.length, pendientes: j.pedidos.length - desp.length,
    tiempo: promedio(desp.map(p => p.despacho - p.llegada)),
    retrasados: desp.filter(p => p.despacho > p.comprometida).length + j.pedidos.filter(p => p.despacho === null && T > p.comprometida).length,
  };
  j.est.forEach((e, i) => { r["espera" + i] = promedio(e.esperas); r["fila" + i] = e.aFila / T; r["util" + i] = e.aOcup / (e.cap * T); });
  return r;
}

function valorT(gl) {
  const tabla = { 9: 2.262, 29: 2.045, 49: 2.010, 99: 1.984 };
  if (tabla[gl]) return tabla[gl];
  const z = 1.959964;
  return z + (z ** 3 + z) / (4 * gl) + (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * gl ** 2);
}
function intervalo(xs) {
  const n = xs.length, m = promedio(xs);
  if (n < 2) return [m, 0];
  const s = Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1));
  return [m, valorT(n - 1) * s / Math.sqrt(n)];
}

function correrEscenario(cap, replicas, metodo) {
  const rng = new Generador(metodo, SEMILLA), rl = new Generador(metodo, SEMILLA_LLEGADAS);
  const res = [];
  for (let i = 0; i < replicas; i++) res.push(indicadores(new Jornada(cap, rng, rl).correr()));
  const resumen = {};
  for (const k of Object.keys(res[0])) resumen[k] = intervalo(res.map(r => r[k]));
  return resumen;
}

// ---------------------------------------------------------------------------
// Escenarios
// ---------------------------------------------------------------------------
const ESCENARIOS = [
  { nombre: "Actual (base)", cap: [1, 3, 1, 3, 1] },
  { nombre: "A: empacador → surtido", cap: [1, 4, 1, 2, 1] },
  { nombre: "B: empacador → verificación", cap: [1, 3, 2, 2, 1] },
  { nombre: "C: +1 surtidor", cap: [1, 4, 1, 3, 1] },
  { nombre: "D: A + 2.º muelle", cap: [1, 4, 1, 2, 2] },
];
const fmt = (x, d = 1) => x.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });
const hora = t => { const m = Math.floor(480 + t); return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
