// Formularios de carga de oficina (Adolfo / administración): certificados, láminas, requerimientos,
// controles de calidad, actas, etapas, legajo de HyS y pedidos de materiales.
// Cada tipo arma un registro y lo manda con la acción "guardar" a la colección de la obra.
window.Formularios = (() => {
  const P = window.Panel;
  const esc = P.esc;

  let preset = null;      // valores que vienen de un botón ("Actualizar", "Registrar pedido"…)
  let obraElegida = '';
  let mensaje = null;     // { ok, texto, obra, pestana }

  const DISCIPLINAS = ['Arquitectura', 'Estructura', 'Instalación sanitaria', 'Instalación eléctrica', 'Instalación de gas', 'Climatización', 'Higiene y seguridad'];
  const ESTADOS_DOC = ['pendiente', 'en elaboración', 'en revisión', 'emitida', 'aprobada', 'en obra'];
  const RESPONSABLES = ['Desarrollo de Proyectos', 'Gestión de Proyectos', 'Calculista externo', 'Instalaciones (externo)', 'Comitente'];
  const TIPOS_ACTA = ['Acta de inicio', 'Acta de replanteo', 'Acta de medición', 'Acta de paralización', 'Recepción provisoria', 'Recepción definitiva'];
  const DOCS_HYS = ['Aviso de obra ART', 'Programa de seguridad', 'Seguro de accidentes personales', 'Capacitación del personal'];

  const sigId = (lista, prefijo) => {
    const n = lista.reduce((m, x) => Math.max(m, Number(String(x.id || '').replace(/\D/g, '')) || 0), 0) + 1;
    return `${prefijo}-${String(n).padStart(2, '0')}`;
  };

  const TIPOS = {
    certificado: {
      titulo: 'Certificado', coleccion: 'certificados', clave: 'n', pestana: 'certificaciones',
      ayuda: 'El monto se calcula con el porcentaje del período sobre el presupuesto de la obra.',
      campos: [
        { id: 'periodo', label: 'Período', tipo: 'month', req: true, def: E => P.sumarDias(E.hoy.slice(0, 8) + '01', -1).slice(0, 7) },
        { id: 'pct', label: '% de avance certificado en el período', tipo: 'number', req: true, step: '0.1', min: '0', max: '100' },
        { id: 'estado', label: 'Estado', tipo: 'select', opciones: ['borrador', 'presentado', 'aprobado', 'cobrado'], def: () => 'presentado' },
        { id: 'fecha', label: 'Fecha de ese estado', tipo: 'date', req: true, def: E => E.hoy },
      ],
      armar(v, o) {
        const existe = preset && preset.n ? o.certificados.find(c => c.n === preset.n) : null;
        const r = existe ? Object.assign({}, existe) : { n: o.certificados.length + 1, presentado: null, aprobado: null, cobrado: null };
        Object.assign(r, { periodo: v.periodo, pct: Number(v.pct), monto: o.presupuesto * Number(v.pct) / 100, estado: v.estado });
        if (v.estado !== 'borrador' && !r.presentado) r.presentado = v.fecha;
        if (['aprobado', 'cobrado'].includes(v.estado) && !r.aprobado) r.aprobado = v.fecha;
        if (v.estado === 'cobrado') r.cobrado = v.fecha;
        return r;
      },
    },
    lamina: {
      titulo: 'Lámina', coleccion: 'documentos', clave: 'codigo', pestana: 'documentacion',
      ayuda: 'Si el código ya existe en la obra, se actualiza (por ejemplo, para pasarla a emitida con una revisión nueva).',
      campos: [
        { id: 'codigo', label: 'Código', tipo: 'text', req: true, ph: 'IS-02' },
        { id: 'titulo', label: 'Título', tipo: 'text', req: true, ph: 'Desagües cloacales planta baja' },
        { id: 'disciplina', label: 'Disciplina', tipo: 'select', opciones: DISCIPLINAS },
        { id: 'revision', label: 'Revisión', tipo: 'text', ph: 'A' },
        { id: 'estado', label: 'Estado', tipo: 'select', opciones: ESTADOS_DOC },
        { id: 'id_tarea', label: 'Tarea que la necesita', tipo: 'tarea' },
        { id: 'emision', label: 'Fecha de emisión', tipo: 'date', def: E => E.hoy },
      ],
      armar: v => Object.assign({}, v, { codigo: v.codigo.trim().toUpperCase(), id_tarea: v.id_tarea || null, emision: ['pendiente', 'en elaboración', 'en revisión'].includes(v.estado) ? null : v.emision }),
    },
    requerimiento: {
      titulo: 'Requerimiento técnico', coleccion: 'requerimientos', clave: 'id', pestana: 'requerimientos',
      ayuda: 'Un plano de detalle, una definición o una consulta que el DT necesita de proyecto.',
      campos: [
        { id: 'asunto', label: 'Asunto', tipo: 'text', req: true, ancho: true, ph: 'Detalle de encuentro de carpintería con revestimiento' },
        { id: 'disciplina', label: 'Disciplina', tipo: 'select', opciones: DISCIPLINAS },
        { id: 'responsable', label: 'A cargo de', tipo: 'select', opciones: RESPONSABLES },
        { id: 'plazo', label: 'Plazo de respuesta', tipo: 'date', req: true, def: E => P.sumarDias(E.hoy, 5) },
        { id: 'id_tarea', label: 'Tarea que traba', tipo: 'tarea' },
      ],
      armar: (v, o, E) => Object.assign({}, v, { id: sigId(o.requerimientos, 'R'), fecha: E.hoy, solicitante: o.dt, estado: 'abierto', id_tarea: v.id_tarea || null }),
    },
    control: {
      titulo: 'Control de calidad', coleccion: 'controles', clave: 'id', pestana: 'calidad',
      ayuda: 'Una no conformidad queda abierta, con alerta en rojo, hasta que se cierra.',
      campos: [
        { id: 'hito', label: 'Control', tipo: 'text', req: true, ancho: true, ph: 'Inspección de armaduras de losa' },
        { id: 'id_tarea', label: 'Tarea', tipo: 'tarea' },
        { id: 'fecha', label: 'Fecha', tipo: 'date', req: true, def: E => E.hoy },
        { id: 'resultado', label: 'Resultado', tipo: 'select', opciones: ['conforme', 'observado', 'no conforme'] },
        { id: 'responsable', label: 'Responsable', tipo: 'text', ph: 'DT, calculista, laboratorio…' },
        { id: 'obs', label: 'Observaciones', tipo: 'textarea', ancho: true },
      ],
      armar: (v, o) => Object.assign({}, v, { id: sigId(o.controles, 'C'), id_tarea: v.id_tarea || null, responsable: v.responsable || o.dt, cerrado: v.resultado !== 'no conforme' }),
    },
    acta: {
      titulo: 'Acta', coleccion: 'actas', pestana: 'actas',
      ayuda: 'Adjuntá el acta firmada escaneada. En la demo se guarda solo el nombre del archivo.',
      campos: [
        { id: 'tipo', label: 'Tipo de acta', tipo: 'select', opciones: TIPOS_ACTA },
        { id: 'fecha', label: 'Fecha', tipo: 'date', req: true, def: E => E.hoy },
        { id: 'firmantes', label: 'Firmantes', tipo: 'text', ph: 'Comitente, DT, contratista' },
        { id: 'archivo', label: 'Archivo firmado (PDF o foto)', tipo: 'file' },
      ],
      armar: v => v,
    },
    etapa: {
      titulo: 'Etapa de obra', coleccion: 'etapa', pestana: 'actas',
      ayuda: 'La etapa elegida pasa a "en curso" y la anterior queda terminada.',
      campos: [{ id: 'nombre', label: 'Etapa actual', tipo: 'select', opciones: o => o.etapas.map(e => e.nombre) }],
      armar: v => v,
    },
    hys: {
      titulo: 'Documento de HyS', coleccion: 'hys', clave: 'documento', pestana: 'hys',
      ayuda: 'Al renovar un documento del legajo se actualiza su vencimiento.',
      campos: [
        { id: 'documento', label: 'Documento', tipo: 'select', opciones: DOCS_HYS },
        { id: 'vence', label: 'Vence', tipo: 'date', req: true, def: E => P.sumarDias(E.hoy, 180) },
      ],
      armar: v => v,
    },
    pedido: {
      titulo: 'Pedido de material', coleccion: 'pedidos', clave: ['id_tarea', 'material'], pestana: 'materiales',
      ayuda: 'Con el pedido registrado la alerta pasa a seguir la fecha de entrega prometida.',
      campos: [
        { id: 'material', label: 'Material', tipo: 'select', ancho: true, opciones: o => o.tareas.flatMap(t => t.materiales.map(m => [`${t.id}|${m.nombre}`, `${m.nombre} · ${t.id} ${t.nombre}`])) },
        { id: 'estado', label: 'Estado', tipo: 'select', opciones: ['pedido', 'recibido', 'no aplica'] },
        { id: 'entrega', label: 'Entrega prometida o recibida', tipo: 'date', req: true, def: E => P.sumarDias(E.hoy, 5) },
      ],
      armar: (v, o, E) => {
        const [id_tarea, material] = v.material.split('|');
        return { id_tarea, material, estado: v.estado, fecha: E.hoy, entrega: v.entrega };
      },
    },
  };

  function preparar(tipo, obra, valores) {
    preset = Object.assign({ tipo }, valores || {});
    obraElegida = obra || obraElegida;
    mensaje = null;
  }

  function campo(c, v, o, E) {
    const id = `c-${c.id}`;
    const val = v != null ? v : (c.def ? c.def(E, o) : '');
    let ctrl;
    if (c.tipo === 'select' || c.tipo === 'tarea') {
      let ops = c.tipo === 'tarea' ? [['', 'Ninguna'], ...o.tareas.map(t => [t.id, `${t.id} ${t.nombre}`])] : (typeof c.opciones === 'function' ? c.opciones(o) : c.opciones);
      ops = ops.map(x => (Array.isArray(x) ? x : [x, x]));
      ctrl = `<select id="${id}" name="${c.id}">${ops.map(([k, t]) => `<option value="${esc(k)}" ${String(k) === String(val) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    } else if (c.tipo === 'textarea') {
      ctrl = `<textarea id="${id}" name="${c.id}">${esc(val)}</textarea>`;
    } else if (c.tipo === 'file') {
      ctrl = `<input id="${id}" name="${c.id}" type="file" accept=".pdf,image/*">`;
    } else {
      ctrl = `<input id="${id}" name="${c.id}" type="${c.tipo}" value="${esc(val)}" ${c.req ? 'required' : ''} ${c.ph ? `placeholder="${esc(c.ph)}"` : ''} ${c.step ? `step="${c.step}"` : ''} ${c.min ? `min="${c.min}"` : ''} ${c.max ? `max="${c.max}"` : ''}>`;
    }
    return `<div class="campo ${c.ancho ? 'ancho' : ''}"><label for="${id}">${esc(c.label)}${c.req ? ' *' : ''}</label>${ctrl}</div>`;
  }

  function vista(E, tipo) {
    if (!TIPOS[tipo]) tipo = preset && TIPOS[preset.tipo] ? preset.tipo : 'certificado';
    if (preset && preset.tipo !== tipo) preset = null;
    if (!obraElegida || !E.obras.some(o => o.id === obraElegida)) obraElegida = E.obras[0].id;
    const T = TIPOS[tipo];
    const o = E.obras.find(x => x.id === obraElegida);
    const valores = preset || {};
    const msg = mensaje ? (mensaje.ok
      ? `<p class="ok-msg">${esc(mensaje.texto)} <a href="#obra.${mensaje.obra}.${mensaje.pestana}">Ver en la obra</a></p>`
      : `<p class="err-msg">${esc(mensaje.texto)}</p>`) : '';
    return `<div class="cab"><div><h1>Cargar datos de oficina</h1><p>Lo que no llega por el reporte diario del DT. Cada carga actualiza el semáforo al instante.</p></div></div>
      <nav class="tipos" aria-label="Tipo de carga">${Object.entries(TIPOS).map(([k, t]) => `<button type="button" data-tipo="${k}" class="${k === tipo ? 'activo' : ''}">${esc(t.titulo)}</button>`).join('')}</nav>
      <section class="card" style="max-width:860px">
        <h2>${esc(T.titulo)}${preset && Object.keys(preset).length > 1 ? ' · actualizar' : ''}</h2>
        <p class="muted chico" style="margin-top:-6px">${esc(T.ayuda)}</p>
        <form id="form-carga" class="form" data-tipo="${tipo}" novalidate>
          <div class="campo ancho"><label for="c-obra">Obra *</label><select id="c-obra" name="obra">${E.obras.map(x => `<option value="${x.id}" ${x.id === obraElegida ? 'selected' : ''}>${esc(x.nombre)} (${esc(x.codigo)})</option>`).join('')}</select></div>
          ${T.campos.map(c => campo(c, valores[c.id], o, E)).join('')}
          <div class="acciones"><button class="btn primario" type="submit">Guardar</button><a class="btn plano" href="#tablero">Volver al tablero</a></div>
          <div class="acciones" id="form-msg">${msg}</div>
        </form>
      </section>`;
  }

  function montar(E, refrescar) {
    const form = document.getElementById('form-carga');
    if (!form) return;
    const tipo = form.dataset.tipo;
    const T = TIPOS[tipo];
    document.querySelectorAll('.tipos button').forEach(b => b.addEventListener('click', () => {
      preset = null; mensaje = null;
      location.hash = `cargar.${b.dataset.tipo}`;
    }));
    form.querySelector('#c-obra').addEventListener('change', e => {
      obraElegida = e.target.value;
      preset = null; mensaje = null;
      refrescar();
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const o = E.obras.find(x => x.id === form.obra.value);
      const v = {};
      for (const c of T.campos) {
        const el = form.elements[c.id];
        v[c.id] = c.tipo === 'file' ? (el.files[0] ? el.files[0].name : '') : el.value.trim();
        if (c.req && !v[c.id]) {
          mostrar(false, `Completá "${c.label}".`);
          el.focus();
          return;
        }
      }
      if (tipo === 'certificado' && !(Number(v.pct) > 0 && Number(v.pct) <= 100)) { mostrar(false, 'El porcentaje tiene que estar entre 0,1 y 100.'); return; }
      try {
        await P.llamar('guardar', { obra: o.id, coleccion: T.coleccion, clave: T.clave, registro: T.armar(v, o, E) });
        mensaje = { ok: true, texto: `Listo, quedó cargado en ${o.nombre}.`, obra: o.id, pestana: T.pestana };
        preset = null;
        await refrescar();
      } catch (err) {
        mostrar(false, err.message);
      }
    });
  }

  function mostrar(ok, texto) {
    const div = document.getElementById('form-msg');
    if (div) div.innerHTML = `<p class="${ok ? 'ok-msg' : 'err-msg'}">${esc(texto)}</p>`;
  }

  return { vista, montar, preparar };
})();
