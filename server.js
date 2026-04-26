const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 3456;
const DIR = __dirname;
const FT = path.join(process.env.HOME, '.npm-global/bin/ft');
const BOOKMARKS_JSON = path.join(DIR, 'bookmarks.json');

// Track running processes
const procs = { sync: null, classify: null };
const logs = { sync: [], classify: [] };
const status = { sync: 'idle', classify: 'idle' };

function runProc(key, cmd, args, onDone) {
  if (procs[key]) return false; // already running
  logs[key] = [];
  status[key] = 'running';
  const proc = spawn(cmd, args, { env: { ...process.env, PATH: process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin' } });
  procs[key] = proc;
  proc.stdout.on('data', d => logs[key].push(d.toString()));
  proc.stderr.on('data', d => logs[key].push(d.toString()));
  proc.on('close', code => {
    status[key] = code === 0 ? 'done' : 'error';
    procs[key] = null;
    if (onDone) onDone(code);
  });
  return true;
}

function exportBookmarks(cb) {
  const out = fs.createWriteStream(BOOKMARKS_JSON);
  const proc = spawn(FT, ['list', '--limit', '5000', '--json']);
  proc.stdout.pipe(out);
  proc.on('close', cb);
}

function getCategories(cb) {
  const proc = spawn(FT, ['categories']);
  let out = '';
  proc.stdout.on('data', d => out += d);
  proc.on('close', () => cb(out));
}

function getProgress(cb) {
  const proc = spawn(FT, ['stats']);
  let out = '';
  proc.stdout.on('data', d => out += d);
  proc.on('close', () => {
    const lines = logs.classify.join('');
    const m = lines.match(/Categories:\s+(\d+)\/(\d+)/g);
    const last = m ? m[m.length - 1] : null;
    cb({ stats: out.trim(), classifyProgress: last });
  });
}

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function serveStatic(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
}

function json(res, obj, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // ── API ──
  if (url === '/api/syncall' && req.method === 'POST') {
    if (status.sync === 'running' || status.classify === 'running')
      return json(res, { ok: false, msg: 'Already running' });
    // Step 1: sync
    runProc('sync', FT, ['sync', '--browser'], syncCode => {
      // Step 2: export after sync
      exportBookmarks(() => {
        // Step 3: classify new/unclassified
        runProc('classify', FT, ['classify'], classifyCode => {
          // Step 4: final export with categories
          exportBookmarks(() => {});
        });
      });
    });
    return json(res, { ok: true });
  }

  if (url === '/api/export' && req.method === 'POST') {
    exportBookmarks(code => json(res, { ok: code === 0 }));
    return;
  }

  if (url === '/api/status') {
    getProgress(info => {
      getCategories(cats => {
        json(res, {
          sync: { status: status.sync, log: logs.sync.slice(-5).join('') },
          classify: { status: status.classify, log: logs.classify.slice(-3).join(''), progress: info.classifyProgress },
          categories: cats.trim(),
        });
      });
    });
    return;
  }

  // ── Static files ──
  if (url === '/' || url === '/index.html') return serveStatic(res, path.join(DIR, 'index.html'));
  if (url === '/bookmarks.json') return serveStatic(res, BOOKMARKS_JSON);
  res.writeHead(404); res.end();
});

server.listen(PORT, () => {
  console.log(`\n  Bookmark viewer → http://localhost:${PORT}\n`);
});
