#!/usr/bin/env python3
"""Bookmarks server — serves UI and orchestrates sync + classify pipeline."""

import http.server
import json
import os
import sqlite3
import subprocess
import sys
import threading
from pathlib import Path

PORT = 3456
DIR = Path(__file__).parent
FT = Path.home() / ".npm-global/bin/ft"
DB_PATH = Path.home() / ".ft-bookmarks/bookmarks.db"
BOOKMARKS_JSON = DIR / "bookmarks.json"

# Shared pipeline state
_lock = threading.Lock()
_state = {
    "sync":     {"status": "idle", "logs": []},
    "classify": {"status": "idle", "logs": [], "progress": None},
}

MIME = {
    ".html": "text/html; charset=utf-8",
    ".js":   "application/javascript",
    ".json": "application/json",
    ".css":  "text/css",
    ".png":  "image/png",
    ".ico":  "image/x-icon",
}


# ── DB migration ──────────────────────────────────────────────────────────────

def migrate_db():
    """
    Keep UI state in a separate table so ft sync's positional INSERT
    into bookmarks never breaks. If we previously added is_read/fav_folder
    directly to bookmarks, migrate them out and drop the columns.
    """
    conn = sqlite3.connect(str(DB_PATH))

    # Create our own state table (idempotent)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS bookmark_ui_state (
            id         TEXT PRIMARY KEY,
            is_read    INTEGER DEFAULT 0,
            fav_folder TEXT
        )
    """)
    conn.commit()

    # Check if stray columns exist on bookmarks (from earlier migration)
    cols = {r[1] for r in conn.execute("PRAGMA table_info(bookmarks)")}
    if "is_read" in cols or "fav_folder" in cols:
        # Migrate any data already there before dropping
        conn.execute("""
            INSERT OR IGNORE INTO bookmark_ui_state (id, is_read, fav_folder)
            SELECT id,
                   COALESCE(is_read, 0),
                   fav_folder
            FROM bookmarks
            WHERE COALESCE(is_read, 0) != 0 OR fav_folder IS NOT NULL
        """)
        conn.commit()
        for col in ("is_read", "fav_folder"):
            if col in cols:
                conn.execute(f"ALTER TABLE bookmarks DROP COLUMN {col}")
        conn.commit()

    conn.close()


# ── DB export ──────────────────────────────────────────────────────────────────

def _parse_json(val, default):
    if not val:
        return default
    try:
        return json.loads(val)
    except Exception:
        return default


def _split_csv(val):
    if not val:
        return []
    return [v.strip() for v in val.split(",") if v.strip()]


def export_bookmarks():
    """Read from SQLite and write bookmarks.json (includes categories)."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT b.*, COALESCE(s.is_read, 0) AS is_read, s.fav_folder
        FROM bookmarks b
        LEFT JOIN bookmark_ui_state s ON b.id = s.id
        ORDER BY b.synced_at DESC
    """)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()

    out = []
    for r in rows:
        out.append({
            "id":                   r["id"],
            "tweetId":              r["tweet_id"],
            "url":                  r["url"],
            "text":                 r["text"],
            "authorHandle":         r["author_handle"],
            "authorName":           r["author_name"],
            "authorProfileImageUrl":r["author_profile_image_url"],
            "postedAt":             r["posted_at"],
            "bookmarkedAt":         r["bookmarked_at"],
            "categories":           _split_csv(r["categories"]),
            "primaryCategory":      r["primary_category"],
            "domains":              _split_csv(r["domains"]),
            "primaryDomain":        r["primary_domain"],
            "githubUrls":           _parse_json(r["github_urls"], []),
            "links":                _parse_json(r["links_json"], []),
            "mediaCount":           r["media_count"],
            "linkCount":            r["link_count"],
            "likeCount":            r["like_count"],
            "repostCount":          r["repost_count"],
            "replyCount":           r["reply_count"],
            "quoteCount":           r["quote_count"],
            "bookmarkCount":        r["bookmark_count"],
            "viewCount":            r["view_count"],
            "folderIds":            _parse_json(r["folder_ids"], []),
            "folderNames":          _parse_json(r["folder_names"], []),
            "articleTitle":         r["article_title"],
            "articleText":          r["article_text"],
            "articleSite":          r["article_site"],
            "syncedAt":             r["synced_at"],
            "enrichedAt":           r["enriched_at"],
            "isRead":               bool(r.get("is_read")),
            "favFolder":            r.get("fav_folder"),
        })

    with open(BOOKMARKS_JSON, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

    return len(out)


# ── Pipeline ───────────────────────────────────────────────────────────────────

def _run(key, cmd, append_env=None):
    """Run a subprocess, streaming output into state logs. Returns exit code."""
    env = {**os.environ, "PATH": os.environ.get("PATH", "") + ":/usr/local/bin:/opt/homebrew/bin:/Users/mayanksagar/.local/bin"}
    if append_env:
        env.update(append_env)

    with _lock:
        _state[key]["status"] = "running"
        _state[key]["logs"] = []

    try:
        proc = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, env=env,
        )
        for line in proc.stdout:
            with _lock:
                _state[key]["logs"].append(line)
                if key == "classify" and "/" in line:
                    _state[key]["progress"] = line.strip()
        proc.wait()
        code = proc.returncode
    except Exception as exc:
        with _lock:
            _state[key]["logs"].append(str(exc))
        code = 1

    with _lock:
        _state[key]["status"] = "done" if code == 0 else "error"

    return code


def _pipeline():
    """Full sync → export → classify → export pipeline (runs in a thread)."""
    ft = str(FT)

    # 1. Sync new bookmarks from X (Chrome session, skip confirmation prompts)
    _run("sync", [ft, "sync", "--browser", "chrome", "--yes"])

    # 2. Export immediately so UI can show new (unclassified) tweets
    export_bookmarks()

    # 3. Classify unclassified tweets (OpenAI if key set, else regex)
    _run("classify", [sys.executable, str(DIR / "classify.py")])

    # 4. Final export with categories applied
    export_bookmarks()


# ── HTTP handler ───────────────────────────────────────────────────────────────

class Handler(http.server.BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        pass  # suppress per-request noise

    def _send_json(self, obj, status=200):
        data = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_file(self, path: Path):
        try:
            data = path.read_bytes()
        except FileNotFoundError:
            self.send_response(404)
            self.end_headers()
            return
        mime = MIME.get(path.suffix, "text/plain")
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        route = self.path.split("?")[0]

        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}

        if route.startswith("/api/read/"):
            tweet_id = route[len("/api/read/"):]
            conn = sqlite3.connect(str(DB_PATH))
            cur = conn.cursor()
            cur.execute("SELECT is_read FROM bookmark_ui_state WHERE id = ?", (tweet_id,))
            row = cur.fetchone()
            new_val = 0 if (row and row[0]) else 1
            conn.execute("""
                INSERT INTO bookmark_ui_state (id, is_read) VALUES (?, ?)
                ON CONFLICT(id) DO UPDATE SET is_read = excluded.is_read
            """, (tweet_id, new_val))
            conn.commit()
            conn.close()
            return self._send_json({"ok": True, "isRead": bool(new_val)})

        if route.startswith("/api/fav/"):
            tweet_id = route[len("/api/fav/"):]
            folder = body.get("folder")
            conn = sqlite3.connect(str(DB_PATH))
            conn.execute("""
                INSERT INTO bookmark_ui_state (id, fav_folder) VALUES (?, ?)
                ON CONFLICT(id) DO UPDATE SET fav_folder = excluded.fav_folder
            """, (tweet_id, folder))
            conn.commit()
            conn.close()
            return self._send_json({"ok": True, "favFolder": folder})

        if route == "/api/syncall":
            with _lock:
                running = (
                    _state["sync"]["status"] == "running"
                    or _state["classify"]["status"] == "running"
                )
            if running:
                return self._send_json({"ok": False, "msg": "Already running"})
            # Reset finished state so the UI polls correctly
            with _lock:
                for key in ("sync", "classify"):
                    _state[key]["status"] = "idle"
                    _state[key]["logs"] = []
                _state["classify"]["progress"] = None
            threading.Thread(target=_pipeline, daemon=True).start()
            return self._send_json({"ok": True})

        self.send_response(404)
        self.end_headers()

    def do_GET(self):
        route = self.path.split("?")[0]

        if route == "/api/favfolders":
            conn = sqlite3.connect(str(DB_PATH))
            cur = conn.cursor()
            cur.execute("""
                SELECT fav_folder, COUNT(*) FROM bookmark_ui_state
                WHERE fav_folder IS NOT NULL AND fav_folder != ''
                GROUP BY fav_folder ORDER BY fav_folder
            """)
            folders = [{"name": r[0], "count": r[1]} for r in cur.fetchall()]
            conn.close()
            return self._send_json({"folders": folders})

        if route == "/api/status":
            with _lock:
                payload = {
                    "sync": {
                        "status": _state["sync"]["status"],
                        "log":    "".join(_state["sync"]["logs"][-5:]),
                    },
                    "classify": {
                        "status":   _state["classify"]["status"],
                        "log":      "".join(_state["classify"]["logs"][-3:]),
                        "progress": _state["classify"]["progress"],
                    },
                }
            return self._send_json(payload)

        if route in ("/", "/index.html"):
            return self._send_file(DIR / "index.html")

        if route == "/bookmarks.json":
            return self._send_file(BOOKMARKS_JSON)

        self.send_response(404)
        self.end_headers()


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    migrate_db()
    server = http.server.ThreadingHTTPServer(("", PORT), Handler)
    print(f"\n  Bookmark viewer → http://localhost:{PORT}\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.")
