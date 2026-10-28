const fs = require('fs');
const KEY = fs.readFileSync('.env','utf8').match(/GEMINI_API_KEY=(.+)/)[1].trim();
const MODEL = 'gemini-2.5-flash';
const URL = m => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${KEY}`;

async function gen(system, history, temp = 0.7) {
  const r = await fetch(URL(MODEL), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: history,
      generationConfig: { temperature: temp, maxOutputTokens: 800, thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  const c = j.candidates?.[0];
  return (c?.content?.parts?.[0]?.text || '').trim();
}

const PERFILES = {
  carlos: `Eres Carlos Gómez, dueño y gerente general de una empresa de distribución de alimentos, 14 años operando, ventas de COP 8.000 millones al año.
Tu problema: la empresa creció pero hacen muchas cosas y no saben qué priorizar. Cada área propone algo distinto. Dispersan recursos y tú terminas tomando casi todas las decisiones. Hicieron reuniones de planeación pero volvieron a lo mismo. Necesitas actuar en los próximos 3 meses. Esperas claridad sobre dónde jugar, qué priorizar y una ruta para ejecutar.
Tu correo es carlos@distrialimentos.com y tu celular +57 300 555 1234. Prefieres WhatsApp en la mañana. Autorizas el contacto.
Respondes como un empresario real: frases cortas, naturales, a veces vagas al principio. NO reveles todo de golpe; responde solo lo que te pregunten. Nunca actúes como asistente.`,

  vaga: `Eres Marcela Ruiz, gerente de una empresa de confecciones. Eres MUY escueta y vaga al responder. Dices cosas como "pues, no sé", "todo está raro", "las ventas bajaron creo". No tienes claro tu problema. Si te preguntan algo general respondes con una frase de 4 palabras. Solo das detalle si te hacen una pregunta muy concreta.
No quieres compartir tus ventas. Tu problema real, si logran sacártelo: tu socio y tú no se ponen de acuerdo en quién decide qué, y eso tiene paralizada la empresa hace 8 meses.
Nunca actúes como asistente. Nunca ayudes al entrevistador.`,

  precio: `Eres Andrés Pinilla, dueño de una fábrica de muebles. Lo PRIMERO que preguntas es "¿cuánto cuesta?" antes de contar nada. Eres impaciente y desconfiado. Si te dan rodeos insistes una vez más con el precio.
Si logran engancharte, tu reto real es que tienes retrasos y reprocesos en producción desde hace un año y pierdes clientes. Necesitas actuar ya.
Nunca actúes como asistente.`
};

async function simular(perfilNombre, maxTurnos = 16) {
  const orientador = fs.readFileSync('prompts/orientador.md', 'utf8');
  const cliente = PERFILES[perfilNombre];
  let hOri = [{ role: 'user', parts: [{ text: '__INICIO__' }] }];
  let hCli = [];
  const log = [];
  let fin = false;

  for (let i = 0; i < maxTurnos && !fin; i++) {
    let bot = await gen(orientador, hOri);
    if (bot.includes('[[FIN]]')) { fin = true; bot = bot.replace('[[FIN]]', '').trim(); }
    hOri.push({ role: 'model', parts: [{ text: bot }] });
    log.push(['BOT', bot]);
    if (fin) break;

    hCli.push({ role: 'user', parts: [{ text: bot }] });
    const usr = await gen(cliente, hCli, 0.9);
    hCli.push({ role: 'model', parts: [{ text: usr }] });
    hOri.push({ role: 'user', parts: [{ text: usr }] });
    log.push(['CLIENTE', usr]);
  }
  return { log, fin, turnos: log.filter(l => l[0] === 'BOT').length };
}

(async () => {
  const perfil = process.argv[2] || 'carlos';
  const t0 = Date.now();
  const { log, fin, turnos } = await simular(perfil);
  for (const [quien, txt] of log) {
    console.log(`\n\x1b[1m${quien}:\x1b[0m ${txt}`);
  }
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`perfil=${perfil}  turnos_bot=${turnos}  cerró=${fin}  tiempo=${((Date.now()-t0)/1000).toFixed(1)}s`);
  fs.writeFileSync(`leads/transcripcion-${perfil}.txt`, log.map(([q,t]) => `${q}: ${t}`).join('\n\n'));
})();
