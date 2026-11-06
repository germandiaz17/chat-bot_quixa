const items = $input.all();
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
  respuestas, chat_type, turnos: seq.length } }];
