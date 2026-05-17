# Third Street Bookmarks

A personal X/Twitter bookmark reader with AI-powered features — built on top of [Field Theory CLI](https://github.com/afar1/fieldtheory-cli) by [@andrewfarah](https://x.com/andrewfarah).

> **Your bookmarks, locally. Searchable, classifiable, listenable.**


---

## What it does

- **Browse** — fast, searchable X-styled dark UI with sort, filter, and pagination
- **Filter** — by category (multi-select), author voice, read/unread, Forgotten Gems, favourites folders, and colour labels
- **AI Chat** — ask natural language questions about your collection, powered by Claude Code CLI or Codex CLI running locally
- **Bookmark Podcast** — AI-generated audio digest from your collection — by topic, recent bookmarks, or a custom prompt — with a real-time waveform visualiser
- **Stats** — scrollable analytics: KPIs, timeline chart, category growth by tweet date (multi-line), engagement leaders, posting hour heatmap, top domains
- **Voice playback** — browser TTS (free), ElevenLabs, or Sarvam AI with per-card speaker button
- **Colour labels** — 7-colour tag system for visual triage (Refractions-style)
- **Notes** — per-bookmark annotations, included in search
- **Quoted tweets** — inline display of quoted tweet content
- **Sync & Classify** — pull new bookmarks from X via `ft sync`, classify with Python regex, OpenAI, Claude CLI, or Codex CLI
- **Persistent state** — read/fav/label/note state dual-written to both `bookmarks.json` and the Field Theory SQLite database — survives re-exports

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite, X-inspired dark theme |
| Backend | Express.js (port 3456) + better-sqlite3 |
| Data | `bookmarks.json` — your data, never committed |
| Sync | [Field Theory CLI](https://github.com/afar1/fieldtheory-cli) (`ft sync`) |
| Classify | `classify.py` — regex offline, OpenAI, Claude CLI, or Codex CLI |
| AI Chat & Podcast | `claude -p` or `codex --full-auto` — local CLIs, no API key needed |
| Voice | Browser SpeechSynthesis, [ElevenLabs](https://elevenlabs.io), [Sarvam AI](https://www.sarvam.ai) |

---

## Getting started

### 1. Prerequisites

- Node.js 20+
- Python 3.10+
- [Field Theory CLI](https://github.com/afar1/fieldtheory-cli) _(optional — for syncing from X)_
- [Claude Code](https://claude.ai/code) or [Codex CLI](https://github.com/openai/codex) _(optional — for AI chat & podcast)_

### 2. Clone & install

```bash
git clone https://github.com/mayanksagar26/third-street-bookmarks
cd third-street-bookmarks

# Install all dependencies
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### 3. Add your bookmarks

```bash
# Try the demo with sample data
cp bookmarks.sample.json bookmarks.json

# Or point to your own Field Theory export
export DATA_PATH=~/.ft-bookmarks/bookmarks.json

# Or sync directly from X (requires ft CLI)
ft sync --browser chrome --yes
python3 export.py          # exports SQLite → bookmarks.json
python3 classify.py        # classifies categories
```

### 4. Build & run

```bash
# Development
cd client && npm run dev &   # React dev server → :5173
node server/index.js         # API server → :3456

# Production (single port)
cd client && npm run build
node server/index.js         # serves everything → :3456
```

Open `http://localhost:3456`.

---

## AI features setup

### Chat & Podcast (local CLI — no API key)

The Chat and Podcast modes call a local AI CLI and stream the response. No Anthropic or OpenAI API key required.

**Claude Code CLI:**
```bash
npm install -g @anthropic-ai/claude-code
claude  # authenticate once
```

**Codex CLI (OpenAI):**
```bash
npm install -g @openai/codex
codex   # authenticate once
```

Switch between them in the right panel ⚙️ gear on the Sync & Classify card, or in the Chat view itself.

### Voice (optional API keys)

The **Listen** button in the header uses browser TTS by default — no setup needed. For higher-quality voices:

| Provider | Where to get a key |
|----------|-------------------|
| ElevenLabs | [elevenlabs.io/api](https://elevenlabs.io/api) |
| Sarvam AI | [sarvam.ai](https://www.sarvam.ai) |

Click the ⚙️ gear next to the Listen button to add your key. Keys are stored in `localStorage` — never sent to the server.

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `j` / `↓` | Next bookmark |
| `k` / `↑` | Previous bookmark |
| `r` | Toggle read |
| `f` | Toggle favourite |
| `/` | Focus search |

---

## `bookmarks.json` schema

See `bookmarks.sample.json` for a working example with 20 bookmarks across all categories.

Key fields beyond the Field Theory defaults:

| Field | Type | Description |
|-------|------|-------------|
| `isRead` | boolean | Read/unread state |
| `favFolder` | string\|null | Favourite folder name (e.g. `"ToRead"`) |
| `colorLabel` | string\|null | One of: `red orange yellow green blue purple pink` |
| `note` | string\|null | Personal annotation (searchable) |
| `quotedTweet` | object\|null | Quoted tweet content from Field Theory |

---

## Classifying bookmarks

```bash
# Offline, free (keyword regex rules)
python3 classify.py

# With OpenAI GPT-4o-mini
OPENAI_API_KEY=sk-... python3 classify.py

# With Claude Code CLI
python3 classify.py --backend=claude

# With Codex CLI
python3 classify.py --backend=codex
```

Or trigger classify from the UI via the Sync & Classify card in the right panel — pick your engine from the ⚙️ settings gear.

---

## Category list

`ai-news` · `tool` · `technique` · `launch` · `startup` · `research` · `career` · `opinion` · `education` · `finance` · `security` · `health` · `design` · `productivity` · `culture` · `personal-story` · `business` · `science` · `misc` · and more

---

## Credits

- **[Field Theory CLI](https://github.com/afar1/fieldtheory-cli)** by [Andrew Farah](https://x.com/andrewfarah) — the sync backbone
- Built with React, Express, Vite, better-sqlite3
- AI features powered by Claude Code CLI / Codex CLI
