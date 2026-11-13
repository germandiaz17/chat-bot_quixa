const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8090);
const ROOT = __dirname;
const MIME = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml',
  '.png':'image/png', '.jpg':'image/jpeg', '.ico':'image/x-icon' };

http.createServer((req, res) => {
  let url;
  // Una URL rara (por ejemplo «//») no debe tumbar el servidor
  try { url = new URL(req.url.replace(/^\/+/, '/'), `http://localhost:${PORT}`); }
  catch (e) { res.writeHead(400); return res.end('URL inválida'); }

  // Formulario «¿Quieres comunicarte con nosotros?» (contacto.js): se guarda como lead en leads/
  if (url.pathname === '/api/contacto' && req.method === 'POST') {
    let cuerpo = '';
    req.on('data', c => {
      cuerpo += c;
      if (cuerpo.length > 8000) { res.writeHead(413); res.end(); req.destroy(); }
    });
    req.on('end', () => {
      if (res.writableEnded) return;
      let d;
      try { d = JSON.parse(cuerpo); } catch (e) { d = null; }
      const txt = (v, max) => String(v ?? '').trim().slice(0, max);
      const c = d && {
        empresa: txt(d.empresa, 100), nombre: txt(d.nombre, 100), cargo: txt(d.cargo, 100),
        correo: txt(d.correo, 120), telefono: txt(d.telefono, 40), pagina: txt(d.pagina, 200)
      };
      const valido = c && c.empresa.length >= 2 && c.nombre.length >= 2 && c.cargo.length >= 2 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.correo) && c.telefono.replace(/\D/g, '').length >= 7;
      if (!valido) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: false, error: 'Datos incompletos o inválidos' }));
      }
      const ahora = new Date();
      const sello = ahora.toISOString().replace(/[:T]/g, '-').replace(/\..+/, '');
      const id = `contacto-${sello}-${Math.random().toString(36).slice(2, 8)}`;
      const lead = {
        conversation_id: id,
        chat_type: 'formulario_contacto',
        estado_conversacion: 'formulario',
        fecha: ahora.toISOString(),
        empresa_nombre: c.empresa,
        nombre_contacto: c.nombre,
        cargo_contacto: c.cargo,
        email: c.correo,
        telefono: c.telefono,
        origen_pagina: c.pagina,
        resumen_para_consultor: 'Pidió que lo contacten desde el formulario de la web. No conversó con el asistente: no hay diagnóstico.'
      };
      try {
        fs.mkdirSync(path.join(ROOT, 'leads'), { recursive: true });
        fs.writeFileSync(path.join(ROOT, 'leads', id + '.json'), JSON.stringify({ lead }, null, 2));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: false }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  if (url.pathname === '/api/leads') {
    let out = [];
    try {
      out = fs.readdirSync(path.join(ROOT, 'leads'))
        .filter(f => f.endsWith('.json') && !f.startsWith('_'))
        .sort((a, b) => a.replace(/^[a-z]+-/, '').localeCompare(b.replace(/^[a-z]+-/, ''))).reverse()
        .map(f => {
          try {
            let j = JSON.parse(fs.readFileSync(path.join(ROOT, 'leads', f), 'utf8'));
            if (Array.isArray(j)) j = j[0] || {};
            // n8n guarda el item completo; el registro vive bajo .lead
            const lead = j && typeof j.lead === 'object' ? j.lead : j;
            return { archivo: f, lead };
          } catch (e) { return { archivo: f, error: String(e) }; }
        });
    } catch (e) {}
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify(out));
  }

  if (url.pathname === '/api/metricas') {
    let m = {};
    try {
      m = JSON.parse(fs.readFileSync(path.join(ROOT, 'leads', '_metricas.json'), 'utf8'));
      if (Array.isArray(m)) m = m[0] || {};
      m = m.metricas || m;
    } catch (e) {}
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(m));
  }

  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('404');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Demo QUIXA en http://localhost:${PORT}`));
