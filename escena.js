// Escena 3D de la bodega, compartida por simulador.html y jurado.html.
// crearPlanta(scene, opciones) arma una planta completa (bandas, estaciones, cajas)
// dentro de un grupo propio, así se pueden dibujar varias plantas en la misma escena.
// Requiere three.js r128 y modelo.js. Si están cargados, usa los modelos GLB de
// Blender (modelos/*.glb); si no, usa la geometría simple como respaldo.

const MOVIMIENTO_REDUCIDO = matchMedia("(prefers-reduced-motion: reduce)").matches;

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.6, metalness: o.m ?? 0.05, emissive: o.e ?? 0x000000 });
// Paleta del render de Blender del póster (diccionario C en bodega_isometrica.py)
const M = {
  banda: mat(0x1C2638, { r: 0.7 }), riel: mat(0x2F4B7C, { m: 0.2, r: 0.35 }), pata: mat(0x8D99AE, { m: 0.5, r: 0.4 }),
  mesa: mat(0xFFFFFF, { r: 0.5 }), metal: mat(0x8D99AE, { m: 0.5, r: 0.4 }), viga: mat(0xFF8A1F), poste: mat(0x1F3A68),
  chaleco: mat(0xFF8A1F), piel: mat(0xF1C27D), pantalon: mat(0x22304A), focoOn: mat(0x22C55E, { e: 0x15803D }),
  focoOff: mat(0x9CA3AF), carton: mat(0xD9A066, { r: 0.75 }), cartonF: mat(0xE8743A, { r: 0.75 }),
  cartonTarde: mat(0xD9A066, { r: 0.75, e: 0x8B1A1A }), cartonFTarde: mat(0xE8743A, { r: 0.75, e: 0x8B1A1A }),
  cinta: mat(0xF3D9B1), oscuro: mat(0x1D2433), blanco: mat(0xFFFFFF), cabina: mat(0x0F1F3D, { m: 0.1 }),
  franja: mat(0xFFC53D), edificio: mat(0xDCE1E8, { r: 0.8 }), puerta: mat(0x7D8799, { m: 0.3 }), zona: mat(0xFCE7B2, { r: 1 }),
  barra: mat(0x22C55E, { e: 0x0F5F2E }), barraFondo: mat(0xD5D9DF),
};
function caja(w, h, d, m, x, y, z, padre) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; padre.add(o); return o;
}
function cilindro(r, h, m, x, y, z, padre, seg = 12) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
  o.position.set(x, y, z); o.castShadow = true; padre.add(o); return o;
}

// Disposición de la planta: bandas (filas) y estaciones en forma de serpiente
const Y_BANDA = 0.86, Y_MESA = 0.9, ALTO_CAJA = 0.5;
const PLANTA = [
  { banda: [[-14, -5], [-9.6, -5]], st: [-7.5, -5], dir: 1 },
  { banda: [[-5.4, -5], [-0.6, -5]], st: [1.5, -5], dir: 1 },
  { banda: [[3.6, -5], [9, -5], [9, 5], [5.6, 5]], st: [3.5, 5], dir: -1 },
  { banda: [[1.4, 5], [-3.4, 5]], st: [-5.5, 5], dir: -1 },
  { banda: [[-7.6, 5], [-12.4, 5]], st: [-14.5, 5], dir: -1 },
];
const FUENTE = new THREE.Vector3(-16.4, Y_BANDA + ALTO_CAJA / 2, -5);
const CAMION = new THREE.Vector3(-18.2, 1.25, 5);
const REABASTO = [-4.6, -10.4];
const Y_SOBRE = Y_BANDA + ALTO_CAJA / 2;

