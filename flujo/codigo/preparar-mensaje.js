const entrada = $input.first().json;
const b = entrada.body || entrada;
const headers = entrada.headers || {};
const sessionId = String(b.sessionId || 'anon').slice(0, 80);
let msg = String(b.message || '').trim();
const esInicio = msg === '__INICIO__';
if (esInicio) msg = 'Hola';

// Configuración por variables de entorno (RNF-04, RNF-03). Valores por defecto = los del documento del MVP.
const env = (k, d) => { try { const v = $env[k]; return v === undefined || v === '' ? d : v; } catch (e) { return d; } };
const MAX_MENSAJES = Number(env('QUIXA_MAX_MENSAJES_SESION', 30));
const MAX_CARACTERES = Number(env('QUIXA_MAX_CARACTERES', 1000));
const MAX_POR_IP_HORA = Number(env('QUIXA_MAX_MENSAJES_IP_HORA', 120));
const ORIGENES = String(env('QUIXA_ORIGENES', '*')).split(',').map(s => s.trim()).filter(Boolean);

const origen = String(headers.origin || '');
const origenPermitido = ORIGENES.includes('*') || ORIGENES.includes(origen);
const cors = ORIGENES.includes('*') ? '*' : (origenPermitido ? origen : ORIGENES[0]);
// En el servidor, Caddy siempre envía la IP real. Sin proxy (demo local) no hay IP y no se aplica el límite por IP.
const ip = String(headers['x-forwarded-for'] || headers['x-real-ip'] || '').split(',')[0].trim();

const st = $getWorkflowStaticData('global');
st.sesiones = st.sesiones || {};
st.ips = st.ips || {};
st.metricas = st.metricas || { iniciadas: {} };
const ahora = Date.now();
const ses = st.sesiones[sessionId] || { codigos: [] };

// Controles de abuso: se responden sin llamar a la IA (no gastan cuota ni dinero)
let bloqueo = '', aviso = '';
if (!origenPermitido) {
  bloqueo = 'origen'; aviso = 'Este chat solo está disponible desde el sitio web de QUIXA.';
} else if (msg.length > MAX_CARACTERES) {
  bloqueo = 'largo'; aviso = `Tu mensaje es muy largo. Escríbelo en menos de ${MAX_CARACTERES} caracteres, por favor.`;
} else if (ses.fin) {
  bloqueo = 'cerrada'; aviso = 'Esta conversación ya terminó y quedó registrada para QUIXA. Si quieres agregar algo, puedes empezar una nueva conversación.';
} else if (!esInicio && (ses.n || 0) >= MAX_MENSAJES) {
  bloqueo = 'sesion'; aviso = 'Llegamos al límite de mensajes de esta conversación. Lo que compartiste quedó registrado y el equipo de QUIXA lo revisará.';
} else if (ip) {
  const recientes = (st.ips[ip] || []).filter(t => ahora - t < 3600000);
  if (recientes.length >= MAX_POR_IP_HORA) {
    bloqueo = 'ip'; aviso = 'Recibimos demasiados mensajes desde tu conexión. Intenta de nuevo en unos minutos.';
  }
  recientes.push(ahora);
  st.ips[ip] = recientes;
}
for (const k of Object.keys(st.ips)) if (!st.ips[k].some(t => ahora - t < 3600000)) delete st.ips[k];

if (!bloqueo) {
  // La sesión empieza con el primer mensaje: el widget envía __INICIO__, el chat integrado de la portada no
  if (!ses.inicio && sessionId !== 'healthcheck' && !sessionId.startsWith('bateria-')) {
    ses.inicio = new Date(ahora).toISOString();
    const dia = ses.inicio.slice(0, 10);
    st.metricas.iniciadas[dia] = (st.metricas.iniciadas[dia] || 0) + 1;
  }
  if (!esInicio) ses.n = (ses.n || 0) + 1;
  // Origen y consentimiento: se guardan una vez por sesión (RF-11, RNF-05)
  ses.page = ses.page || String(b.page || '').slice(0, 300);
  ses.ref = ses.ref || String(b.ref || '').slice(0, 120);
  ses.referrer = ses.referrer || String(b.referrer || '').slice(0, 300);
  if (!ses.utm && b.utm && typeof b.utm === 'object') {
    ses.utm = {};
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'])
      if (b.utm[k]) ses.utm[k] = String(b.utm[k]).slice(0, 120);
  }
  if (!ses.consentimiento && b.consentimiento && b.consentimiento.aceptado)
    ses.consentimiento = { aceptado: true, version: String(b.consentimiento.version || ''), fecha: String(b.consentimiento.fecha || '') };
  ses.t = ahora;
  st.sesiones[sessionId] = ses;
}

// Máquina de estados: n8n recuerda qué preguntas ya se hicieron en esta sesión
// y le indica al agente qué toca. El modelo no tiene que llevar la cuenta.
const codigos = ses.codigos || [];
const hechos = new Set(codigos.map(c => c.replace(/-P$/, '')));
const G = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'];
const ESP = { AC: ['AC1','AC2','AC3','AC4','AC5'], ES: ['ES1','ES2','ES3','ES4','ES5','ES6','ES7'],
  JA: ['JA1','JA2','JA3','JA4','JA5','JA6','JA7'], PC: ['PC1','PC2','PC3','PC4','PC5','PC6','PC7','PC8','PC9'],
  EM: ['EM1','EM2','EM3','EM4','EM5','EM6','EM7'] };
