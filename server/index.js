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

const SETTINGS_PATH = path.resolve(__dirname, '..', 'settings.json');
const FT = path.join(os.homedir(), '.npm-global/bin/ft');
const CLASSIFY_PY = path.resolve(__dirname, '..', 'classify.py');
const EXTRA_PATH = '/usr/local/bin:/opt/homebrew/bin:' + path.join(os.homedir(), '.local/bin') +
  ':' + path.join(os.homedir(), '.npm-global/bin') +
  ':' + path.join(os.homedir(), '.nvm/versions/node/v20.0.0/bin');
const DB_PATH = path.join(os.homedir(), '.ft-bookmarks', 'bookmarks.db');

app.use(express.json({ limit: '10mb' }));

// ── SQLite UI state (dual-write so data survives re-exports) ──────────────────
let db = null;

function openDb() {
  if (db) return db;
  if (!fs.existsSync(DB_PATH)) return null;
  try {
    const Database = require('better-sqlite3');
    db = new Database(DB_PATH);
    // Ensure columns exist (safe to run multiple times)
    db.exec(`
      CREATE TABLE IF NOT EXISTS bookmark_ui_state (id TEXT PRIMARY KEY, is_read INTEGER DEFAULT 0, fav_folder TEXT);
      ALTER TABLE bookmark_ui_state ADD COLUMN color_label TEXT;
    `);
  } catch {
    // ALTER TABLE fails if column already exists — that's fine
    try {
      const Database = require('better-sqlite3');
      db = new Database(DB_PATH);
    } catch { db = null; }
  }
  return db;
}

function dbUpsertState(id, fields) {
  const conn = openDb();
  if (!conn) return;
  try {
    conn.prepare(`
      INSERT INTO bookmark_ui_state (id, is_read, fav_folder, color_label)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        is_read     = COALESCE(excluded.is_read,     is_read),
        fav_folder  = COALESCE(excluded.fav_folder,  fav_folder),
        color_label = COALESCE(excluded.color_label, color_label)
    `).run(
      id,
      'isRead'     in fields ? (fields.isRead ? 1 : 0) : null,
      'favFolder'  in fields ? (fields.favFolder  || null) : null,
      'colorLabel' in fields ? (fields.colorLabel || null) : null,
    );
  } catch {}
}

const DIST = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
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

// ── Settings I/O ──────────────────────────────────────────────────────────────
function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')); }
  catch { return { aiBackend: 'claude', classifyBackend: 'python' }; }
}

function writeSettings(data) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2));
}

// ── Bookmarks I/O ─────────────────────────────────────────────────────────────
function readBookmarks() {
  return JSON.parse(fs.readFileSync(BOOKMARKS_JSON, 'utf8'));
}

function writeBookmarks(data) {
  fs.writeFileSync(BOOKMARKS_JSON, JSON.stringify(data, null, 2));
}

// ── Settings ──────────────────────────────────────────────────────────────────
app.get('/api/settings', (req, res) => {
  res.json(readSettings());
});

