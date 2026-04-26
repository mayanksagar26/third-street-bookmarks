const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3456;

const BOOKMARKS_JSON = process.env.DATA_PATH
  ? path.resolve(process.env.DATA_PATH)
  : path.resolve(__dirname, '..', 'bookmarks.json');

const FT = path.join(os.homedir(), '.npm-global/bin/ft');
const CLASSIFY_PY = path.resolve(__dirname, '..', 'classify.py');
const EXTRA_PATH = '/usr/local/bin:/opt/homebrew/bin:' + path.join(os.homedir(), '.local/bin');

app.use(express.json());

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
}

// ── Process tracking ──────────────────────────────────────────────────────────
const procs  = { sync: null, classify: null };
const logs   = { sync: [], classify: [] };
const status = { sync: 'idle', classify: 'idle' };

function runProc(key, cmd, args, onDone) {
  if (procs[key]) return false;
  logs[key] = [];
  status[key] = 'running';
  const proc = spawn(cmd, args, {
    env: { ...process.env, PATH: process.env.PATH + ':' + EXTRA_PATH },
  });
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

// ── Bookmarks I/O ─────────────────────────────────────────────────────────────
function readBookmarks() {
  return JSON.parse(fs.readFileSync(BOOKMARKS_JSON, 'utf8'));
}

function writeBookmarks(data) {
  fs.writeFileSync(BOOKMARKS_JSON, JSON.stringify(data, null, 2));
}

// ── API ───────────────────────────────────────────────────────────────────────
app.get('/api/bookmarks', (req, res) => {
  try {
    res.json(readBookmarks());
  } catch {
    res.status(404).json({ error: 'bookmarks.json not found — copy bookmarks.sample.json to bookmarks.json to get started' });
  }
});

app.post('/api/read/:id', (req, res) => {
  try {
    const { id } = req.params;
    const data = readBookmarks();
    const bm = data.find(b => b.id === id || b.tweetId === id);
    if (!bm) return res.status(404).json({ error: 'Not found' });
    bm.isRead = !bm.isRead;
    writeBookmarks(data);
    res.json({ isRead: bm.isRead });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/fav/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { folder } = req.body;
    const data = readBookmarks();
    const bm = data.find(b => b.id === id || b.tweetId === id);
    if (!bm) return res.status(404).json({ error: 'Not found' });
    bm.favFolder = folder || null;
    writeBookmarks(data);
    res.json({ folder: bm.favFolder });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/syncall', (req, res) => {
  if (!fs.existsSync(FT)) {
    return res.json({ ok: false, msg: 'ft not installed — bring your own bookmarks.json' });
  }
  if (status.sync === 'running' || status.classify === 'running') {
    return res.json({ ok: false, msg: 'Already running' });
  }
  // Reset state
  for (const key of ['sync', 'classify']) { logs[key] = []; status[key] = 'idle'; }

  runProc('sync', FT, ['sync', '--browser', 'chrome', '--yes'], () => {
    // After sync, export from SQLite
    runProc('classify', 'python3', [CLASSIFY_PY], () => {
      // Re-export with categories
      try {
        const { execSync } = require('child_process');
        execSync(`python3 "${path.resolve(__dirname, '..', 'server.py')}" --export-only 2>/dev/null || true`);
      } catch {}
    });
  });

  res.json({ ok: true });
});

app.get('/api/status', (req, res) => {
  const classifyLog = logs.classify.join('');
  const m = classifyLog.match(/Categories:\s+\d+\/\d+/g);
  res.json({
    sync:     { status: status.sync,     log: logs.sync.slice(-5).join('') },
    classify: { status: status.classify, log: logs.classify.slice(-3).join(''), progress: m ? m[m.length - 1] : null },
  });
});

// Fallback to React app in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`\n  Bookmark server → http://localhost:${PORT}`);
  console.log(`  Data: ${BOOKMARKS_JSON}\n`);
});