const geoBandas = PLANTA.map(e => {
  const segs = []; let total = 0;
  for (let i = 0; i < e.banda.length - 1; i++) {
    const [x1, z1] = e.banda[i], [x2, z2] = e.banda[i + 1], L = Math.hypot(x2 - x1, z2 - z1);
    segs.push({ x1, z1, x2, z2, L, desde: total }); total += L;
  }
  return { segs, total };
});
function puntoBanda(k, d) {
  const g = geoBandas[k];
  for (const s of g.segs) if (d <= s.desde + s.L + 1e-9) { const f = (d - s.desde) / s.L; return [s.x1 + (s.x2 - s.x1) * f, s.z1 + (s.z2 - s.z1) * f]; }
  const s = g.segs[g.segs.length - 1]; return [s.x2, s.z2];
}
// Lugar del i-ésimo pedido en la fila k: sobre la banda (d = distancia recorrida) o,
// si ya no cabe, en pilas de 3 en el piso junto al inicio de la banda (d = null)
function lugarFila(k, i) {
  const g = geoBandas[k], paso = 0.78, caben = Math.floor((g.total - 0.5) / paso) + 1;
  if (i < caben) { const d = g.total - 0.4 - i * paso; const [x, z] = puntoBanda(k, d); return { pos: new THREE.Vector3(x, Y_SOBRE, z), d }; }
  const e = i - caben, col = Math.floor(e / 3), niv = e % 3, hilera = Math.floor(col / 6), c = col % 6;
  const s0 = g.segs[0], ux = (s0.x2 - s0.x1) / s0.L, uz = (s0.z2 - s0.z1) / s0.L, lado = s0.z1 < 0 ? -1 : 1;
  return { pos: new THREE.Vector3(s0.x1 + ux * (0.4 + c * 0.7), ALTO_CAJA / 2 + niv * (ALTO_CAJA + 0.02), s0.z1 + uz * (0.4 + c * 0.7) + lado * (1.35 + hilera * 0.7)), d: null };
}
function inicioBanda(k) { const [x, z] = PLANTA[k].banda[0]; return new THREE.Vector3(x, Y_SOBRE, z); }
function tramoBanda(k, d0, d1, r) {
  for (const s of geoBandas[k].segs) if (s.desde > d0 + 1e-6 && s.desde < d1 - 1e-6) r.push(new THREE.Vector3(s.x1, Y_SOBRE, s.z1));
  const [x, z] = puntoBanda(k, d1); r.push(new THREE.Vector3(x, Y_SOBRE, z));
}

function construirBanda(puntos, padre) {
  for (let i = 0; i < puntos.length - 1; i++) {
    const [x1, z1] = puntos[i], [x2, z2] = puntos[i + 1];
    const horiz = z1 === z2, L = Math.hypot(x2 - x1, z2 - z1), cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    const largo = L + 1.1;
    if (horiz) {
      caja(largo, 0.12, 1.1, M.banda, cx, Y_BANDA - 0.06, cz, padre);
      caja(largo, 0.1, 0.07, M.riel, cx, Y_BANDA + 0.02, cz - 0.56, padre);
      caja(largo, 0.1, 0.07, M.riel, cx, Y_BANDA + 0.02, cz + 0.56, padre);
    } else {
      caja(1.1, 0.12, largo, M.banda, cx, Y_BANDA - 0.06, cz, padre);
      caja(0.07, 0.1, largo, M.riel, cx - 0.56, Y_BANDA + 0.02, cz, padre);
      caja(0.07, 0.1, largo, M.riel, cx + 0.56, Y_BANDA + 0.02, cz, padre);
    }
    const n = Math.max(1, Math.round(L / 2.2));
    for (let j = 0; j <= n; j++) {
      const f = j / n, x = x1 + (x2 - x1) * f, z = z1 + (z2 - z1) * f;
      const [ox, oz] = horiz ? [0, 0.5] : [0.5, 0];
      cilindro(0.045, Y_BANDA - 0.1, M.pata, x - ox, (Y_BANDA - 0.1) / 2, z - oz, padre, 8);
      cilindro(0.045, Y_BANDA - 0.1, M.pata, x + ox, (Y_BANDA - 0.1) / 2, z + oz, padre, 8);
    }
  }
}