app.post('/api/settings', (req, res) => {
  try {
    const settings = { ...readSettings(), ...req.body };
    writeSettings(settings);
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Bookmarks ─────────────────────────────────────────────────────────────────
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
    dbUpsertState(bm.id, { isRead: bm.isRead });
    res.json({ isRead: bm.isRead });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/read/bulk', (req, res) => {
  try {
    const { ids, read } = req.body;
    const data = readBookmarks();
    const updated = [];
    (ids || []).forEach(id => {
      const bm = data.find(b => b.id === id || b.tweetId === id);
      if (bm) { bm.isRead = read !== false; updated.push(bm.id); }
    });
    writeBookmarks(data);
    updated.forEach(id => dbUpsertState(id, { isRead: read !== false }));
    res.json({ updated });
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
    dbUpsertState(bm.id, { favFolder: bm.favFolder });
    res.json({ folder: bm.favFolder });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/label/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { color } = req.body;
    const data = readBookmarks();
    const bm = data.find(b => b.id === id || b.tweetId === id);
    if (!bm) return res.status(404).json({ error: 'Not found' });
    bm.colorLabel = color || null;
    writeBookmarks(data);
    dbUpsertState(bm.id, { colorLabel: bm.colorLabel });
    res.json({ colorLabel: bm.colorLabel });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/note/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const data = readBookmarks();
    const bm = data.find(b => b.id === id || b.tweetId === id);
    if (!bm) return res.status(404).json({ error: 'Not found' });
    bm.note = note || null;
    writeBookmarks(data);
    res.json({ note: bm.note });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── TTS proxy (avoids browser CORS restrictions) ─────────────────────────────
app.post('/api/tts', async (req, res) => {
  const { provider, text, key, voiceId } = req.body;
  if (!text || !key) return res.status(400).json({ error: 'text and key required' });

  try {
    if (provider === 'elevenlabs') {
      const vid = voiceId || '21m00Tcm4TlvDq8ikWAM';
      const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
        method: 'POST',
        headers: {
          'xi-api-key': key,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: text.slice(0, 1000),
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });
      if (!upstream.ok) {
        const err = await upstream.text();
        return res.status(upstream.status).json({ error: err });
      }
      res.setHeader('Content-Type', 'audio/mpeg');
      const buf = await upstream.arrayBuffer();
      res.send(Buffer.from(buf));

    } else if (provider === 'sarvam') {
      const upstream = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: [text.slice(0, 500)],
          target_language_code: 'en-IN',
          speaker: voiceId || 'meera',
          enable_preprocessing: true,
        }),
      });
      if (!upstream.ok) {
        const err = await upstream.text();
        return res.status(upstream.status).json({ error: err });
      }
      const data = await upstream.json();
      const b64 = data.audios?.[0];
      if (!b64) return res.status(500).json({ error: 'No audio returned from Sarvam' });
      res.setHeader('Content-Type', 'audio/wav');
      res.send(Buffer.from(b64, 'base64'));

    } else {
      res.status(400).json({ error: 'Unknown provider' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Fetch available voices for a TTS provider ────────────────────────────────
app.get('/api/tts/voices', async (req, res) => {
  const { provider, key } = req.query;
  if (!key) return res.status(400).json({ error: 'key required' });
  try {
    if (provider === 'elevenlabs') {
      const upstream = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': key },
      });
      if (!upstream.ok) {
        const err = await upstream.text();
        return res.status(upstream.status).json({ error: err });
      }
      const data = await upstream.json();
      // Only return voices usable on free tier — exclude library/professional voices
      const voices = (data.voices || [])
        .filter(v => v.category !== 'library' && v.category !== 'professional')
        .map(v => ({ id: v.voice_id, name: v.name, category: v.category }));
      res.json({ voices });
    } else {
      res.json({ voices: [] });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── AI Chat ───────────────────────────────────────────────────────────────────
app.post('/api/chat', (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  const settings = readSettings();
  const backend = settings.aiBackend || 'claude';

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  let cmd, args;
  if (backend === 'codex') {
    cmd = 'codex';
    args = ['--full-auto', '-q', prompt];
  } else {
    cmd = 'claude';
    args = ['-p', prompt];
  }

  const proc = spawn(cmd, args, {
    env: { ...process.env, PATH: process.env.PATH + ':' + EXTRA_PATH },
  });

  proc.stdout.on('data', d => { if (!res.writableEnded) res.write(d); });
  proc.stderr.on('data', () => {});
  proc.on('close', () => { if (!res.writableEnded) res.end(); });
  proc.on('error', () => {
    const msg = `\n\n⚠️ ${backend} CLI not found. Install it or switch AI backend in settings.`;
    if (!res.writableEnded) { res.write(msg); res.end(); }
  });
});

// ── AI Classify ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  'ai-news','tool','technique','launch','startup','research','career','opinion',
  'education','finance','security','health','design','productivity','culture',
  'personal-story','humor','media','business','commerce','demo','entertainment',
  'travel','sports','books','food','history','self-improvement','community',
  'leadership','marketing','policy','science','misc',
];

app.post('/api/classify-ai', (req, res) => {
  const settings = readSettings();
  const backend = settings.aiBackend || 'claude';

  let data;
  try { data = readBookmarks(); } catch (e) { return res.status(500).json({ error: e.message }); }

  const unclassified = data.filter(b =>
    !b.primaryCategory || b.primaryCategory === '' || b.primaryCategory === 'unclassified'
  );

  if (!unclassified.length) return res.json({ ok: true, classified: 0, msg: 'Nothing to classify' });

  const batchSize = 20;
  let done = 0;

  function processBatch(i, callback) {
    if (i >= unclassified.length) return callback(null);
    const batch = unclassified.slice(i, i + batchSize);
    const lines = batch.map((b, idx) => `${idx + 1}. ${(b.text || '').slice(0, 300)}`).join('\n');
    const prompt = `You classify tweets/bookmarks into exactly one category.\n\nCategories: ${CATEGORIES.join(', ')}\n\nRules:\n- Return ONLY a JSON array of category strings, one per tweet, in input order.\n- Pick the most specific category that fits.\n- Use "misc" only when nothing else fits.\n- No explanations, no extra text, no markdown fences.\n\nTweets:\n${lines}`;

    let cmd, args;
    if (backend === 'codex') {
      cmd = 'codex'; args = ['--full-auto', '-q', prompt];
    } else {
      cmd = 'claude'; args = ['-p', prompt];
    }

    const proc = spawn(cmd, args, {
      env: { ...process.env, PATH: process.env.PATH + ':' + EXTRA_PATH },
    });

    let out = '';
    proc.stdout.on('data', d => { out += d.toString(); });
    proc.on('close', code => {
      if (code === 0) {
        try {
          const clean = out.trim().replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
          const cats = JSON.parse(clean);
          batch.forEach((b, idx) => {
            const cat = cats[idx];
            const valid = CATEGORIES.includes(cat) ? cat : 'misc';
            const bm = data.find(d => d.id === b.id);
            if (bm) { bm.primaryCategory = valid; bm.categories = [valid]; }
          });
          done += batch.length;
        } catch {}
      }
      processBatch(i + batchSize, callback);
    });
    proc.on('error', () => processBatch(i + batchSize, callback));
  }

  processBatch(0, () => {
    try { writeBookmarks(data); } catch {}
    res.json({ ok: true, classified: done });
  });
});

// ── Sync & Classify ───────────────────────────────────────────────────────────
const EXPORT_PY = path.resolve(__dirname, '..', 'export.py');

function runExport(onDone) {
  // export.py reads SQLite → bookmarks.json, preserving colorLabel/note/isRead/favFolder
  const proc = spawn('python3', [EXPORT_PY, BOOKMARKS_JSON], {
    env: { ...process.env, PATH: process.env.PATH + ':' + EXTRA_PATH },
  });
  proc.stdout.on('data', d => logs.classify.push(d.toString()));
  proc.stderr.on('data', d => logs.classify.push(d.toString()));
  proc.on('close', code => { if (onDone) onDone(code); });
  proc.on('error', e => { logs.classify.push(`Export error: ${e.message}\n`); if (onDone) onDone(1); });
}

app.post('/api/syncall', (req, res) => {
  if (!fs.existsSync(FT)) {
    return res.json({ ok: false, msg: 'ft not installed — bring your own bookmarks.json' });
  }
  if (status.sync === 'running' || status.classify === 'running') {
    return res.json({ ok: false, msg: 'Already running' });
  }

  const settings = readSettings();
  for (const key of ['sync', 'classify']) { logs[key] = []; status[key] = 'idle'; }

  runProc('sync', FT, ['sync', '--browser', 'chrome', '--yes'], () => {
    const classifyBackend = settings.classifyBackend || 'python';
    status.classify = 'running';

    if (classifyBackend === 'python') {
      // 1. classify in SQLite via classify.py, 2. export to bookmarks.json
      runProc('classify', 'python3', [CLASSIFY_PY], () => {
        runExport(() => { status.classify = 'done'; });
      });
    } else {
      // 1. export first so we have JSON to classify
      // 2. classify with AI CLI, 3. write categories back
      const aiCmd = classifyBackend === 'codex' ? 'codex' : 'claude';
      logs.classify.push(`Exporting bookmarks…\n`);

      runExport(() => {
        let data;
        try { data = readBookmarks(); } catch { status.classify = 'error'; return; }

        const unclassified = data.filter(b =>
          !b.primaryCategory || b.primaryCategory === '' || b.primaryCategory === 'unclassified'
        );

        if (!unclassified.length) { status.classify = 'done'; return; }

        logs.classify.push(`Classifying ${unclassified.length} bookmarks with ${aiCmd}…\n`);
        const batchSize = 20;
        let done = 0;

        function runBatch(i) {
          if (i >= unclassified.length) {
            try { writeBookmarks(data); } catch {}
            status.classify = 'done';
            logs.classify.push(`Done. ${done} classified.\n`);
            return;
          }
          const batch = unclassified.slice(i, i + batchSize);
          const lines = batch.map((b, idx) => `${idx + 1}. ${(b.text || '').slice(0, 300)}`).join('\n');
          const prompt = `Classify tweets into one of: ${CATEGORIES.join(', ')}. Return ONLY a JSON array. No markdown.\n\n${lines}`;
          const args2 = classifyBackend === 'codex' ? ['--full-auto', '-q', prompt] : ['-p', prompt];

          const proc = spawn(aiCmd, args2, {
            env: { ...process.env, PATH: process.env.PATH + ':' + EXTRA_PATH },
          });
          let out = '';
          proc.stdout.on('data', d => { out += d.toString(); });
          proc.on('close', code => {
            if (code === 0) {
              try {
                const clean = out.trim().replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
                const cats = JSON.parse(clean);
                batch.forEach((b, idx) => {
                  const cat = cats[idx];
                  const valid = CATEGORIES.includes(cat) ? cat : 'misc';
                  const bm = data.find(d => d.id === b.id);
                  if (bm) { bm.primaryCategory = valid; bm.categories = [valid]; }
                });
                done += batch.length;
              } catch {}
            }
            logs.classify.push(`Categories: ${Math.min(i + batchSize, unclassified.length)}/${unclassified.length}\n`);
            runBatch(i + batchSize);
          });
          proc.on('error', () => { status.classify = 'error'; });
        }
        runBatch(0);
      });
    }
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

if (fs.existsSync(DIST)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`\n  Bookmark server → http://localhost:${PORT}`);
  console.log(`  Data: ${BOOKMARKS_JSON}\n`);
});
