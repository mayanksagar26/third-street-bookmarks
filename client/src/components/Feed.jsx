import TweetCard from './TweetCard';
import Pagination from './Pagination';

export default function Feed({
  bookmarks, page, pageSize, loading, error,
  searchQuery, readIds, favMap, favFolders,
  onToggleRead, onToggleFav, onPageChange,
}) {
  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
        Loading bookmarks…
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⚠️</div>
        <h3>Could not load bookmarks</h3>
        <p>{error}</p>
        <p style={{ marginTop: 8, fontSize: 13 }}>
          Copy <code>bookmarks.sample.json</code> to <code>bookmarks.json</code> or set <code>DATA_PATH</code> to your file.
        </p>
      </div>
    );
  }

  if (!bookmarks.length) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <h3>No results</h3>
        <p>Try a different search or filter</p>
      </div>
    );
  }

  const start = (page - 1) * pageSize;
  const pageItems = bookmarks.slice(start, start + pageSize);

  return (
    <>
      <div className="feed">
        {pageItems.map(b => (
          <TweetCard
            key={b.id}
            bookmark={b}
            searchQuery={searchQuery}
            isRead={readIds.has(b.id)}
            favFolder={favMap[b.id] || null}
            favFolders={favFolders}
            onToggleRead={onToggleRead}
            onToggleFav={onToggleFav}
          />
        ))}
      </div>
      <Pagination
        total={bookmarks.length}
        currentPage={page}
        pageSize={pageSize}
        onPageChange={onPageChange}
      />
    </>
  );
}
