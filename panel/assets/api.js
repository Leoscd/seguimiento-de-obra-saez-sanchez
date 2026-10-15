// Conexión con la API del panel y utilidades compartidas por las vistas.
// Modo demo: CONFIG_PANEL.DEMO = true, o ?demo en localhost. Usa el backend falso de assets/demo.js.
window.Panel = (() => {
  const CFG = window.CONFIG_PANEL || {};
  const enLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const DEMO = !!CFG.DEMO || (enLocal && new URLSearchParams(location.search).has('demo'));
  const K = { sesion: 'panel.sesion' };

  const local = {
    leer(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    escribir(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin espacio o bloqueado */ } },
    borrar(k) { try { localStorage.removeItem(k); } catch (e) { /* bloqueado */ } },
  };

  class ErrorApi extends Error {
    constructor(r) {
      super(r.mensaje || 'No se pudo completar la operación.');
      this.codigo = r.error;
    }
  }

  async function llamar(accion, datos = {}) {
    const cuerpo = Object.assign({ accion, sesion: local.leer(K.sesion) }, datos);
    let r;
    if (DEMO) {
      r = await window.PanelDemo.llamar(cuerpo);
    } else {
      if (!CFG.ENDPOINT) throw new ErrorApi({ mensaje: 'Falta configurar ENDPOINT en assets/config.js.' });
      let res;
      try {
        res = await fetch(CFG.ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cuerpo),
          cache: 'no-store',
        });
        r = await res.json();
      } catch (e) {
        throw new ErrorApi({ mensaje: 'Sin conexión con el servidor. Probá de nuevo en un rato.' });
      }
    }
    if (!r || !r.ok) throw new ErrorApi(r || {});
    return r;
  }

  // ---------- fechas (ISO yyyy-mm-dd, hora de Argentina) ----------
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const aFecha = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const sumarDias = (s, n) => { const d = aFecha(s); d.setDate(d.getDate() + n); return iso(d); };
  const dias = (desde, hasta) => Math.round((aFecha(hasta) - aFecha(desde)) / 864e5);
  // Feriados de fecha fija (nacionales + 24/9 de Tucumán), igual que obra_bot/cronograma.py.
  const FERIADOS = ['01-01', '03-24', '04-02', '05-01', '05-25', '06-20', '07-09', '09-24', '12-08', '12-25'];
  const esHabil = s => { const d = aFecha(s).getDay(); return d > 0 && d < 6 && !FERIADOS.includes(s.slice(5)); };
  const restarHabiles = (s, n) => { while (n > 0) { s = sumarDias(s, -1); if (esHabil(s)) n--; } return s; };
  const habilAnterior = s => { do { s = sumarDias(s, -1); } while (!esHabil(s)); return s; };
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const fecha = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '—');
  const fechaLarga = s => (s ? `${Number(s.slice(8, 10))} ${MESES[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}` : '—');
  const mes = p => `${MESES[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;

  // ---------- números ----------
  const pesos = n => '$ ' + Math.round(n).toLocaleString('es-AR');
  const millones = n => '$ ' + (n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' M';
  const dec = n => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const signo = n => (n > 0 ? '+' : '') + dec(n);
  const pct = n => (n == null ? '—' : `${Math.round(n)} %`);

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  return {
    DEMO, CFG, local, llamar, ErrorApi,
    iso, sumarDias, dias, esHabil, restarHabiles, habilAnterior, fecha, fechaLarga, mes,
    pesos, millones, pct, dec, signo, esc,
  };
})();
