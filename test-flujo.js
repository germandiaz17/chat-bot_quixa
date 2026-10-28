const fs = require('fs');
const KEY = fs.readFileSync('.env','utf8').match(/GEMINI_API_KEY=(.+)/)[1].trim();
const HOOK = 'http://localhost:5678/webhook/chat';
const CLIENT_MODEL = 'gemini-3-flash-preview';

const PERFILES = {
carlos:`Eres Carlos Gómez, dueño y gerente general de una empresa de distribución de alimentos, 14 años operando, ventas COP 8.000 millones al año.
Problema: la empresa creció pero hacen muchas cosas y no saben qué priorizar. Cada área propone algo distinto. Dispersan recursos y tú tomas casi todas las decisiones. Hicieron reuniones de planeación pero volvieron a lo mismo. Actuar en los próximos 3 meses. Esperas claridad sobre dónde jugar, qué priorizar y una ruta de ejecución.
Correo carlos@distrialimentos.com, celular +57 300 555 1234, prefieres WhatsApp en la mañana, SÍ autorizas el contacto.
Responde como empresario real: frases cortas y naturales. NO reveles todo de golpe, solo lo que te preguntan. Si te presentan un resumen y es correcto, confirma. NUNCA actúes como asistente ni hagas preguntas de vuelta.`,

vaga:`Eres Marcela Ruiz, gerente de una empresa de confecciones. Eres MUY escueta y vaga. Respondes "pues no sé", "todo está raro", "creo que las ventas bajaron". Frases de menos de 8 palabras. Solo das detalle si la pregunta es muy concreta.
NO quieres compartir tus ventas: di "prefiero no responder".
Tu problema real, si logran sacártelo: tu socio y tú no se ponen de acuerdo en quién decide qué, y eso tiene la empresa paralizada hace 8 meses. Urgencia: ya.
Correo marcela@confec.co, celular +57 310 222 3344. Autorizas contacto.
NUNCA actúes como asistente.`
};

async function gem(system, hist) {
  for (let intento = 0; intento < 6; intento++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${CLIENT_MODEL}:generateContent?key=${KEY}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ systemInstruction:{parts:[{text:system}]}, contents:hist,
        generationConfig:{temperature:0.9, maxOutputTokens:400} })});
    const j = await r.json();
    if (j.error) { await new Promise(s=>setTimeout(s, 8000)); continue; }
    return (j.candidates?.[0]?.content?.parts?.[0]?.text || 'ok').trim();
  }
  return 'ok';
}

async function bot(sessionId, message) {
  const r = await fetch(HOOK, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ sessionId, message, page:'/demo', ref:'test' }) });
  if (!r.ok) throw new Error('webhook HTTP ' + r.status + ' ' + (await r.text()).slice(0,200));
  return r.json();
}

(async () => {
  const perfil = process.argv[2] || 'carlos';
  const sid = 'demo-' + perfil + '-' + Date.now();
  const sys = PERFILES[perfil];
  let hCli = [], fin = false, turnos = 0, lead = null;
  const t0 = Date.now();

  let res = await bot(sid, '__INICIO__');
  console.log(`\n\x1b[1;34mBOT:\x1b[0m ${res.reply}`);
  turnos++;

  for (let i = 0; i < 22 && !fin; i++) {
    hCli.push({ role:'user', parts:[{ text: res.reply }] });
    const msg = await gem(sys, hCli);
    hCli.push({ role:'model', parts:[{ text: msg }] });
    console.log(`\n\x1b[1;32mCLIENTE:\x1b[0m ${msg}`);

    res = await bot(sid, msg);
    turnos++;
    console.log(`\n\x1b[1;34mBOT:\x1b[0m ${res.reply}`);
    if (res.fin) { fin = true; lead = res.lead; }
  }

  console.log('\n' + '═'.repeat(72));
  console.log(`perfil=${perfil}  turnos_bot=${turnos}  cerró=${fin}  ${((Date.now()-t0)/1000).toFixed(0)}s`);
  if (lead) {
    const llenos = Object.entries(lead).filter(([k,v]) =>
      v && v !== '' && !(Array.isArray(v) && !v.length) && k !== 'transcripcion').length;
    console.log(`campos con dato: ${llenos}/${Object.keys(lead).length}`);
    console.log('\nCAMPOS CLAVE:');
    for (const k of ['nombre_contacto','rol_contacto','empresa_nombre','sector_actividad','rango_ventas',
                     'reto_principal','categoria_reto','impacto','urgencia','acciones_previas',
                     'servicio_orientado','motivo_orientacion','validacion_ruta','email','telefono',
                     'autorizacion_contacto','estado_conversacion','nivel_completitud'])
      console.log(`  ${k.padEnd(22)} ${JSON.stringify(lead[k])}`);
    console.log('\nRESUMEN PARA CONSULTOR:\n ', lead.resumen_para_consultor);
  } else if (fin) console.log('⚠ cerró pero sin lead en la respuesta');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
