const inp = $input.first().json || {};
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

// Puntaje 0–100 y categoría (RF-05). PROVISIONAL: los pesos los propuso el equipo técnico
// a partir de la Guía y el Portafolio; QUIXA debe validarlos. Cada componente queda a la vista.
function puntuar(l) {
  const c = {};
  if (l.chat_type === 'embajadores') {
    const r = l.referido || {};
    const llenos = ['empresa', 'lider', 'cargo_lider', 'sector', 'reto', 'relacion_con_embajador'].filter(k => String(r[k] || '').trim()).length;
    c.perfil = Math.round(35 * llenos / 6);
  } else {
    c.perfil = l.ajuste_perfil && l.ajuste_perfil.aplica ? Math.round(35 * (l.ajuste_perfil.puntaje || 0) / 8) : 0;
  }
  c.urgencia = { inmediata: 25, menos_3_meses: 20, '3_6_meses': 12, mas_de_6_meses: 5, sin_definir: 3 }[l.urgencia] || 0;
  c.clasificacion = { revisar_para_sesion_1a1: 15, lista_para_revision: 15, requiere_profundizacion: 8 }[l.classification] || 0;
  c.completitud = { completa: 15, parcial: 7, revision_humana: 7 }[l.estado_conversacion] || 0;
  c.encaje_portafolio = l.servicio_orientado && !l.necesidad_fuera_portafolio ? 10 : 0;
  const valor = Object.values(c).reduce((a, b) => a + b, 0);
  const autorizo = l.autorizacion_datos === 'si';
  const categoria = !autorizo ? 'sin_autorizacion' : valor >= 70 ? 'caliente' : valor >= 40 ? 'tibio' : 'frio';
  return { valor, categoria, componentes: c, maximos: { perfil: 35, urgencia: 25, clasificacion: 15, completitud: 15, encaje_portafolio: 10 },
    provisional: true, nota: 'Pesos y umbrales propuestos (caliente ≥ 70, tibio 40–69, frío < 40); pendientes de validar con QUIXA. Sin autorización no hay seguimiento comercial.' };
}
lead.puntaje_lead = puntuar(lead);

// Control, origen y consentimiento (los guarda el código, no la IA)
const ses = (($getWorkflowStaticData('global').sesiones) || {})[ctx.sessionId] || {};
lead.conversation_id = ctx.sessionId;
lead.review_status = 'pendiente';
lead.created_at = new Date().toISOString();
lead.inicio_conversacion = ses.inicio || '';
lead.origen_pagina = ctx.page;
lead.origen_ref = ctx.ref;
lead.origen_utm = ses.utm || {};
lead.origen_referrer = ses.referrer || '';
lead.consentimiento_aviso = ses.consentimiento || { aceptado: false };
lead.turnos = t.turnos;
lead.transcripcion = t.transcripcion;

// Contenido listo para HubSpot (RF-07) y el correo al consultor (RF-08).
// Hoy se guarda dentro del lead; en el MVP lo toman los nodos de HubSpot y de correo.
const env = (k, d) => { try { const v = $env[k]; return v === undefined || v === '' ? d : v; } catch (e) { return d; } };
const s = v => (v === undefined || v === null) ? '' : String(v);
const partes = s(lead.nombre_contacto).trim().split(/\s+/);
const email = s(lead.email).trim().toLowerCase();
const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
const dominio = correoValido ? email.split('@')[1] : '';
const GENERICOS = /^(gmail|hotmail|outlook|yahoo|live|icloud|msn|aol|protonmail)\./i;
const crearEnHubspot = correoValido && lead.autorizacion_datos === 'si';
lead.integraciones = {
  hubspot: {
    crear: crearEnHubspot,
    motivo: crearEnHubspot ? 'Tiene correo válido y autorizó sus datos.'
      : (!correoValido ? 'Sin correo válido: HubSpot identifica al contacto por correo.' : 'No autorizó el uso de sus datos.'),
    contacto: {
      email, firstname: partes[0] || '', lastname: partes.slice(1).join(' '),
      phone: s(lead.telefono), jobtitle: s(lead.cargo_contacto), company: s(lead.empresa_nombre),
      city: s(lead.ciudad), country: s(lead.pais), hs_lead_status: 'NEW',
      quixa_servicio_orientado: s(lead.servicio_orientado), quixa_clasificacion: s(lead.classification),
      quixa_puntaje: lead.puntaje_lead.valor, quixa_categoria: lead.puntaje_lead.categoria,
      quixa_urgencia: s(lead.urgencia), quixa_reto: s(lead.reto_principal).slice(0, 1000),
      quixa_resumen: s(lead.resumen_para_consultor).slice(0, 2000),
      quixa_estado_conversacion: s(lead.estado_conversacion), quixa_ajuste_perfil: s((lead.ajuste_perfil || {}).nivel),
      quixa_origen: s(lead.origen_ref || (lead.origen_utm || {}).utm_source), quixa_utm_campaign: s((lead.origen_utm || {}).utm_campaign),
      quixa_conversation_id: s(lead.conversation_id)
    },
    empresa: {
      name: s(lead.empresa_nombre), domain: dominio && !GENERICOS.test(dominio) ? dominio : '',
      city: s(lead.ciudad), country: s(lead.pais), quixa_sector: s(lead.sector),
      quixa_rango_ventas: s(lead.rango_ventas), quixa_anos_operacion: s(lead.anos_operacion_num ?? '')
    }
  }
};

