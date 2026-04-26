import { useState } from 'react';

function fmt(n) { return Number(n || 0).toLocaleString(); }

export default function Header({ searchQuery, onSearch, resultCount }) {
  const [input, setInput] = useState('');

  function handleChange(val) {
    setInput(val);
    onSearch(val);
  }

  function clear() {
    setInput('');
    onSearch('');
  }

  return (
    <div className="header">
      <span className="header-title">Bookmarks</span>
      <div className="search-wrap">
        <span className="search-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.53 20.47l-3.66-3.66C19.195 15.24 20 13.214 20 11c0-4.97-4.03-9-9-9s-9 4.03-9 9 4.03 9 9 9c2.215 0 4.24-.804 5.808-2.13l3.66 3.66c.147.146.34.22.53.22s.385-.073.53-.22c.295-.293.295-.767.002-1.06zM3.5 11c0-4.135 3.365-7.5 7.5-7.5s7.5 3.365 7.5 7.5-3.365 7.5-7.5 7.5-7.5-3.365-7.5-7.5z"/>
          </svg>
        </span>
        <input
          className="search-input"
          type="text"
          placeholder="Search bookmarks..."
          value={input}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && clear()}
        />
        <button className={`search-clear ${input ? 'visible' : ''}`} onClick={clear}>✕</button>
      </div>
      {resultCount !== null && (
        <span className="header-count">{fmt(resultCount)} results</span>
      )}
    </div>
  );
}
