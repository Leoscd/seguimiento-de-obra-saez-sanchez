// Backend falso para mostrar el panel sin servidor. Datos 100 % ficticios, fechados relativos a hoy
// (como scripts/seed_demo.py), armados para que aparezcan todos los niveles del semáforo.
// Guarda lo cargado en el navegador (clave "panel.demo1") y lo regenera cuando cambia el día.
window.PanelDemo = (() => {
  const P = window.Panel;
  const R = window.Reglas;
  const CLAVE = 'panel.demo1';

  const PERSONAS = [
    { id: 'coord', nombre: 'Coordinación de obras', rol: 'Coordinador', email: 'coordinacion@demo' },
    { id: 'mac', nombre: 'Martín Acosta', rol: 'DT', email: 'macosta@demo' },
    { id: 'lhe', nombre: 'Lucía Herrera', rol: 'DT', email: 'lherrera@demo' },
    { id: 'tvi', nombre: 'Tomás Villagra', rol: 'DT', email: 'tvillagra@demo' },
  ];

  // Pseudoaleatorio fijo, para que el clima y el personal no cambien en cada recarga.
  function azar(semilla) {
    let x = 0;
    for (const c of semilla) x = (x * 31 + c.charCodeAt(0)) >>> 0;
    return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
  }

  function generar(hoy) {
    const d = n => P.sumarDias(hoy, n);
    const mesRel = k => { // k = 1: mes anterior
      const [y, m] = hoy.split('-').map(Number);
      const t = y * 12 + m - 1 - k;
      return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`;
    };

    const tarea = (id, rubro, nombre, ini, fin, critica, avance, extra = {}) => ({
      id, rubro, nombre, inicio: d(ini), fin: d(fin), critica, avance,
      materiales: (extra.m || []).map(([nombre, cantidad, unidad, proveedor, plazo]) => ({ nombre, cantidad, unidad, proveedor, plazo })),
      control: extra.control || null,
    });

    const rubros = (presupuesto, filas) => filas.map(([rubro, frac, avance, factor = 1]) => {
      const p = presupuesto * frac;
      return { rubro, presupuesto: p, avance, costo: p * avance / 100 * factor };
    });

    const etapas = filas => filas.map(([nombre, ini, fin]) => ({
      nombre, inicio: d(ini), fin: d(fin),
      estado: d(fin) < hoy ? 'terminada' : d(ini) <= hoy ? 'en curso' : 'pendiente',
    }));

    // Un certificado por mes, desde el inicio de la obra hasta el mes anterior (o el fin de la obra).
    function certificados(obra, pctTotal, recientes, aprobadoHace = {}) {
      const meses = [];
      for (let k = 1; k < 24; k++) {
        const m = mesRel(k);
        if (m < obra.inicio.slice(0, 7)) break;
        if (m <= obra.fin.slice(0, 7)) meses.unshift(m);
      }
      const n = meses.length;
      return meses.map((periodo, i) => {
        const desdeNuevo = n - 1 - i;
        let estado = recientes[desdeNuevo] || 'cobrado';
        let presentado = P.sumarDias(P.sumarDias(periodo + '-28', 6).slice(0, 8) + '01', 3);
        if (presentado > hoy) presentado = hoy;
        const aprobado = aprobadoHace[desdeNuevo] != null ? d(-aprobadoHace[desdeNuevo]) : P.sumarDias(presentado, 8);
        if (aprobado > hoy && estado !== 'presentado') estado = 'presentado';
        return {
          n: i + 1, periodo, pct: Math.round(pctTotal / n * 10) / 10, monto: obra.presupuesto * pctTotal / n / 100, estado,
          presentado, aprobado: ['aprobado', 'cobrado'].includes(estado) ? aprobado : null,
          cobrado: estado === 'cobrado' ? P.sumarDias(aprobado, 15) : null,
        };
      });
    }

    // Reportes confirmados día hábil por día hábil, hasta `hasta` días hábiles antes de hoy.
    function reportes(obra, hasta, personal, ajustes = {}) {
      const rnd = azar(obra.id);
      const lista = [];
      let fin = hoy;
      for (let i = 0; i < hasta; i++) fin = P.habilAnterior(fin);
      const av = R.avanceObra(obra, hoy);
      const factor = av.previsto ? av.real / av.previsto : 1;
      let f = obra.inicio;
      let n = 0;
      while (f <= fin && f <= obra.fin) {
        if (P.esHabil(f)) {
          n++;
          const r = rnd();
          const lluvia = r > .86 ? Math.round(5 + rnd() * 25) : 0;
          const previsto = R.avanceObra(obra, f).previsto;
          lista.push(Object.assign({
            fecha: f, n, confirmado: true,
            clima: lluvia ? 'Lluvia por la tarde' : r > .55 ? 'Nublado' : 'Soleado',
            lluvia_mm: lluvia,
            jornada: lluvia > 15 ? 'parcial' : 'completa',
            causa: lluvia > 15 ? 'Lluvia' : '',
            personal: Math.max(2, Math.round(personal * (.75 + rnd() * .4))),
            epp: true, art: rnd() > .93, incidente: null,
            avance_real: Math.min(100, Math.round(previsto * factor * 10) / 10),
            avance_previsto: previsto,
          }, ajustes[P.dias(f, hoy)] || {}));
        }
        f = P.sumarDias(f, 1);
      }
      return lista;
    }

    const legajo = (aviso, programa, seguro, capacitacion) => [
      { documento: 'Aviso de obra ART', vence: d(aviso) },
      { documento: 'Programa de seguridad', vence: d(programa) },
      { documento: 'Seguro de accidentes personales', vence: d(seguro) },
      { documento: 'Capacitación del personal', vence: d(capacitacion) },
    ];

    // ---------- Casa Lomas de Tafí ----------
    const casa = {
      id: 'casa-lomas', codigo: 'O-031', nombre: 'Casa Lomas de Tafí', comitente: 'Familia Correa (demo)',
      direccion: 'Barrio Lomas de Tafí, Tafí Viejo', dt: 'mac', estado: 'en curso', inicio: d(-40), fin: d(95), presupuesto: 185e6,
      tareas: [
        tarea('T-010', '01 Trabajos preliminares', 'Replanteo y obrador', -40, -36, false, 100),
        tarea('T-020', '02 Movimiento de suelos', 'Excavación de bases y vigas de fundación', -35, -28, true, 100),
        tarea('T-030', '03 Fundaciones', 'Bases y vigas de fundación de H°A°', -27, -12, true, 100, { control: 'Inspección de armaduras', m: [['Hormigón elaborado H-21', 14, 'm3', 'Hormigonera del Norte', 2]] }),
        tarea('T-045', '06 Aislaciones', 'Capa aisladora horizontal', -12, -9, false, 100, { m: [['Hidrófugo', 40, 'kg', 'Corralón San Martín', 2]] }),
        tarea('T-040', '05 Mampostería', 'Mampostería de elevación planta baja', -10, 6, true, 50, { m: [['Ladrillo cerámico hueco 18x18x33', 3200, 'u', 'Corralón San Martín', 4]] }),
        tarea('T-050', '08 Contrapisos y carpetas', 'Contrapiso planta baja', 8, 12, true, 0, { m: [['Cemento portland', 120, 'bolsas', 'Corralón San Martín', 3], ['Arena gruesa', 6, 'm3', 'Áridos Lules', 2], ['Ripio', 8, 'm3', 'Áridos Lules', 2]] }),
        tarea('T-060', '10 Instalación sanitaria', 'Cañerías de desagüe planta baja', 9, 14, false, 0, { m: [['Caño PVC 110 mm', 24, 'u', 'Sanitarios Tucumán', 5]] }),
        tarea('T-070', '04 Estructura de H°A°', 'Losa sobre planta baja', 15, 25, true, 0, { control: 'Inspección de armaduras', m: [['Hierro aletado 8 mm', 1.2, 't', 'Hierros del Norte', 7], ['Hormigón elaborado H-21', 18, 'm3', 'Hormigonera del Norte', 2], ['Viguetas pretensadas', 46, 'u', 'Pretensados Tucumán', 10]] }),
        tarea('T-080', '05 Mampostería', 'Mampostería de elevación planta alta', 27, 40, false, 0, { m: [['Ladrillo común', 8000, 'u', 'Hornos de Famaillá', 10]] }),
        tarea('T-090', '09 Cubiertas', 'Cubierta de chapa', 41, 50, false, 0, { m: [['Chapa sinusoidal C25', 60, 'u', 'Chapas del NOA', 15]] }),
      ],
      pedidos: [
        { id_tarea: 'T-050', material: 'Arena gruesa', estado: 'pedido', fecha: d(-2), entrega: d(6) },
        { id_tarea: 'T-050', material: 'Ripio', estado: 'pedido', fecha: d(-2), entrega: d(6) },
        { id_tarea: 'T-070', material: 'Hierro aletado 8 mm', estado: 'pedido', fecha: d(-4), entrega: d(8) },
      ],
      notas: [
        { tipo: 'Comunicación con el comitente', numero: 1, fecha: d(-3), emisor: 'Comitente', destinatario: 'DT', asunto: 'Cambiar cerámico de galería por porcelanato', plazo: d(6), estado: 'pendiente', impacto: true },
        { tipo: 'Observación del DT', numero: 1, fecha: d(-14), emisor: 'DT', destinatario: 'Director de proyecto', asunto: 'Fisura capilar en viga de fundación VF-3, consultar calculista', plazo: d(-8), estado: 'cumplida' },
      ],
      requerimientos: [
        { id: 'R-01', fecha: d(-9), asunto: 'Nivel de piso terminado en galería', disciplina: 'Arquitectura', solicitante: 'mac', responsable: 'Desarrollo de Proyectos', plazo: d(-2), estado: 'abierto', id_tarea: 'T-050' },
        { id: 'R-02', fecha: d(-20), asunto: 'Detalle de encuentro mampostería y columna C-4', disciplina: 'Arquitectura', solicitante: 'mac', responsable: 'Desarrollo de Proyectos', plazo: d(-15), estado: 'respondido', id_tarea: 'T-040' },
      ],
      documentos: [
        { codigo: 'A-01', titulo: 'Planta baja – arquitectura', disciplina: 'Arquitectura', revision: 'C', estado: 'en obra', emision: d(-45) },
        { codigo: 'A-02', titulo: 'Planta alta – arquitectura', disciplina: 'Arquitectura', revision: 'B', estado: 'en obra', emision: d(-45) },
        { codigo: 'E-03', titulo: 'Fundaciones – planta y detalles', disciplina: 'Estructura', revision: 'B', estado: 'en obra', emision: d(-42), id_tarea: 'T-030' },
        { codigo: 'E-05', titulo: 'Losa sobre PB – planta de armaduras', disciplina: 'Estructura', revision: 'A', estado: 'en elaboración', id_tarea: 'T-070' },
        { codigo: 'IS-02', titulo: 'Desagües cloacales planta baja', disciplina: 'Instalación sanitaria', revision: 'A', estado: 'pendiente', id_tarea: 'T-060' },
        { codigo: 'IE-01', titulo: 'Instalación eléctrica – planta baja', disciplina: 'Instalación eléctrica', revision: 'A', estado: 'emitida', emision: d(-6) },
      ],
      hys: legajo(240, 110, 9, 60),
      controles: [
        { id: 'C-01', fecha: d(-16), hito: 'Inspección de armaduras de fundación', id_tarea: 'T-030', resultado: 'conforme', responsable: 'mac', obs: 'Recubrimientos y separadores correctos.', cerrado: true },
        { id: 'C-02', fecha: d(-5), hito: 'Ensayo de probetas H-21 (28 días)', id_tarea: 'T-030', resultado: 'conforme', responsable: 'Laboratorio externo', obs: 'Resistencia media 23,4 MPa.', cerrado: true },
      ],
      actas: [
        { tipo: 'Acta de inicio', fecha: d(-40), firmantes: 'Comitente, DT, contratista', archivo: 'acta-inicio-O031.pdf' },
        { tipo: 'Acta de replanteo', fecha: d(-40), firmantes: 'DT, contratista', archivo: 'acta-replanteo-O031.pdf' },
      ],
      etapas: etapas([['Trabajos preliminares', -40, -36], ['Estructura', -35, 25], ['Obra gruesa', 26, 50], ['Terminaciones', 51, 85], ['Entrega', 86, 95]]),
    };
    casa.rubros = rubros(casa.presupuesto, [
      ['01 Trabajos preliminares', .03, 100], ['03 Fundaciones', .12, 100, .97], ['04 Estructura de H°A°', .18, 5],
      ['05 Mampostería', .14, 35, 1.02], ['08 Contrapisos y carpetas', .06, 0], ['09 Cubiertas', .08, 0],
      ['10–13 Instalaciones', .17, 0], ['14–20 Terminaciones', .22, 0]]);
    casa.certificados = certificados(casa, 36, ['presentado']);
    casa.reportes = reportes(casa, 1, 9);

    // ---------- Local Av. Mate de Luna ----------
    const local = {
      id: 'local-mate-de-luna', codigo: 'O-034', nombre: 'Local Av. Mate de Luna', comitente: 'Comercial NOA SRL (demo)',
      direccion: 'Av. Mate de Luna 2500, San Miguel de Tucumán', dt: 'lhe', estado: 'en curso', inicio: d(-15), fin: d(34), presupuesto: 62e6,
      tareas: [
        tarea('L-010', '01 Trabajos preliminares', 'Demolición de tabiques y retiro de escombros', -15, -10, true, 100),
        tarea('L-020', '11 Instalación eléctrica', 'Canalización y cableado', -9, 6, true, 35, { m: [['Cable unipolar 2,5 mm', 400, 'm', 'Eléctrica Mate de Luna', 3], ['Caja de PVC rectangular', 60, 'u', 'Eléctrica Mate de Luna', 3]] }),
        tarea('L-030', '07 Revoques', 'Revoque grueso y fino interior', 7, 17, true, 0, { m: [['Cal hidratada', 80, 'bolsas', 'Corralón San Martín', 2], ['Arena fina', 4, 'm3', 'Áridos Lules', 2]] }),
        tarea('L-040', '16 Pisos y zócalos', 'Porcelanato 60x60 en salón', 18, 26, true, 0, { m: [['Porcelanato 60x60', 180, 'm2', 'Cerámicos Yerba Buena', 12], ['Pegamento para porcelanato', 70, 'bolsas', 'Cerámicos Yerba Buena', 5]] }),
        tarea('L-050', '18 Pinturas', 'Pintura látex interior', 27, 34, false, 0, { m: [['Látex interior 20 l', 12, 'baldes', 'Pinturerías del Norte', 3]] }),
      ],
      pedidos: [
        { id_tarea: 'L-040', material: 'Porcelanato 60x60', estado: 'pedido', fecha: d(-6), entrega: d(12) },
        { id_tarea: 'L-030', material: 'Arena fina', estado: 'recibido', fecha: d(-5), entrega: d(-2) },
      ],
      notas: [
        { tipo: 'Nota de pedido', numero: 2, fecha: d(-6), emisor: 'Contratista', destinatario: 'DT', asunto: 'Definición del color de porcelanato del salón', plazo: d(-1), estado: 'pendiente', impacto: true },
        { tipo: 'Orden de servicio', numero: 1, fecha: d(-12), emisor: 'DT', destinatario: 'Contratista', asunto: 'Retirar escombros de la vereda antes de las 8 h', plazo: d(-11), estado: 'cumplida' },
      ],
      requerimientos: [
        { id: 'R-01', fecha: d(-8), asunto: 'Ubicación de tableros y bocas (plano eléctrico rev. B)', disciplina: 'Instalación eléctrica', solicitante: 'lhe', responsable: 'Gestión de Proyectos', plazo: d(-3), estado: 'abierto', id_tarea: 'L-020' },
        { id: 'R-02', fecha: d(-2), asunto: 'Despiece de porcelanato y junta en umbral', disciplina: 'Arquitectura', solicitante: 'lhe', responsable: 'Desarrollo de Proyectos', plazo: d(8), estado: 'abierto', id_tarea: 'L-040' },
      ],
      documentos: [
        { codigo: 'A-01', titulo: 'Planta de demolición y construcción', disciplina: 'Arquitectura', revision: 'B', estado: 'en obra', emision: d(-18) },
        { codigo: 'IE-01', titulo: 'Instalación eléctrica – salón', disciplina: 'Instalación eléctrica', revision: 'A', estado: 'en obra', emision: d(-18), id_tarea: 'L-020' },
        { codigo: 'A-03', titulo: 'Despiece de solados', disciplina: 'Arquitectura', revision: 'A', estado: 'en revisión', id_tarea: 'L-040' },
      ],
      hys: legajo(120, -5, 70, 40),
      controles: [],
      actas: [{ tipo: 'Acta de inicio', fecha: d(-15), firmantes: 'Comitente, DT, contratista', archivo: 'acta-inicio-O034.pdf' }],
      etapas: etapas([['Trabajos preliminares', -15, -10], ['Instalaciones', -9, 6], ['Obra gruesa', 7, 17], ['Terminaciones', 18, 34], ['Entrega', 35, 38]]),
    };
    local.rubros = rubros(local.presupuesto, [
      ['01 Trabajos preliminares', .08, 100, 1.03], ['11 Instalación eléctrica', .22, 35, 1.04], ['07 Revoques', .18, 0],
      ['16 Pisos y zócalos', .34, 0], ['18 Pinturas', .18, 0]]);
    local.certificados = certificados(local, 40, ['presentado']);
    local.reportes = reportes(local, 3, 6, {
      5: { jornada: 'parcial', causa: 'Corte de luz', personal: 4 },
      4: { jornada: 'parcial', causa: 'Falta de material (cable)', personal: 3 },
    });
    if (local.reportes.length) local.reportes[local.reportes.length - 1].epp = false;

    // ---------- Edificio Barrio Norte ----------
    const edificio = {
      id: 'edificio-barrio-norte', codigo: 'O-027', nombre: 'Edificio Barrio Norte', comitente: 'Fideicomiso Norte (demo)',
      direccion: 'Calle 24 de Septiembre 900, San Miguel de Tucumán', dt: 'tvi', estado: 'en curso', inicio: d(-120), fin: d(260), presupuesto: 640e6,
      tareas: [
        tarea('T-010', '01 Trabajos preliminares', 'Obrador, cerco y replanteo', -120, -110, false, 100),
        tarea('T-020', '02 Movimiento de suelos', 'Excavación de subsuelo', -109, -95, true, 100),
        tarea('T-030', '03 Fundaciones', 'Platea de fundación', -94, -70, true, 100, { control: 'Inspección de armaduras' }),
        tarea('T-040', '04 Estructura de H°A°', 'Estructura de subsuelo', -69, -45, true, 100, { control: 'Inspección de armaduras' }),
        tarea('T-050', '04 Estructura de H°A°', 'Losa sobre planta baja', -44, -30, true, 100, { control: 'Inspección de armaduras' }),
        tarea('T-055', '04 Estructura de H°A°', 'Hormigonado de losa 1° piso', -8, -6, true, 100, { control: 'Inspección de armaduras' }),
        tarea('T-060', '04 Estructura de H°A°', 'Columnas y vigas 2° piso', -5, 12, true, 25),
        tarea('T-065', '04 Estructura de H°A°', 'Losa 2° piso', 13, 16, true, 0, { control: 'Inspección de armaduras', m: [['Hormigón elaborado H-25', 40, 'm3', 'Hormigonera del Norte', 2]] }),
        tarea('T-070', '05 Mampostería', 'Mampostería de subsuelo y planta baja', -25, 20, false, 40, { m: [['Ladrillo cerámico hueco 12x18x33', 9000, 'u', 'Corralón San Martín', 4]] }),
        tarea('T-080', '10 Instalación sanitaria', 'Montantes sanitarias', 10, 45, false, 0, { m: [['Caño PVC 110 mm', 40, 'u', 'Sanitarios Tucumán', 5]] }),
        tarea('T-090', '04 Estructura de H°A°', 'Estructura 3° y 4° piso', 17, 70, true, 0, { m: [['Hierro aletado 12 mm', 6, 't', 'Hierros del Norte', 7]] }),
        tarea('T-100', '11 Instalación eléctrica', 'Montantes y canalizaciones eléctricas', 30, 120, false, 0, { m: [['Cable unipolar 4 mm', 2000, 'm', 'Eléctrica Mate de Luna', 3]] }),
        tarea('T-110', '14 Carpinterías', 'Carpinterías de aluminio', 150, 220, false, 0, { m: [['Ventanas de aluminio línea Modena', 64, 'u', 'Aberturas del Valle', 45]] }),
        tarea('T-120', '15 Revestimientos', 'Terminaciones interiores', 200, 255, false, 0),
        tarea('T-130', '20 Limpieza final', 'Limpieza final y entrega', 256, 260, false, 0),
      ],
      pedidos: [
        { id_tarea: 'T-090', material: 'Hierro aletado 12 mm', estado: 'pedido', fecha: d(-12), entrega: d(-1) },
        { id_tarea: 'T-070', material: 'Ladrillo cerámico hueco 12x18x33', estado: 'recibido', fecha: d(-30), entrega: d(-26) },
      ],
      notas: [
        { tipo: 'Orden de servicio', numero: 4, fecha: d(-3), emisor: 'DT', destinatario: 'Contratista', asunto: 'Rehacer recubrimiento de armaduras en columna C-12', plazo: d(1), estado: 'pendiente' },
        { tipo: 'Nota de pedido', numero: 3, fecha: d(-10), emisor: 'Contratista', destinatario: 'DT', asunto: 'Autorización para hormigonar losa 1° piso', plazo: d(-8), estado: 'respondida' },
      ],
      requerimientos: [
        { id: 'R-04', fecha: d(-4), asunto: 'Detalle de junta de dilatación en losa 2° piso', disciplina: 'Estructura', solicitante: 'tvi', responsable: 'Calculista externo', plazo: d(5), estado: 'abierto', id_tarea: 'T-065' },
        { id: 'R-05', fecha: d(-2), asunto: 'Pases de montantes en losa 2° piso', disciplina: 'Instalación sanitaria', solicitante: 'tvi', responsable: 'Gestión de Proyectos', plazo: d(1), estado: 'abierto', id_tarea: 'T-080' },
        { id: 'R-03', fecha: d(-25), asunto: 'Nivel de fondo de platea en sector ascensor', disciplina: 'Estructura', solicitante: 'tvi', responsable: 'Calculista externo', plazo: d(-20), estado: 'respondido', id_tarea: 'T-040' },
      ],
      documentos: [
        { codigo: 'E-10', titulo: 'Estructura de subsuelo', disciplina: 'Estructura', revision: 'C', estado: 'en obra', emision: d(-75), id_tarea: 'T-040' },
        { codigo: 'E-12', titulo: 'Losas 1° y 2° piso – encofrado y armaduras', disciplina: 'Estructura', revision: 'B', estado: 'en obra', emision: d(-20), id_tarea: 'T-060' },
        { codigo: 'E-14', titulo: 'Estructura 3° y 4° piso', disciplina: 'Estructura', revision: 'A', estado: 'emitida', emision: d(-3), id_tarea: 'T-090' },
        { codigo: 'IS-07', titulo: 'Montantes sanitarias', disciplina: 'Instalación sanitaria', revision: 'A', estado: 'pendiente', id_tarea: 'T-080' },
        { codigo: 'IE-03', titulo: 'Montantes eléctricas', disciplina: 'Instalación eléctrica', revision: 'A', estado: 'en elaboración', id_tarea: 'T-100' },
        { codigo: 'A-21', titulo: 'Planilla de carpinterías', disciplina: 'Arquitectura', revision: '—', estado: 'pendiente', id_tarea: 'T-110' },
      ],
      hys: legajo(200, 90, 120, 25),
      controles: [
        { id: 'C-01', fecha: d(-72), hito: 'Inspección de armaduras de platea', id_tarea: 'T-030', resultado: 'conforme', responsable: 'tvi', obs: 'Sin observaciones.', cerrado: true },
        { id: 'C-02', fecha: d(-47), hito: 'Inspección de armaduras de subsuelo', id_tarea: 'T-040', resultado: 'observado', responsable: 'tvi', obs: 'Faltaban separadores en tabique norte; corregido en el día.', cerrado: true },
        { id: 'C-03', fecha: d(-32), hito: 'Inspección de armaduras losa sobre PB', id_tarea: 'T-050', resultado: 'conforme', responsable: 'Calculista externo', obs: 'Aprobada para hormigonar.', cerrado: true },
        { id: 'C-04', fecha: d(-3), hito: 'Recubrimiento de columnas 1° piso', id_tarea: 'T-060', resultado: 'no conforme', responsable: 'tvi', obs: 'Recubrimiento insuficiente en columna C-12. Orden de servicio N° 4.', cerrado: false },
      ],
      actas: [
        { tipo: 'Acta de inicio', fecha: d(-120), firmantes: 'Fiduciario, DT, contratista', archivo: 'acta-inicio-O027.pdf' },
        { tipo: 'Acta de replanteo', fecha: d(-119), firmantes: 'DT, agrimensor, contratista', archivo: 'acta-replanteo-O027.pdf' },
        { tipo: 'Acta de medición', fecha: d(-35), firmantes: 'DT, contratista', archivo: 'acta-medicion-3-O027.pdf' },
      ],
      etapas: etapas([['Trabajos preliminares', -120, -110], ['Estructura', -109, 70], ['Obra gruesa', 71, 150], ['Terminaciones', 151, 250], ['Entrega', 251, 260]]),
    };
    edificio.rubros = rubros(edificio.presupuesto, [
      ['01 Trabajos preliminares', .02, 100], ['02 Movimiento de suelos', .04, 100, .95], ['03 Fundaciones', .08, 100, 1.01],
      ['04 Estructura de H°A°', .24, 45, 1.12], ['05 Mampostería', .09, 40], ['10–13 Instalaciones', .18, 0],
      ['14 Carpinterías', .12, 0], ['15–20 Terminaciones', .23, 0]]);
    edificio.certificados = certificados(edificio, 40, ['presentado', 'aprobado'], { 1: 38 });
    edificio.reportes = reportes(edificio, 1, 22, {
      [P.dias(P.habilAnterior(P.habilAnterior(P.habilAnterior(hoy))), hoy)]: {
        incidente: { texto: 'Ayudante con corte en la mano al manipular hierro. Atendido por la ART, sin baja.', grave: false }, art: true,
      },
    });

    // ---------- Vivienda Yerba Buena (terminada, en cierre) ----------
    const vivienda = {
      id: 'vivienda-yerba-buena', codigo: 'O-019', nombre: 'Vivienda Yerba Buena', comitente: 'Familia Paz (demo)',
      direccion: 'Country Las Yungas, Yerba Buena', dt: 'mac', estado: 'en cierre', inicio: d(-200), fin: d(-20), presupuesto: 98e6,
      tareas: [
        tarea('V-010', '01 Trabajos preliminares', 'Replanteo y obrador', -200, -195, false, 100),
        tarea('V-020', '03 Fundaciones', 'Fundaciones', -194, -170, true, 100),
        tarea('V-030', '04 Estructura de H°A°', 'Estructura y losa', -169, -130, true, 100),
        tarea('V-040', '05 Mampostería', 'Mampostería', -129, -100, true, 100),
        tarea('V-050', '10 Instalación sanitaria', 'Instalación sanitaria', -110, -80, false, 100, { control: 'Prueba hidráulica' }),
        tarea('V-060', '11 Instalación eléctrica', 'Instalación eléctrica', -105, -75, false, 100),
        tarea('V-070', '16 Pisos y zócalos', 'Pisos y revestimientos', -74, -45, true, 100),
        tarea('V-080', '18 Pinturas', 'Pintura y terminaciones', -44, -25, true, 100),
        tarea('V-090', '20 Limpieza final', 'Limpieza final', -24, -20, false, 100),
      ],
      pedidos: [],
      notas: [
        { tipo: 'Comunicación con el comitente', numero: 3, fecha: d(-18), emisor: 'Comitente', destinatario: 'DT', asunto: 'Reclamo por filtración en ducha del baño 2', plazo: d(-4), estado: 'respondida' },
      ],
      requerimientos: [],
      documentos: [
        { codigo: 'A-01', titulo: 'Conforme a obra – arquitectura', disciplina: 'Arquitectura', revision: 'A', estado: 'en elaboración' },
      ],
      hys: legajo(25, 40, 30, 50),
      controles: [
        { id: 'C-05', fecha: d(-82), hito: 'Prueba hidráulica de cañerías', id_tarea: 'V-050', resultado: 'conforme', responsable: 'mac', obs: '2 h a 1,5 veces la presión de trabajo, sin pérdidas.', cerrado: true },
        { id: 'C-09', fecha: d(-17), hito: 'Prueba de estanqueidad baño 2', id_tarea: 'V-070', resultado: 'no conforme', responsable: 'mac', obs: 'Filtración en ducha del baño 2. Pendiente reparación del contratista.', cerrado: false },
      ],
      actas: [
        { tipo: 'Acta de inicio', fecha: d(-200), firmantes: 'Comitente, DT, contratista', archivo: 'acta-inicio-O019.pdf' },
        { tipo: 'Acta de replanteo', fecha: d(-200), firmantes: 'DT, contratista', archivo: 'acta-replanteo-O019.pdf' },
      ],
      etapas: etapas([['Trabajos preliminares', -200, -195], ['Estructura', -194, -130], ['Obra gruesa', -129, -75], ['Terminaciones', -74, -20], ['Entrega', -19, 10]]),
    };
    vivienda.rubros = rubros(vivienda.presupuesto, [
      ['01–03 Preliminares y fundaciones', .15, 100, .98], ['04 Estructura de H°A°', .2, 100, 1.01], ['05 Mampostería', .12, 100],
      ['10–13 Instalaciones', .18, 100, 1.03], ['15–18 Terminaciones', .35, 100, .99]]);
    vivienda.certificados = certificados(vivienda, 100, ['presentado']);
    vivienda.reportes = reportes(vivienda, 1, 8);

    return { generado: hoy, obras: [edificio, casa, local, vivienda], vistas: {} };
  }

  function cargar() {
    const hoy = P.iso(new Date());
    const guardado = P.local.leer(CLAVE);
    if (guardado && guardado.generado === hoy) return guardado;
    const b = generar(hoy);
    P.local.escribir(CLAVE, b);
    return b;
  }

  const COLECCIONES = ['certificados', 'documentos', 'requerimientos', 'controles', 'actas', 'hys', 'notas', 'pedidos'];

  async function llamar(c) {
    await new Promise(r => setTimeout(r, 120));
    const b = cargar();
    const hoy = b.generado;
    switch (c.accion) {
      case 'estado': {
        const alertas = R.ordenar(b.obras.flatMap(o => R.evaluar(o, hoy, PERSONAS)))
          .map(a => Object.assign(a, { vista: !!b.vistas[a.id] }));
        return { ok: true, hoy, demo: true, usuario: PERSONAS[0], personas: PERSONAS, obras: b.obras, alertas };
      }
      case 'alerta': {
        if (c.vista) b.vistas[c.id] = hoy; else delete b.vistas[c.id];
        P.local.escribir(CLAVE, b);
        return { ok: true };
      }
      case 'guardar': {
        const o = b.obras.find(x => x.id === c.obra);
        if (!o) return { ok: false, error: 'validacion', mensaje: 'Elegí una obra.' };
        if (c.coleccion === 'etapa') {
          o.etapas.forEach(e => {
            if (e.nombre === c.registro.nombre) e.estado = 'en curso';
            else if (e.estado === 'en curso') e.estado = 'terminada';
          });
        } else if (COLECCIONES.includes(c.coleccion)) {
          const lista = o[c.coleccion];
          const claves = [].concat(c.clave || []);
          const i = claves.length ? lista.findIndex(x => claves.every(k => x[k] === c.registro[k])) : -1;
          if (i >= 0) lista[i] = Object.assign(lista[i], c.registro); else lista.push(c.registro);
        } else {
          return { ok: false, error: 'validacion', mensaje: 'Tipo de carga desconocido.' };
        }
        P.local.escribir(CLAVE, b);
        return { ok: true };
      }
      case 'reiniciar':
        P.local.borrar(CLAVE);
        return { ok: true };
      default:
        return { ok: false, error: 'accion', mensaje: `Acción desconocida: ${c.accion}` };
    }
  }

  return { llamar };
})();
