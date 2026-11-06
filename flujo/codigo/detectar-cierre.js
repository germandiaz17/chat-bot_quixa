const out = String($input.first().json.output || '');
// Marcadores internos que escribe el agente: [[Q:G4]], [[Q:AC2-P]], [[FIN]]
const fin = /\[\[?\s*FIN\s*\]\]?/i.test(out);
const m = out.match(/\[\[?\s*Q\s*:\s*([A-Z]{1,3}\d{0,2}(?:-P)?)\s*\]\]?/i);
const reply = out.replace(/\[\[?\s*(?:Q\s*:[^\]]*|FIN)\s*\]\]?/gi, '').trim();
const p = $('Preparar mensaje').first().json;
const codigo = m ? m[1].toUpperCase() : (fin ? 'FIN' : '');

// Registra la pregunta hecha para la máquina de estados y guarda la conversación
// turno a turno, para poder rescatarla como lead «parcial» si la persona la abandona.
const st = $getWorkflowStaticData('global');
st.sesiones = st.sesiones || {};
const ses = st.sesiones[p.sessionId] || { codigos: [] };
if (codigo) ses.codigos.push(codigo);
ses.log = ses.log || [];
if (p.mensajeCliente) ses.log.push({ r: 'CLIENTE', t: p.mensajeCliente });
ses.log.push({ r: 'BOT', t: reply, c: codigo });
if (fin) ses.fin = true;
ses.t = Date.now();
st.sesiones[p.sessionId] = ses;
// Limpia sesiones de más de un día (para entonces ya se guardaron como lead o como parcial)
for (const k of Object.keys(st.sesiones)) if (Date.now() - (st.sesiones[k].t || 0) > 86400000) delete st.sesiones[k];
return [{ json: { reply, fin, codigo, sessionId: p.sessionId, page: p.page, ref: p.ref, cors: p.cors } }];
