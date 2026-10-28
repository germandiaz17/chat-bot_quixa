"""Aplica la estructura de la Guía de preguntas (v2) al flujo de n8n exportado."""
import json, pathlib, sys

base = pathlib.Path(sys.argv[1])
flujo_path = base / 'flujo' / 'quixa-consultor-virtual.json'
d = json.loads(flujo_path.read_text())
orientador = (base / 'prompts' / 'orientador.md').read_text().rstrip() + '\n'
extractor = (base / 'prompts' / 'extractor.md').read_text().rstrip() + '\n'

PREPARAR = r"""const b = $input.first().json.body || $input.first().json;
const sessionId = b.sessionId || 'anon';
let msg = (b.message || '').trim();
const esInicio = msg === '__INICIO__';
if (esInicio) msg = 'Hola';

// Máquina de estados: n8n recuerda qué preguntas ya se hicieron en esta sesión
// y le indica al agente qué toca. El modelo no tiene que llevar la cuenta.
const st = $getWorkflowStaticData('global');
st.sesiones = st.sesiones || {};
const codigos = (st.sesiones[sessionId] || {}).codigos || [];
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
if (codigos.length) {
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
const mensaje = guia ? `${msg}\n\n[[ESTADO: ${guia}]]` : msg;
return [{ json: { sessionId, mensaje, esInicio, page: b.page || '', ref: b.ref || '' } }];"""

DETECTAR = r"""const out = String($input.first().json.output || '');
// Marcadores internos que escribe el agente: [[Q:G4]], [[Q:AC2-P]], [[FIN]]
const fin = /\[\[?\s*FIN\s*\]\]?/i.test(out);
const m = out.match(/\[\[?\s*Q\s*:\s*([A-Z]{1,3}\d{0,2}(?:-P)?)\s*\]\]?/i);
const reply = out.replace(/\[\[?\s*(?:Q\s*:[^\]]*|FIN)\s*\]\]?/gi, '').trim();
const p = $('Preparar mensaje').first().json;
const codigo = m ? m[1].toUpperCase() : (fin ? 'FIN' : '');
// Registra la pregunta hecha para la máquina de estados (y limpia sesiones de más de un día)
const st = $getWorkflowStaticData('global');
st.sesiones = st.sesiones || {};
const ses = st.sesiones[p.sessionId] || { codigos: [] };
if (codigo) ses.codigos.push(codigo);
ses.t = Date.now();
st.sesiones[p.sessionId] = ses;
for (const k of Object.keys(st.sesiones)) if (Date.now() - (st.sesiones[k].t || 0) > 86400000) delete st.sesiones[k];
return [{ json: { reply, fin, codigo, sessionId: p.sessionId, page: p.page, ref: p.ref } }];"""

