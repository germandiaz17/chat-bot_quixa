// Chat del consultor virtual integrado en la tarjeta "Asistente general QUIXA".
// Incluye: aviso de privacidad antes de empezar, historial al recargar, límite de caracteres,
// origen (ref, UTM, referrer), avisos de bloqueo y «Empezar una nueva conversación» al cerrar.
(function () {
  'use strict';

  var script = document.currentScript;
  var attr = function (k, d) { return (script && script.getAttribute(k)) || d; };
  var ENDPOINT = attr('data-endpoint', 'http://localhost:5678/webhook/chat');
  var PRIVACIDAD_URL = attr('data-privacidad-url', '#');
  var MAX_CARACTERES = Number(attr('data-max-caracteres', 1000));
  // TEXTO PROVISIONAL: se reemplaza por el texto legal que entregue QUIXA (Ley 1581 de 2012).
  var AVISO_VERSION = 'provisional-2026-11-04';
  var AVISO_TEXTO = 'Antes de empezar: QUIXA GROUP S.A.S. BIC usará lo que compartas en esta conversación para entender tu necesidad, ' +
    'orientarte y, si lo autorizas al final, contactarte. La conversación la procesa un asistente de inteligencia artificial y queda registrada ' +
    'para que la revise un consultor. Puedes consultar, corregir o pedir que eliminemos tus datos en cualquier momento.';

  var card = document.querySelector('.chat-card');
  if (!card) return;
  var body = card.querySelector('.chat-body');
  var chips = card.querySelector('.quick-replies');
  var form = card.querySelector('.chat-input-wrapper');
  var input = card.querySelector('.chat-input');
  var sendBtn = card.querySelector('.send-button');
  var AVATAR = 'Robot_quixa.png';

  function leer(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function guardar(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function leerJSON(k, d) { try { return JSON.parse(leer(k) || 'null') || d; } catch (e) { return d; } }

  var sessionId = leer('quixa_sid');
  if (!sessionId) {
    sessionId = 'sid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
    guardar('quixa_sid', sessionId);
  }

  // Origen de la visita: se guarda la primera vez (la URL puede cambiar al navegar)
  var origen = leerJSON('quixa_origen', null);
  if (!origen) {
    var q = new URLSearchParams(location.search);
    origen = { ref: q.get('ref') || '', referrer: document.referrer || '', utm: {} };
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) {
      if (q.get(k)) origen.utm[k] = q.get(k);
    });
    guardar('quixa_origen', JSON.stringify(origen));
  }

  var historial = leerJSON('quixa_hist', []);
  var consentimiento = leerJSON('quixa_consent', null);
  var finished = leer('quixa_fin') === '1';

  function hora() {
    return new Date().toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' });
  }

  var primeraHora = card.querySelector('.message-time');
  if (primeraHora) primeraHora.textContent = hora();

  function scroll() { body.scrollTop = body.scrollHeight; }
  function append(node) { body.appendChild(node); scroll(); return node; }
  function el(tag, cls, text) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (text != null) d.textContent = text;
    return d;
  }

  function recordar(tipo, texto, h) {
    historial.push({ tipo: tipo, t: texto, h: h });
    guardar('quixa_hist', JSON.stringify(historial.slice(-120)));
  }

  function addUser(text, h, restaurando) {
    h = h || hora();
    var g = el('div', 'message-group message-group--user');
    var row = el('div', 'user-message');
    row.appendChild(el('div', 'user-bubble', text));
    g.appendChild(row);
    g.appendChild(el('div', 'message-time message-time--user', h));
    append(g);
    if (!restaurando) recordar('user', text, h);
  }

  function addBot(text, h, restaurando) {
    h = h || hora();
    var g = el('div', 'message-group');
    var row = el('div', 'bot-message');
    var av = el('div', 'bot-avatar');
    var img = el('img', 'bot-avatar-img');
    img.src = AVATAR;
    img.alt = 'Asistente QUIXA';
    av.appendChild(img);
    var bubbles = el('div', 'bot-bubbles');
    var bubble = el('div', 'bot-bubble');
    bubble.appendChild(el('p', null, text));
    bubbles.appendChild(bubble);
    row.appendChild(av);
    row.appendChild(bubbles);
    g.appendChild(row);
    g.appendChild(el('div', 'message-time', h));
    append(g);
    if (!restaurando) recordar('bot', text, h);
  }

  function notice(text, error, restaurando) {
    append(el('div', 'chat-notice' + (error ? ' chat-notice--error' : ''), text));
    if (!restaurando && !error) recordar('notice', text);
  }

  function typing(on) {
    var ex = body.querySelector('.typing-indicator');
    if (on && !ex) {
      var d = el('div', 'typing-indicator');
      d.setAttribute('aria-label', 'El asistente está escribiendo');
      d.innerHTML = '<i></i><i></i><i></i>';
      append(d);
    } else if (!on && ex) {
      ex.remove();
    }
  }

  function lock(on) {
    input.disabled = on;
    sendBtn.disabled = on;
    if (chips) chips.querySelectorAll('.chip').forEach(function (c) { c.disabled = on; });
  }

  // Contador de caracteres bajo la caja de texto
  input.maxLength = MAX_CARACTERES;
  var contador = el('div', 'chat-count');
  contador.hidden = true;
  form.parentNode.appendChild(contador);
  function contar() {
    var n = input.value.length;
    contador.hidden = n === 0;
    contador.textContent = n + ' / ' + MAX_CARACTERES;
    contador.classList.toggle('chat-count--alto', n > MAX_CARACTERES * 0.8);
  }
  input.addEventListener('input', contar);

  function terminar() {
    finished = true;
    guardar('quixa_fin', '1');
    input.placeholder = 'Conversación finalizada';
    lock(true);
    if (chips) chips.hidden = true;
    if (body.querySelector('.chat-nueva')) return;
    var b = el('button', 'chat-nueva', 'Empezar una nueva conversación');
    b.type = 'button';
    b.addEventListener('click', function () {
      // El consentimiento y el origen se conservan durante la visita
      ['quixa_sid', 'quixa_hist', 'quixa_fin'].forEach(function (k) { try { sessionStorage.removeItem(k); } catch (e) {} });
      location.reload();
    });
    append(b);
  }

  async function send(text) {
    if (finished || input.disabled) return;
    if (chips) chips.hidden = true;
    addUser(text);
    lock(true);
    typing(true);
    try {
      // El cierre genera el registro estructurado y puede tardar más que un turno normal.
      var ctrl = new AbortController();
      var limite = setTimeout(function () { ctrl.abort(); }, 120000);
      var res = await fetch(ENDPOINT, {
        signal: ctrl.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          message: text,
          page: location.pathname,
          ref: origen.ref,
          utm: origen.utm,
          referrer: origen.referrer,
          consentimiento: consentimiento
        })
      });
      clearTimeout(limite);
      typing(false);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      if (Array.isArray(data)) data = data[0] || {};
      if (data.bloqueo) notice(data.reply || 'No pudimos procesar tu mensaje.');
      else addBot(data.reply || '(sin respuesta)');
      if (data.fin) {
        if (!data.bloqueo) notice('Conversación cerrada. El caso quedó registrado para QUIXA.');
        terminar();
        return;
      }
    } catch (err) {
      typing(false);
      notice(err && err.name === 'AbortError'
        ? 'El asistente tardó demasiado en responder. Vuelve a enviar tu mensaje.'
        : 'No pudimos conectar con el asistente. Intenta de nuevo en unos minutos.', true);
    }
    lock(false);
    input.focus();
  }

  // Aviso de privacidad y aceptación ANTES de cualquier dato (RNF-05)
  function pedirConsentimiento() {
    lock(true);
    var a = el('div', 'chat-aviso');
    a.appendChild(el('p', null, AVISO_TEXTO));
    var link = el('a', null, 'Ver la política de tratamiento de datos');
    link.href = PRIVACIDAD_URL;
    link.target = '_blank';
    link.rel = 'noopener';
    a.appendChild(link);
    var ok = el('button', 'chat-aviso-btn', 'Acepto y continuar');
    ok.type = 'button';
    ok.addEventListener('click', function () {
      consentimiento = { aceptado: true, version: AVISO_VERSION, fecha: new Date().toISOString() };
      guardar('quixa_consent', JSON.stringify(consentimiento));
      a.remove();
      lock(false);
      input.focus();
    });
    a.appendChild(ok);
    // Va antes de los botones rápidos, para que se lea primero
    if (chips && chips.parentNode === body) body.insertBefore(a, chips); else append(a);
    scroll();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var t = input.value.trim();
    if (!t) return;
    input.value = '';
    contar();
    send(t);
  });

  if (chips) {
    chips.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      var label = chip.querySelector('span');
      send((label ? label.textContent : chip.textContent).trim());
    });
  }

  // Al recargar la página: se restaura la conversación en curso
  if (historial.length) {
    if (chips) chips.hidden = true;
    historial.forEach(function (m) {
      if (m.tipo === 'user') addUser(m.t, m.h, true);
      else if (m.tipo === 'bot') addBot(m.t, m.h, true);
      else notice(m.t, false, true);
    });
  }
  if (finished) terminar();
  else if (!consentimiento) pedirConsentimiento();
})();
