import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import SortBar from './components/SortBar';
import StatsBar from './components/StatsBar';
import Feed from './components/Feed';
import RightPanel from './components/RightPanel';
import ChatWithBookmarks from './components/ChatWithBookmarks';
import StatsObservations from './components/StatsObservations';
import BookmarkPodcast from './components/BookmarkPodcast';
import VoiceBubble from './components/VoiceBubble';

const PAGE_SIZE = 30;

function parseDate(s) {
  try { return new Date(s).getTime() || 0; } catch { return 0; }
}

function sortBookmarks(list, sort) {
  const copy = [...list];
  if (sort === 'newest')    return copy.sort((a, b) => parseDate(b.postedAt) - parseDate(a.postedAt));
  if (sort === 'oldest')    return copy.sort((a, b) => parseDate(a.postedAt) - parseDate(b.postedAt));
  if (sort === 'likes')     return copy.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
  if (sort === 'bookmarks') return copy.sort((a, b) => (b.bookmarkCount || 0) - (a.bookmarkCount || 0));
  if (sort === 'reposts')   return copy.sort((a, b) => (b.repostCount || 0) - (a.repostCount || 0));
  if (sort === 'author')    return copy.sort((a, b) => (a.authorHandle || '').localeCompare(b.authorHandle || ''));
  return copy;
}

