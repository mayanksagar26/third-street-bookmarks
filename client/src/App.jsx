import { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import SortBar from './components/SortBar';
import StatsBar from './components/StatsBar';
import Feed from './components/Feed';
import RightPanel from './components/RightPanel';

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
  const [currentVoice, setCurrentVoice]         = useState(null);
  const [showUnreadOnly, setShowUnreadOnly]     = useState(true);
  const [selectedCategories, setSelectedCats]   = useState(new Set());
  const [syncState, setSyncState]               = useState({ status: 'idle', msg: '' });

  // Load bookmarks
  useEffect(() => {
    fetch('/api/bookmarks')
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d.error || 'Failed to load')))
      .then(data => {
        setAllBookmarks(data);
        setReadIds(new Set(data.filter(b => b.isRead).map(b => b.id)));
        const fav = {};
        data.forEach(b => { if (b.favFolder) fav[b.id] = b.favFolder; });
        setFavMap(fav);
        setLoading(false);
      })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  // Check initial sync status on load
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
      if (currentFilter.startsWith('folder:')) {
        const folder = currentFilter.slice(7);
        result = result.filter(b => (b.folderNames || []).includes(folder));
      } else if (currentFilter === 'fav:all') {
        result = result.filter(b => favMap[b.id]);
      } else if (currentFilter.startsWith('fav:')) {
        const folder = currentFilter.slice(4);
        result = result.filter(b => favMap[b.id] === folder);
      }
    }

    if (currentVoice) result = result.filter(b => b.authorHandle === currentVoice);
    if (showUnreadOnly) result = result.filter(b => !readIds.has(b.id));

    if (searchQuery) {
      const q = searchQuery;
      result = result.filter(b =>
        (b.text || '').toLowerCase().includes(q) ||
        (b.authorHandle || '').toLowerCase().includes(q.replace('@', '')) ||
        (b.authorName || '').toLowerCase().includes(q) ||
        (b.articleTitle || '').toLowerCase().includes(q) ||
        (b.primaryCategory || '').toLowerCase().includes(q)
      );
    }

    return sortBookmarks(result, currentSort);
  }, [allBookmarks, currentFilter, currentSort, searchQuery, readIds, favMap, currentVoice, showUnreadOnly, selectedCategories]);

  // Computed metadata
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

  const handleFilterChange = useCallback((filter) => {
    setCurrentFilter(prev => (prev === filter && filter !== 'all') ? 'all' : filter);
    if (filter === 'all') setShowUnreadOnly(false);
    setCurrentPage(1);
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
      />
      <main className="main">
        <Header
          searchQuery={searchQuery}
          onSearch={(q) => { setSearchQuery(q.trim().toLowerCase()); setCurrentPage(1); }}
          resultCount={filtered.length !== allBookmarks.length ? filtered.length : null}
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
          onToggleRead={handleToggleRead}
          onToggleFav={handleToggleFav}
          onPageChange={setCurrentPage}
        />
      </main>
      <RightPanel
        bookmarks={allBookmarks}
        currentVoice={currentVoice}
        onVoiceClick={handleVoiceClick}
        syncState={syncState}
        onSync={handleSync}
      />
    </div>
  );
}
