import { useMemo } from 'react';

export default function RightPanel({ bookmarks, currentVoice, onVoiceClick }) {
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
    </aside>
  );
}
