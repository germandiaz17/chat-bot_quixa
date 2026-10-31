(function () {
  var btn = document.querySelector('.nav-toggle');
  var menu = document.getElementById('menu');
  if (!btn || !menu) return;

  btn.addEventListener('click', function () {
    var abierta = document.body.classList.toggle('nav-abierta');
    btn.setAttribute('aria-expanded', abierta ? 'true' : 'false');
  });

  menu.addEventListener('click', function (e) {
    if (!e.target.closest('a, button')) return;
    document.body.classList.remove('nav-abierta');
    btn.setAttribute('aria-expanded', 'false');
  });
})();
