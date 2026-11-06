(function () {
  'use strict';

  var script = document.currentScript;
  var ENDPOINT = (script && script.getAttribute('data-endpoint')) || 'http://localhost:5678/webhook/chat';
  var TITULO = (script && script.getAttribute('data-titulo')) || 'Consultor Virtual';
  var SUBTITULO = (script && script.getAttribute('data-subtitulo')) || 'QUIXA GROUP';
  var PRIVACIDAD_URL = (script && script.getAttribute('data-privacidad-url')) || '#';
  var MAX_CARACTERES = Number((script && script.getAttribute('data-max-caracteres')) || 1000);
  // TEXTO PROVISIONAL: se reemplaza por el texto legal que entregue QUIXA (Ley 1581 de 2012).
  var AVISO_VERSION = 'provisional-2026-11-04';
  var AVISO_TEXTO = 'Antes de empezar: QUIXA GROUP S.A.S. BIC usará lo que compartas en esta conversación para entender tu necesidad, ' +
    'orientarte y, si lo autorizas al final, contactarte. La conversación la procesa un asistente de inteligencia artificial y queda registrada ' +
    'para que la revise un consultor. Puedes consultar, corregir o pedir que eliminemos tus datos en cualquier momento.';

  function leer(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function guardar(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }

  var sessionId = leer('quixa_sid');
  if (!sessionId) {
    sessionId = 'sid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
    guardar('quixa_sid', sessionId);
  }

  // Origen del visitante (RF-11): se toma en la primera página que visita y se conserva en la sesión
  var origen = null;
  try { origen = JSON.parse(leer('quixa_origen') || 'null'); } catch (e) {}
  if (!origen) {
    var q = new URLSearchParams(location.search);
    origen = { ref: q.get('ref') || '', referrer: document.referrer || '', utm: {} };
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) {
      if (q.get(k)) origen.utm[k] = q.get(k);
    });
    guardar('quixa_origen', JSON.stringify(origen));
  }

  // Historial de la conversación: sobrevive a recargar la página (RF-10)
  var historial = [];
  try { historial = JSON.parse(leer('quixa_hist') || '[]'); } catch (e) {}
  var consentimiento = null;
  try { consentimiento = JSON.parse(leer('quixa_consent') || 'null'); } catch (e) {}

  var CSS = `
  .qx-launcher{position:fixed;right:24px;bottom:24px;width:60px;height:60px;border-radius:50%;
    background:#1B2A5B;color:#fff;border:none;cursor:pointer;box-shadow:0 6px 24px rgba(27,42,91,.35);
    display:flex;align-items:center;justify-content:center;z-index:2147483000;transition:transform .18s ease}
  .qx-launcher:hover{transform:scale(1.06)}
  .qx-launcher svg{width:28px;height:28px}
  .qx-panel{position:fixed;right:24px;bottom:96px;width:390px;height:min(620px,calc(100vh - 140px));
    background:#fff;border-radius:16px;box-shadow:0 18px 60px rgba(16,24,48,.28);display:none;
    flex-direction:column;overflow:hidden;z-index:2147483000;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
  .qx-panel.qx-open{display:flex}
  .qx-head{background:#1B2A5B;color:#fff;padding:16px 18px;display:flex;align-items:center;gap:12px;flex:0 0 auto}
  .qx-avatar{width:36px;height:36px;border-radius:50%;background:#F26B3A;display:flex;align-items:center;
    justify-content:center;font-weight:700;font-size:15px;flex:0 0 auto}
  .qx-head-txt{flex:1;min-width:0}
  .qx-head-txt b{display:block;font-size:14px;line-height:1.3}
  .qx-head-txt span{display:block;font-size:11.5px;opacity:.72;letter-spacing:.04em;text-transform:uppercase}
  .qx-close{background:none;border:none;color:#fff;opacity:.7;cursor:pointer;font-size:22px;line-height:1;padding:0 2px}
  .qx-close:hover{opacity:1}
  .qx-body{flex:1;overflow-y:auto;padding:18px;background:#F6F7FB;display:flex;flex-direction:column;gap:12px}
  .qx-msg{max-width:84%;padding:11px 14px;border-radius:14px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}
  .qx-bot{align-self:flex-start;background:#fff;color:#1A1F36;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(16,24,48,.08)}
  .qx-user{align-self:flex-end;background:#1B2A5B;color:#fff;border-bottom-right-radius:4px}
  .qx-sys{align-self:center;background:#E8EDF7;color:#44507A;font-size:12px;padding:8px 14px;border-radius:10px;text-align:center;max-width:92%}
  .qx-err{align-self:center;background:#FDECEA;color:#A5281B;font-size:12.5px;padding:9px 14px;border-radius:10px;max-width:92%}
  .qx-typing{align-self:flex-start;background:#fff;padding:13px 16px;border-radius:14px;border-bottom-left-radius:4px;
    display:flex;gap:4px;box-shadow:0 1px 2px rgba(16,24,48,.08)}
  .qx-typing i{width:7px;height:7px;border-radius:50%;background:#9AA3BF;animation:qxb 1.3s infinite}
  .qx-typing i:nth-child(2){animation-delay:.18s}.qx-typing i:nth-child(3){animation-delay:.36s}
  @keyframes qxb{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}
  .qx-foot{flex:0 0 auto;border-top:1px solid #E4E7F0;padding:12px;background:#fff;display:flex;gap:8px;align-items:flex-end}
  .qx-foot textarea{flex:1;resize:none;border:1px solid #D6DBE8;border-radius:10px;padding:10px 12px;
    font-size:14px;font-family:inherit;max-height:96px;outline:none;line-height:1.4}
  .qx-foot textarea:focus{border-color:#1B2A5B}
  .qx-send{background:#1B2A5B;border:none;color:#fff;width:40px;height:40px;border-radius:10px;cursor:pointer;
    display:flex;align-items:center;justify-content:center;flex:0 0 auto}
  .qx-send:disabled{opacity:.4;cursor:not-allowed}
  .qx-send svg{width:18px;height:18px}
  .qx-aviso{align-self:stretch;background:#fff;border:1px solid #E4E7F0;border-radius:12px;padding:14px 16px;font-size:13px;line-height:1.5;color:#1A1F36}
  .qx-aviso a{color:#1B2A5B}
  .qx-aviso button{margin-top:12px;width:100%;background:#F26B3A;color:#fff;border:none;border-radius:10px;padding:10px;font-size:14px;font-weight:600;cursor:pointer}
  .qx-nueva{align-self:center;background:none;border:1px solid #1B2A5B;color:#1B2A5B;border-radius:10px;padding:8px 14px;font-size:12.5px;cursor:pointer}
  .qx-count{font-size:10.5px;color:#8A93AD;text-align:right;padding:0 14px 4px;background:#fff;display:none}
  .qx-count.qx-alto{display:block}
  .qx-legal{font-size:10.5px;color:#8A93AD;text-align:center;padding:0 12px 9px;background:#fff;line-height:1.4}
  @media (max-width:480px){
    .qx-panel{right:0;bottom:0;width:100vw;height:100dvh;border-radius:0}
    .qx-launcher{right:16px;bottom:16px}
  }`;

  var st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);

  var launcher = document.createElement('button');
  launcher.className = 'qx-launcher';
  launcher.setAttribute('aria-label', 'Abrir chat con QUIXA');
  launcher.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

  var panel = document.createElement('div');
  panel.className = 'qx-panel';
  panel.innerHTML =
    '<div class="qx-head"><div class="qx-avatar">Q</div>' +
    '<div class="qx-head-txt"><b>' + TITULO + '</b><span>' + SUBTITULO + '</span></div>' +
    '<button class="qx-close" aria-label="Cerrar">&times;</button></div>' +
    '<div class="qx-body"></div>' +
    '<div class="qx-foot">' +
    '<textarea rows="1" maxlength="' + MAX_CARACTERES + '" placeholder="Escribe tu mensaje..."></textarea>' +
    '<button class="qx-send" aria-label="Enviar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>' +
    '</div>' +
    '<div class="qx-count"></div>' +
    '<div class="qx-legal">Orientación preliminar. La definición final del servicio corresponde a QUIXA.</div>';

  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  var body = panel.querySelector('.qx-body');
  var input = panel.querySelector('textarea');
  var sendBtn = panel.querySelector('.qx-send');
  var contador = panel.querySelector('.qx-count');
  var started = historial.length > 0;
  var finished = leer('quixa_fin') === '1';

  function scroll() { body.scrollTop = body.scrollHeight; }

  function add(text, cls, sinGuardar) {
    var d = document.createElement('div');
    d.className = 'qx-msg ' + cls;
    d.textContent = text;
    body.appendChild(d);
    scroll();
    if (!sinGuardar) {
      historial.push({ t: text, c: cls });
      guardar('quixa_hist', JSON.stringify(historial.slice(-120)));
    }
    return d;
  }

  function terminar() {
    finished = true;
    guardar('quixa_fin', '1');
    input.placeholder = 'Conversación finalizada';
    lock(true);
    if (body.querySelector('.qx-nueva')) return;
    var n = document.createElement('button');
    n.className = 'qx-nueva';
    n.textContent = 'Empezar una nueva conversación';
    n.addEventListener('click', function () {
      ['quixa_sid', 'quixa_hist', 'quixa_fin'].forEach(function (k) { try { sessionStorage.removeItem(k); } catch (e) {} });
      sessionId = 'sid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
      guardar('quixa_sid', sessionId);
      historial = []; finished = false; started = false;
      body.innerHTML = '';
      input.placeholder = 'Escribe tu mensaje...';
      lock(false);
      iniciar();
    });
    body.appendChild(n);
    scroll();
  }

  historial.forEach(function (m) { add(m.t, m.c, true); });
  if (finished) terminar();

  function typing(on) {
    var ex = body.querySelector('.qx-typing');
    if (on && !ex) {
      var d = document.createElement('div');
      d.className = 'qx-typing';
      d.innerHTML = '<i></i><i></i><i></i>';
      body.appendChild(d);
      scroll();
    } else if (!on && ex) {
      ex.remove();
    }
  }

  function lock(on) {
    input.disabled = on;
    sendBtn.disabled = on;
  }

  async function send(text, silent) {
    if (finished) return;
    if (!silent) add(text, 'qx-user');
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
      add(data.reply || '(sin respuesta)', data.bloqueo ? 'qx-sys' : 'qx-bot');
      if (data.fin) {
        if (!data.bloqueo) add('Conversación cerrada. El caso quedó registrado para QUIXA.', 'qx-sys');
        terminar();
        return;
      }
    } catch (err) {
      typing(false);
      var msg = err && err.name === 'AbortError'
        ? 'El asistente tardó demasiado en responder. Vuelve a enviar tu mensaje.'
        : 'No pudimos conectar con el asistente. Intenta de nuevo en un momento.';
      var d = document.createElement('div');
      d.className = 'qx-err';
      d.textContent = msg;
      body.appendChild(d);
      scroll();
    }
    lock(false);
    input.focus();
  }

  // Aviso de privacidad y consentimiento ANTES de cualquier dato (RNF-05)
  function pedirConsentimiento() {
    lock(true);
    var a = document.createElement('div');
    a.className = 'qx-aviso';
    a.innerHTML = '<div></div><a target="_blank" rel="noopener">Ver la política de tratamiento de datos</a><button>Acepto y continuar</button>';
    a.firstChild.textContent = AVISO_TEXTO;
    a.querySelector('a').href = PRIVACIDAD_URL;
    a.querySelector('button').addEventListener('click', function () {
      consentimiento = { aceptado: true, version: AVISO_VERSION, fecha: new Date().toISOString() };
      guardar('quixa_consent', JSON.stringify(consentimiento));
      a.remove();
      add('Aceptaste el aviso de privacidad.', 'qx-sys');
      iniciar();
    });
    body.appendChild(a);
    scroll();
  }

  function iniciar() {
    started = true;
    send('__INICIO__', true);
  }

  function open() {
    panel.classList.add('qx-open');
    if (finished) { lock(true); return; }
    input.focus();
    if (!started && !body.querySelector('.qx-aviso')) {
      consentimiento ? iniciar() : pedirConsentimiento();
    }
  }

  launcher.addEventListener('click', function () {
    panel.classList.contains('qx-open') ? panel.classList.remove('qx-open') : open();
  });
  panel.querySelector('.qx-close').addEventListener('click', function () {
    panel.classList.remove('qx-open');
  });

  function submit() {
    var t = input.value.trim();
    if (!t || input.disabled) return;
    input.value = '';
    input.style.height = 'auto';
    send(t, false);
  }

  sendBtn.addEventListener('click', submit);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  });
  input.addEventListener('input', function () {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 96) + 'px';
    var n = input.value.length;
    contador.textContent = n + ' / ' + MAX_CARACTERES;
    contador.classList.toggle('qx-alto', n > MAX_CARACTERES * 0.8);
  });

  window.QuixaChat = { open: open, sessionId: sessionId, endpoint: ENDPOINT };
})();