TRANSCRIPCION = r"""const items = $input.all();
const seq = [];
for (const it of items) {
  const j = it.json || {};
  const arr = j.messages || j.chatHistory || [];
  for (const m of (Array.isArray(arr) ? arr : [arr])) {
    if (!m) continue;
    // Formato agrupado del Memory Manager: { human, ai }
    if (m.human !== undefined || m.ai !== undefined) {
      if (m.human) seq.push({ rol: 'CLIENTE', txt: String(m.human) });
      if (m.ai) seq.push({ rol: 'BOT', txt: String(m.ai) });
      continue;
    }
    // Formato plano: { type|role, message|content }
    const rol = String(m.type || m.role || '').toLowerCase();
    const txt = m.message ?? m.content ?? m.text ?? '';
    if (txt) seq.push({ rol: (rol.includes('ai') || rol.includes('assist')) ? 'BOT' : 'CLIENTE', txt: String(txt) });
  }
}
// Quita la nota de estado que n8n añade al mensaje del cliente (no la escribió el prospecto)
for (const x of seq) if (x.rol === 'CLIENTE') x.txt = x.txt.replace(/\s*\[\[ESTADO:[\s\S]*?\]\]\s*$/, '').trim();
// El primer turno es el disparo artificial del widget
if (seq.length && seq[0].rol === 'CLIENTE' && seq[0].txt.trim() === 'Hola') seq.shift();

const MARCA = /\[\[?\s*(?:Q\s*:[^\]]*|FIN)\s*\]\]?/gi;
const limpiar = t => String(t).replace(MARCA, '').trim();
const ctx = $('Detectar cierre').first().json;
if (ctx.reply && !seq.some(s => s.rol === 'BOT' && limpiar(s.txt).startsWith(ctx.reply.slice(0, 40))))
  seq.push({ rol: 'BOT', txt: ctx.reply + '\n[[FIN]]' });

const codigo = t => { const m = String(t).match(/\[\[?\s*Q\s*:\s*([A-Z]{1,3}\d{0,2}(?:-P)?)\s*\]\]?/i); return m ? m[1].toUpperCase() : ''; };
function preguntaDe(t) {
  const s = limpiar(t), f = s.lastIndexOf('?');
  if (f < 0) return s;
  const i = s.lastIndexOf('¿', f);
  if (i >= 0) return s.slice(i, f + 1);
  const pre = s.slice(0, f + 1), k = Math.max(pre.lastIndexOf('. '), pre.lastIndexOf('\n'));
  return pre.slice(k + 1).trim();
}

// Respuesta literal por pregunta: la da el código, no la IA (Guía §9)
const respuestas = [], porId = {};
for (let k = 0; k < seq.length; k++) {
  if (seq[k].rol !== 'BOT') continue;
  const cod = codigo(seq[k].txt);
  if (!cod) continue;
  const sig = seq[k + 1] && seq[k + 1].rol === 'CLIENTE' ? seq[k + 1].txt : '';
  const base = cod.replace(/-P$/, '');
  if (!porId[base]) {
    porId[base] = { question_id: base, question_text: preguntaDe(seq[k].txt), answer_raw: sig, follow_up_used: false, follow_ups: [] };
    respuestas.push(porId[base]);
  } else {
    // Profundización, o la misma pregunta repetida: queda como seguimiento
    porId[base].follow_up_used = true;
    porId[base].follow_ups.push({ question_text: preguntaDe(seq[k].txt), answer_raw: sig });
  }
}
const TIPOS = { AC: 'anticonsejo_1a1', ES: 'estrategia', JA: 'junta_asesora', PC: 'proyectos_consultoria', EM: 'embajadores' };
let chat_type = respuestas.length ? 'general' : '';
for (const r of respuestas) { const pre = r.question_id.replace(/\d+$/, ''); if (TIPOS[pre]) chat_type = TIPOS[pre]; }

return [{ json: {
  transcripcion: seq.map(s => s.rol + ': ' + limpiar(s.txt)).join('\n\n'),
  transcripcion_codificada: seq.map(s => s.rol + ': ' + s.txt.trim()).join('\n\n'),
  respuestas, chat_type, turnos: seq.length } }];"""

