// Prueba de punta a punta de la estructura de la Guía de preguntas (v2).
// Responde según el código de pregunta que devuelve el flujo ([[Q:...]]).
// Uso: node test-guia.js [anticonsejo|estrategia|embajador]
const HOOK = 'http://localhost:5678/webhook/chat';
const PERFIL = process.argv[2] || 'anticonsejo';
const sid = `guia-${PERFIL}-${Date.now()}`;
const PAUSA_MS = 4500; // cuota gratuita de Gemini: 15 peticiones/minuto

const COMUNES = {
  C1: 'Carlos Gómez, gerente general',
  C2: 'Distrialimentos, distribución de alimentos',
  C3: 'Bucaramanga, Colombia',
  VT: 'Entre 6.000 y 50.000 millones',
  C4: 'carlos@distrialimentos y 300 555 1234',        // correo inválido a propósito
  'C4-P': 'Perdón, es carlos@distrialimentos.com',
  AUT: 'Sí, autorizo',
  C5: 'Lo antes posible, este mes',
  C6: 'Está bien así. Solo que mi socio también debería estar en la conversación',
  OR: 'Sí, me parece bien',
};

const PERFILES = {
  anticonsejo: {
    G1: 'Hola, soy Carlos Gómez, dueño y gerente general',
    G2: 'Distrialimentos, distribuimos alimentos a tiendas y minimercados en Santander',
    G3: 'Diría que consolidación, llevamos 14 años',
    G4: 'Tengo que decidir si dejamos de atender a los clientes pequeños, que son la mitad de la facturación pero casi no dejan margen',
    'G4-P': 'Se nota en comercial y en logística: las rutas se llenan de pedidos chiquitos y el margen se va en transporte',
    G5: 'Tener claridad para tomar esa decisión sin destruir la empresa',
    G6: 'Creo que sé lo que hay que hacer, pero me da miedo hacerlo',
    AC1: 'Seguimos visitando a cada tendero cada semana con vendedor propio, como hace 14 años',
    'AC1-P': 'Por ejemplo, la ruta de Floridablanca cuesta más de lo que vende; la mantenemos porque siempre ha existido',
    AC2: 'Hay varias, la verdad',
    'AC2-P': 'Que nunca le decimos que no a un pedido, por pequeño que sea. Limita porque llenamos camiones con pedidos que pierden plata',
    AC3: 'Subir el pedido mínimo. Perderíamos quizás un 20% de los clientes, pero liberaríamos capacidad para los grandes',
    'AC3-P': 'Habría que dejar de visitar a unos 300 tenderos. El riesgo de seguir igual es quedarnos sin caja en un año',
    AC4: 'En el precio. Los clientes nos comparan con otros dos distribuidores y ya no ven diferencia',
    'AC4-P': 'Sí, el margen bajó de 18% a 11% en tres años',
    AC5: 'Necesitaría ver la rentabilidad por cliente y por ruta, y cuánto perderíamos realmente',
    'AC5-P': 'Margen por cliente, costo por ruta y qué pasa con la caja los primeros seis meses',
  },
  estrategia: {
    G1: 'Soy Laura Restrepo, CEO',
    G2: 'Cerámicas del Valle, fabricamos baldosas para construcción',
    G3: 'Doce años, y diría que en crecimiento',
    G4: 'Crecimos rápido y ahora cada área propone algo diferente: exportar, abrir tiendas, lanzar línea premium',
    G5: 'Saber dónde jugar, qué priorizar y tener una ruta para ejecutar',
    G6: 'Ya lo tengo claro: necesitamos un plan estratégico con prioridades y una ruta de ejecución',
    ES1: 'Duplicar ventas en tres años y entrar a Centroamérica',
    ES2: 'Que no tenemos foco. Todo es prioridad y nada avanza',
    ES3: 'Día a día. Hacemos un plan en enero y en marzo ya nadie lo mira',
    ES4: 'El segmento de remodelación de vivienda, que crece mucho',
    ES5: 'La calidad y el tiempo de entrega, pero los competidores se están igualando',
    ES6: 'Si exportamos o nos enfocamos en el mercado local. No tengo datos de rentabilidad por canal',
    ES7: 'Un plan de 90 días con prioridades claras y responsables',
  },
  embajador: {
    G1: 'Hola, soy Andrés Pardo, consultor independiente',
    G2: 'No tengo empresa como tal. Quiero conectar a QUIXA con empresarios que conozco',
    EM1: 'Consultor independiente en temas tributarios',
    EM2: 'Por LinkedIn, vi una charla de ustedes',
    EM3: 'Mis clientes me piden ayuda en estrategia y yo no hago eso',
    EM4: 'Pymes familiares de manufactura, entre 10 y 50 empleados',
    'EM4-P': 'Sí, Textiles Andinos en Cali. La lidera Marta Ruiz, la fundadora; llevan 25 años y las ventas están estancadas hace tres años. Es clienta mía hace tiempo',
    EM5: 'La Cámara de Comercio de Cali y una asociación de industriales',
    EM6: 'Generando conexiones, presentando empresarios',
    EM7: 'Saber cómo funciona el programa y qué condiciones tiene',
    C3: 'Vivo en Palmira',
    C4: 'andres.pardo@gmail y 315 222 9876',
    'C4-P': 'Ah sí, andres.pardo@gmail.com',
    C5: 'Cuanto antes, tengo a Marta esperando',
    C6: 'Nada más, gracias',
  },
};

