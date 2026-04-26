import { useState, useRef, useEffect } from 'react';

const SUGGESTIONS = [
  "What have I been bookmarking this month?",
  "Which authors do I bookmark most?",
  "Find AI tools I bookmarked",
  "Show me unread bookmarks from last week",
];

function fmt(n) { return Number(n || 0).toLocaleString(); }

function formatDate(s) {
  if (!s) return '';
  try {
    const d = new Date(s);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return ''; }
}

function searchByKeywords(query, bookmarks) {
  const terms = query.toLowerCase().replace(/[?!.]/g, '').split(/\s+/).filter(w => w.length > 2 && !['find','show','what','which','have','been','from','about','that','with','this','last'].includes(w));
  if (!terms.length) return bookmarks.slice(0, 5);
  return bookmarks
    .map(b => {
      const text = `${b.text || ''} ${b.authorName || ''} ${b.authorHandle || ''} ${b.primaryCategory || ''} ${(b.categories || []).join(' ')} ${(b.articleTitle || '')}`.toLowerCase();
      const score = terms.reduce((s, t) => s + (text.includes(t) ? 1 : 0), 0);
      return { ...b, _score: score };
    })
    .filter(b => b._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 6);
}

function processQuery(query, bookmarks) {
  const q = query.toLowerCase();

  // Author query
  if (q.includes('author') || q.includes('who') || q.includes('voices') || q.includes('people')) {
    const counts = {};
    const meta = {};
    bookmarks.forEach(b => {
      counts[b.authorHandle] = (counts[b.authorHandle] || 0) + 1;
      if (!meta[b.authorHandle]) meta[b.authorHandle] = b.authorName || b.authorHandle;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return {
      type: 'authors',
      message: `You bookmark **${top.length}** voices. Your most bookmarked:`,
      authors: top.map(([handle, count]) => ({ handle, name: meta[handle], count })),
    };
  }

  // Time-based query
  if (q.includes('month') || q.includes('week') || q.includes('recent') || q.includes('today') || q.includes('latest')) {
    const isWeek = q.includes('week') || q.includes('today');
    const cutoff = new Date(Date.now() - (isWeek ? 7 : 30) * 86400000);
    const recent = bookmarks
      .filter(b => new Date(b.bookmarkedAt || b.syncedAt) > cutoff)
      .sort((a, b) => new Date(b.bookmarkedAt || b.syncedAt) - new Date(a.bookmarkedAt || a.syncedAt));
    const label = isWeek ? 'this week' : 'this month';
    if (!recent.length) return { type: 'text', message: `No bookmarks found ${label}.` };
    const catCounts = {};
    recent.forEach(b => { if (b.primaryCategory) catCounts[b.primaryCategory] = (catCounts[b.primaryCategory] || 0) + 1; });
    const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => `${c} (${n})`).join(', ');
    return {
      type: 'bookmarks',
      message: `You saved **${recent.length}** bookmarks ${label}. Top categories: ${topCat}.`,
      bookmarks: recent.slice(0, 5),
    };
  }

  // Category/topic search
  const results = searchByKeywords(query, bookmarks);
  if (!results.length) {
    return { type: 'text', message: "No bookmarks matched that query. Try different keywords." };
  }
  return {
    type: 'bookmarks',
    message: `Found **${results.length}** bookmarks matching your query:`,
    bookmarks: results,
  };
}

function getSurprise(bookmarks) {
  const unread = bookmarks.filter(b => !b.isRead);
  const pool = unread.length > 10 ? unread : bookmarks;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return {
    type: 'bookmarks',
    message: `Here's one you might have forgotten about:`,
    bookmarks: [pick],
  };
}

function BookmarkCard({ b }) {
  return (
    <a
      href={b.url}
      target="_blank"
      rel="noopener noreferrer"
      className="chat-bookmark-card"
    >
      <div className="chat-bookmark-author">@{b.authorHandle}</div>
      <div className="chat-bookmark-text">{(b.text || '').slice(0, 160)}{b.text?.length > 160 ? '…' : ''}</div>
      <div className="chat-bookmark-meta">
        {b.primaryCategory && <span className="chat-bookmark-cat">{b.primaryCategory}</span>}
        <span>{formatDate(b.bookmarkedAt || b.syncedAt)}</span>
        {b.likeCount > 0 && <span>♥ {fmt(b.likeCount)}</span>}
      </div>
    </a>
  );
}

function renderMessage(content) {
  return content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

export default function ChatWithBookmarks({ bookmarks, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function sendQuery(query) {
    if (!query.trim() || loading) return;
    setInput('');
    const userMsg = { role: 'user', text: query };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setTimeout(() => {
      const result = processQuery(query, bookmarks);
      setMessages(prev => [...prev, { role: 'assistant', ...result }]);
      setLoading(false);
    }, 400);
  }

  function handleSurprise() {
    setMessages(prev => [...prev, { role: 'user', text: '✨ Surprise me' }]);
    setLoading(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'assistant', ...getSurprise(bookmarks) }]);
      setLoading(false);
    }, 300);
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="mode-container">
      <div className="mode-topbar">
        <button className="mode-back-btn" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          Back
        </button>
      </div>

      <div className="chat-container">
        {isEmpty ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="var(--accent)">
                <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
              </svg>
            </div>
            <h2 className="chat-title">Chat with your Bookmarks</h2>
            <p className="chat-subtitle">Powered by your collection</p>
            <p className="chat-desc">Ask questions about your bookmark collection in natural language. Chat will search your bookmarks and provide answers.</p>
            <div className="chat-chips-grid">
              {SUGGESTIONS.map(s => (
                <button key={s} className="chat-chip-item" onClick={() => sendQuery(s)}>{s}</button>
              ))}
            </div>
            <button className="chat-surprise-btn" onClick={handleSurprise}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>
              Surprise me
            </button>
          </div>
        ) : (
          <div className="chat-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-message ${msg.role}`}>
                {msg.role === 'user' ? (
                  <div className="chat-bubble user">{msg.text}</div>
                ) : (
                  <div className="chat-assistant-msg">
                    <div className="chat-assistant-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
                    </div>
                    <div className="chat-assistant-body">
                      <p className="chat-assistant-text" dangerouslySetInnerHTML={{ __html: renderMessage(msg.message) }} />
                      {msg.type === 'bookmarks' && msg.bookmarks?.map((b, j) => (
                        <BookmarkCard key={j} b={b} />
                      ))}
                      {msg.type === 'authors' && (
                        <div className="chat-authors-list">
                          {msg.authors?.map(a => (
                            <div key={a.handle} className="chat-author-row">
                              <span className="chat-author-name">{a.name}</span>
                              <span className="chat-author-handle">@{a.handle}</span>
                              <span className="chat-author-count">{a.count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="chat-message assistant">
                <div className="chat-assistant-msg">
                  <div className="chat-assistant-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
                  </div>
                  <div className="chat-typing"><span/><span/><span/></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        <div className="chat-input-area">
          <input
            ref={inputRef}
            className="chat-input"
            placeholder="Ask about your bookmarks…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendQuery(input)}
          />
          <button className="chat-send-btn" onClick={() => sendQuery(input)} disabled={!input.trim()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
