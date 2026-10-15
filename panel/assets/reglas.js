// Motor de alertas del panel: umbrales, cálculos derivados (avance, materiales, económico) y reglas.
// Funciones puras sobre los datos de una obra. El backend del VPS replica estas mismas reglas en Python;
// si cambia un umbral acá, cambia allá.
window.Reglas = (() => {
  const P = window.Panel;

  const UMBRALES = {
    margenPedidoDias: 2,          // hábiles, igual que MARGEN_PEDIDO_DIAS del bot
    desvioObraAmarillo: -5,       // % real − previsto de la obra
    desvioObraRojo: -10,
    atrasoTareaCritica: 15,       // puntos de % que una tarea crítica puede ir detrás de lo previsto
    diasDocAntesDeTarea: 10,      // la lámina tiene que estar emitida N días antes de que arranque la tarea
    diasReqTareaCritica: 7,
    sobrecertificacion: 10,       // % certificado − % avance físico
    subcertificacion: -15,
    sobrecostoRubro: 5,           // % de costo real por encima de lo presupuestado para el avance del rubro
    diaPresentarCertificado: 5,   // el certificado del mes anterior se presenta hasta este día
    diasCobroCertificado: 30,
    diasAvisoVencimientoHys: 15,
    diasRecepcionProvisoria: 15,
    diasIncidente: 7,
  };

  const MODULOS = [
    { id: 'reportes', nombre: 'Reportes diarios', corto: 'Reportes' },
    { id: 'avance', nombre: 'Avance y cronograma', corto: 'Avance' },
    { id: 'materiales', nombre: 'Materiales', corto: 'Materiales' },
    { id: 'economico', nombre: 'Seguimiento económico', corto: 'Económico' },
    { id: 'certificaciones', nombre: 'Certificaciones', corto: 'Certif.' },
    { id: 'documentacion', nombre: 'Documentación técnica', corto: 'Docum.' },
    { id: 'requerimientos', nombre: 'Requerimientos técnicos', corto: 'Requer.' },
    { id: 'hys', nombre: 'Higiene y seguridad', corto: 'HyS' },
    { id: 'calidad', nombre: 'Controles de calidad', corto: 'Calidad' },
    { id: 'actas', nombre: 'Actas y etapas', corto: 'Actas' },
    { id: 'notas', nombre: 'Notas de obra', corto: 'Notas' },
  ];
  const NIVELES = ['critico', 'rojo', 'amarillo', 'verde'];
  const NOMBRE_NIVEL = { critico: 'Crítico', rojo: 'Rojo', amarillo: 'Amarillo', verde: 'En orden' };
  const peor = niveles => NIVELES.find(n => niveles.includes(n)) || 'verde';

  // ---------- cálculos ----------
  function pctPrevisto(t, hoy) {
    if (hoy < t.inicio) return 0;
    if (hoy >= t.fin) return 100;
    return Math.round((P.dias(t.inicio, hoy) + 1) / (P.dias(t.inicio, t.fin) + 1) * 1000) / 10;
  }

  // Promedio simple de tareas, igual que cronograma.avance_obra del bot.
  function avanceObra(obra, hoy) {
    const ts = obra.tareas;
    if (!ts.length) return { real: 0, previsto: 0, desvio: 0 };
    const real = ts.reduce((s, t) => s + (t.avance ?? 0), 0) / ts.length;
    const previsto = ts.reduce((s, t) => s + pctPrevisto(t, hoy), 0) / ts.length;
    return { real: Math.round(real * 10) / 10, previsto: Math.round(previsto * 10) / 10, desvio: Math.round((real - previsto) * 10) / 10 };
  }

  // Fecha límite de pedido = inicio de la tarea − plazo de entrega − margen (hábiles). Igual que el bot.
  function materiales(obra, hoy) {
    const filas = [];
    obra.tareas.forEach(t => (t.materiales || []).forEach(m => {
      const pedido = (obra.pedidos || []).find(p => p.id_tarea === t.id && p.material === m.nombre);
      const limite = P.restarHabiles(t.inicio, m.plazo + UMBRALES.margenPedidoDias);
      const diasLimite = P.dias(hoy, limite);
      let nivel = 'verde';
      let estado = pedido ? pedido.estado : 'sin pedir';
      if (t.inicio <= hoy && !pedido) estado = 'en uso';
      if (estado === 'pedido' && pedido.entrega && pedido.entrega < hoy) nivel = 'rojo';
      else if (estado === 'sin pedir') {
        if (diasLimite < 0) nivel = t.critica ? 'critico' : 'rojo';
        else if (diasLimite <= 7) nivel = 'amarillo';
      }
      filas.push({ tarea: t, material: m, pedido, estado, limite, diasLimite, nivel });
    }));
    return filas.sort((a, b) => NIVELES.indexOf(a.nivel) - NIVELES.indexOf(b.nivel) || a.limite.localeCompare(b.limite));
  }

  function economico(obra, hoy) {
    const certs = (obra.certificados || []).filter(c => c.estado !== 'borrador');
    const certificado = certs.reduce((s, c) => s + c.monto, 0);
    const cobrado = certs.filter(c => c.estado === 'cobrado').reduce((s, c) => s + c.monto, 0);
    const costo = (obra.rubros || []).reduce((s, r) => s + r.costo, 0);
    const pctCert = obra.presupuesto ? certificado / obra.presupuesto * 100 : 0;
    const av = avanceObra(obra, hoy);
    return { presupuesto: obra.presupuesto, certificado, cobrado, costo, pctCert, pctFisico: av.real, brecha: pctCert - av.real };
  }

  function etapaActual(obra) {
    return obra.etapas.find(e => e.estado === 'en curso') || obra.etapas.filter(e => e.estado === 'terminada').pop() || obra.etapas[0];
  }

  function ultimoReporte(obra) {
    return (obra.reportes || []).filter(r => r.confirmado).sort((a, b) => b.fecha.localeCompare(a.fecha))[0] || null;
  }

  function habilesSinReportar(obra, hoy) {
    const ult = ultimoReporte(obra);
    let d = P.habilAnterior(hoy);
    let n = 0;
    while (d > (ult ? ult.fecha : obra.inicio) && n < 30) { n++; d = P.habilAnterior(d); }
    return n;
  }

  // ---------- reglas ----------
  function evaluar(obra, hoy, personas) {
    const U = UMBRALES;
    const out = [];
    const dt = (personas || []).find(p => p.id === obra.dt);
    const add = (modulo, clave, nivel, titulo, detalle, desde) =>
      out.push({ id: `${modulo}:${obra.id}:${clave}`, obra: obra.id, dt: obra.dt, modulo, nivel, titulo, detalle, desde: desde || hoy });
    const tarea = id => obra.tareas.find(t => t.id === id);
    const enCurso = obra.estado === 'en curso';

    // Reportes diarios
    if (enCurso) {
      const n = habilesSinReportar(obra, hoy);
      const ult = ultimoReporte(obra);
      if (n >= 2) add('reportes', 'sin-reporte', 'rojo', `${n} días hábiles sin reporte`, `${dt ? dt.nombre : 'El DT'} no confirma un reporte desde el ${P.fecha(ult && ult.fecha)}.`, ult && ult.fecha);
      else if (n === 1) add('reportes', 'sin-reporte', 'amarillo', 'Falta el reporte del último día hábil', `Último reporte confirmado: ${P.fecha(ult && ult.fecha)}.`, ult && ult.fecha);
    }

    // Avance
    const av = avanceObra(obra, hoy);
    if (enCurso && av.desvio <= U.desvioObraRojo) add('avance', 'obra', 'rojo', `Obra ${P.dec(Math.abs(av.desvio))} puntos atrasada`, `Avance real ${P.pct(av.real)} contra ${P.pct(av.previsto)} previsto.`);
    else if (enCurso && av.desvio <= U.desvioObraAmarillo) add('avance', 'obra', 'amarillo', `Obra ${P.dec(Math.abs(av.desvio))} puntos atrasada`, `Avance real ${P.pct(av.real)} contra ${P.pct(av.previsto)} previsto.`);
    obra.tareas.filter(t => t.critica).forEach(t => {
      const atraso = pctPrevisto(t, hoy) - (t.avance ?? 0);
      if (atraso >= U.atrasoTareaCritica) {
        add('avance', t.id, 'critico', `Tarea crítica atrasada: ${t.nombre}`, `${t.id}: ${P.pct(t.avance)} real contra ${P.pct(pctPrevisto(t, hoy))} previsto. Atrasa a las que siguen.`);
      }
    });

    // Materiales
    materiales(obra, hoy).filter(m => m.nivel !== 'verde').forEach(m => {
      const clave = `${m.tarea.id}-${m.material.nombre}`;
      if (m.estado === 'pedido') {
        add('materiales', clave, 'rojo', `${m.material.nombre}: entrega atrasada`, `Prometido para el ${P.fecha(m.pedido.entrega)} a ${m.material.proveedor}. Lo necesita ${m.tarea.id} ${m.tarea.nombre}.`, m.pedido.entrega);
      } else {
        const txt = m.diasLimite < 0 ? `venció el ${P.fecha(m.limite)}` : `vence el ${P.fecha(m.limite)}`;
        add('materiales', clave, m.nivel, `Pedir ${m.material.nombre}`, `Fecha límite de pedido ${txt} (${m.material.cantidad} ${m.material.unidad}, ${m.material.proveedor}, ${m.material.plazo} días de entrega). Arranca ${m.tarea.id} el ${P.fecha(m.tarea.inicio)}.`, m.limite);
      }
    });

    // Económico
    const eco = economico(obra, hoy);
    if (eco.brecha > U.sobrecertificacion) add('economico', 'sobrecert', 'rojo', 'Certificado por encima del avance físico', `Certificado ${P.pct(eco.pctCert)} del presupuesto con ${P.pct(eco.pctFisico)} de avance real.`);
    else if (enCurso && eco.brecha < U.subcertificacion) add('economico', 'subcert', 'amarillo', 'Avance sin certificar', `Avance real ${P.pct(eco.pctFisico)} y certificado ${P.pct(eco.pctCert)}.`);
    (obra.rubros || []).forEach(r => {
      const esperado = r.presupuesto * r.avance / 100;
      if (esperado > 0 && r.costo > esperado * (1 + U.sobrecostoRubro / 100)) {
        add('economico', `rubro-${r.rubro}`, 'rojo', `${r.rubro}: costo por encima del presupuesto`, `Lleva ${P.millones(r.costo)} gastados con ${P.pct(r.avance)} de avance; lo presupuestado para ese avance es ${P.millones(esperado)} (+${P.pct((r.costo / esperado - 1) * 100)}).`);
      }
    });

    // Certificaciones
    const mesAnterior = P.sumarDias(hoy.slice(0, 8) + '01', -1).slice(0, 7);
    const certs = obra.certificados || [];
    if (enCurso && obra.inicio.slice(0, 7) <= mesAnterior && Number(hoy.slice(8)) > U.diaPresentarCertificado) {
      const c = certs.find(x => x.periodo === mesAnterior);
      if (!c || c.estado === 'borrador') add('certificaciones', `sin-${mesAnterior}`, 'amarillo', `Certificado de ${P.mes(mesAnterior)} sin presentar`, `Se presenta hasta el día ${U.diaPresentarCertificado} de cada mes.`);
    }
    certs.filter(c => c.estado === 'aprobado' && c.aprobado && P.dias(c.aprobado, hoy) > U.diasCobroCertificado).forEach(c =>
      add('certificaciones', `cobro-${c.n}`, 'rojo', `Certificado N° ${c.n} sin cobrar`, `Aprobado el ${P.fecha(c.aprobado)} (hace ${P.dias(c.aprobado, hoy)} días) por ${P.millones(c.monto)}.`, c.aprobado));

    // Documentación técnica
    (obra.documentos || []).filter(d => !['emitida', 'aprobada', 'en obra'].includes(d.estado) && d.id_tarea).forEach(d => {
      const t = tarea(d.id_tarea);
      if (!t) return;
      const faltan = P.dias(hoy, t.inicio);
      if (faltan <= U.diasDocAntesDeTarea) {
        add('documentacion', d.codigo, t.critica ? 'critico' : 'rojo', `Lámina ${d.codigo} sin emitir`, `${d.titulo}. La necesita ${t.id} ${t.nombre}, que ${faltan > 0 ? `arranca en ${faltan} días` : 'ya arrancó'}.`);
      }
    });

    // Requerimientos técnicos
    (obra.requerimientos || []).filter(r => r.estado === 'abierto').forEach(r => {
      const t = r.id_tarea && tarea(r.id_tarea);
      const traba = t && t.critica && P.dias(hoy, t.inicio) <= U.diasReqTareaCritica && (t.avance ?? 0) < 100;
      if (traba) add('requerimientos', r.id, 'critico', `Requerimiento sin respuesta traba una tarea crítica`, `${r.asunto} (${r.responsable}). Traba ${t.id} ${t.nombre}.`, r.fecha);
      else if (r.plazo < hoy) add('requerimientos', r.id, 'rojo', `Requerimiento vencido: ${r.asunto}`, `Pedido a ${r.responsable} el ${P.fecha(r.fecha)}, plazo ${P.fecha(r.plazo)}.`, r.plazo);
      else if (P.dias(hoy, r.plazo) <= 2) add('requerimientos', r.id, 'amarillo', `Requerimiento por vencer: ${r.asunto}`, `Plazo ${P.fecha(r.plazo)}, a cargo de ${r.responsable}.`, r.fecha);
    });

    // Higiene y seguridad
    (obra.hys || []).forEach(h => {
      const faltan = P.dias(hoy, h.vence);
      if (faltan < 0) add('hys', h.documento, 'rojo', `${h.documento} vencido`, `Venció el ${P.fecha(h.vence)}.`, h.vence);
      else if (faltan <= U.diasAvisoVencimientoHys) add('hys', h.documento, 'amarillo', `${h.documento} vence en ${faltan} días`, `Vence el ${P.fecha(h.vence)}.`);
    });
    (obra.reportes || []).filter(r => r.incidente && P.dias(r.fecha, hoy) <= U.diasIncidente).forEach(r =>
      add('hys', `inc-${r.fecha}`, r.incidente.grave ? 'critico' : 'rojo', `Incidente en obra (${P.fecha(r.fecha)})`, r.incidente.texto, r.fecha));
    const ult = ultimoReporte(obra);
    if (enCurso && ult && ult.epp === false) add('hys', 'epp', 'amarillo', 'Personal sin EPP completo', `Informado en el reporte del ${P.fecha(ult.fecha)}.`, ult.fecha);

    // Controles de calidad
    obra.tareas.filter(t => t.control).forEach(t => {
      const hecho = (obra.controles || []).some(c => c.id_tarea === t.id);
      if (hecho) return;
      if ((t.avance ?? 0) > 0 || t.inicio <= hoy) add('calidad', `ctl-${t.id}`, 'critico', `${t.nombre} sin ${t.control.toLowerCase()}`, `${t.id} tiene ${P.pct(t.avance)} de avance y no hay control registrado.`, t.inicio);
      else if (P.dias(hoy, t.inicio) <= 3) add('calidad', `ctl-${t.id}`, 'amarillo', `Programar ${t.control.toLowerCase()}`, `${t.id} ${t.nombre} arranca el ${P.fecha(t.inicio)}.`);
    });
    (obra.controles || []).filter(c => c.resultado === 'no conforme' && !c.cerrado).forEach(c =>
      add('calidad', `nc-${c.id}`, 'rojo', `No conformidad abierta: ${c.hito}`, c.obs, c.fecha));

    // Actas
    const actas = obra.actas || [];
    if (av.real > 0 && !actas.some(a => a.tipo === 'Acta de inicio')) add('actas', 'inicio', 'rojo', 'Obra en ejecución sin acta de inicio', 'Cargá el acta firmada.');
    if (av.real >= 100 && P.dias(obra.fin, hoy) > U.diasRecepcionProvisoria && !actas.some(a => a.tipo === 'Recepción provisoria')) {
      add('actas', 'recepcion', 'amarillo', 'Falta el acta de recepción provisoria', `La obra terminó el ${P.fecha(obra.fin)} (hace ${P.dias(obra.fin, hoy)} días).`, obra.fin);
    }

    // Notas de obra
    (obra.notas || []).filter(n => n.estado === 'pendiente' && n.plazo).forEach(n => {
      const clave = `${n.tipo}-${n.numero}`;
      if (n.plazo < hoy) add('notas', clave, 'rojo', `${n.tipo} N° ${n.numero} vencida`, `${n.asunto}. Plazo ${P.fecha(n.plazo)}.`, n.plazo);
      else if (P.dias(hoy, n.plazo) <= 2) add('notas', clave, 'amarillo', `${n.tipo} N° ${n.numero} vence el ${P.fecha(n.plazo)}`, n.asunto, n.fecha);
    });

    return out;
  }

  const ordenar = alertas => alertas.slice().sort((a, b) =>
    NIVELES.indexOf(a.nivel) - NIVELES.indexOf(b.nivel) || (a.desde || '').localeCompare(b.desde || ''));

  return {
    UMBRALES, MODULOS, NIVELES, NOMBRE_NIVEL, peor, ordenar,
    pctPrevisto, avanceObra, materiales, economico, etapaActual, ultimoReporte, habilesSinReportar, evaluar,
  };
})();
