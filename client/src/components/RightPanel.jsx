import { useMemo } from 'react';

export default function RightPanel({ bookmarks, currentVoice, onVoiceClick, syncState, onSync }) {
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
