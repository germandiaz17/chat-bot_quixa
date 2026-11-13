/*
 * Ventana de contacto QUIXA.
 * Uso: <script src="contacto.js" data-endpoint="/api/contacto"></script>
 * Cualquier elemento con el atributo data-abrir-contacto abre la ventana.
 * Envía JSON {empresa, nombre, cargo, correo, telefono, pagina} por POST al endpoint.
 */
(function () {
  var script = document.currentScript;
  var ENDPOINT = (script && script.getAttribute('data-endpoint')) || '/api/contacto';

  if (!document.querySelector('link[href$="contacto.css"]')) {
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = script ? script.src.replace(/contacto\.js(\?.*)?$/, 'contacto.css') : 'contacto.css';
    document.head.appendChild(css);
  }

  var ICONOS = {
    empresa: '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 3h11v18H4zM16 8h4v13h-4z" opacity=".95"/><g fill="#fff"><rect x="6" y="5.5" width="2" height="2"/><rect x="10" y="5.5" width="2" height="2"/><rect x="6" y="9.5" width="2" height="2"/><rect x="10" y="9.5" width="2" height="2"/><rect x="6" y="13.5" width="2" height="2"/><rect x="10" y="13.5" width="2" height="2"/><rect x="8" y="17.5" width="3" height="3.5"/><rect x="17.2" y="11" width="1.6" height="1.6"/><rect x="17.2" y="14.5" width="1.6" height="1.6"/></g></svg>',
    nombre: '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="7.5" r="4.5"/><path d="M3.5 21c0-4.4 3.8-7.5 8.5-7.5s8.5 3.1 8.5 7.5z"/></svg>',
    cargo: '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 3h6a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v4H2V8a2 2 0 0 1 2-2h3V5a2 2 0 0 1 2-2zm0 3h6V5H9z"/><path d="M2 13.5h8.5V15h3v-1.5H22V19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/></svg>',
    correo: '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2 5h20v14H2z"/><path d="M3.5 6.5 12 13l8.5-6.5M3.5 17.5l6-5.5M20.5 17.5l-6-5.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    telefono: '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.6 2.5c.6-.3 1.3 0 1.6.5l2 3.6c.3.6.2 1.3-.3 1.7L8.3 9.6a12.4 12.4 0 0 0 6.1 6.1l1.3-1.6c.4-.5 1.1-.6 1.7-.3l3.6 2c.6.3.8 1 .5 1.6l-1 2.1c-.4.9-1.4 1.4-2.4 1.2C10.4 19.4 4.6 13.6 3.2 5.9c-.2-1 .3-2 1.2-2.4z"/></svg>'
  };

  var CAMPOS = [
    { id: 'empresa', texto: 'Nombre de la empresa', tipo: 'text', auto: 'organization' },
    { id: 'nombre', texto: 'Nombre de la persona de contacto', tipo: 'text', auto: 'name' },
    { id: 'cargo', texto: 'Cargo o rol en la empresa', tipo: 'text', auto: 'organization-title' },
    { id: 'correo', texto: 'Correo electrónico', tipo: 'email', auto: 'email' },
    { id: 'telefono', texto: 'Número de contacto', tipo: 'tel', auto: 'tel' }
  ];

  var logo = (document.querySelector('.logo-img') || {}).src || 'Logo_quixa.png';

  var fondo = document.createElement('div');
  fondo.className = 'qc-fondo';
  fondo.hidden = true;
  fondo.innerHTML =
    '<div class="qc-ventana" role="dialog" aria-modal="true" aria-labelledby="qc-titulo">' +
      '<button type="button" class="qc-cerrar" aria-label="Cerrar">' +
        '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>' +
      '</button>' +
      '<div class="qc-intro">' +
        '<img class="qc-logo" src="' + logo + '" alt="QUIXA">' +
        '<svg class="qc-icono" width="130" height="124" viewBox="0 -5 24 29" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M12 -3.6v2.4M8.2 -2.8l1 1.8M15.8 -2.8l-1 1.8"/>' +
          '<path d="m11 17 2 2a1 1 0 1 0 3-3"/>' +
          '<path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/>' +
          '<path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>' +
        '</svg>' +
        '<h2 class="qc-titulo" id="qc-titulo">¿Quieres comunicarte con nosotros?</h2>' +
        '<div class="qc-raya"></div>' +
        '<p class="qc-texto">Déjanos tus datos y nuestro equipo <strong>se pondrá en contacto</strong> contigo.</p>' +
      '</div>' +
      '<div class="qc-divisor" aria-hidden="true"></div>' +
      '<div>' +
        '<form class="qc-form" novalidate>' +
          CAMPOS.map(function (c) {
            return '<label class="qc-campo">' + ICONOS[c.id] +
              '<input name="' + c.id + '" type="' + c.tipo + '" placeholder="' + c.texto + '" aria-label="' + c.texto +
              '" autocomplete="' + c.auto + '" maxlength="' + (c.id === 'correo' ? 120 : 100) + '" required></label>';
          }).join('') +
          '<div class="qc-aviso" role="status" aria-live="polite"></div>' +
          '<button type="submit" class="qc-enviar"><span>Quiero que me contacten</span>' +
            '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6"/></svg>' +
          '</button>' +
        '</form>' +
        '<div class="qc-gracias" hidden>' +
          '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#34197A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-6.5"/></svg>' +
          '<h3>¡Gracias! Recibimos tus datos.</h3>' +
          '<p>Un consultor de QUIXA se comunicará contigo pronto.</p>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(fondo);

  var ventana = fondo.querySelector('.qc-ventana');
  var form = fondo.querySelector('.qc-form');
  var aviso = fondo.querySelector('.qc-aviso');
  var boton = fondo.querySelector('.qc-enviar');
  var gracias = fondo.querySelector('.qc-gracias');
  var origen = null;

  function abrir(e) {
    if (e) e.preventDefault();
    origen = document.activeElement;
    form.hidden = false;
    gracias.hidden = true;
    aviso.textContent = '';
    aviso.className = 'qc-aviso';
    fondo.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { fondo.classList.add('qc-visible'); });
    form.elements.empresa.focus();
  }

  function cerrar() {
    fondo.classList.remove('qc-visible');
    document.body.style.overflow = '';
    setTimeout(function () { fondo.hidden = true; }, 200);
    if (origen && origen.focus) origen.focus();
  }

  function validar() {
    var malos = [];
    CAMPOS.forEach(function (c) {
      var input = form.elements[c.id];
      var v = input.value.trim();
      var ok = v.length >= 2;
      if (ok && c.id === 'correo') ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
      if (ok && c.id === 'telefono') ok = v.replace(/\D/g, '').length >= 7;
      input.parentNode.classList.toggle('qc-error', !ok);
      input.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok) malos.push(c);
    });
    return malos;
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-abrir-contacto]');
    if (t) abrir(e);
  });
  fondo.querySelector('.qc-cerrar').addEventListener('click', cerrar);
  fondo.addEventListener('mousedown', function (e) { if (e.target === fondo) cerrar(); });

  document.addEventListener('keydown', function (e) {
    if (fondo.hidden) return;
    if (e.key === 'Escape') return cerrar();
    if (e.key !== 'Tab') return;
    // Mantiene el foco dentro de la ventana
    var f = ventana.querySelectorAll('button:not([hidden]), input');
    f = Array.prototype.filter.call(f, function (n) { return n.offsetParent !== null; });
    var primero = f[0], ultimo = f[f.length - 1];
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  });

  form.addEventListener('input', function (e) {
    if (e.target.parentNode.classList.contains('qc-error')) {
      e.target.parentNode.classList.remove('qc-error');
    }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var malos = validar();
    if (malos.length) {
      aviso.textContent = malos.length === 1 && malos[0].id === 'correo' ? 'Revisa el correo electrónico.'
        : malos.length === 1 && malos[0].id === 'telefono' ? 'Revisa el número de contacto.'
        : 'Completa los campos marcados.';
      form.elements[malos[0].id].focus();
      return;
    }
    var datos = { pagina: location.pathname };
    CAMPOS.forEach(function (c) { datos[c.id] = form.elements[c.id].value.trim(); });

    boton.disabled = true;
    aviso.className = 'qc-aviso qc-ok';
    aviso.textContent = 'Enviando…';
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); })
      .then(function () {
        form.reset();
        form.hidden = true;
        gracias.hidden = false;
        fondo.querySelector('.qc-cerrar').focus();
      })
      .catch(function () {
        aviso.className = 'qc-aviso';
        aviso.textContent = 'No pudimos enviar tus datos. Inténtalo de nuevo en un momento.';
      })
      .then(function () { boton.disabled = false; });
  });

  window.QuixaContacto = { abrir: abrir, cerrar: cerrar };
})();
