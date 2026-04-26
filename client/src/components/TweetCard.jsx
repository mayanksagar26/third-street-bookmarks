import { useState, useEffect, useRef } from 'react';

const CAT_CLASS = {
  technology:'cat-technology', tech:'cat-technology',
  ai:'cat-ai', 'artificial intelligence':'cat-ai', 'machine learning':'cat-ai', ml:'cat-ai',
  business:'cat-business', science:'cat-science', design:'cat-design',
  product:'cat-product', startup:'cat-startup', startups:'cat-startup',
  engineering:'cat-engineering', finance:'cat-finance', philosophy:'cat-philosophy',
  productivity:'cat-productivity', health:'cat-health',
};

function getCatClass(cat) {
  if (!cat || cat === 'unclassified') return 'cat-unclassified';
  return CAT_CLASS[cat.toLowerCase().replace(/[^a-z ]/g, '').trim()] || 'cat-other';
}

function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
function fmt(n) { return Number(n || 0).toLocaleString(); }

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getProcessedText(text, searchQuery) {
  let t = esc(text || '');
  // linkify
  t = t.replace(/(https?:\/\/[^\s<>"]+|(?:www\.|[a-z0-9-]+\.(?:com|io|ai|dev|org|net|co|app|sh|gg|xyz|me|to|be))[^\s<>"]*)/gi, url => {
    const href = url.startsWith('http') ? url : 'https://' + url;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="color:var(--accent);text-decoration:none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${url}</a>`;
  });
  // highlight search
  if (searchQuery && searchQuery.length >= 2) {
    try {
      const re = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
      t = t.replace(re, '<span class="highlight">$1</span>');
    } catch {}
  }
  return t;
}

function formatDate(s) {
  if (!s) return '';
  try {
    const d = new Date(s);
    if (isNaN(d)) return '';
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60)    return `${Math.floor(diff)}s`;
    if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  } catch { return ''; }
}

function formatAdded(s) {
  if (!s) return '';
  try {
    const d = new Date(s);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return ''; }
}

export default function TweetCard({ bookmark: b, searchQuery, isRead, favFolder, favFolders, onToggleRead, onToggleFav }) {
  const [showPopup, setShowPopup] = useState(false);
  const [newFolder, setNewFolder] = useState('');
  const popupRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!showPopup) return;
    setTimeout(() => inputRef.current?.focus(), 50);
    const close = (e) => {
      if (!popupRef.current?.contains(e.target)) setShowPopup(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showPopup]);

  const handle = b.authorHandle || '';
  const name = b.authorName || handle;
  const cats = b.categories?.length ? b.categories : (b.primaryCategory && b.primaryCategory !== 'unclassified' ? [b.primaryCategory] : []);
  const addedDate = formatAdded(b.bookmarkedAt || b.syncedAt);

  function handleStarClick(e) {
    e.stopPropagation();
    if (favFolder) { onToggleFav(b.id, null); return; }
    setShowPopup(p => !p);
  }

  function saveFolder(folder) {
    setShowPopup(false);
    setNewFolder('');
    onToggleFav(b.id, folder || null);
  }

  return (
    <div className={`tweet-card${isRead ? ' is-read' : ''}`} data-id={b.id}>
      <a
        className="tweet-avatar"
        href={`https://x.com/${handle}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
      >
        {b.authorProfileImageUrl
          ? <img src={b.authorProfileImageUrl} alt="" loading="lazy" onError={e => e.target.style.display='none'} />
          : <div className="tweet-avatar-placeholder">{(name[0] || '?').toUpperCase()}</div>
        }
      </a>

      <div className="tweet-body">
        <div className="tweet-header">
          <a className="tweet-name" href={`https://x.com/${handle}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
            {name}
          </a>
          <a className="tweet-handle" href={`https://x.com/${handle}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
            @{handle}
          </a>
          <span className="tweet-date">{formatDate(b.postedAt)}</span>

          <div className="tweet-card-actions">
            {/* Read button */}
            <button
              className={`tw-btn read-btn${isRead ? ' active' : ''}`}
              title={isRead ? 'Mark as unread' : 'Mark as read'}
              onClick={e => { e.stopPropagation(); onToggleRead(b.id); }}
            >
              {isRead
                ? <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                : <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>
              }
            </button>

            {/* Star button */}
            <button
              className={`tw-btn star-btn${favFolder ? ' active' : ''}`}
              title={favFolder ? `Saved in "${favFolder}" — click to remove` : 'Add to favourites'}
              onClick={handleStarClick}
              style={{ position: 'relative' }}
            >
              {favFolder
                ? <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              }

              {showPopup && (
                <div className="fav-popup" ref={popupRef} onClick={e => e.stopPropagation()}>
                  <div className="fav-popup-title">Save in</div>
                  {favFolders.map(f => (
                    <div key={f} className="fav-popup-folder" onClick={() => saveFolder(f)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b">
                        <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
                      </svg>
                      {f}
                    </div>
                  ))}
                  {favFolders.length > 0 && <div className="fav-popup-divider" />}
                  <input
                    ref={inputRef}
                    className="fav-popup-input"
                    placeholder="New folder…"
                    value={newFolder}
                    onChange={e => setNewFolder(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && newFolder.trim() && saveFolder(newFolder.trim())}
                  />
                  <button
                    className="fav-popup-save"
                    onClick={() => newFolder.trim() && saveFolder(newFolder.trim())}
                  >Save</button>
                </div>
              )}
            </button>
          </div>
        </div>

        <div
          className="tweet-text"
          dangerouslySetInnerHTML={{ __html: getProcessedText(b.text, searchQuery) }}
        />

        {cats.length > 0 && (
          <div className="tweet-categories">
            {cats.slice(0, 4).map(c => (
              <span key={c} className={`tweet-category ${getCatClass(c)}`}>{cap(c)}</span>
            ))}
          </div>
        )}

        {addedDate && <div className="tweet-meta">Added {addedDate}</div>}

        <div className="tweet-actions">
          <span className="tweet-action">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 7.879 3.77 7.879 8.004 0 3.783-2.96 7.292-6.893 7.92a.5.5 0 01-.579-.49v-1.79c0-.145-.049-.274-.13-.373-.12-.146-.322-.197-.51-.146a8 8 0 01-2.147.298c-4.421 0-7.991-3.58-7.991-8.003z"/></svg>
            {fmt(b.replyCount)}
          </span>
          <span className="tweet-action repost">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/></svg>
            {fmt(b.repostCount)}
          </span>
          <span className="tweet-action like">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"/></svg>
            {fmt(b.likeCount)}
          </span>
          <span className="tweet-action bookmark">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z"/></svg>
            {fmt(b.bookmarkCount)}
          </span>
          <a
            className="view-on-x"
            href={b.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
          >
            View
          </a>
        </div>
      </div>
    </div>
  );
}