const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const urgente = lead.estado_conversacion === 'revision_humana' || lead.urgencia === 'inmediata' || lead.alertas_revision.length > 0;
const SERV = { anticonsejo_1a1: 'Sesión Anticonsejo 1:1', estrategia: 'Consultoría en Estrategia', junta_asesora: 'Junta Asesora',
  proyectos_consultoria: 'Proyectos de Consultoría', embajadores: 'Programa de Embajadores' };
const prep = lead.preparacion_consultor || {};
const lista = a => (Array.isArray(a) && a.length) ? '<ul>' + a.map(x => '<li>' + esc(typeof x === 'string' ? x : JSON.stringify(x)) + '</li>').join('') + '</ul>' : '<p>—</p>';
const fila = (k, v) => v ? `<tr><td style="color:#667;padding:3px 12px 3px 0;vertical-align:top">${k}</td><td style="padding:3px 0">${esc(v)}</td></tr>` : '';
const visor = env('QUIXA_URL_VISOR', 'http://localhost:8080/leads.html');
const asunto = (urgente ? '[ATENCIÓN] ' : '') + `Nuevo lead QUIXA · ${s(lead.nombre_contacto) || 'Sin nombre'} · ${s(lead.empresa_nombre) || 'Sin empresa'} · ${lead.puntaje_lead.categoria} (${lead.puntaje_lead.valor})`;
const motivosAtencion = [
  lead.estado_conversacion === 'revision_humana' ? 'Requiere revisión humana' : '',
  lead.urgencia === 'inmediata' ? 'Urgencia inmediata' : '',
  ...lead.alertas_revision
].filter(Boolean);
const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1A1F36;max-width:640px">
<h2 style="color:#1B2A5B;margin:0 0 4px">${esc(lead.nombre_contacto) || 'Nuevo lead'} · ${esc(lead.empresa_nombre)}</h2>
<p style="margin:0 0 14px;color:#667">${esc(SERV[lead.servicio_orientado] || lead.servicio_orientado)} · Puntaje ${lead.puntaje_lead.valor}/100 (${esc(lead.puntaje_lead.categoria)}, provisional) · Ajuste al perfil: ${esc((lead.ajuste_perfil || {}).nivel)}</p>
${motivosAtencion.length ? `<div style="background:#FDECEA;color:#A5281B;padding:10px 14px;border-radius:8px;margin-bottom:14px"><b>Atención:</b> ${motivosAtencion.map(esc).join(' · ')}</div>` : ''}
<h3 style="color:#1B2A5B;margin:16px 0 6px">Resumen</h3><p style="margin:0">${esc(lead.resumen_para_consultor)}</p>
<h3 style="color:#1B2A5B;margin:16px 0 6px">Contacto</h3><table style="border-collapse:collapse">
${fila('Cargo', lead.cargo_contacto)}${fila('Correo', lead.email)}${fila('Teléfono', lead.telefono)}${fila('Ciudad', [lead.ciudad, lead.pais].filter(Boolean).join(', '))}
${fila('Autorizó datos', lead.autorizacion_datos)}${fila('Quiere avanzar', lead.plazo_avance)}</table>
<h3 style="color:#1B2A5B;margin:16px 0 6px">Reto y orientación</h3><table style="border-collapse:collapse">
${fila('Reto', lead.reto_principal)}${fila('Efecto', lead.efecto_en_resultados)}${fila('Espera lograr', lead.resultado_esperado)}
${fila('Orientación', SERV[lead.servicio_orientado] || lead.servicio_orientado)}${fila('Motivo', lead.motivo_orientacion)}${fila('Clasificación', lead.classification)}${fila('Razón', lead.classification_reason)}</table>
<h3 style="color:#1B2A5B;margin:16px 0 6px">Para preparar la sesión</h3>
<p style="margin:6px 0 2px"><b>Hipótesis</b></p>${lista(prep.hipotesis_iniciales)}
<p style="margin:6px 0 2px"><b>Preguntas sugeridas</b></p>${lista(prep.preguntas_para_la_sesion)}
${lead.datos_pendientes && lead.datos_pendientes.length ? '<p style="margin:6px 0 2px"><b>Datos pendientes</b></p>' + lista(lead.datos_pendientes) : ''}
<p style="margin:18px 0 0"><a href="${esc(visor)}#${esc(lead.conversation_id)}" style="color:#F26B3A">Ver la ficha completa y la transcripción</a></p>
<p style="color:#99A;font-size:12px;margin-top:18px">Clasificación y puntaje preliminares, generados por el consultor virtual. La decisión del siguiente paso es de QUIXA.</p></div>`;
lead.integraciones.correo = { para: env('QUIXA_CORREO_CONSULTOR', ''), asunto, urgente, html };

const stamp = lead.created_at.slice(0, 19).replace(/[:T]/g, '-');
return [{ json: { lead, nombreArchivo: `lead-${stamp}-${ctx.sessionId.slice(-6)}.json`, reply: ctx.reply, cors: ctx.cors } }];
