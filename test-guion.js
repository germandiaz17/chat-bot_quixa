// Conversación guionizada: responde según lo que pregunte el bot.
const HOOK = 'http://localhost:5678/webhook/chat';
const sid = 'guion-' + Date.now();

const REGLAS = [
  [/con qui[eé]n tengo el gusto|tu nombre|c[oó]mo te llamas/i, 'Soy Carlos Gómez'],
  [/cargo|rol|relaci[oó]n con la empresa/i,                     'Soy el dueño y gerente general'],
  [/nombre de (tu|la) empresa|c[oó]mo se llama la empresa|a qu[eé] se dedica/i,
                                                                'Distrialimentos. Distribuimos alimentos, llevamos 14 años'],
  [/a[ñn]os|tiempo.*operando|cu[aá]nto llevan/i,                'Catorce años'],
  [/ventas anuales|rango.*ventas|facturaci[oó]n/i,              'Alrededor de 8.000 millones de pesos al año'],
  [/qu[eé] est[aá] pasando|te llev[oó] a buscar|situaci[oó]n actual/i,
                                                                'La empresa creció, pero sentimos que hacemos muchas cosas y no sabemos cuáles priorizar'],
  [/un solo reto|reto principal|resumirlo/i,                    'Definir hacia dónde llevar la empresa y qué debemos dejar de hacer'],
  [/causando|causa|origen/i,                                    'Tenemos muchas oportunidades comerciales y cada área propone algo diferente'],
  [/iniciativas.*compitiendo|compitiendo por la atenci[oó]n/i,  'Nuevas líneas, abrir regiones, montar e-commerce y renovar la flota, todo al tiempo'],
  [/priorizar|impidiendo concentrarte/i,                        'Quiero priorizar, pero cada semana aparece algo urgente y cambiamos de foco'],
  [/impacto|afectando/i,                                        'Estamos dispersando recursos y yo termino tomando casi todas las decisiones'],
  [/dependen directamente de ti|cuando no est[aá]s/i,           'Casi todas las compras grandes y los precios. Si no estoy, se frena'],
  [/intentado|han hecho|probado/i,                              'Hicimos varias reuniones de planeación, pero después volvemos a lo mismo'],
  [/resultado.*(obtuv|acciones)/i,                              'Al principio hubo ánimo, pero a las tres semanas todo volvió igual'],
  [/urgente|cu[aá]ndo.*actuar|plazo/i,                          'En los próximos tres meses'],
  [/seis meses|si (la situaci[oó]n|esto|todo) sigue|qu[eé] podr[ií]a pasar/i,
                                                                'Podemos seguir gastando recursos sin avanzar en una dirección clara'],
  [/participan en la decisi[oó]n|decisores|qui[eé]nes deciden/i,'Mi hermano, que es socio, y la gerente financiera'],
  [/esperas obtener|esperas de QUIXA|resultado [uú]til/i,       'Quiero claridad sobre dónde jugar, qué priorizar y una ruta para ejecutar'],
  [/se acerca a lo que estabas buscando|hace sentido|esta orientaci[oó]n/i, 'Sí, es justo lo que necesito'],
  [/correo|email/i,                                             'carlos@distrialimentos.com'],
  [/tel[eé]fono|whatsapp|n[uú]mero/i,                           '+57 300 555 1234'],
  [/mejor momento|canal.*contact|cu[aá]ndo.*contact/i,          'WhatsApp en la mañana'],
  [/autorizas/i,                                                'Sí, autorizo'],
  [/corregir o agregar|algo que.*corregir|confirmas/i,          'Está correcto, nada que agregar'],
];

// Solo nos interesa la ULTIMA pregunta del mensaje: el contexto previo
// hacia coincidir reglas equivocadas y desalineaba toda la conversacion.
function ultimaPregunta(txt) {
  const preguntas = txt.match(/[^.!?\n]*\?/g);
  return preguntas && preguntas.length ? preguntas[preguntas.length - 1] : txt;
}

function responder(mensajeBot, usadas) {
  const q = ultimaPregunta(mensajeBot);
  for (let i = 0; i < REGLAS.length; i++) {
    if (usadas.has(i)) continue;
    if (REGLAS[i][0].test(q)) { usadas.add(i); return REGLAS[i][1]; }
  }
  return 'Sí, de acuerdo';
}

(async () => {
  const usadas = new Set();
  let res = await (await fetch(HOOK, {method:'POST',headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ sessionId: sid, message:'__INICIO__', page:'/', ref:'demo-lunes' })})).json();
  console.log(`\n\x1b[1;34mBOT:\x1b[0m ${res.reply}`);
  let n = 1;

  while (!res.fin && n < 26) {
    const msg = responder(res.reply, usadas);
    console.log(`\n\x1b[1;32mCLIENTE:\x1b[0m ${msg}`);
    const r = await fetch(HOOK, {method:'POST',headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ sessionId: sid, message: msg, page:'/', ref:'demo-lunes' })});
    if (!r.ok) { console.error('HTTP', r.status, (await r.text()).slice(0,200)); break; }
    res = await r.json(); n++;
    console.log(`\n\x1b[1;34mBOT:\x1b[0m ${res.reply}`);
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`turnos=${n}  cerró=${!!res.fin}`);
  if (res.lead) {
    const l = res.lead;
    const con = Object.entries(l).filter(([k,v]) => k!=='transcripcion' && v!=='' && v!==false && !(Array.isArray(v)&&!v.length)).length;
    console.log(`campos con dato: ${con}/${Object.keys(l).length}\n`);
    for (const k of ['nombre_contacto','rol_contacto','empresa_nombre','sector_actividad','anos_operacion',
      'rango_ventas','reto_principal','categoria_reto','causa_percibida','impacto','acciones_previas',
      'resultado_acciones_previas','urgencia','consecuencia_no_accion','decisores','resultado_esperado',
      'servicio_orientado','motivo_orientacion','validacion_ruta','email','telefono','preferencia_contacto',
      'autorizacion_contacto','estado_conversacion','nivel_completitud'])
      console.log(`  ${k.padEnd(26)} ${JSON.stringify(l[k])}`);
  }
})();