function cleanForVoice(text) {
  return (text || '')
    .replace(/https?:\/\/\S+/g, 'link')
    .replace(/\bhttp\S+/g, 'link')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function loadTtsConfig() {
  try { return JSON.parse(localStorage.getItem('ttsConfig') || 'null'); } catch { return null; }
}

function saveTtsConfig(cfg) {
  localStorage.setItem('ttsConfig', cfg ? JSON.stringify(cfg) : 'null');
}

export default function App() {
  const [allBookmarks, setAllBookmarks]         = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState(null);
  const [currentFilter, setCurrentFilter]       = useState('all');
  const [currentSort, setCurrentSort]           = useState('newest');
  const [currentPage, setCurrentPage]           = useState(1);
  const [searchQuery, setSearchQuery]           = useState('');
  const [readIds, setReadIds]                   = useState(new Set());
  const [favMap, setFavMap]                     = useState({});
  const [labelsMap, setLabelsMap]               = useState({});
  const [notesMap, setNotesMap]                 = useState({});
  const [currentVoice, setCurrentVoice]         = useState(null);
  const [showUnreadOnly, setShowUnreadOnly]     = useState(true);
  const [selectedCategories, setSelectedCats]   = useState(new Set());
  const [syncState, setSyncState]               = useState({ status: 'idle', msg: '' });
  const [activeMode, setActiveMode]             = useState(null);
  const [aiBackend, setAiBackend]               = useState('claude');
  const [classifyBackend, setClassifyBackend]   = useState('python');
  const [ttsConfig, setTtsConfigState]          = useState(loadTtsConfig);
  const [showVoiceSetup, setShowVoiceSetup]     = useState(false);
  const [voicePlaying, setVoicePlaying]         = useState(false);
  const [voiceIdx, setVoiceIdx]                 = useState(0);
  const [focusedIdx, setFocusedIdx]             = useState(-1);
  const voiceScriptRef                          = useRef([]);
  const audioRef                                = useRef(null);

  // Load bookmarks
  useEffect(() => {
    fetch('/api/bookmarks')
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d.error || 'Failed to load')))
      .then(data => {
        setAllBookmarks(data);
        setReadIds(new Set(data.filter(b => b.isRead).map(b => b.id)));
        const fav = {}, labels = {}, notes = {};
        data.forEach(b => {
          if (b.favFolder) fav[b.id] = b.favFolder;
          if (b.colorLabel) labels[b.id] = b.colorLabel;
          if (b.note) notes[b.id] = b.note;
        });
        setFavMap(fav);
        setLabelsMap(labels);
        setNotesMap(notes);
        setLoading(false);
      })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  // Load settings
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d.aiBackend) setAiBackend(d.aiBackend);
      if (d.classifyBackend) setClassifyBackend(d.classifyBackend);
    }).catch(() => {});
  }, []);

  // Check initial sync status
  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(d => {
      if (d.sync.status === 'running' || d.classify.status === 'running') {
        setSyncState({ status: 'running', msg: d.classify.status === 'running' ? (d.classify.progress || 'Classifying…') : 'Syncing…' });
      }
    }).catch(() => {});
  }, []);

  // Poll sync status while running
  useEffect(() => {
    if (syncState.status !== 'running') return;
    const timer = setInterval(() => {
      fetch('/api/status').then(r => r.json()).then(d => {
        if (d.sync.status === 'running') {
          const msg = d.sync.log ? d.sync.log.split('\n').filter(Boolean).pop()?.trim().slice(0, 40) : '';
          setSyncState({ status: 'running', msg: msg || 'Syncing bookmarks…' });
        } else if (d.classify.status === 'running') {
          setSyncState({ status: 'running', msg: d.classify.progress || 'Classifying…' });
        } else if (d.sync.status === 'error' || d.classify.status === 'error') {
          setSyncState({ status: 'error', msg: 'Something went wrong' });
          clearInterval(timer);
        } else {
          setSyncState({ status: 'done', msg: 'Done ✓ — reloading…' });
          clearInterval(timer);
          setTimeout(() => {
            fetch('/api/bookmarks?t=' + Date.now()).then(r => r.json()).then(data => {
              setAllBookmarks(data);
              setSyncState({ status: 'idle', msg: '' });
            }).catch(() => {});
          }, 1500);
        }
      }).catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [syncState.status]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        document.querySelector('.search-input')?.focus();
        return;
      }

      const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIdx(i => Math.min(i + 1, pageItems.length - 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIdx(i => Math.max(i - 1, 0));
      } else if (e.key === 'r' && focusedIdx >= 0) {
        const bm = pageItems[focusedIdx];
        if (bm) handleToggleRead(bm.id);
      } else if (e.key === 'f' && focusedIdx >= 0) {
        const bm = pageItems[focusedIdx];
        if (bm && !favMap[bm.id]) handleToggleFav(bm.id, 'Favourites');
        else if (bm) handleToggleFav(bm.id, null);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [focusedIdx, currentPage]); // eslint-disable-line

  // Computed: filtered + sorted
  const filtered = useMemo(() => {
    let result = [...allBookmarks];

    if (selectedCategories.size > 0) {
      result = result.filter(b => {
        const cats = b.categories?.length ? b.categories : [b.primaryCategory];
        return cats.some(c => selectedCategories.has(c));
      });
    }

    if (currentFilter !== 'all') {
      if (currentFilter === 'gems') {
        const cutoff = Date.now() - 30 * 86400000;
        result = result.filter(b => {
          const date = parseDate(b.bookmarkedAt || b.syncedAt);
          return date > 0 && date < cutoff && !readIds.has(b.id);
        });
      } else if (currentFilter.startsWith('folder:')) {
        const folder = currentFilter.slice(7);
        result = result.filter(b => (b.folderNames || []).includes(folder));
      } else if (currentFilter === 'fav:all') {
        result = result.filter(b => favMap[b.id]);
      } else if (currentFilter.startsWith('fav:')) {
        const folder = currentFilter.slice(4);
        result = result.filter(b => favMap[b.id] === folder);
      } else if (currentFilter.startsWith('label:')) {
        const color = currentFilter.slice(6);
        result = result.filter(b => labelsMap[b.id] === color);
      }
    }

    if (currentVoice) result = result.filter(b => b.authorHandle === currentVoice);
    if (showUnreadOnly && currentFilter !== 'gems') result = result.filter(b => !readIds.has(b.id));

    if (searchQuery) {
      const q = searchQuery;
      result = result.filter(b =>
        (b.text || '').toLowerCase().includes(q) ||
        (b.authorHandle || '').toLowerCase().includes(q.replace('@', '')) ||
        (b.authorName || '').toLowerCase().includes(q) ||
        (b.articleTitle || '').toLowerCase().includes(q) ||
        (b.primaryCategory || '').toLowerCase().includes(q) ||
        (notesMap[b.id] || '').toLowerCase().includes(q)
      );
    }

    return sortBookmarks(result, currentSort);
  }, [allBookmarks, currentFilter, currentSort, searchQuery, readIds, favMap, labelsMap, notesMap, currentVoice, showUnreadOnly, selectedCategories]);

  const unreadCount = useMemo(() => allBookmarks.filter(b => !readIds.has(b.id)).length, [allBookmarks, readIds]);
  const favFolders  = useMemo(() => [...new Set(Object.values(favMap))].sort(), [favMap]);

  const catCounts = useMemo(() => {
    const counts = {};
    allBookmarks.forEach(b => {
      const cats = b.categories?.length ? b.categories : [b.primaryCategory || 'unclassified'];
      cats.forEach(c => { if (c && c !== 'unclassified') counts[c] = (counts[c] || 0) + 1; });
    });
    return counts;
  }, [allBookmarks]);

  const folderCounts = useMemo(() => {
    const counts = {};
    allBookmarks.forEach(b => (b.folderNames || []).forEach(f => { counts[f] = (counts[f] || 0) + 1; }));
    return counts;
  }, [allBookmarks]);

  const gemsCount = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    return allBookmarks.filter(b => {
      const date = parseDate(b.bookmarkedAt || b.syncedAt);
      return date > 0 && date < cutoff && !readIds.has(b.id);
    }).length;
  }, [allBookmarks, readIds]);

  // Handlers
  const handleToggleRead = useCallback(async (id) => {
    try {
      const r = await fetch(`/api/read/${id}`, { method: 'POST' });
      const d = await r.json();
      setReadIds(prev => {
        const next = new Set(prev);
        d.isRead ? next.add(id) : next.delete(id);
        return next;
      });
    } catch {}
  }, []);

  const handleToggleFav = useCallback(async (id, folder) => {
    try {
      await fetch(`/api/fav/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder }),
      });
      setFavMap(prev => {
        const next = { ...prev };
        folder ? (next[id] = folder) : delete next[id];
        return next;
      });
    } catch {}
  }, []);

  const handleUpdateLabel = useCallback(async (id, color) => {
    try {
      await fetch(`/api/label/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color }),
      });
      setLabelsMap(prev => {
        const next = { ...prev };
        color ? (next[id] = color) : delete next[id];
        return next;
      });
    } catch {}
  }, []);

  const handleUpdateNote = useCallback(async (id, note) => {
    try {
      await fetch(`/api/note/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      setNotesMap(prev => {
        const next = { ...prev };
        note ? (next[id] = note) : delete next[id];
        return next;
      });
    } catch {}
  }, []);

  const handleBulkRead = useCallback(async (ids) => {
    try {
      await fetch('/api/read/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, read: true }),
      });
      setReadIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.add(id));
        return next;
      });
    } catch {}
  }, []);

  const handleSync = useCallback(async () => {
    if (syncState.status === 'running') return;
    try {
      const r = await fetch('/api/syncall', { method: 'POST' });
      const d = await r.json();
      if (!d.ok) { setSyncState({ status: 'error', msg: d.msg }); return; }
      setSyncState({ status: 'running', msg: 'Connecting to X…' });
    } catch {
      setSyncState({ status: 'error', msg: 'Server not reachable' });
    }
  }, [syncState.status]);

  const handleSetAiBackend = useCallback(async (backend) => {
    setAiBackend(backend);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiBackend: backend }),
    }).catch(() => {});
  }, []);

  const handleSetClassifyBackend = useCallback(async (backend) => {
    setClassifyBackend(backend);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classifyBackend: backend }),
    }).catch(() => {});
  }, []);

  const handleSetTtsConfig = useCallback((cfg) => {
    setTtsConfigState(cfg);
    saveTtsConfig(cfg);
  }, []);

  // TTS voice playback using ElevenLabs or Sarvam
  const handleTtsSpeak = useCallback(async (text) => {
    if (!ttsConfig || !text) return;
    try {
      if (ttsConfig.provider === 'elevenlabs') {
        const voiceId = ttsConfig.voice || '21m00Tcm4TlvDq8ikWAM';
        const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: { 'xi-api-key': ttsConfig.key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, model_id: 'eleven_monolingual_v1', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
        });
        if (!resp.ok) throw new Error(`ElevenLabs error ${resp.status}`);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
        audioRef.current = new Audio(url);
        audioRef.current.play();
        return audioRef.current;
      } else if (ttsConfig.provider === 'sarvam') {
        const resp = await fetch('https://api.sarvam.ai/text-to-speech', {
          method: 'POST',
          headers: { 'api-subscription-key': ttsConfig.key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs: [text.slice(0, 500)], target_language_code: 'en-IN', speaker: ttsConfig.voice || 'meera', enable_preprocessing: true }),
        });
        if (!resp.ok) throw new Error(`Sarvam error ${resp.status}`);
        const d = await resp.json();
        const b64 = d.audios?.[0];
        if (!b64) throw new Error('No audio returned');
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
        audioRef.current = new Audio(url);
        audioRef.current.play();
        return audioRef.current;
      }
    } catch (e) {
      console.error('TTS error:', e);
      // Fallback to browser TTS
      const utter = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utter);
    }
  }, [ttsConfig]);

  // Play through feed with voice
  const handleVoicePlay = useCallback(async () => {
    if (voicePlaying) {
      if (audioRef.current) audioRef.current.pause();
      window.speechSynthesis.cancel();
      setVoicePlaying(false);
      return;
    }
    const items = filtered.slice(0, 20).filter(b => b.text);
    voiceScriptRef.current = items;
    setVoicePlaying(true);
    setVoiceIdx(0);
  }, [voicePlaying, filtered]);

  // Auto-advance voice
  useEffect(() => {
    if (!voicePlaying || voiceScriptRef.current.length === 0) return;
    const bm = voiceScriptRef.current[voiceIdx];
    if (!bm) { setVoicePlaying(false); return; }

    const text = `From ${bm.authorName || bm.authorHandle}: ${cleanForVoice(bm.text)}`;

    if (ttsConfig) {
      handleTtsSpeak(text).then(audio => {
        if (!audio) return;
        audio.onended = () => {
          setVoiceIdx(i => {
            const next = i + 1;
            if (next >= voiceScriptRef.current.length) { setVoicePlaying(false); return i; }
            return next;
          });
        };
      });
    } else {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.95;
      utter.onend = () => {
        setVoiceIdx(i => {
          const next = i + 1;
          if (next >= voiceScriptRef.current.length) { setVoicePlaying(false); return i; }
          return next;
        });
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    }
  }, [voicePlaying, voiceIdx]); // eslint-disable-line

  const handleFilterChange = useCallback((filter) => {
    setCurrentFilter(prev => (prev === filter && filter !== 'all') ? 'all' : filter);
    if (filter === 'all') setShowUnreadOnly(false);
    setCurrentPage(1);
    setFocusedIdx(-1);
  }, []);

  const handleToggleCategory = useCallback((cat) => {
    setSelectedCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
    setCurrentPage(1);
  }, []);

  const handleVoiceClick = useCallback((handle) => {
    setCurrentVoice(prev => prev === handle ? null : handle);
    setCurrentPage(1);
  }, []);

  return (
    <div className="layout">
      <Sidebar
        total={allBookmarks.length}
        unreadCount={unreadCount}
        gemsCount={gemsCount}
        currentFilter={currentFilter}
        onFilterChange={handleFilterChange}
        showUnreadOnly={showUnreadOnly}
        onToggleUnread={() => { setShowUnreadOnly(p => !p); setCurrentPage(1); }}
        catCounts={catCounts}
        selectedCategories={selectedCategories}
        onToggleCategory={handleToggleCategory}
        onClearCategories={() => { setSelectedCats(new Set()); setCurrentPage(1); }}
        favMap={favMap}
        favFolders={favFolders}
        folderCounts={folderCounts}
        labelsMap={labelsMap}
      />
      <main className="main">
        {activeMode === 'chat' ? (
          <ChatWithBookmarks bookmarks={allBookmarks} aiBackend={aiBackend} onClose={() => setActiveMode(null)} />
        ) : activeMode === 'stats' ? (
          <StatsObservations bookmarks={allBookmarks} onClose={() => setActiveMode(null)} />
        ) : activeMode === 'podcast' ? (
          <BookmarkPodcast bookmarks={allBookmarks} ttsConfig={ttsConfig} onSetTtsConfig={handleSetTtsConfig} aiBackend={aiBackend} onClose={() => setActiveMode(null)} />
        ) : (
          <>
            <Header
              searchQuery={searchQuery}
              onSearch={(q) => { setSearchQuery(q.trim().toLowerCase()); setCurrentPage(1); }}
              resultCount={filtered.length !== allBookmarks.length ? filtered.length : null}
              ttsConfig={ttsConfig}
              voicePlaying={voicePlaying}
              showVoiceSetup={showVoiceSetup}
              onVoiceToggle={handleVoicePlay}
              onShowVoiceSetup={() => setShowVoiceSetup(p => !p)}
              onSetTtsConfig={handleSetTtsConfig}
              onCloseVoiceSetup={() => setShowVoiceSetup(false)}
            />
            <SortBar currentSort={currentSort} onSort={(s) => { setCurrentSort(s); setCurrentPage(1); }} />
            {!loading && !error && <StatsBar bookmarks={allBookmarks} />}
            <Feed
              bookmarks={filtered}
              page={currentPage}
              pageSize={PAGE_SIZE}
              loading={loading}
              error={error}
              searchQuery={searchQuery}
              readIds={readIds}
              favMap={favMap}
              favFolders={favFolders}
              labelsMap={labelsMap}
              notesMap={notesMap}
              focusedIdx={focusedIdx}
              onToggleRead={handleToggleRead}
              onToggleFav={handleToggleFav}
              onUpdateLabel={handleUpdateLabel}
              onUpdateNote={handleUpdateNote}
              onBulkRead={handleBulkRead}
              onPageChange={(p) => { setCurrentPage(p); setFocusedIdx(-1); }}
              ttsConfig={ttsConfig}
              onSpeakBookmark={(bm) => handleTtsSpeak(`From ${bm.authorName || bm.authorHandle}: ${cleanForVoice(bm.text)}`)}
            />
          </>
        )}
      </main>
      <RightPanel
        bookmarks={allBookmarks}
        currentVoice={currentVoice}
        onVoiceClick={handleVoiceClick}
        syncState={syncState}
        onSync={handleSync}
        activeMode={activeMode}
        setActiveMode={setActiveMode}
        aiBackend={aiBackend}
        onSetAiBackend={handleSetAiBackend}
        classifyBackend={classifyBackend}
        onSetClassifyBackend={handleSetClassifyBackend}
      />
      {voicePlaying && (
        <VoiceBubble
          isPlaying={voicePlaying}
          currentText={voiceScriptRef.current[voiceIdx]?.text || ''}
          onPlayPause={() => {
            if (audioRef.current) audioRef.current.pause();
            window.speechSynthesis.cancel();
            setVoicePlaying(false);
          }}
          onSkip={() => setVoiceIdx(i => Math.min(i + 1, voiceScriptRef.current.length - 1))}
          onClose={() => {
            if (audioRef.current) audioRef.current.pause();
            window.speechSynthesis.cancel();
            setVoicePlaying(false);
          }}
        />
      )}
    </div>
  );
}