const NOMBRE = { AC: 'Anticonsejo 1:1', ES: 'Consultoría en Estrategia', JA: 'Junta Asesora', PC: 'Proyectos de Consultoría', EM: 'Programa de Embajadores' };
const prefijo = c => c.replace(/-P$/, '').replace(/\d+$/, '');
let chat = null;
for (const c of codigos) if (ESP[prefijo(c)]) chat = prefijo(c);
const falta = arr => arr.filter(c => !hechos.has(c));
const enCierre = codigos.some(c => /^(C\d|VT|AUT)/.test(c));
const ultimo = codigos[codigos.length - 1] || '';
const exploratoria = /^(G[456]|AC|ES|JA|PC|EM)\d/.test(ultimo);
const profundizaciones = codigos.filter(c => c === ultimo.replace(/-P$/, '') + '-P').length;

let guia = '';
if (!codigos.length && !esInicio && !(ses.log || []).length) {
  // Chat integrado de la portada: la página ya saludó y preguntó «¿Cuál es el principal reto de tu empresa?»
  guia = 'La página ya te presentó y le preguntó a la persona por el principal reto de su empresa; este mensaje es su respuesta. ' +
    'No repitas la presentación: agradece en una frase, muestra que entendiste el reto y empieza el CHAT GENERAL con G1. ' +
    'Cuando llegues a G4, no lo preguntes desde cero: confirma el reto que ya contó y pide que lo amplíe.';
} else if (codigos.length) {
  if (enCierre || (chat && !falta(ESP[chat]).length)) {
    let pend = ['C1', 'C2', 'C3', 'VT', 'C4', 'AUT', 'C5', 'C6'].filter(c => !hechos.has(c));
    if (hechos.has('G1')) pend = pend.filter(c => c !== 'C1');
    if (hechos.has('G2') || (chat === 'EM' && hechos.has('EM1'))) pend = pend.filter(c => c !== 'C2');
    if (chat === 'EM') pend = pend.filter(c => c !== 'VT');
    guia = pend.length
      ? `Tramo CIERRE. Pendientes, en orden: ${pend.join(', ')}. AUT, C5 y C6 son obligatorias.`
      : 'Cierre completo. Si la persona ya respondió a C6, toca la DESPEDIDA con [[FIN]].';
  } else if (chat) {
    const pend = falta(ESP[chat]);
    guia = chat === 'AC'
      ? `Chat ${NOMBRE[chat]}. Pendientes, en este orden y todas obligatorias: ${pend.join(', ')}.`
      : `Chat ${NOMBRE[chat]}. Pendientes, en orden: ${pend.join(', ')} (salta solo las que ya tengan respuesta explícita).`;
    if (chat === 'EM' && hechos.has('EM4') && !codigos.includes('EM4-P')) guia += ' Falta la profundización obligatoria EM4-P.';
  } else if (hechos.has('OR')) {
    guia = 'Ya hiciste la orientación. Según la respuesta de la persona, empieza el chat especializado elegido con su primera pregunta, o pasa al CIERRE si no quiere seguir.';
  } else {
    const pend = falta(G);
    guia = pend.length
      ? `Tramo CHAT GENERAL. Pendientes, en orden: ${pend.join(', ')}. Todavía NO orientes ni hagas preguntas de un chat especializado (salvo que la persona solo quiera referir empresarios: entonces Embajadores).`
      : 'Chat general completo. Toca la ORIENTACIÓN (OR) antes de cualquier pregunta especializada.';
  }
  if (exploratoria && profundizaciones < 2)
    guia += ` Antes de avanzar: si la respuesta a ${ultimo} fue vaga o sin ejemplo, profundiza con ${ultimo.replace(/-P$/, '')}-P.`;
}

// Cerca del tope de mensajes: el bot cierra a tiempo para que el lead no se pierda
const usados = ses.n || 0;
if (!bloqueo && usados >= MAX_MENSAJES - 1) {
  guia = 'ÚLTIMO MENSAJE DISPONIBLE: agradece, explica que el equipo de QUIXA revisará el caso y haz la DESPEDIDA con [[FIN]] ahora.';
} else if (!bloqueo && usados >= MAX_MENSAJES - 5 && !(enCierre && hechos.has('AUT'))) {
  const urg = ['C4', 'AUT'].filter(c => !hechos.has(c));
  guia += ` QUEDAN POCOS MENSAJES: pasa al CIERRE ya${urg.length ? ' y pide primero ' + urg.join(' y ') : ''}; luego la despedida.`;
}

const mensaje = guia ? `${msg}\n\n[[ESTADO: ${guia}]]` : msg;
return [{ json: { sessionId, mensaje, mensajeCliente: esInicio ? '' : msg, esInicio,
  bloqueado: !!bloqueo, bloqueo, aviso, cors,
  page: ses.page || '', ref: ses.ref || '' } }];
