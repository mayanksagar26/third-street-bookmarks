import { useState, useMemo } from 'react';

function fmt(n) { return Number(n || 0).toLocaleString(); }

function getMonthKey(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch { return null; }
}

function monthLabel(key) {
  const [y, m] = key.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function monthLabelFull(key) {
  const [y, m] = key.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function smoothPath(pts) {
  if (pts.length < 2) return pts.length === 1 ? `M${pts[0].x},${pts[0].y}` : '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const cp1x = pts[i].x + (pts[i + 1].x - pts[i].x) / 3;
    const cp2x = pts[i].x + (pts[i + 1].x - pts[i].x) * 2 / 3;
    d += ` C${cp1x},${pts[i].y} ${cp2x},${pts[i + 1].y} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

function areaPath(pts, h) {
  if (!pts.length) return '';
  const line = smoothPath(pts);
  return `${line} L${pts[pts.length - 1].x},${h} L${pts[0].x},${h} Z`;
}

export default function StatsObservations({ bookmarks, onClose }) {
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [timeRange, setTimeRange] = useState('all');
  const [hoveredMonth, setHoveredMonth] = useState(null);

  const byMonth = useMemo(() => {
    const map = {};
    bookmarks.forEach(b => {
      const key = getMonthKey(b.bookmarkedAt || b.syncedAt);
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(b);
    });
    return map;
  }, [bookmarks]);

  const sortedMonths = useMemo(() => Object.keys(byMonth).sort(), [byMonth]);

  const filteredMonths = useMemo(() => {
    if (timeRange === 'all') return sortedMonths;
    const now = new Date();
    const months = timeRange === '1y' ? 12 : timeRange === '6m' ? 6 : 3;
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    const cutKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`;
    return sortedMonths.filter(k => k >= cutKey);
  }, [sortedMonths, timeRange]);

  // SVG chart
  const chartW = 720, chartH = 180, padL = 40, padR = 20, padT = 16, padB = 32;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const chartPoints = useMemo(() => {
    if (!filteredMonths.length) return [];
    const maxCount = Math.max(...filteredMonths.map(k => byMonth[k]?.length || 0));
    if (maxCount === 0) return [];
    return filteredMonths.map((key, i) => ({
      key,
      x: padL + (i / Math.max(filteredMonths.length - 1, 1)) * innerW,
      y: padT + innerH - ((byMonth[key]?.length || 0) / maxCount) * innerH,
      count: byMonth[key]?.length || 0,
    }));
  }, [filteredMonths, byMonth]);

  const maxCount = chartPoints.length ? Math.max(...chartPoints.map(p => p.count)) : 0;

  const selectedData = useMemo(() => {
    if (!selectedMonth || !byMonth[selectedMonth]) return null;
    const items = byMonth[selectedMonth];
    const cats = {}, domains = {}, authors = {};
    items.forEach(b => {
      if (b.primaryCategory) cats[b.primaryCategory] = (cats[b.primaryCategory] || 0) + 1;
      if (b.primaryDomain) domains[b.primaryDomain] = (domains[b.primaryDomain] || 0) + 1;
      if (b.authorHandle) authors[b.authorHandle] = (authors[b.authorHandle] || 0) + 1;
    });
    const topCats = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topDomains = Object.entries(domains).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const topAuthor = Object.entries(authors).sort((a, b) => b[1] - a[1])[0];
    const topAuthorMeta = items.find(b => b.authorHandle === topAuthor?.[0]);
    return { items, topCats, topDomains, topAuthor, topAuthorMeta };
  }, [selectedMonth, byMonth]);

  return (
    <div className="mode-container">
      <div className="mode-topbar">
        <button className="mode-back-btn" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          Back
        </button>
        <h2 className="mode-title">Stats &amp; Observations</h2>
        <div className="stats-range-btns">
          {[['all','All Time'],['1y','1 Year'],['6m','6 Months'],['3m','3 Months']].map(([k,l]) => (
            <button key={k} className={`sort-btn ${timeRange===k?'active':''}`} onClick={() => { setTimeRange(k); setSelectedMonth(null); }}>{l}</button>
          ))}
        </div>
      </div>

      <div className="stats-body">
        {/* SVG Line Chart */}
        <div className="stats-chart-wrap">
          <div className="stats-section-title">Bookmarks over time</div>
          <svg className="stats-svg" viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none">
            {/* Grid lines */}
            {[0,0.25,0.5,0.75,1].map((t, i) => {
              const y = padT + t * innerH;
              return (
                <g key={i}>
                  <line x1={padL} x2={chartW - padR} y1={y} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                  <text x={padL - 6} y={y + 4} fill="var(--text-tertiary)" fontSize="10" textAnchor="end">
                    {Math.round(maxCount * (1 - t))}
                  </text>
                </g>
              );
            })}

            {chartPoints.length > 1 && (
              <>
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3"/>
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <path d={areaPath(chartPoints, padT + innerH)} fill="url(#chartGrad)"/>
                <path d={smoothPath(chartPoints)} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"/>
              </>
            )}

            {/* Dots + hover */}
            {chartPoints.map((pt, i) => (
              <g key={pt.key}>
                <circle
                  cx={pt.x} cy={pt.y} r={hoveredMonth === pt.key ? 5 : 3}
                  fill={selectedMonth === pt.key ? '#fff' : 'var(--accent)'}
                  stroke={selectedMonth === pt.key ? 'var(--accent)' : 'var(--bg)'}
                  strokeWidth="2"
                  style={{ cursor: 'pointer', transition: 'r 0.15s' }}
                  onClick={() => setSelectedMonth(pt.key === selectedMonth ? null : pt.key)}
                  onMouseEnter={() => setHoveredMonth(pt.key)}
                  onMouseLeave={() => setHoveredMonth(null)}
                />
                {hoveredMonth === pt.key && (
                  <g>
                    <rect x={pt.x - 28} y={pt.y - 30} width="56" height="20" rx="6" fill="var(--bg-elevated)" stroke="var(--border)"/>
                    <text x={pt.x} y={pt.y - 16} fill="var(--text-primary)" fontSize="11" textAnchor="middle" fontWeight="600">{pt.count}</text>
                  </g>
                )}
                {(i === 0 || i === filteredMonths.length - 1 || filteredMonths.length <= 12 || i % Math.ceil(filteredMonths.length / 10) === 0) && (
                  <text x={pt.x} y={padT + innerH + 18} fill="var(--text-tertiary)" fontSize="9" textAnchor="middle">
                    {monthLabel(pt.key)}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>

        {/* Monthly breakdown grid */}
        <div className="stats-section-title" style={{ marginTop: 24 }}>Monthly breakdown <span style={{color:'var(--text-secondary)',fontWeight:400,fontSize:12}}>— click a month for details</span></div>
        <div className="stats-monthly-grid">
          {filteredMonths.slice().reverse().map(key => {
            const count = byMonth[key]?.length || 0;
            const isSelected = selectedMonth === key;
            return (
              <div
                key={key}
                className={`stats-month-cell ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedMonth(isSelected ? null : key)}
              >
                <div className="stats-month-label">{monthLabel(key)}</div>
                <div className="stats-month-count">{count}</div>
                <div className="stats-month-bar">
                  <div className="stats-month-bar-fill" style={{ width: `${Math.round((count / maxCount) * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected month detail */}
        {selectedMonth && selectedData && (
          <div className="stats-detail">
            <div className="stats-detail-header">
              <span className="stats-detail-title">{monthLabelFull(selectedMonth)}</span>
              <span className="stats-detail-count">{selectedData.items.length} bookmarks</span>
              <button className="stats-detail-close" onClick={() => setSelectedMonth(null)}>✕</button>
            </div>

            <div className="stats-detail-grid">
              <div className="stats-detail-card">
                <div className="stats-detail-card-title">Top Categories</div>
                {selectedData.topCats.map(([cat, n]) => (
                  <div key={cat} className="stats-detail-row">
                    <span className="stats-detail-label">{cat}</span>
                    <span className="stats-detail-val">{n}</span>
                  </div>
                ))}
              </div>

              <div className="stats-detail-card">
                <div className="stats-detail-card-title">Top Domains</div>
                {selectedData.topDomains.map(([d, n]) => (
                  <div key={d} className="stats-detail-row">
                    <span className="stats-detail-label">{d}</span>
                    <span className="stats-detail-val">{n}</span>
                  </div>
                ))}
              </div>

              {selectedData.topAuthor && (
                <div className="stats-detail-card">
                  <div className="stats-detail-card-title">Top Voice</div>
                  <div className="stats-detail-voice">
                    <div className="stats-detail-voice-avatar">
                      {selectedData.topAuthorMeta?.authorProfileImageUrl
                        ? <img src={selectedData.topAuthorMeta.authorProfileImageUrl} alt="" onError={e => e.target.style.display='none'} />
                        : selectedData.topAuthor[0][0]?.toUpperCase()
                      }
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{selectedData.topAuthorMeta?.authorName || selectedData.topAuthor[0]}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>@{selectedData.topAuthor[0]} · {selectedData.topAuthor[1]} bookmarks</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bookmark rows */}
            <div className="stats-detail-card-title" style={{ marginTop: 16, padding: '0 2px' }}>All bookmarks this month</div>
            <div className="stats-bm-rows">
              {selectedData.items
                .sort((a, b) => new Date(b.bookmarkedAt || b.syncedAt) - new Date(a.bookmarkedAt || a.syncedAt))
                .map(b => (
                  <a key={b.id} href={b.url} target="_blank" rel="noopener noreferrer" className="stats-bm-row">
                    <span className="stats-bm-author">@{b.authorHandle}</span>
                    <span className="stats-bm-text">{(b.text || '').slice(0, 80)}…</span>
                    <span className="stats-bm-cat">{b.primaryCategory}</span>
                    <span className="stats-bm-date">{new Date(b.bookmarkedAt || b.syncedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </a>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