// ---------------------------------------------------------------------------
// Modelos GLB de Blender (opcionales)
// ---------------------------------------------------------------------------
const MODELOS = {};
const LISTA_MODELOS = ["trabajador", "camion", "rack", "planta"];
// Carga los modelos; si algo falla o tarda más de `espera` ms, sigue sin ellos
function cargarModelos(base = "modelos/", espera = 5000) {
  if (!THREE.GLTFLoader) return Promise.resolve(MODELOS);
  const loader = new THREE.GLTFLoader();
  const uno = n => new Promise(res => loader.load(`${base}${n}.glb`, g => {
    g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    MODELOS[n] = g.scene; res();
  }, undefined, () => res()));
  return Promise.race([Promise.all(LISTA_MODELOS.map(uno)), new Promise(r => setTimeout(r, espera))]).then(() => MODELOS);
}
function clonModelo(n) { return MODELOS[n] ? MODELOS[n].clone(true) : null; }

// ---------------------------------------------------------------------------
// Planta
// ---------------------------------------------------------------------------
function crearPlanta(scene, opciones = {}) {
  const raiz = new THREE.Group();
  const [ox, oy, oz] = opciones.offset || [0, 0, 0];
  raiz.position.set(ox, oy, oz); scene.add(raiz);
  const pl = { raiz, cajas: new Map(), estGrupos: [], j: null, cap: null, mus: true, alQuitarCaja: null };

  // Objetos fijos
  const fijos = new THREE.Group(); raiz.add(fijos);
  PLANTA.forEach(e => construirBanda(e.banda, fijos));

  const fuente = new THREE.Group(); fuente.userData.sel = { tipo: "fuente" }; fijos.add(fuente);
  caja(2.2, 2.6, 3, M.edificio, -18, 1.3, -5, fuente);
  caja(0.06, 1.7, 1.4, M.puerta, -16.88, 0.85, -5, fuente);
  caja(0.9, 0.12, 1.1, M.banda, -16.3, Y_BANDA - 0.06, -5, fuente);

  const camion = new THREE.Group(); camion.userData.sel = { tipo: "camion" }; fijos.add(camion);
  const camionGLB = clonModelo("camion");
  if (camionGLB) { camionGLB.position.set(-21.3, 0, 5); camion.add(camionGLB); }
  else {
    caja(4.4, 2, 2.1, M.blanco, -20.4, 1.45, 5, camion);
    caja(1.4, 1.5, 2, M.cabina, -23.4, 1.1, 5, camion);
    caja(0.05, 0.6, 1.7, M.oscuro, -24.12, 1.5, 5, camion);
    [[-19, 4], [-21.6, 4], [-23.3, 4], [-19, 6], [-21.6, 6], [-23.3, 6]].forEach(([x, z]) => {
      const r = cilindro(0.38, 0.3, M.oscuro, x, 0.38, z, camion, 16); r.rotation.x = Math.PI / 2;
    });
  }
  caja(2.6, 0.02, 3.4, M.franja, -16.9, 0.012, 5, fijos);

  const racks = new THREE.Group(); racks.userData.sel = { tipo: "racks" }; fijos.add(racks);
  for (let r = 0; r < 3; r++) {
    const x0 = 0 + r * 2.6, rackGLB = clonModelo("rack");
    if (rackGLB) { rackGLB.position.set(x0 + 1.1, 0, -11.1); racks.add(rackGLB); continue; }
    [[x0, -10.7], [x0 + 2.2, -10.7], [x0, -11.5], [x0 + 2.2, -11.5]].forEach(([x, z]) => caja(0.08, 2.6, 0.08, M.poste, x, 1.3, z, racks));
    for (const y of [0.5, 1.3, 2.1]) {
      caja(2.3, 0.08, 0.08, M.viga, x0 + 1.1, y, -10.7, racks); caja(2.3, 0.08, 0.08, M.viga, x0 + 1.1, y, -11.5, racks);
      for (let b = 0; b < 3; b++) caja(0.5, 0.36, 0.55, M.carton, x0 + 0.45 + b * 0.68, y + 0.22, -11.1, racks);
    }
  }
  // Plantas decorativas como en el render del póster
  [[-11, -9], [11.5, -8], [11.5, 8]].forEach(([x, z]) => { const p = clonModelo("planta"); if (p) { p.position.set(x, 0, z); fijos.add(p); } });

  const zonaRe = new THREE.Group(); zonaRe.userData.sel = { tipo: "reabasto" }; fijos.add(zonaRe);
  caja(4.6, 0.02, 1.9, M.zona, REABASTO[0], 0.011, REABASTO[1], zonaRe);
  [[-6.9, -10.4, 0.06, 1.9], [-2.3, -10.4, 0.06, 1.9], [-4.6, -11.35, 4.6, 0.06], [-4.6, -9.45, 4.6, 0.06]].forEach(([x, z, w, d]) => caja(w, 0.025, d, M.franja, x, 0.014, z, zonaRe));

  const estaciones = new THREE.Group(); raiz.add(estaciones);
  Object.assign(pl, { fijos, fuente, camion, racks, zonaRe, estaciones });

  function posSlot(k, s) {
    const e = PLANTA[k], cap = pl.cap[k];
    return [e.st[0], e.st[1] + (s - (cap - 1) / 2) * 1.7];
  }
  function trabajador(padre, wx, z, dir) {
    const trab = new THREE.Group(); trab.position.set(wx, 0.8, z); padre.add(trab);
    const glb = clonModelo("trabajador");
    if (glb) { glb.position.set(0, -0.8, 0); glb.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; trab.add(glb); }
    else {
      cilindro(0.16, 0.8, M.pantalon, wx, 0.4, z, padre);
      cilindro(0.23, 0.62, M.chaleco, 0, 0.3, 0, trab);
      const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), M.piel); cabeza.position.set(0, 0.8, 0); cabeza.castShadow = true; trab.add(cabeza);
    }
    return trab;
  }
  function construirEstaciones() {
    estaciones.clear(); pl.estGrupos = [];
    PLANTA.forEach((e, k) => {
      const g = new THREE.Group(); g.userData.sel = { tipo: "estacion", k }; estaciones.add(g);
      const slots = [];
      for (let s = 0; s < pl.cap[k]; s++) {
        const [x, z] = posSlot(k, s);
        caja(1.2, 0.08, 1.0, k === 4 ? M.franja : M.mesa, x, Y_MESA - 0.04, z, g);
        for (const [dx, dz] of [[-0.52, -0.42], [0.52, -0.42], [-0.52, 0.42], [0.52, 0.42]]) cilindro(0.035, Y_MESA - 0.08, M.metal, x + dx, (Y_MESA - 0.08) / 2, z + dz, g, 6);
        cilindro(0.025, 0.65, M.metal, x - e.dir * 0.52, Y_MESA + 0.3, z - 0.42, g, 6);
        const foco = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), M.focoOff); foco.position.set(x - e.dir * 0.52, Y_MESA + 0.66, z - 0.42); g.add(foco);
        const trab = trabajador(g, x + e.dir * 0.95, z, e.dir);
        const fondo = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.09, 0.09), M.barraFondo); fondo.position.set(x, 2.02, z); fondo.visible = false; g.add(fondo);
        const barra = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.11, 0.11), M.barra); barra.position.copy(fondo.position); barra.visible = false; g.add(barra);
        if (k === 0) caja(0.06, 0.34, 0.5, M.oscuro, x + e.dir * 0.35, Y_MESA + 0.17, z + 0.15, g);
        if (k === 2) caja(0.26, 0.12, 0.18, M.franja, x + e.dir * 0.3, Y_MESA + 0.06, z + 0.3, g);
        if (k === 3) { caja(0.5, 0.14, 0.4, M.carton, x + e.dir * 0.25, Y_MESA + 0.07, z + 0.28, g); const t = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.04, 8, 16), M.cinta); t.rotation.x = Math.PI / 2; t.position.set(x - e.dir * 0.3, Y_MESA + 0.04, z + 0.3); g.add(t); }
        slots.push({ foco, trab, fondo, barra, x });
      }
      pl.estGrupos.push({ g, slots });
    });
  }

  // Pedidos (cajas)
  const geoCaja = new THREE.BoxGeometry(0.58, ALTO_CAJA, 0.58);
  const geoCinta = new THREE.BoxGeometry(0.6, ALTO_CAJA + 0.01, 0.1);
  function crearCaja(p) {
    const o = new THREE.Mesh(geoCaja, p.faltante ? M.cartonF : M.carton);
    o.castShadow = true;
    o.add(new THREE.Mesh(geoCinta, M.cinta));
    o.position.copy(FUENTE); o.userData.sel = { tipo: "pedido", p }; o.userData.p = p;
    o.userData.est = { en: "nuevo" }; o.userData.ruta = []; o.userData.clave = "";
    raiz.add(o); pl.cajas.set(p.id, o); return o;
  }
  function quitarCaja(o, p) {
    raiz.remove(o); pl.cajas.delete(p.id);
    if (pl.alQuitarCaja) pl.alQuitarCaja(p);
  }

  function destino(p) {
    const d = p.donde, j = pl.j;
    if (d.en === "servicio") { const [x, z] = posSlot(d.k, p.slot); return new THREE.Vector3(x, Y_MESA + ALTO_CAJA / 2, z); }
    if (d.en === "fila") return lugarFila(d.k, j.est[d.k].fila.indexOf(p)).pos;
    if (d.en === "reabasto") {
      const i = j.pedidos.filter(x => x.donde.en === "reabasto").indexOf(p);
      return new THREE.Vector3(REABASTO[0] - 1.8 + (i % 6) * 0.72, ALTO_CAJA / 2 + 0.02 + Math.floor(i / 6) * 0.52, REABASTO[1]);
    }
    return CAMION.clone();
  }
  // Las cajas siguen una ruta (bandas, mesas, piso) en lugar de cruzar la planta en línea recta
  const V_CAJA = 7, ATRASO_MAX = 0.6;
  function claveDe(p) {
    const d = p.donde, j = pl.j;
    if (d.en === "fila") return `f${d.k}:${j.est[d.k].fila.indexOf(p)}`;
    if (d.en === "servicio") return `s${d.k}:${p.slot}`;
    if (d.en === "reabasto") return `r${j.pedidos.filter(x => x.donde.en === "reabasto").indexOf(p)}`;
    return "x";
  }
  function planRuta(o, p) {
    const d = p.donde, ant = o.userData.est, pos = o.position, r = [], meta = destino(p);
    const alto = v => v.clone().setY(Math.max(v.y, Y_MESA + ALTO_CAJA / 2) + 0.35);
    const subir = v => v.clone().setY(2.2);   // por encima del trabajador al salir de la mesa
    const est = { en: d.en, k: d.k, d: null };
    if (d.en === "fila" || d.en === "servicio") {
      const k = d.k, lf = d.en === "fila" ? lugarFila(k, pl.j.est[k].fila.indexOf(p)) : null;
      const enBanda = ant.k === k && (ant.en === "fila" || ant.en === "servicio") && ant.d !== null;
      if (lf && lf.d === null) {                       // a la tarima junto a la banda
        if (ant.k !== k || ant.en !== "fila") { if (ant.en === "servicio") r.push(subir(pos)); r.push(inicioBanda(k)); }
        r.push(alto(lf.pos).setY(lf.pos.y + 0.4)); r.push(lf.pos);
      } else {
        let d0 = 0;
        if (enBanda) d0 = ant.d;
        else {
          const ini = inicioBanda(k);
          if (ant.en === "servicio") r.push(subir(pos));
          else if (ant.en === "reabasto") { const lado = ini.z < 0 ? -1 : 1; r.push(new THREE.Vector3(ini.x, ALTO_CAJA / 2, ini.z + lado * 1.2)); }
          else if (ant.en === "fila" && ant.d === null) r.push(pos.clone().setY(Y_SOBRE + 0.4));
          r.push(ini);
        }
        const d1 = lf ? lf.d : geoBandas[k].total;
        if (d1 > d0 + 1e-6) tramoBanda(k, d0, d1, r);
        if (d.en === "servicio") { r.push(alto(meta)); r.push(meta); }
        est.d = lf ? lf.d : geoBandas[k].total;
      }
    } else if (d.en === "reabasto") {
      if (ant.en === "servicio") { r.push(alto(pos)); r.push(new THREE.Vector3(pos.x, ALTO_CAJA / 2, pos.z - 1.3)); }
      r.push(meta);
    } else {                                           // al camión
      if (ant.en === "servicio") { r.push(subir(pos)); r.push(new THREE.Vector3(meta.x + 1.6, 2.2, meta.z)); }
      r.push(meta);
    }
    o.userData.ruta = r; o.userData.est = est;
  }
  function moverCaja(o, dt) {
    const r = o.userData.ruta;
    if (!r.length) return true;
    let resta = 0, prev = o.position;
    for (const q of r) { resta += prev.distanceTo(q); prev = q; }
    let paso = Math.max(V_CAJA, resta / ATRASO_MAX) * dt;
    while (paso > 0 && r.length) {
      const dd = o.position.distanceTo(r[0]);
      if (dd <= paso) { o.position.copy(r[0]); r.shift(); paso -= dd; }
      else { o.position.lerp(r[0], paso / dd); paso = 0; }
    }
    return !r.length;
  }

  // Cambia de jornada o de capacidades
  pl.reiniciar = (j, cap) => {
    for (const o of pl.cajas.values()) raiz.remove(o);
    pl.cajas.clear();
    pl.j = j; pl.cap = cap;
    construirEstaciones();
  };
  // Dibuja el estado de la jornada en el instante t
  pl.actualizar = (t, inmediato = false, dt = 0) => {
    const j = pl.j, salto = inmediato || MOVIMIENTO_REDUCIDO;
    for (const p of j.pedidos) {
      if (p.fuera) continue;
      const o = pl.cajas.get(p.id) || crearCaja(p);
      const clave = claveDe(p);
      if (salto) {
        const lf = p.donde.en === "fila" ? lugarFila(p.donde.k, j.est[p.donde.k].fila.indexOf(p)) : null;
        o.position.copy(destino(p)); o.userData.ruta = []; o.userData.clave = clave;
        o.userData.est = { en: p.donde.en, k: p.donde.k, d: lf ? lf.d : p.donde.en === "servicio" ? geoBandas[p.donde.k].total : null };
      } else if (clave !== o.userData.clave) { planRuta(o, p); o.userData.clave = clave; }
      const llego = moverCaja(o, salto ? 0 : dt);
      o.visible = pl.mus;
      const tarde = (p.despacho ?? t) > p.comprometida;
      o.material = p.faltante ? (tarde ? M.cartonFTarde : M.cartonF) : (tarde ? M.cartonTarde : M.carton);
      if (p.donde.en === "salida" && (llego || salto)) { p.fuera = true; quitarCaja(o, p); }
    }
    const fase = performance.now() / 1000;
    pl.estGrupos.forEach(({ slots }, k) => slots.forEach((s, i) => {
      const q = j.est[k].slots[i];
      s.foco.material = q ? M.focoOn : M.focoOff;
      s.fondo.visible = s.barra.visible = !!q;
      if (q) {
        const f = Math.min(1, Math.max(0.02, (t - q.servIni) / Math.max(1e-6, q.servFin - q.servIni)));
        s.barra.scale.x = f; s.barra.position.x = s.x - (1 - f) / 2;
      }
      s.trab.rotation.z = q && !MOVIMIENTO_REDUCIDO ? Math.sin(fase * 6 + i + k) * 0.08 : 0;
      s.trab.position.y = 0.8 + (q && !MOVIMIENTO_REDUCIDO ? Math.abs(Math.sin(fase * 6 + i + k)) * 0.04 : 0);
    }));
  };
  // Objetos que se pueden seleccionar con clic
  pl.seleccionables = () => [...pl.cajas.values(), ...estaciones.children, fuente, camion, racks, zonaRe];
  return pl;
}
