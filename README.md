# Third Street Bookmarks

A personal Twitter/X bookmark archiver with an AI-powered classifier and a clean dark-mode web UI — built in React.

## What it does

- Browse your X bookmarks in a fast, searchable dark UI styled after X
- Filter by category (multi-select), author, read/unread, and favourites folders
- Sort by newest, oldest, likes, bookmarks, reposts, or author
- Mark bookmarks as read and save to custom favourite folders
- Classify bookmarks into categories (AI news, tools, research, startups, etc.)
- Sync new bookmarks from X via the `ft` CLI (optional — for your own setup)

## Stack

- **Frontend** — React 18 + Vite, X-inspired dark theme
- **Backend** — Express.js API server (port 3456)
- **Data** — `bookmarks.json` — bring your own, never committed to git
- **Classifier** — Python (`classify.py`), uses OpenAI API if `OPENAI_API_KEY` is set, falls back to regex rules offline

## Getting started

**1. Clone and install**
```bash
git clone https://github.com/mayanksagar26/third-street-bookmarks
cd third-street-bookmarks
npm run setup
```

**2. Bring your bookmarks**
```bash
# Start with the sample to try the UI
cp bookmarks.sample.json bookmarks.json

# Or point to your own file anywhere on disk
export DATA_PATH=~/path/to/your/bookmarks.json
```

**3. Run**
```bash
npm run dev
```

Opens the Express API on `:3456` and the React dev server on `:5173`. Visit `http://localhost:5173`.

**4. Production build**
```bash
npm run build   # builds React into client/dist/
npm start       # serves everything from Express on :3456
```

## bookmarks.json format

See `bookmarks.sample.json` for the full schema. Key fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique tweet ID |
| `text` | string | Tweet content |
| `authorHandle` | string | Twitter handle |
| `authorName` | string | Display name |
| `authorProfileImageUrl` | string\|null | Avatar URL |
| `postedAt` | string | Tweet date |
| `categories` | string[] | Category tags |
| `primaryCategory` | string | Main category |
| `likeCount` / `repostCount` / `bookmarkCount` | number | Engagement stats |
| `isRead` | boolean | Read state |
| `favFolder` | string\|null | Favourite folder name |

## Classifying bookmarks

```bash
# Offline (keyword rules, free)
python3 classify.py

# With AI (GPT-4o-mini)
OPENAI_API_KEY=sk-... python3 classify.py
```

## Categories

`ai-news` · `tool` · `technique` · `launch` · `startup` · `research` · `career` · `opinion` · `education` · `finance` · `security` · `design` · `productivity` · `culture` · `business` · `science` · `misc` · and more
