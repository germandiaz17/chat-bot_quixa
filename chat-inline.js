// Chat del consultor virtual integrado en la tarjeta "Asistente general QUIXA".
(function () {
  'use strict';

  var script = document.currentScript;
  var ENDPOINT = (script && script.getAttribute('data-endpoint')) || 'http://localhost:5678/webhook/chat';

  var card = document.querySelector('.chat-card');
  if (!card) return;
  var body = card.querySelector('.chat-body');
  var chips = card.querySelector('.quick-replies');
  var form = card.querySelector('.chat-input-wrapper');
  var input = card.querySelector('.chat-input');
  var sendBtn = card.querySelector('.send-button');
  var AVATAR = 'Robot_quixa.png';

  var sessionId = null;
  try { sessionId = sessionStorage.getItem('quixa_sid'); } catch (e) {}
  if (!sessionId) {
    sessionId = 'sid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
    try { sessionStorage.setItem('quixa_sid', sessionId); } catch (e) {}
  }

  var finished = false;

  function hora() {
    return new Date().toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' });
  }

  var primeraHora = card.querySelector('.message-time');
  if (primeraHora) primeraHora.textContent = hora();

  function scroll() { body.scrollTop = body.scrollHeight; }

  function append(el) {
    body.appendChild(el);
    scroll();
    return el;
  }

  function el(tag, cls, text) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (text != null) d.textContent = text;
    return d;
  }

  function addUser(text) {
    var g = el('div', 'message-group message-group--user');
    var row = el('div', 'user-message');
    row.appendChild(el('div', 'user-bubble', text));
    g.appendChild(row);
    g.appendChild(el('div', 'message-time message-time--user', hora()));
    append(g);
  }

  function addBot(text) {
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
    g.appendChild(el('div', 'message-time', hora()));
    append(g);
  }

  function notice(text, error) {
    append(el('div', 'chat-notice' + (error ? ' chat-notice--error' : ''), text));
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

  async function send(text) {
    if (finished || input.disabled) return;
    if (chips) chips.hidden = true;
    addUser(text);
    lock(true);
    typing(true);
    try {
      // El cierre genera el registro estructurado y puede tardar mas que un turno normal.
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
          ref: new URLSearchParams(location.search).get('ref') || ''
        })
      });
      clearTimeout(limite);
      typing(false);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      if (Array.isArray(data)) data = data[0] || {};
      addBot(data.reply || '(sin respuesta)');
      if (data.fin) {
        finished = true;
        notice('Conversación cerrada. El caso quedó registrado para QUIXA.');
        input.placeholder = 'Conversación finalizada';
        lock(true);
        return;
      }
    } catch (err) {
      typing(false);
      notice(err && err.name === 'AbortError'
        ? 'El asistente tardó demasiado en responder. Vuelve a enviar tu mensaje.'
        : 'No pudimos conectar con el asistente. Verifica que n8n esté corriendo en ' + ENDPOINT, true);
    }
    lock(false);
    input.focus();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var t = input.value.trim();
    if (!t) return;
    input.value = '';
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
})();
