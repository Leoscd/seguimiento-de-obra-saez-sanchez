// Gráficos en SVG inline, sin librerías: gantt del cronograma y curva S de avance.
// Los colores salen de los tokens del tema (clases g-*), así se leen en claro y oscuro.
window.Graficos = (() => {
  const P = window.Panel;
  const R = window.Reglas;
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  const estilo = `<style>
    .g-plan{fill:var(--plan)} .g-real{fill:var(--accent)} .g-crit{fill:var(--crit)}
    .g-fila{fill:var(--surface-2)} .g-linea-plan{fill:none;stroke:var(--plan);stroke-width:2.5}
    .g-linea-real{fill:none;stroke:var(--accent);stroke-width:2.5} .g-area{fill:var(--accent-soft)}
    .g-punto{fill:var(--accent);stroke:var(--surface);stroke-width:2} .g-txt-fuerte{fill:var(--text)!important;font-weight:600}
  </style>`;

  // Primer día de cada mes entre dos fechas, para las marcas del eje.
  function meses(desde, hasta) {
    const out = [];
    let [y, m] = desde.split('-').map(Number);
    for (let i = 0; i < 40; i++) {
      m++; if (m > 12) { m = 1; y++; }
      const f = `${y}-${String(m).padStart(2, '0')}-01`;
      if (f > hasta) break;
      out.push(f);
    }
    return out;
  }

  function gantt(tareas, hoy) {
    if (!tareas.length) return '<p class="vacio">La obra no tiene cronograma cargado.</p>';
    const ini = tareas.reduce((a, t) => (t.inicio < a ? t.inicio : a), tareas[0].inicio);
    const fin = tareas.reduce((a, t) => (t.fin > a ? t.fin : a), tareas[0].fin);
    const total = Math.max(1, P.dias(ini, fin) + 1);
    const W = 960, izq = 250, der = 16, filaH = 24, arriba = 26;
    const ancho = W - izq - der;
    const H = arriba + tareas.length * filaH + 8;
    const x = f => izq + P.dias(ini, f) / total * ancho;
    let s = `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Diagrama de Gantt del cronograma">${estilo}`;
    meses(ini, fin).forEach(f => {
      const xx = x(f);
      s += `<line class="eje" x1="${xx}" y1="${arriba - 6}" x2="${xx}" y2="${H - 4}"/>`;
      s += `<text x="${xx + 3}" y="${arriba - 10}">${MESES[Number(f.slice(5, 7)) - 1]}</text>`;
    });
    tareas.forEach((t, i) => {
      const y = arriba + i * filaH;
      const x1 = x(t.inicio), x2 = x(P.sumarDias(t.fin, 1));
      const w = Math.max(3, x2 - x1);
      const nombre = `${t.id} ${t.nombre}`;
      if (i % 2 === 0) s += `<rect class="g-fila" x="0" y="${y}" width="${W}" height="${filaH}" opacity=".5"/>`;
      s += `<text x="6" y="${y + 16}" class="${t.critica ? 'g-txt-fuerte' : ''}">${P.esc(nombre.length > 38 ? nombre.slice(0, 37) + '…' : nombre)}</text>`;
      s += `<rect class="g-plan" x="${x1}" y="${y + 6}" width="${w}" height="12" rx="3"/>`;
      if (t.avance > 0) s += `<rect class="g-real" x="${x1}" y="${y + 6}" width="${w * Math.min(100, t.avance) / 100}" height="12" rx="3"/>`;
      if (t.critica) s += `<rect class="g-crit" x="${x1}" y="${y + 19}" width="${w}" height="2"/>`;
      s += `<title>${P.esc(nombre)}: ${P.fecha(t.inicio)} a ${P.fecha(t.fin)}, ${t.avance} % real, ${R.pctPrevisto(t, hoy)} % previsto</title>`;
    });
    if (hoy >= ini && hoy <= fin) {
      const xh = x(hoy);
      s += `<line class="hoy" x1="${xh}" y1="${arriba - 4}" x2="${xh}" y2="${H - 4}"/><text class="hoy-txt" x="${xh + 4}" y="${H - 6}">hoy</text>`;
    }
    return s + '</svg>';
  }

  function curvaS(obra, hoy) {
    const ini = obra.inicio;
    const fin = obra.tareas.reduce((a, t) => (t.fin > a ? t.fin : a), obra.inicio);
    const total = Math.max(1, P.dias(ini, fin));
    const W = 640, H = 240, izq = 36, der = 14, arriba = 12, abajo = 26;
    const x = f => izq + P.dias(ini, f) / total * (W - izq - der);
    const y = v => arriba + (100 - v) / 100 * (H - arriba - abajo);
    let s = `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Curva S: avance previsto y real">${estilo}`;
    [0, 25, 50, 75, 100].forEach(v => {
      s += `<line class="eje" x1="${izq}" y1="${y(v)}" x2="${W - der}" y2="${y(v)}"/><text x="${izq - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    });
    meses(ini, fin).forEach(f => { s += `<text x="${x(f)}" y="${H - 8}" text-anchor="middle">${MESES[Number(f.slice(5, 7)) - 1]}</text>`; });
    const pasos = 48;
    const plan = [];
    for (let i = 0; i <= pasos; i++) {
      const f = P.sumarDias(ini, Math.round(total * i / pasos));
      plan.push([x(f), y(R.avanceObra(obra, f).previsto)]);
    }
    s += `<polyline class="g-linea-plan" points="${plan.map(p => p.join(',')).join(' ')}"/>`;
    const reps = (obra.reportes || []).filter(r => r.avance_real != null);
    const real = reps.filter((r, i) => i % 3 === 0 || i === reps.length - 1).map(r => [x(r.fecha), y(r.avance_real)]);
    const av = R.avanceObra(obra, hoy);
    if (obra.estado === 'en curso' && hoy <= fin) real.push([x(hoy), y(av.real)]);
    if (real.length) {
      const base = y(0);
      s += `<polygon class="g-area" points="${real[0][0]},${base} ${real.map(p => p.join(',')).join(' ')} ${real[real.length - 1][0]},${base}" opacity=".7"/>`;
      s += `<polyline class="g-linea-real" points="${real.map(p => p.join(',')).join(' ')}"/>`;
      const u = real[real.length - 1];
      s += `<circle class="g-punto" cx="${u[0]}" cy="${u[1]}" r="5"/>`;
      s += `<text class="g-txt-fuerte" x="${Math.min(u[0] + 8, W - 60)}" y="${u[1] - 8}">${Math.round(obra.estado === 'en curso' ? av.real : reps[reps.length - 1].avance_real)} %</text>`;
    }
    if (hoy >= ini && hoy <= fin) s += `<line class="hoy" x1="${x(hoy)}" y1="${arriba}" x2="${x(hoy)}" y2="${H - abajo}"/>`;
    return s + '</svg>';
  }

  return { gantt, curvaS };
})();
