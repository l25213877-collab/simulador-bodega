// Gráficas en vivo dibujadas en <canvas>, sin librerías.
// historial(): guarda una muestra por minuto simulado; graficaLinea() y graficaBarras() dibujan.

const COLOR = { tinta: "#0F1F3D", tenue: "#6B7280", rejilla: "#E5E8EC", azul: "#2F4B7C", naranja: "#FF8A1F", rojo: "#E8452C", verde: "#1FA37A" };

// Historial de la jornada: fila del surtido y despacho promedio, minuto a minuto
function historial() {
  return { t: [], fila: [], desp: [], prox: 0, suma: 0, n: 0, contados: new Set() };
}
function muestrear(h, j, hasta) {
  for (const p of j.pedidos) if (p.despacho !== null && p.despacho <= hasta && !h.contados.has(p.id)) {
    h.contados.add(p.id); h.suma += p.despacho - p.llegada; h.n++;
  }
  while (h.prox <= hasta) {
    h.t.push(h.prox); h.fila.push(j.est[1].fila.length); h.desp.push(h.n ? h.suma / h.n : null); h.prox++;
  }
}

function lienzo(canvas) {
  const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const c = canvas.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  c.fillStyle = "#fff"; c.fillRect(0, 0, w, h);
  c.font = "11px system-ui, -apple-system, Segoe UI, sans-serif"; c.textBaseline = "middle";
  return [c, w, h];
}
const redondo = v => { const p = 10 ** Math.floor(Math.log10(Math.max(v, 1e-9))), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };

// Línea contra el reloj de la jornada (0–480 min, eje en horas 08:00–16:00)
function graficaLinea(canvas, xs, ys, o = {}) {
  const [c, w, h] = lienzo(canvas), m = { l: 34, r: 18, t: 8, b: 18 };
  const vals = ys.filter(v => v !== null);
  const ymax = o.ymax ?? redondo(Math.max(o.minMax ?? 1, ...vals, o.ref ?? 0) * 1.1);
  const X = x => m.l + (x / 480) * (w - m.l - m.r), Y = y => h - m.b - (y / ymax) * (h - m.t - m.b);
  c.strokeStyle = COLOR.rejilla; c.fillStyle = COLOR.tenue; c.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const y = ymax * i / 4, py = Math.round(Y(y)) + 0.5; c.beginPath(); c.moveTo(m.l, py); c.lineTo(w - m.r, py); c.stroke(); c.textAlign = "right"; c.fillText(Number.isInteger(y) ? y : y.toFixed(1), m.l - 5, py); }
  c.textAlign = "center";
  for (let hr = 0; hr <= 8; hr += 2) { c.textAlign = hr === 0 ? "left" : hr === 8 ? "right" : "center"; c.fillText(`${8 + hr}:00`, hr === 0 ? m.l - 4 : hr === 8 ? w - 2 : X(hr * 60), h - 7); }
  if (o.ref != null) { c.setLineDash([4, 4]); c.strokeStyle = COLOR.tenue; c.beginPath(); c.moveTo(m.l, Y(o.ref)); c.lineTo(w - m.r, Y(o.ref)); c.stroke(); c.setLineDash([]); if (o.refTxt) { c.textAlign = "right"; c.fillText(o.refTxt, w - m.r, Y(o.ref) + 9); } }
  c.strokeStyle = o.color || COLOR.azul; c.lineWidth = 2; c.lineJoin = "round"; c.beginPath();
  let empezo = false;
  xs.forEach((x, i) => { const y = ys[i]; if (y === null) return; empezo ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)); empezo = true; });
  c.stroke();
  const ult = [...ys].reverse().find(v => v !== null);
  if (ult != null) { c.fillStyle = o.color || COLOR.azul; c.textAlign = "right"; c.font = "bold 12px system-ui, sans-serif"; c.fillText(`${o.fmt ? o.fmt(ult) : ult}`, w - m.r, m.t + 6); }
}

// Barras horizontales de 0 a 100 %; las que pasan el umbral se pintan en rojo
function graficaBarras(canvas, valores, etiquetas, o = {}) {
  const [c, w, h] = lienzo(canvas), m = { l: 84, r: 44, t: 4, b: 4 }, umbral = o.umbral ?? 0.8;
  const fila = (h - m.t - m.b) / valores.length, ancho = w - m.l - m.r;
  valores.forEach((v, i) => {
    const y = m.t + i * fila + fila * 0.18, alto = fila * 0.64, alta = v > umbral;
    c.fillStyle = COLOR.tinta; c.textAlign = "right"; c.fillText(etiquetas[i], m.l - 6, y + alto / 2);
    c.fillStyle = COLOR.rejilla; c.fillRect(m.l, y, ancho, alto);
    c.fillStyle = alta ? COLOR.rojo : COLOR.azul; c.fillRect(m.l, y, ancho * Math.min(1, v), alto);
    c.fillStyle = alta ? COLOR.rojo : COLOR.tinta; c.textAlign = "left"; c.font = alta ? "bold 11px system-ui, sans-serif" : "11px system-ui, sans-serif";
    c.fillText(`${(v * 100).toFixed(0)} %`, m.l + ancho + 6, y + alto / 2); c.font = "11px system-ui, sans-serif";
  });
  const xu = m.l + ancho * umbral; c.strokeStyle = COLOR.rojo; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(xu, m.t); c.lineTo(xu, h - m.b); c.stroke(); c.setLineDash([]);
}

// Ocupación de cada etapa hasta el instante t
function ocupaciones(j, t) {
  return j.est.map(e => t > 0 ? (e.aOcup + e.ocup * (t - e.ult)) / (e.cap * t) : 0);
}