ARMAR_LEAD = r"""const inp = $input.first().json || {};
let txt = inp.text || '';
let lead;
if (!txt) {
  // La extraccion no se pudo completar: se guarda el caso para revision humana.
  lead = { extraccion_fallida: true, estado_conversacion: 'revision_humana',
           observaciones: 'No se pudo generar la ficha estructurada: ' + (inp.error || 'el modelo no respondio') };
} else {
  txt = String(txt).replace(/```json/gi, '').replace(/```/g, '').trim();
  const i = txt.indexOf('{'), f = txt.lastIndexOf('}');
  if (i >= 0 && f > i) txt = txt.slice(i, f + 1);
  try { lead = JSON.parse(txt); }
  catch (e) { lead = { error_parseo: String(e), crudo: txt, estado_conversacion: 'revision_humana' }; }
}
const ctx = $('Detectar cierre').first().json;
const t = $('Armar transcripcion').first().json;

// Une la respuesta literal (código) con el resumen y tipo de evidencia (IA)
const mapa = {};
for (const a of (Array.isArray(lead.analisis_respuestas) ? lead.analisis_respuestas : []))
  if (a && a.question_id) mapa[String(a.question_id).toUpperCase().replace(/-P$/, '')] = a;
lead.respuestas = (t.respuestas || []).map(r => ({
  question_id: r.question_id,
  question_text: r.question_text,
  answer_raw: r.answer_raw,
  answer_summary: (mapa[r.question_id] || {}).answer_summary || '',
  evidence_type: (mapa[r.question_id] || {}).evidence_type || '',
  follow_up_used: r.follow_up_used,
  follow_ups: r.follow_ups
}));
delete lead.analisis_respuestas;
if (t.chat_type) lead.chat_type = t.chat_type;

lead.alertas_revision = Array.isArray(lead.alertas_revision) ? lead.alertas_revision : [];
if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(lead.email).trim()))
  lead.alertas_revision.push('Correo con formato inválido: ' + lead.email);
if (lead.telefono && String(lead.telefono).replace(/\D/g, '').length < 7)
  lead.alertas_revision.push('Teléfono incompleto: ' + lead.telefono);

// Ajuste al perfil de cliente ideal (Portafolio QUIXA 2026, "Perfil de cliente a referir").
// Criterio en código para que sea transparente y QUIXA pueda ajustarlo.
const arr = v => Array.isArray(v) ? v : [];
if (lead.chat_type === 'embajadores') {
  lead.ajuste_perfil = { aplica: false, nivel: 'no_aplica', nota: 'Embajador: evaluar el perfil del referido.' };
} else {
  const anos = Number.isFinite(lead.anos_operacion_num) ? lead.anos_operacion_num : null;
  const criterios = {
    lider: { dueno_ceo_fundador_gerente: 'cumple', directivo: 'parcial', otro: 'no_cumple' }[lead.rol_lider] || 'sin_dato',
    trayectoria: anos === null ? 'sin_dato' : (anos >= 10 ? 'cumple' : 'no_cumple'),
    tamano: { '6000_50000': 'cumple', '2500_6000': 'parcial', menos_2500: 'no_cumple', mas_50000: 'no_cumple' }[lead.rango_ventas] || 'sin_dato',
    senales: (arr(lead.senales_alerta_icp).length || arr(lead.problemas_quixa).length) ? 'cumple' : 'no_cumple'
  };
  const pts = Object.values(criterios).reduce((a, c) => a + (c === 'cumple' ? 2 : c === 'parcial' ? 1 : 0), 0);
  const sinDato = Object.values(criterios).filter(c => c === 'sin_dato').length;
  const nivel = sinDato >= 2 ? 'por_validar' : pts >= 6 ? 'alto' : pts >= 3 ? 'medio' : 'bajo';
  lead.ajuste_perfil = { aplica: true, nivel, puntaje: pts, maximo: 8, criterios,
    referencia: 'Dueño/CEO/fundador/gerente · más de 10 años · ventas COP 6.000–50.000 millones · señales de alerta' };
}
// Referencia interna de inversión (no se muestra al prospecto)
const tramo = { menos_2500: 'USD 899 (emprendedores / consolidación)', '2500_6000': 'USD 1.299', '6000_50000': 'USD 2.199', mas_50000: 'USD 2.199' }[lead.rango_ventas];
lead.referencia_inversion_interna = {
  anticonsejo: 'Desde USD 150',
  estrategia: tramo || 'Por definir: falta el rango de ventas',
  junta_asesora: 'USD 1.299 / mes, mínimo 6 meses',
  proyectos_consultoria: 'A la medida',
  modelo_pago: 'El empresario paga las primeras dos sesiones; si continúa, se abona al servicio elegido.'
};
lead.etapa_proceso = '2_consultor_quixa';

lead.conversation_id = ctx.sessionId;
lead.review_status = 'pendiente';
lead.created_at = new Date().toISOString();
lead.origen_pagina = ctx.page;
lead.origen_ref = ctx.ref;
lead.turnos = t.turnos;
lead.transcripcion = t.transcripcion;
const stamp = lead.created_at.slice(0, 19).replace(/[:T]/g, '-');
return [{ json: { lead, nombreArchivo: `lead-${stamp}-${ctx.sessionId.slice(-6)}.json`, reply: ctx.reply } }];"""

for n in d['nodes']:
    name, p = n['name'], n['parameters']
    if name == 'Preparar mensaje':
        p['jsCode'] = PREPARAR
    elif name == 'Consultor QUIXA':
        p['options']['systemMessage'] = orientador
    elif name == 'Detectar cierre':
        p['jsCode'] = DETECTAR
    elif name == 'Armar transcripcion':
        p['jsCode'] = TRANSCRIPCION
    elif name == 'Extraer registro':
        p['text'] = '=' + extractor + '\n{{ $json.transcripcion_codificada }}'
    elif name == 'Gemini extractor':
        p['options']['maxOutputTokens'] = 8000
    elif name == 'Armar lead':
        p['jsCode'] = ARMAR_LEAD
    elif name == 'Responder turno':
        p['responseBody'] = '={{ JSON.stringify({ reply: $json.reply, fin: false, codigo: $json.codigo }) }}'

flujo_path.write_text(json.dumps(d, ensure_ascii=False, indent=2))
print('flujo actualizado:', flujo_path)
