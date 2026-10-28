const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = __dirname;
const MIME = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml',
  '.png':'image/png', '.jpg':'image/jpeg', '.ico':'image/x-icon' };

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/leads') {
    let out = [];
    try {
      out = fs.readdirSync(path.join(ROOT, 'leads'))
        .filter(f => f.endsWith('.json'))
        .sort().reverse()
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

  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('404');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Demo QUIXA en http://localhost:${PORT}`));
