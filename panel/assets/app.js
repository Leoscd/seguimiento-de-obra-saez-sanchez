// Panel de seguimiento de obras: router y vistas.
// Rutas por hash (solo letras, números, punto y guion, para que funcionen como enlace directo):
//   #tablero · #alertas · #dts · #dt.<id> · #obra.<id>[.<pestaña>] · #informes[.<obra>] · #cargar[.<tipo>]
(() => {
  const P = window.Panel;
  const R = window.Reglas;
  const G = window.Graficos;
  const F = window.Formularios;
  const esc = P.esc;
  const vista = document.getElementById('vista');

  let E = null;          // respuesta de "estado": obras, personas, alertas
  let idx = {};
  const filtros = { obra: '', dt: '', modulo: '', nivel: '', vistas: true };

  // ---------- datos ----------
  async function cargar() {
    E = await P.llamar('estado');
    idx = {
      obra: Object.fromEntries(E.obras.map(o => [o.id, o])),
      persona: Object.fromEntries(E.personas.map(p => [p.id, p])),
      alertasObra: {},
    };
    E.alertas.forEach(a => (idx.alertasObra[a.obra] = idx.alertasObra[a.obra] || []).push(a));
  }
  const alertasDe = (obraId, modulo) => (idx.alertasObra[obraId] || []).filter(a => !modulo || a.modulo === modulo);
  const nivelModulo = (obraId, modulo) => R.peor(alertasDe(obraId, modulo).map(a => a.nivel));
  const nombre = id => (idx.persona[id] ? idx.persona[id].nombre : id || '—');
  const modulo = id => R.MODULOS.find(m => m.id === id) || { id, nombre: id, corto: id };
  const enCurso = () => E.obras.filter(o => o.estado === 'en curso');
  const mesAnterior = () => P.sumarDias(E.hoy.slice(0, 8) + '01', -1).slice(0, 7);

  // ---------- piezas ----------
  const sem = (nivel, texto, extra = '') => `<span class="sem ${nivel}" ${extra}>${texto ?? R.NOMBRE_NIVEL[nivel]}</span>`;
  const etiqueta = (estado) => {
    const tono = {
      cobrado: 'ok', aprobado: 'acc', presentado: 'warn', borrador: '',
      'en obra': 'ok', aprobada: 'ok', emitida: 'acc', 'en revisión': 'warn', 'en elaboración': 'warn', pendiente: 'bad',
      abierto: 'warn', respondido: 'ok', cerrado: 'ok', conforme: 'ok', observado: 'warn', 'no conforme': 'bad',
      cumplida: 'ok', respondida: 'ok', pedido: 'acc', recibido: 'ok', 'sin pedir': 'bad', 'en uso': '', 'no aplica': '',
      terminada: 'ok', 'en curso': 'acc', 'en cierre': 'warn',
    }[estado] || '';
    return `<span class="etiqueta ${tono}">${esc(estado)}</span>`;
  };
  const tabla = (cols, filas, vacio = 'Sin registros.') => (filas.length
    ? `<div class="desliza"><table class="tabla"><thead><tr>${cols.map(c => `<th class="${c.n ? 'n' : ''}">${c.t}</th>`).join('')}</tr></thead><tbody>${filas.join('')}</tbody></table></div>`
    : `<p class="vacio">${vacio}</p>`);
  const td = (v, n) => `<td class="${n ? 'n' : ''}">${v}</td>`;

  function miniBarra(av) {
    return `<span class="mini-barra"><span class="pista"><span class="real" style="width:${Math.min(100, av.real)}%"></span><span class="prev" style="left:${Math.min(100, av.previsto)}%"></span></span>${Math.round(av.real)} %</span>`;
  }

  function alertaHTML(a, conObra = true) {
    const o = idx.obra[a.obra];
    const meta = [conObra && o ? o.nombre : null, modulo(a.modulo).nombre, nombre(a.dt), a.desde && a.desde !== E.hoy ? `desde ${P.fecha(a.desde)}` : 'hoy'].filter(Boolean).join(' · ');
    return `<div class="alerta ${a.nivel} ${a.vista ? 'vista' : ''}">
      <span class="franja"></span>
      <div class="txt"><b>${esc(a.titulo)}</b><span>${esc(a.detalle)}</span><div class="chip">${esc(meta)}</div></div>
      <div class="acc">${sem(a.nivel)}
        <a class="btn mini" href="#obra.${a.obra}.${a.modulo}">Abrir</a>
        <button class="btn mini plano" data-vista="${esc(a.id)}" data-valor="${a.vista ? '' : '1'}">${a.vista ? 'Desmarcar' : 'Marcar vista'}</button>
      </div></div>`;
  }

  function filtrarAlertas(lista) {
    return lista.filter(a => (!filtros.obra || a.obra === filtros.obra) && (!filtros.dt || a.dt === filtros.dt)
      && (!filtros.modulo || a.modulo === filtros.modulo) && (!filtros.nivel || a.nivel === filtros.nivel) && (filtros.vistas || !a.vista));
  }

  function barraFiltros(conObra = true) {
    const op = (lista, sel) => lista.map(([v, t]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(t)}</option>`).join('');
    const dts = E.personas.filter(p => p.rol === 'DT');
    return `<div class="filtros no-imprimir">
      ${conObra ? `<select id="f-obra" aria-label="Obra">${op([['', 'Todas las obras'], ...E.obras.map(o => [o.id, o.nombre])], filtros.obra)}</select>` : ''}
      <select id="f-dt" aria-label="DT">${op([['', 'Todos los DT'], ...dts.map(p => [p.id, p.nombre])], filtros.dt)}</select>
      <select id="f-modulo" aria-label="Módulo">${op([['', 'Todos los módulos'], ...R.MODULOS.map(m => [m.id, m.nombre])], filtros.modulo)}</select>
      <select id="f-nivel" aria-label="Nivel">${op([['', 'Todos los niveles'], ['critico', 'Crítico'], ['rojo', 'Rojo'], ['amarillo', 'Amarillo']], filtros.nivel)}</select>
      <label class="chico muted" style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="f-vistas" ${filtros.vistas ? 'checked' : ''}> Mostrar las ya vistas</label>
    </div>`;
  }

  function conteo(lista) {
    const c = { critico: 0, rojo: 0, amarillo: 0 };
    lista.forEach(a => { c[a.nivel]++; });
    return c;
  }

  // ---------- vistas ----------
  function tablero() {
    const obras = E.obras;
    const c = conteo(E.alertas);
    const sinReporte = enCurso().filter(o => R.habilesSinReportar(o, E.hoy) > 0);
    const ma = mesAnterior();
    const certMes = obras.flatMap(o => o.certificados.filter(x => x.periodo === ma && x.estado !== 'borrador')).reduce((s, x) => s + x.monto, 0);
    const cols = R.MODULOS;
    const filas = obras.map(o => {
      const av = R.avanceObra(o, E.hoy);
      const etapa = R.etapaActual(o);
      const celdas = cols.map(m => {
        const al = alertasDe(o.id, m.id);
        const niv = R.peor(al.map(a => a.nivel));
        const tit = al.length ? al.map(a => `• ${a.titulo}`).join('\n') : `${m.nombre}: en orden`;
        return `<td><a class="sem ${niv} ${al.length ? '' : 'solo'}" href="#obra.${o.id}.${m.id}" title="${esc(tit)}" aria-label="${esc(m.nombre)}: ${al.length ? al.length + ' alertas' : 'en orden'}">${al.length || '✓'}</a></td>`;
      }).join('');
      const desvio = o.estado === 'en curso' ? `<small class="muted">${P.signo(av.desvio)} vs previsto</small>` : `<small>${esc(o.estado)}</small>`;
      return `<tr>
        <td class="obra"><a href="#obra.${o.id}">${esc(o.nombre)}</a><small>${esc(o.codigo)} · ${esc(nombre(o.dt))} · ${esc(etapa.nombre)}</small></td>
        <td style="text-align:left">${miniBarra(av)}${desvio}</td>${celdas}</tr>`;
    }).join('');

    const urgentes = filtrarAlertas(E.alertas.filter(a => a.nivel !== 'amarillo'));
    return `
      <div class="cab"><div><h1>Tablero de obras</h1><p>${P.fechaLarga(E.hoy)} · ${enCurso().length} obras en ejecución, ${obras.length - enCurso().length} en cierre</p></div>
        <a class="btn primario" href="#cargar">Cargar datos de oficina</a></div>
      <div class="kpis">
        <div class="kpi crit"><b>${c.critico}</b><span>Alertas críticas</span></div>
        <div class="kpi rojo"><b>${c.rojo}</b><span>Alertas en rojo</span></div>
        <div class="kpi amarillo"><b>${c.amarillo}</b><span>Para seguir (amarillo)</span></div>
        <div class="kpi ${sinReporte.length ? 'rojo' : ''}"><b>${sinReporte.length}</b><span>Obras sin el reporte de ayer</span></div>
        <div class="kpi"><b>${P.millones(certMes)}</b><span>Certificado de ${P.mes(ma)}</span></div>
      </div>
      <section class="card" aria-labelledby="t-matriz">
        <h2 id="t-matriz">Semáforo por obra</h2>
        <div class="desliza"><table class="matriz"><thead><tr><th class="obra">Obra</th><th style="text-align:left">Avance real</th>${cols.map(m => `<th title="${esc(m.nombre)}">${esc(m.corto)}</th>`).join('')}</tr></thead><tbody>${filas}</tbody></table></div>
        <div class="leyenda">${sem('critico', 'Crítico')} ${sem('rojo', 'Rojo')} ${sem('amarillo', 'Amarillo')} ${sem('verde', 'En orden')} <span>El número es la cantidad de alertas. La rayita en la barra marca el avance previsto.</span></div>
      </section>
      <section class="pila" style="margin-top:14px" aria-labelledby="t-urg">
        <div class="cab" style="margin:8px 0 0"><h2 id="t-urg" class="rotulo" style="margin:0">Críticas y en rojo (${urgentes.length})</h2><a class="btn mini" href="#alertas">Ver todas las alertas</a></div>
        <div class="alertas">${urgentes.map(a => alertaHTML(a)).join('') || '<p class="vacio">Nada crítico ni en rojo.</p>'}</div>
      </section>`;
  }

  function alertas() {
    const lista = filtrarAlertas(E.alertas);
    const c = conteo(lista);
    return `<div class="cab"><div><h1>Alertas</h1><p>${lista.length} alertas: ${c.critico} críticas, ${c.rojo} en rojo y ${c.amarillo} en amarillo. Se cierran solas cuando se resuelve lo que las dispara.</p></div></div>
      ${barraFiltros()}
      <div class="alertas">${lista.map(a => alertaHTML(a)).join('') || '<p class="vacio">No hay alertas con estos filtros.</p>'}</div>`;
  }

  function dts() {
    const tarjetas = E.personas.filter(p => p.rol === 'DT').map(p => {
      const obras = E.obras.filter(o => o.dt === p.id);
      const al = E.alertas.filter(a => a.dt === p.id);
      const c = conteo(al);
      const filasObra = obras.map(o => {
        const n = o.estado === 'en curso' ? R.habilesSinReportar(o, E.hoy) : null;
        const rep = n == null ? '<span class="muted">en cierre</span>' : n === 0 ? sem('verde', 'al día') : sem(n >= 2 ? 'rojo' : 'amarillo', `${n} día${n > 1 ? 's' : ''} sin reporte`);
        return `<div class="fila-dato"><span>${esc(o.nombre)}</span>${rep}</div>`;
      }).join('');
      return `<a class="card persona" href="#dt.${p.id}">
        <div><span class="nombre">${esc(p.nombre)}</span><div class="muted chico">Director técnico · ${obras.length} obra${obras.length === 1 ? '' : 's'}</div></div>
        <div class="pila" style="gap:6px">${filasObra}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${sem('critico', `${c.critico} críticas`)}${sem('rojo', `${c.rojo} rojas`)}${sem('amarillo', `${c.amarillo} amarillas`)}</div>
      </a>`;
    }).join('');
    return `<div class="cab"><div><h1>Directores técnicos</h1><p>Reportes, obras a cargo y pendientes de cada DT.</p></div></div><div class="personas">${tarjetas}</div>`;
  }

  function dt(id) {
    const p = idx.persona[id];
    if (!p) return noEncontrado();
    const obras = E.obras.filter(o => o.dt === id);
    const al = E.alertas.filter(a => a.dt === id);
    const pend = obras.flatMap(o => [
      ...o.requerimientos.filter(r => r.estado === 'abierto').map(r => [o, 'Requerimiento', r.asunto, r.plazo]),
      ...o.notas.filter(n => n.estado === 'pendiente').map(n => [o, `${n.tipo} N° ${n.numero}`, n.asunto, n.plazo]),
      ...o.controles.filter(c => c.resultado === 'no conforme' && !c.cerrado).map(c => [o, 'No conformidad', c.hito, null]),
    ]);
    const filasObra = obras.map(o => {
      const av = R.avanceObra(o, E.hoy);
      const ult = R.ultimoReporte(o);
      return `<tr>${td(`<a href="#obra.${o.id}">${esc(o.nombre)}</a>`)}${td(etiqueta(o.estado))}${td(miniBarra(av))}${td(`${P.signo(av.desvio)}`, 1)}${td(ult ? `${P.fecha(ult.fecha)} (N° ${ult.n})` : '—')}${td(sem(nivelObra(o.id), alertasDe(o.id).length || '✓'))}</tr>`;
    });
    return `<div class="cab"><div><h1>${esc(p.nombre)}</h1><p>Director técnico · ${esc(p.email)}</p></div><a class="btn" href="#dts">Todos los DT</a></div>
      <div class="grilla-2">
        <section class="card"><h2>Obras a cargo</h2>${tabla([{ t: 'Obra' }, { t: 'Estado' }, { t: 'Avance' }, { t: 'Desvío', n: 1 }, { t: 'Último reporte' }, { t: 'Alertas' }], filasObra)}</section>
        <section class="card"><h2>Pendientes abiertos</h2>${tabla([{ t: 'Obra' }, { t: 'Qué' }, { t: 'Asunto' }, { t: 'Plazo' }],
          pend.map(([o, q, a, pl]) => `<tr>${td(esc(o.nombre))}${td(esc(q))}${td(esc(a))}${td(pl ? P.fecha(pl) : '—')}</tr>`), 'Sin pendientes.')}</section>
      </div>
      <h2 class="rotulo" style="margin-top:18px">Alertas de sus obras (${al.length})</h2>
      <div class="alertas">${al.map(a => alertaHTML(a)).join('') || '<p class="vacio">Sin alertas.</p>'}</div>`;
  }
  const nivelObra = id => R.peor(alertasDe(id).map(a => a.nivel));

  // ---------- ficha de obra ----------
  const PESTANAS = [['resumen', 'Resumen'], ...R.MODULOS.map(m => [m.id, m.nombre]), ['informe', 'Informe semanal']];

  function obra(id, pestana = 'resumen') {
    const o = idx.obra[id];
    if (!o) return noEncontrado();
    const av = R.avanceObra(o, E.hoy);
    const eco = R.economico(o, E.hoy);
    const etapa = R.etapaActual(o);
    const ult = R.ultimoReporte(o);
    const sinRep = o.estado === 'en curso' ? R.habilesSinReportar(o, E.hoy) : 0;
    const c = conteo(alertasDe(id));
    const faltan = P.dias(E.hoy, o.fin);
    const tabs = PESTANAS.map(([t, n]) => {
      const niv = R.MODULOS.some(m => m.id === t) ? nivelModulo(id, t) : null;
      return `<a href="#obra.${id}.${t}" class="${t === pestana ? 'activo' : ''}">${niv ? `<span class="punto ${niv}"></span>` : ''}${esc(n)}</a>`;
    }).join('');
    const cuerpo = (PESTANA_VISTA[pestana] || PESTANA_VISTA.resumen)(o);
    return `<div class="cab"><div><h1>${esc(o.nombre)}</h1><p>${esc(o.codigo)} · ${esc(o.comitente)} · ${esc(o.direccion)}</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn" href="#dt.${o.dt}">DT: ${esc(nombre(o.dt))}</a><a class="btn primario" href="#cargar">Cargar</a></div></div>
      <div class="ficha-cab">
        <div class="dato"><span>Etapa</span><b>${esc(etapa.nombre)}</b> <small>${esc(o.estado)}</small></div>
        <div class="dato"><span>Avance real / previsto</span><b>${P.pct(av.real)}</b> <small>/ ${P.pct(av.previsto)} (${P.signo(av.desvio)})</small></div>
        <div class="dato"><span>Certificado / avance físico</span><b>${P.pct(eco.pctCert)}</b> <small>/ ${P.pct(eco.pctFisico)}</small></div>
        <div class="dato"><span>Último reporte</span><b>${ult ? `N° ${ult.n} · ${P.fecha(ult.fecha)}` : '—'}</b> ${sinRep ? `<small>${sinRep} día${sinRep > 1 ? 's' : ''} hábil${sinRep > 1 ? 'es' : ''} sin reporte</small>` : ''}</div>
        <div class="dato"><span>Fin previsto</span><b>${P.fecha(o.fin)}</b> <small>${faltan >= 0 ? `faltan ${faltan} días` : `hace ${-faltan} días`}</small></div>
        <div class="dato"><span>Alertas</span><b class="num">${c.critico + c.rojo + c.amarillo}</b> <small>${c.critico} crít. · ${c.rojo} rojas · ${c.amarillo} amar.</small></div>
      </div>
      <nav class="tabs" aria-label="Módulos de la obra">${tabs}</nav>
      ${cuerpo}`;
  }

  const bloqueAlertas = (o, mod) => {
    const al = alertasDe(o.id, mod);
    return al.length ? `<div class="alertas" style="margin-bottom:14px">${al.map(a => alertaHTML(a, false)).join('')}</div>` : '';
  };
  const botonCarga = (tipo, texto, obraId, valores) => `<button class="btn mini" data-cargar="${tipo}" data-obra="${obraId}" ${valores ? `data-valores="${esc(JSON.stringify(valores))}"` : ''}>${texto}</button>`;

  function etapasHTML(o) {
    return `<div class="etapas">${o.etapas.map(e => `<div class="etapa ${e.estado === 'terminada' ? 'hecha' : e.estado === 'en curso' ? 'actual' : ''}"><b>${esc(e.nombre)}</b><span>${P.fecha(e.inicio)} – ${P.fecha(e.fin)} · ${esc(e.estado)}</span></div>`).join('')}</div>`;
  }

  const PESTANA_VISTA = {
    resumen(o) {
      const prox = o.tareas.filter(t => t.inicio > E.hoy && P.dias(E.hoy, t.inicio) <= 14);
      const activas = o.tareas.filter(t => t.inicio <= E.hoy && (t.avance ?? 0) < 100);
      return `${bloqueAlertas(o) || '<p class="ok-msg" style="margin-bottom:14px">Todo en orden en esta obra.</p>'}
        <section class="card" style="margin-bottom:14px"><h2>Etapas de obra</h2>${etapasHTML(o)}</section>
        <div class="grilla-2">
          <section class="card"><h2>En ejecución</h2>${tabla([{ t: 'Tarea' }, { t: 'Fin' }, { t: 'Real', n: 1 }, { t: 'Previsto', n: 1 }],
            activas.map(t => `<tr class="${t.critica ? 'crit-fila' : ''}">${td(`${esc(t.id)} ${esc(t.nombre)}`)}${td(P.fecha(t.fin))}${td(P.pct(t.avance), 1)}${td(P.pct(R.pctPrevisto(t, E.hoy)), 1)}</tr>`), 'Sin tareas en ejecución.')}</section>
          <section class="card"><h2>Arrancan en los próximos 14 días</h2>${tabla([{ t: 'Tarea' }, { t: 'Inicio' }, { t: 'Crítica' }],
            prox.map(t => `<tr class="${t.critica ? 'crit-fila' : ''}">${td(`${esc(t.id)} ${esc(t.nombre)}`)}${td(P.fecha(t.inicio))}${td(t.critica ? 'Sí' : 'No')}</tr>`), 'Nada arranca en las próximas dos semanas.')}</section>
        </div>`;
    },

    reportes(o) {
      const reps = o.reportes.slice(-15).reverse();
      return `${bloqueAlertas(o, 'reportes')}
        <section class="card"><h2>Últimos reportes diarios</h2>
        <p class="muted chico" style="margin-top:-6px">Los arma el DT con el bot de reporte diario (fotos y audios). Acá se ven confirmados.</p>
        ${tabla([{ t: 'Fecha' }, { t: 'N°', n: 1 }, { t: 'Clima' }, { t: 'Lluvia', n: 1 }, { t: 'Jornada' }, { t: 'Personal', n: 1 }, { t: 'EPP' }, { t: 'ART' }, { t: 'Incidente' }],
          reps.map(r => `<tr>${td(P.fecha(r.fecha))}${td(r.n, 1)}${td(esc(r.clima))}${td(r.lluvia_mm ? r.lluvia_mm + ' mm' : '—', 1)}${td(r.jornada === 'completa' ? 'Completa' : `<span class="etiqueta warn">Parcial</span> ${esc(r.causa)}`)}${td(r.personal, 1)}${td(r.epp ? 'Completo' : '<span class="etiqueta bad">Incompleto</span>')}${td(r.art ? 'Visita' : '—')}${td(r.incidente ? `<span class="etiqueta bad">Sí</span> ${esc(r.incidente.texto)}` : '—')}</tr>`), 'Todavía no hay reportes.')}</section>`;
    },

    avance(o) {
      const av = R.avanceObra(o, E.hoy);
      return `${bloqueAlertas(o, 'avance')}
        <div class="grilla-2" style="margin-bottom:14px">
          <section class="card"><h2>Curva S</h2>${G.curvaS(o, E.hoy)}
            <div class="leyenda"><span><i style="background:var(--plan)"></i>Previsto según cronograma</span><span><i style="background:var(--accent)"></i>Real según reportes</span></div></section>
          <section class="card"><h2>Resumen</h2>
            <div class="pila" style="gap:8px">
              <div class="fila-dato"><span>Avance real</span><b class="num">${P.pct(av.real)}</b></div>
              <div class="fila-dato"><span>Avance previsto a hoy</span><b class="num">${P.pct(av.previsto)}</b></div>
              <div class="fila-dato"><span>Desvío</span><b class="num">${P.signo(av.desvio)} puntos</b></div>
              <div class="fila-dato"><span>Tareas críticas</span><b class="num">${o.tareas.filter(t => t.critica).length} de ${o.tareas.length}</b></div>
              <p class="muted chico" style="margin:6px 0 0">El avance de la obra es el promedio de sus tareas, igual que en el bot. El cronograma se importa del Excel/CSV exportado de MS Project.</p>
            </div></section>
        </div>
        <section class="card" style="margin-bottom:14px"><h2>Cronograma</h2><div class="desliza"><div style="min-width:720px">${G.gantt(o.tareas, E.hoy)}</div></div>
          <div class="leyenda"><span><i style="background:var(--plan)"></i>Plazo previsto</span><span><i style="background:var(--accent)"></i>Avance real</span><span><i style="background:var(--crit);height:3px"></i>Camino crítico</span></div></section>
        <section class="card"><h2>Tareas</h2>${tabla([{ t: 'ID' }, { t: 'Rubro' }, { t: 'Tarea' }, { t: 'Inicio' }, { t: 'Fin' }, { t: 'Previsto', n: 1 }, { t: 'Real', n: 1 }, { t: 'Desvío', n: 1 }],
          o.tareas.map(t => { const pv = R.pctPrevisto(t, E.hoy); const dv = (t.avance ?? 0) - pv; return `<tr class="${t.critica ? 'crit-fila' : ''}">${td(esc(t.id))}${td(esc(t.rubro))}${td(esc(t.nombre))}${td(P.fecha(t.inicio))}${td(P.fecha(t.fin))}${td(P.pct(pv), 1)}${td(P.pct(t.avance), 1)}${td(`<span style="color:${dv <= -15 ? 'var(--bad)' : 'inherit'}">${dv > 0 ? '+' : ''}${Math.round(dv)}</span>`, 1)}</tr>`; }))}</section>`;
    },

    materiales(o) {
      const filas = R.materiales(o, E.hoy);
      return `${bloqueAlertas(o, 'materiales')}
        <section class="card"><h2>Previsión de materiales</h2>
        <p class="muted chico" style="margin-top:-6px">Fecha límite de pedido = inicio de la tarea − plazo de entrega − ${R.UMBRALES.margenPedidoDias} días hábiles de margen.</p>
        ${tabla([{ t: 'Nivel' }, { t: 'Material' }, { t: 'Cantidad', n: 1 }, { t: 'Para' }, { t: 'Proveedor' }, { t: 'Plazo', n: 1 }, { t: 'Límite de pedido' }, { t: 'Estado' }, { t: '' }],
          filas.map(f => `<tr>${td(sem(f.nivel, R.NOMBRE_NIVEL[f.nivel]))}${td(esc(f.material.nombre))}${td(`${f.material.cantidad} ${esc(f.material.unidad)}`, 1)}${td(`${esc(f.tarea.id)} · ${P.fecha(f.tarea.inicio)}`)}${td(esc(f.material.proveedor))}${td(f.material.plazo + ' d', 1)}${td(P.fecha(f.limite))}${td(etiqueta(f.estado) + (f.pedido && f.pedido.entrega ? ` <span class="muted chico">entrega ${P.fecha(f.pedido.entrega)}</span>` : ''))}<td>${['sin pedir', 'pedido'].includes(f.estado) ? botonCarga('pedido', f.estado === 'pedido' ? 'Actualizar' : 'Registrar pedido', o.id, { material: `${f.tarea.id}|${f.material.nombre}`, estado: f.estado === 'pedido' ? 'recibido' : 'pedido' }) : ''}</td></tr>`), 'La obra no tiene materiales cargados en el cronograma.')}</section>`;
    },

    economico(o) {
      const eco = R.economico(o, E.hoy);
      return `${bloqueAlertas(o, 'economico')}
        <div class="kpis">
          <div class="kpi"><b>${P.millones(eco.presupuesto)}</b><span>Presupuesto</span></div>
          <div class="kpi"><b>${P.millones(eco.certificado)}</b><span>Certificado (${P.pct(eco.pctCert)})</span></div>
          <div class="kpi"><b>${P.millones(eco.cobrado)}</b><span>Cobrado</span></div>
          <div class="kpi"><b>${P.millones(eco.costo)}</b><span>Costo real a la fecha</span></div>
          <div class="kpi ${Math.abs(eco.brecha) > R.UMBRALES.sobrecertificacion ? 'rojo' : ''}"><b>${P.signo(eco.brecha)}</b><span>Certificado − avance físico (puntos)</span></div>
        </div>
        <section class="card"><h2>Presupuesto por rubro</h2>${tabla([{ t: 'Rubro' }, { t: 'Presupuesto', n: 1 }, { t: 'Avance', n: 1 }, { t: 'Previsto para el avance', n: 1 }, { t: 'Costo real', n: 1 }, { t: 'Desvío', n: 1 }],
          o.rubros.map(r => { const esp = r.presupuesto * r.avance / 100; const dv = esp ? (r.costo / esp - 1) * 100 : 0; return `<tr>${td(esc(r.rubro))}${td(P.millones(r.presupuesto), 1)}${td(P.pct(r.avance), 1)}${td(esp ? P.millones(esp) : '—', 1)}${td(r.costo ? P.millones(r.costo) : '—', 1)}${td(esp ? `<span style="color:${dv > R.UMBRALES.sobrecostoRubro ? 'var(--bad)' : 'inherit'}">${P.signo(dv)} %</span>` : '—', 1)}</tr>`; }))}</section>`;
    },

    certificaciones(o) {
      return `${bloqueAlertas(o, 'certificaciones')}
        <section class="card"><div class="cab" style="margin:0 0 10px"><h2 style="margin:0">Certificados de obra</h2>${botonCarga('certificado', 'Nuevo certificado', o.id)}</div>
        ${tabla([{ t: 'N°', n: 1 }, { t: 'Período' }, { t: '% del período', n: 1 }, { t: 'Monto', n: 1 }, { t: 'Estado' }, { t: 'Presentado' }, { t: 'Aprobado' }, { t: 'Cobrado' }, { t: '' }],
          o.certificados.slice().reverse().map(c => `<tr>${td(c.n, 1)}${td(P.mes(c.periodo))}${td(P.pct(c.pct), 1)}${td(P.pesos(c.monto), 1)}${td(etiqueta(c.estado))}${td(P.fecha(c.presentado))}${td(P.fecha(c.aprobado))}${td(P.fecha(c.cobrado))}<td>${c.estado !== 'cobrado' ? botonCarga('certificado', 'Cambiar estado', o.id, { n: c.n, periodo: c.periodo, pct: c.pct, estado: { borrador: 'presentado', presentado: 'aprobado', aprobado: 'cobrado' }[c.estado] }) : ''}</td></tr>`), 'Sin certificados.')}</section>`;
    },

    documentacion(o) {
      return `${bloqueAlertas(o, 'documentacion')}
        <section class="card"><div class="cab" style="margin:0 0 10px"><h2 style="margin:0">Documentación del proyecto ejecutivo</h2>${botonCarga('lamina', 'Cargar lámina', o.id)}</div>
        ${tabla([{ t: 'Código' }, { t: 'Título' }, { t: 'Disciplina' }, { t: 'Rev.' }, { t: 'Estado' }, { t: 'Emisión' }, { t: 'La necesita' }, { t: '' }],
          o.documentos.map(d => { const t = o.tareas.find(x => x.id === d.id_tarea); return `<tr>${td(`<b>${esc(d.codigo)}</b>`)}${td(esc(d.titulo))}${td(esc(d.disciplina))}${td(esc(d.revision))}${td(etiqueta(d.estado))}${td(P.fecha(d.emision))}${td(t ? `${esc(t.id)} · arranca ${P.fecha(t.inicio)}` : '—')}<td>${botonCarga('lamina', 'Actualizar', o.id, Object.assign({}, d))}</td></tr>`; }))}</section>`;
    },

    requerimientos(o) {
      return `${bloqueAlertas(o, 'requerimientos')}
        <section class="card"><div class="cab" style="margin:0 0 10px"><h2 style="margin:0">Requerimientos técnicos</h2>${botonCarga('requerimiento', 'Nuevo requerimiento', o.id)}</div>
        <p class="muted chico" style="margin-top:-4px">Pedidos del DT a proyecto: planos de detalle, definiciones y consultas que traban la obra.</p>
        ${tabla([{ t: 'ID' }, { t: 'Fecha' }, { t: 'Asunto' }, { t: 'Disciplina' }, { t: 'A cargo de' }, { t: 'Plazo' }, { t: 'Estado' }, { t: 'Tarea' }, { t: '' }],
          o.requerimientos.map(r => `<tr>${td(esc(r.id))}${td(P.fecha(r.fecha))}${td(esc(r.asunto))}${td(esc(r.disciplina))}${td(esc(r.responsable))}${td(P.fecha(r.plazo))}${td(etiqueta(r.estado))}${td(esc(r.id_tarea || '—'))}<td>${r.estado === 'abierto' ? `<button class="btn mini" data-responder="${esc(r.id)}" data-obra="${o.id}">Marcar respondido</button>` : ''}</td></tr>`), 'Sin requerimientos.')}</section>`;
    },

    hys(o) {
      const ult30 = o.reportes.filter(r => P.dias(r.fecha, E.hoy) <= 30);
      const inc = o.reportes.filter(r => r.incidente);
      return `${bloqueAlertas(o, 'hys')}
        <div class="kpis">
          <div class="kpi"><b>${ult30.filter(r => !r.epp).length}</b><span>Días con EPP incompleto (30 días)</span></div>
          <div class="kpi"><b>${ult30.filter(r => r.art).length}</b><span>Visitas de ART o HyS (30 días)</span></div>
          <div class="kpi ${inc.length ? 'rojo' : ''}"><b>${inc.length}</b><span>Incidentes desde el inicio</span></div>
        </div>
        <div class="grilla-2">
          <section class="card"><div class="cab" style="margin:0 0 10px"><h2 style="margin:0">Legajo de higiene y seguridad</h2>${botonCarga('hys', 'Cargar documento', o.id)}</div>
            ${tabla([{ t: 'Documento' }, { t: 'Vence' }, { t: 'Estado' }, { t: '' }],
              o.hys.map(h => { const f = P.dias(E.hoy, h.vence); return `<tr>${td(esc(h.documento))}${td(P.fecha(h.vence))}${td(f < 0 ? '<span class="etiqueta bad">vencido</span>' : f <= R.UMBRALES.diasAvisoVencimientoHys ? `<span class="etiqueta warn">vence en ${f} días</span>` : '<span class="etiqueta ok">vigente</span>')}<td>${botonCarga('hys', 'Renovar', o.id, { documento: h.documento })}</td></tr>`; }))}</section>
          <section class="card"><h2>Incidentes</h2>${tabla([{ t: 'Fecha' }, { t: 'Detalle' }],
            inc.map(r => `<tr>${td(P.fecha(r.fecha))}${td(esc(r.incidente.texto))}</tr>`), 'Sin incidentes reportados.')}</section>
        </div>`;
    },

    calidad(o) {
      const pendientes = o.tareas.filter(t => t.control && !o.controles.some(c => c.id_tarea === t.id));
      return `${bloqueAlertas(o, 'calidad')}
        <section class="card" style="margin-bottom:14px"><div class="cab" style="margin:0 0 10px"><h2 style="margin:0">Controles registrados</h2>${botonCarga('control', 'Registrar control', o.id)}</div>
        ${tabla([{ t: 'ID' }, { t: 'Fecha' }, { t: 'Control' }, { t: 'Tarea' }, { t: 'Resultado' }, { t: 'Responsable' }, { t: 'Observaciones' }, { t: '' }],
          o.controles.slice().reverse().map(c => `<tr>${td(esc(c.id))}${td(P.fecha(c.fecha))}${td(esc(c.hito))}${td(esc(c.id_tarea || '—'))}${td(etiqueta(c.resultado) + (c.resultado === 'no conforme' ? ` <span class="muted chico">${c.cerrado ? 'cerrada' : 'abierta'}</span>` : ''))}${td(esc(nombre(c.responsable)))}${td(esc(c.obs))}<td>${c.resultado === 'no conforme' && !c.cerrado ? `<button class="btn mini" data-cerrar-nc="${esc(c.id)}" data-obra="${o.id}">Cerrar no conformidad</button>` : ''}</td></tr>`), 'Sin controles.')}</section>
        <section class="card"><h2>Hitos que exigen control y todavía no lo tienen</h2>${tabla([{ t: 'Tarea' }, { t: 'Control' }, { t: 'Inicio' }, { t: 'Avance', n: 1 }, { t: '' }],
          pendientes.map(t => `<tr class="${t.critica ? 'crit-fila' : ''}">${td(`${esc(t.id)} ${esc(t.nombre)}`)}${td(esc(t.control))}${td(P.fecha(t.inicio))}${td(P.pct(t.avance), 1)}<td>${botonCarga('control', 'Registrar', o.id, { id_tarea: t.id, hito: `${t.control} – ${t.nombre}` })}</td></tr>`), 'Todos los hitos con control exigido están controlados.')}</section>`;
    },

    actas(o) {
      const TIPOS = ['Acta de inicio', 'Acta de replanteo', 'Acta de medición', 'Recepción provisoria', 'Recepción definitiva'];
      return `${bloqueAlertas(o, 'actas')}
        <section class="card" style="margin-bottom:14px"><div class="cab" style="margin:0 0 10px"><h2 style="margin:0">Etapas de obra</h2>${botonCarga('etapa', 'Cambiar etapa', o.id)}</div>${etapasHTML(o)}</section>
        <div class="grilla-2">
          <section class="card"><div class="cab" style="margin:0 0 10px"><h2 style="margin:0">Actas</h2>${botonCarga('acta', 'Cargar acta', o.id)}</div>
            ${tabla([{ t: 'Tipo' }, { t: 'Fecha' }, { t: 'Firmantes' }, { t: 'Archivo' }],
              o.actas.map(a => `<tr>${td(esc(a.tipo))}${td(P.fecha(a.fecha))}${td(esc(a.firmantes))}${td(`<span class="muted">${esc(a.archivo || '—')}</span>`)}</tr>`), 'Sin actas.')}</section>
          <section class="card"><h2>Actas de la obra</h2><div class="pila" style="gap:8px">${TIPOS.map(t => {
            const a = o.actas.find(x => x.tipo === t);
            return `<div class="fila-dato"><span>${esc(t)}</span>${a ? `<span class="etiqueta ok">${P.fecha(a.fecha)}</span>` : '<span class="etiqueta">pendiente</span>'}</div>`;
          }).join('')}</div></section>
        </div>`;
    },

    notas(o) {
      return `${bloqueAlertas(o, 'notas')}
        <section class="card"><h2>Notas de obra</h2>
        <p class="muted chico" style="margin-top:-6px">Se cargan desde el reporte diario con su texto literal. Siguen abiertas hasta que alguien las cierra.</p>
        ${tabla([{ t: 'Tipo' }, { t: 'N°', n: 1 }, { t: 'Fecha' }, { t: 'De → a' }, { t: 'Asunto' }, { t: 'Plazo' }, { t: 'Estado' }, { t: 'Materiales' }],
          o.notas.map(n => `<tr>${td(esc(n.tipo))}${td(n.numero, 1)}${td(P.fecha(n.fecha))}${td(`${esc(n.emisor)} → ${esc(n.destinatario)}`)}${td(esc(n.asunto))}${td(P.fecha(n.plazo))}${td(etiqueta(n.estado))}${td(n.impacto ? '<span class="etiqueta warn">impacta</span>' : '—')}</tr>`), 'Sin notas.')}</section>`;
    },

    informe(o) { return informeObra(o); },
  };

  // ---------- informes ----------
  function informeObra(o) {
    const av = R.avanceObra(o, E.hoy);
    const eco = R.economico(o, E.hoy);
    const semana = o.reportes.filter(r => P.dias(r.fecha, E.hoy) <= 7);
    const al = alertasDe(o.id);
    const c = conteo(al);
    const prox = o.tareas.filter(t => t.inicio > E.hoy && P.dias(E.hoy, t.inicio) <= 14);
    const mats = R.materiales(o, E.hoy).filter(m => m.nivel !== 'verde');
    const notas = o.notas.filter(n => n.estado === 'pendiente');
    const perdidas = semana.filter(r => r.jornada !== 'completa');
    const resumen = [
      `Avance real ${P.pct(av.real)} contra ${P.pct(av.previsto)} previsto (${P.signo(av.desvio)} puntos), etapa ${R.etapaActual(o).nombre.toLowerCase()}.`,
      al.length ? `Preocupa: ${al.filter(a => a.nivel !== 'amarillo').slice(0, 2).map(a => a.titulo.toLowerCase()).join('; ') || al[0].titulo.toLowerCase()}.` : 'Sin alertas abiertas.',
      mats.length ? `Se necesita gestionar ${mats.length} pedido${mats.length > 1 ? 's' : ''} de materiales y ${notas.length} nota${notas.length === 1 ? '' : 's'} pendiente${notas.length === 1 ? '' : 's'}.` : `Materiales en orden; ${notas.length} nota${notas.length === 1 ? '' : 's'} pendiente${notas.length === 1 ? '' : 's'}.`,
    ];
    const li = arr => (arr.length ? `<ul>${arr.join('')}</ul>` : '<p class="muted">Nada para informar.</p>');
    return `<article class="card informe">
      <p class="rotulo">Informe semanal · ${P.fechaLarga(P.sumarDias(E.hoy, -6))} al ${P.fechaLarga(E.hoy)}</p>
      <h2 style="margin-top:0;font-size:22px">${esc(o.nombre)}</h2>
      <p class="muted">${esc(o.codigo)} · ${esc(o.comitente)} · DT ${esc(nombre(o.dt))}</p>
      <div class="resumen">${resumen.map(esc).join('<br>')}</div>
      <h2>Alertas (${c.critico} críticas, ${c.rojo} rojas, ${c.amarillo} amarillas)</h2>${li(R.ordenar(al).map(a => `<li><b>${R.NOMBRE_NIVEL[a.nivel]}:</b> ${esc(a.titulo)}. ${esc(a.detalle)}</li>`))}
      <h2>La semana en obra</h2>
      <p>${semana.length} reportes confirmados, ${perdidas.length} jornada${perdidas.length === 1 ? '' : 's'} con horas perdidas${perdidas.length ? ` (${[...new Set(perdidas.map(r => r.causa))].map(esc).join(', ')})` : ''}, ${semana.reduce((s, r) => s + (r.lluvia_mm || 0), 0)} mm de lluvia y ${semana.length ? Math.round(semana.reduce((s, r) => s + r.personal, 0) / semana.length) : 0} personas por día en promedio.</p>
      <h2>Próximas dos semanas</h2>${li(prox.map(t => `<li>${esc(t.id)} ${esc(t.nombre)}: arranca el ${P.fecha(t.inicio)}${t.critica ? ' (crítica)' : ''}.</li>`))}
      <h2>Materiales a gestionar</h2>${li(mats.map(m => `<li>${esc(m.material.nombre)} (${m.material.cantidad} ${esc(m.material.unidad)}): ${m.estado === 'pedido' ? `entrega prometida ${P.fecha(m.pedido.entrega)}` : `pedir antes del ${P.fecha(m.limite)}`}.</li>`))}
      <h2>Notas de obra abiertas</h2>${li(notas.map(n => `<li>${esc(n.tipo)} N° ${n.numero}: ${esc(n.asunto)}${n.plazo ? `, plazo ${P.fecha(n.plazo)}` : ''}.</li>`))}
      <h2>Económico</h2><p>Certificado ${P.millones(eco.certificado)} (${P.pct(eco.pctCert)} del presupuesto de ${P.millones(eco.presupuesto)}); cobrado ${P.millones(eco.cobrado)}.</p>
      ${accionesInforme(resumen.join('\n'))}
    </article>`;
  }

  function accionesInforme(texto) {
    return `<div class="no-imprimir" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
      <button class="btn mini" data-copiar="${esc(texto)}">Copiar resumen</button>
      ${P.CFG.ARTIFACT ? '<span class="muted chico">En el sistema instalado, este informe sale en PDF y se manda por mail los viernes.</span>' : '<button class="btn mini" data-imprimir>Imprimir o guardar PDF</button>'}
    </div>`;
  }

  function informes(obraId) {
    const sel = `<select id="inf-obra" aria-label="Informe">${[['', 'Consolidado de gerencia'], ...E.obras.map(o => [o.id, o.nombre])].map(([v, t]) => `<option value="${v}" ${v === (obraId || '') ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    const cab = `<div class="cab no-imprimir"><div><h1>Informes</h1><p>Informe semanal por obra y consolidado para gerencia, armados con los mismos datos del tablero.</p></div><div class="filtros" style="margin:0">${sel}</div></div>`;
    if (obraId && idx.obra[obraId]) return cab + informeObra(idx.obra[obraId]);
    const filas = E.obras.map(o => {
      const av = R.avanceObra(o, E.hoy);
      const eco = R.economico(o, E.hoy);
      const c = conteo(alertasDe(o.id));
      const ult = R.ultimoReporte(o);
      return `<tr>${td(`<a href="#obra.${o.id}">${esc(o.nombre)}</a>`)}${td(esc(nombre(o.dt)))}${td(esc(R.etapaActual(o).nombre))}${td(P.pct(av.real), 1)}${td(P.pct(av.previsto), 1)}${td(`${P.signo(av.desvio)}`, 1)}${td(P.pct(eco.pctCert), 1)}${td(P.fecha(ult && ult.fecha))}${td(`${c.critico ? sem('critico', c.critico) : ''} ${c.rojo ? sem('rojo', c.rojo) : ''} ${c.amarillo ? sem('amarillo', c.amarillo) : ''}`)}</tr>`;
    });
    const crit = E.alertas.filter(a => a.nivel === 'critico');
    const texto = `Consolidado de obras al ${P.fecha(E.hoy)}: ${E.obras.length} obras, ${crit.length} alertas críticas.\n` + crit.map(a => `- ${idx.obra[a.obra].nombre}: ${a.titulo}`).join('\n');
    return cab + `<article class="card informe" style="max-width:none">
      <p class="rotulo">Consolidado de gerencia · ${P.fechaLarga(E.hoy)}</p>
      ${tabla([{ t: 'Obra' }, { t: 'DT' }, { t: 'Etapa' }, { t: 'Real', n: 1 }, { t: 'Previsto', n: 1 }, { t: 'Desvío', n: 1 }, { t: 'Certificado', n: 1 }, { t: 'Último reporte' }, { t: 'Alertas' }], filas)}
      <h2>Lo crítico de la semana</h2>${crit.length ? `<ul>${crit.map(a => `<li><b>${esc(idx.obra[a.obra].nombre)}:</b> ${esc(a.titulo)}. ${esc(a.detalle)}</li>`).join('')}</ul>` : '<p class="muted">Nada crítico.</p>'}
      ${accionesInforme(texto)}
    </article>`;
  }

  function noEncontrado() {
    return '<div class="cab"><div><h1>No encontramos esa página</h1><p><a href="#tablero">Volver al tablero</a></p></div></div>';
  }

  // ---------- router ----------
  function ruta() {
    const partes = (location.hash || '#tablero').slice(1).split('.');
    return { vista: partes[0] || 'tablero', a: partes[1], b: partes[2] };
  }

  function render() {
    const r = ruta();
    let html;
    if (r.vista === 'obra') html = obra(r.a, r.b);
    else if (r.vista === 'alertas') html = alertas();
    else if (r.vista === 'dts') html = dts();
    else if (r.vista === 'dt') html = dt(r.a);
    else if (r.vista === 'informes') html = informes(r.a);
    else if (r.vista === 'cargar') html = F.vista(E, r.a);
    else html = tablero();
    vista.innerHTML = html;
    const activa = { obra: 'tablero', dt: 'dts' }[r.vista] || r.vista;
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('activo', a.dataset.ruta === activa));
    const crit = E.alertas.filter(a => a.nivel === 'critico' && !a.vista).length;
    const badge = document.getElementById('cuenta-crit');
    badge.textContent = crit;
    badge.hidden = !crit;
    if (r.vista === 'cargar') F.montar(E, refrescar);
  }

  async function refrescar() {
    await cargar();
    render();
  }

  // ---------- eventos ----------
  vista.addEventListener('change', e => {
    const id = e.target.id;
    if (id === 'inf-obra') { location.hash = e.target.value ? `informes.${e.target.value}` : 'informes'; return; }
    const map = { 'f-obra': 'obra', 'f-dt': 'dt', 'f-modulo': 'modulo', 'f-nivel': 'nivel' };
    if (map[id]) { filtros[map[id]] = e.target.value; render(); }
    if (id === 'f-vistas') { filtros.vistas = e.target.checked; render(); }
  });

  vista.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.vista) {
      await P.llamar('alerta', { id: b.dataset.vista, vista: !!b.dataset.valor });
      await refrescar();
    } else if (b.dataset.cargar) {
      F.preparar(b.dataset.cargar, b.dataset.obra, b.dataset.valores ? JSON.parse(b.dataset.valores) : null);
      location.hash = `cargar.${b.dataset.cargar}`;
    } else if (b.dataset.responder) {
      await P.llamar('guardar', { obra: b.dataset.obra, coleccion: 'requerimientos', clave: 'id', registro: { id: b.dataset.responder, estado: 'respondido' } });
      await refrescar();
    } else if (b.dataset.cerrarNc) {
      await P.llamar('guardar', { obra: b.dataset.obra, coleccion: 'controles', clave: 'id', registro: { id: b.dataset.cerrarNc, cerrado: true } });
      await refrescar();
    } else if (b.dataset.copiar != null) {
      try { await navigator.clipboard.writeText(b.dataset.copiar); b.textContent = 'Copiado'; } catch (err) { b.textContent = 'No se pudo copiar'; }
    } else if (b.dataset.imprimir != null) {
      window.print();
    }
  });

  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

  async function iniciar() {
    if (P.DEMO) document.getElementById('aviso-demo').hidden = false;
    try {
      await cargar();
      render();
    } catch (err) {
      vista.innerHTML = `<div class="cab"><div><h1>No se pudo abrir el panel</h1><p class="err-msg">${esc(err.message)}</p></div></div>`;
    }
  }
  document.getElementById('reiniciar-demo').addEventListener('click', async () => {
    await P.llamar('reiniciar');
    await refrescar();
  });
  iniciar();
})();
