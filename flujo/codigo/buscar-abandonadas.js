// Corre cada 10 minutos. Guarda como lead «parcial» las conversaciones sin actividad
// que no llegaron al cierre, y actualiza las métricas del embudo (meta del piloto: ≥ 30% completan).
// No usa la IA: guarda lo que la persona alcanzó a decir, tal cual.
const env = (k, d) => { try { const v = $env[k]; return v === undefined || v === '' ? d : v; } catch (e) { return d; } };
const INACTIVIDAD_MIN = Number(env('QUIXA_MINUTOS_INACTIVIDAD', 30));
const st = $getWorkflowStaticData('global');
st.sesiones = st.sesiones || {};
st.metricas = st.metricas || { iniciadas: {} };
const m = st.metricas;
m.cerradas = m.cerradas || {};
m.parciales = m.parciales || {};
m.sin_mensajes = m.sin_mensajes || {};
const ahora = Date.now();
const out = [];

for (const [sid, ses] of Object.entries(st.sesiones)) {
  // Sesiones técnicas (arranque y batería de pruebas): no son visitantes
  if (sid === 'healthcheck' || sid.startsWith('bateria-') || ses.contado) continue;
  const dia = (ses.inicio || new Date(ses.t || ahora).toISOString()).slice(0, 10);
  if (ses.fin) { m.cerradas[dia] = (m.cerradas[dia] || 0) + 1; ses.contado = true; continue; }
  if (ahora - (ses.t || 0) < INACTIVIDAD_MIN * 60000) continue;
  ses.contado = true;
  const log = ses.log || [];
  if (!log.some(x => x.r === 'CLIENTE')) { m.sin_mensajes[dia] = (m.sin_mensajes[dia] || 0) + 1; continue; }
  m.parciales[dia] = (m.parciales[dia] || 0) + 1;

  // Respuesta literal por pregunta, igual que en el cierre normal
  const respuestas = [], porId = {};
  for (let k = 0; k < log.length; k++) {
    const x = log[k];
    if (x.r !== 'BOT' || !x.c || x.c === 'FIN') continue;
    const sig = log[k + 1] && log[k + 1].r === 'CLIENTE' ? log[k + 1].t : '';
    const base = x.c.replace(/-P$/, '');
    if (!porId[base]) { porId[base] = { question_id: base, question_text: x.t, answer_raw: sig, follow_up_used: false, follow_ups: [] }; respuestas.push(porId[base]); }
    else { porId[base].follow_up_used = true; porId[base].follow_ups.push({ question_text: x.t, answer_raw: sig }); }
  }
  const aut = porId.AUT ? porId.AUT.answer_raw : '';
  const autorizo = /^\s*(s[ií]\b|claro|de acuerdo|acepto|autorizo)/i.test(aut) && !/\bno\b/i.test(aut);
  const ultima = respuestas.length ? respuestas[respuestas.length - 1].question_id : '';
  const lead = {
    estado_conversacion: 'parcial',
    motivo_parcial: `Sin actividad durante ${INACTIVIDAD_MIN} minutos. Última pregunta: ${ultima || 'ninguna'}.`,
    autorizacion_datos: porId.AUT ? (autorizo ? 'si' : 'revisar') : 'no_otorgada',
    seguimiento_comercial_permitido: autorizo,
    nombre_contacto: porId.G1 ? porId.G1.answer_raw : (porId.C1 ? porId.C1.answer_raw : ''),
    empresa_nombre: porId.G2 ? porId.G2.answer_raw : (porId.C2 ? porId.C2.answer_raw : ''),
    reto_principal: porId.G4 ? porId.G4.answer_raw : '',
    respuestas,
    puntaje_lead: null,
    resumen_para_consultor: 'Conversación incompleta: no se generó análisis con IA. Revisar las respuestas literales.',
    alertas_revision: autorizo ? [] : ['La persona no llegó a autorizar el uso de sus datos: no hacer seguimiento comercial.'],
    conversation_id: sid,
    review_status: 'pendiente',
    created_at: new Date().toISOString(),
    inicio_conversacion: ses.inicio || '',
    origen_pagina: ses.page || '', origen_ref: ses.ref || '', origen_utm: ses.utm || {}, origen_referrer: ses.referrer || '',
    consentimiento_aviso: ses.consentimiento || { aceptado: false },
    turnos: log.length,
    transcripcion: log.map(x => x.r + ': ' + x.t).join('\n\n')
  };
  const stamp = lead.created_at.slice(0, 19).replace(/[:T]/g, '-');
  out.push({ json: { lead, nombreArchivo: `parcial-${stamp}-${sid.slice(-6)}.json` } });
}

// Métricas acumuladas por día (el visor de leads las muestra)
const dias = new Set([...Object.keys(m.iniciadas), ...Object.keys(m.cerradas), ...Object.keys(m.parciales), ...Object.keys(m.sin_mensajes)]);
const resumen = [...dias].sort().map(d => {
  const ini = m.iniciadas[d] || 0, cer = m.cerradas[d] || 0;
  return { dia: d, iniciadas: ini, cerradas: cer, parciales: m.parciales[d] || 0, sin_mensajes: m.sin_mensajes[d] || 0,
    pct_cierre: ini ? Math.round(100 * cer / ini) : null };
});
out.push({ json: { metricas: { actualizado: new Date().toISOString(), por_dia: resumen }, nombreArchivo: '_metricas.json' } });
return out;