const resp = { ...COMUNES, ...PERFILES[PERFIL] };
const dormir = ms => new Promise(r => setTimeout(r, ms));

function responder(codigo, usados) {
  const c = String(codigo || '').toUpperCase();
  usados[c] = (usados[c] || 0) + 1;
  if (usados[c] === 1 && resp[c]) return resp[c];
  if (c.endsWith('-P')) return 'No tengo más detalle sobre eso, la verdad';
  if (resp[c]) return resp[c];
  return 'Sí, de acuerdo';
}

async function turno(message) {
  for (let intento = 0; intento < 3; intento++) {
    const r = await fetch(HOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid, message, page: '/', ref: 'test-guia' }) });
    if (r.ok) { let j = await r.json(); return Array.isArray(j) ? j[0] : j; }
    console.error('  HTTP', r.status, '— reintento en 20 s');
    await dormir(20000);
  }
  throw new Error('El flujo no respondió');
}

(async () => {
  const usados = {};
  let res = await turno('__INICIO__');
  console.log(`\n\x1b[1;34mBOT [${res.codigo}]:\x1b[0m ${res.reply}`);
  let n = 1;
  while (!res.fin && n < 40) {
    await dormir(PAUSA_MS);
    const msg = responder(res.codigo, usados);
    console.log(`\n\x1b[1;32mCLIENTE:\x1b[0m ${msg}`);
    res = await turno(msg); n++;
    console.log(`\n\x1b[1;34mBOT [${res.codigo || (res.fin ? 'FIN' : '¿?')}]:\x1b[0m ${res.reply}`);
  }
  console.log('\n' + '═'.repeat(70));
  console.log(`perfil=${PERFIL}  turnos=${n}  cerró=${!!res.fin}`);
  if (res.lead) {
    const l = res.lead;
    for (const k of ['chat_type', 'servicio_orientado', 'classification', 'classification_reason', 'estado_conversacion',
      'nombre_contacto', 'empresa_nombre', 'etapa_empresa', 'anos_operacion_num', 'rango_ventas', 'rol_lider', 'ciudad', 'email', 'telefono',
      'autorizacion_datos', 'urgencia', 'problemas_quixa', 'frenos_detectados', 'senales_alerta_icp', 'ruta_posterior_probable',
      'ajuste_perfil', 'preparacion_consultor', 'referido', 'alertas_revision', 'datos_pendientes', 'review_status'])
      console.log(`  ${k.padEnd(22)} ${JSON.stringify(l[k])}`);
    console.log('\n  Respuestas:');
    for (const r of l.respuestas || [])
      console.log(`   ${r.question_id.padEnd(4)} [${r.evidence_type || '—'}] ${r.answer_raw.slice(0, 60)}${r.follow_up_used ? '  (+profundización)' : ''}`);
    console.log('\n  Resumen:', l.resumen_para_consultor);
  }
})();
