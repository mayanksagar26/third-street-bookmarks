import { useMemo, useState, useRef, useEffect } from 'react';

const TOOLS = [
  {
    id: 'chat',
    label: 'Chat with Bookmarks',
    desc: 'Ask questions about your collection',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
      </svg>
    ),
  },
  {
    id: 'stats',
    label: 'Stats & Observations',
    desc: 'Trends, charts, monthly breakdown',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/>
      </svg>
    ),
  },
  {
    id: 'podcast',
    label: 'Bookmark Podcast',
    desc: 'Audio digest of your bookmarks',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 1a9 9 0 0 0-9 9v7c0 1.1.9 2 2 2h1v-8H4v-1a8 8 0 1 1 16 0v1h-2v8h1c1.1 0 2-.9 2-2v-7a9 9 0 0 0-9-9z"/>
      </svg>
    ),
  },
];

export default function RightPanel({ bookmarks, currentVoice, onVoiceClick, syncState, onSync, activeMode, setActiveMode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  const authors = useMemo(() => {
    const count = {};
    const meta = {};
    bookmarks.forEach(b => {
      count[b.authorHandle] = (count[b.authorHandle] || 0) + 1;
      if (!meta[b.authorHandle]) meta[b.authorHandle] = { name: b.authorName, img: b.authorProfileImageUrl };
    });
    return Object.entries(count).sort((a, b) => b[1] - a[1]).map(([handle, c]) => ({
      handle, count: c, ...meta[handle],
    }));
  }, [bookmarks]);

  const btnClass = `action-btn ${syncState.status !== 'idle' ? syncState.status : ''}`.trim();

  return (
    <aside className="right-panel">
      {/* Profile / Tools */}
      <div className="panel-card profile-card" ref={menuRef}>
        <button className="profile-btn" onClick={() => setMenuOpen(p => !p)}>
          <div className="profile-avatar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
          </div>
          <span className="profile-btn-label">Profile</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </button>

        {menuOpen && (
          <div className="profile-menu">
            {TOOLS.map(tool => (
              <button
                key={tool.id}
                className={`profile-menu-item ${activeMode === tool.id ? 'active' : ''}`}
                onClick={() => { setActiveMode(activeMode === tool.id ? null : tool.id); setMenuOpen(false); }}
              >
                <span className="profile-menu-icon">{tool.icon}</span>
                <div className="profile-menu-info">
                  <div className="profile-menu-label">{tool.label}</div>
                  <div className="profile-menu-desc">{tool.desc}</div>
                </div>
                {activeMode === tool.id && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent)"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Voices */}
      <div className="panel-card">
        <div className="panel-card-title">Voices</div>
        <div className="voices-list">
          {authors.map(a => (
            <div
              key={a.handle}
              className={`top-author ${currentVoice === a.handle ? 'active' : ''}`}
              onClick={() => onVoiceClick(a.handle)}
            >
              <div className="top-author-avatar">
                {a.img && <img src={a.img} alt="" loading="lazy" onError={e => e.target.style.display='none'} />}
              </div>
              <div className="top-author-info">
                <div className="top-author-name">{a.name || a.handle}</div>
                <div className="top-author-handle">@{a.handle}</div>
              </div>
              <div className="top-author-count">{a.count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sync */}
      <div className="panel-card">
        <div className="panel-card-title">Sync &amp; Classify</div>
        <button className={btnClass} onClick={onSync}>
          <svg viewBox="0 0 24 24" fill="currentColor" className={syncState.status === 'running' ? 'spin' : ''}>
            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
          </svg>
          Sync &amp; Classify
        </button>
        {syncState.msg && <div className="action-status" style={{ marginTop: 6 }}>{syncState.msg}</div>}
      </div>
    </aside>
  );
}
