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
- **Pluggable sync sources** — pull bookmarks from [Field Theory](https://github.com/afar1/fieldtheory-cli) **or** [birdclaw](https://birdclaw.sh); pick the source in the UI. birdclaw unlocks extra tools (Liked Tweets, Inbox Triage, AI Digests)
- **Sync & Classify** — pull new bookmarks from your chosen source, classify with Python regex, OpenAI, Claude CLI, or Codex CLI
- **Durable state, source of truth** — your read / favourite / label / note actions live in an app-owned SQLite at `~/.tsb/state.db`, applied on every read. No sync from any source can ever reset them; switch sources freely

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite, X-inspired dark theme |
| Backend | Express.js (port 3456) + better-sqlite3 |
| Data | `bookmarks.json` — bookmark content cache, never committed |
| State | `~/.tsb/state.db` — app-owned SQLite; source of truth for read/fav/label/note + voice prefs |
| Sync | [Field Theory CLI](https://github.com/afar1/fieldtheory-cli) (`ft sync`) or [birdclaw](https://birdclaw.sh) (`birdclaw sync bookmarks`) — switchable in the UI |
| Classify | `classify.py` — regex offline, OpenAI, Claude CLI, or Codex CLI |
| AI Chat & Podcast | `claude -p` or `codex --full-auto` — local CLIs, no API key needed |
| Voice | Browser SpeechSynthesis, [ElevenLabs](https://elevenlabs.io), [Sarvam AI](https://www.sarvam.ai) |

---

## Getting started

### 1. Prerequisites

- Node.js 20+
- Python 3.10+
- [Field Theory CLI](https://github.com/afar1/fieldtheory-cli) or [birdclaw](https://birdclaw.sh) _(optional — for syncing from X; see [Sync sources](#sync-sources))_
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

## Sync sources

The app reads from `bookmarks.json`, but **where that data comes from is pluggable.** Open the ⚙️ gear on the **Sync & Classify** card in the right panel and pick a source. Your choice is saved in `settings.json`.

| Source | Provides | Sync command |
|--------|----------|--------------|
| **Field Theory** | Bookmarks | `ft sync --browser chrome` |
| **birdclaw** | Bookmarks · Likes · Inbox · Media · Threads · Digests · Multi-account | `birdclaw sync bookmarks` |

Each source declares its capabilities in [`client/src/sources.js`](client/src/sources.js). The UI gates features on them, so picking **birdclaw** lights up three extra tools in the Profile menu — **Liked Tweets**, **Inbox Triage**, and **AI Digests** — which stay locked under Field Theory.

### Using birdclaw

[birdclaw](https://birdclaw.sh) (by [@steipete](https://github.com/steipete)) is a local-first X workspace that stores everything in one SQLite DB at `~/.birdclaw/birdclaw.sqlite`.

```bash
# 1. Install (requires Node ≥25.8.1)
npm i -g birdclaw@latest        # or: brew install steipete/tap/birdclaw

# 2. Initialise + authenticate, then pull your data
birdclaw init
birdclaw sync bookmarks         # also: likes, mentions, timeline

# 3. In the app: ⚙️ on Sync & Classify → pick "birdclaw" → Sync
```

**How it works under the hood:**

- `birdclaw_export.py` reads `~/.birdclaw/birdclaw.sqlite` (the `tweets` table, filtered by the `bookmarked`/`liked` flags, joined to `profiles` and `tweet_collections`) and maps it onto the `bookmarks.json` schema, tagging each row `"source": "birdclaw"`.
- **Sources merge, they don't overwrite.** Each sync unions its bookmarks into the existing file by tweet ID — keeping rows from the other source, dropping only its own un-bookmarked tweets, and **preserving your read / favourite / label / note state** on every overlapping tweet. So you can run Field Theory and birdclaw side by side without resetting history. (`--replace` on either exporter forces a full overwrite.)
- `classify.py --json` then categorizes the result with your chosen classify engine.
- The **Liked Tweets**, **Inbox Triage**, and **AI Digests** views read live from `/api/birdclaw/likes`, `/api/birdclaw/inbox` (the `ai_scores` table), and `/api/birdclaw/digest` (`birdclaw today` / `digest week`).

> **Note:** birdclaw needs **Node ≥25**. If your server runs on older Node, the live `birdclaw sync` step is skipped and the app exports whatever is already cached in `~/.birdclaw/birdclaw.sqlite` — so existing data still shows. The **AI Digests** view needs the birdclaw CLI itself and will say so if Node is too old.

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

## Changelog

### 1.1.0 — 2026-05-30

Multi-source sync and a durable state layer.

- **Pluggable sync sources** — choose **Field Theory** or **[birdclaw](https://birdclaw.sh)** from the ⚙️ gear on the Sync & Classify card. Each source declares its capabilities; the UI lights up the tools it can feed.
- **birdclaw integration** — `birdclaw_export.py` maps birdclaw's SQLite (`~/.birdclaw/birdclaw.sqlite`) onto the bookmark schema, plus three new source-gated views: **Liked Tweets**, **Inbox Triage** (AI-ranked mentions), and **AI Digests**.
- **Smart merge (append, never overwrite)** — a sync now unions its bookmarks into the existing file by tweet ID: it keeps the other source's bookmarks and **preserves your read / favourite / label / note state** on every overlapping tweet. Run both sources side by side without resetting history.
- **App-owned State DB** — your read/fav/label/note actions and per-author voice prefs now live in `~/.tsb/state.db`, independent of any source and applied on every read. No sync can ever reset them. Existing state is migrated automatically on first run.
- **Dynamic attribution** — the sidebar "Powered by" line follows the active source (Field Theory / Andrew Farah ↔ birdclaw / Peter Steinberger), linked to their X profiles.
- **TSB favicon** — the browser tab now shows the bookmark mark instead of the default icon.
- **`classify.py --json`** — source-agnostic classification that works on any `bookmarks.json`, not just Field Theory's database.

### 1.0.0 — Initial release

A local X/Twitter bookmark reader built on the Field Theory CLI.

- **Browse & triage** — fast X-styled dark UI with search, sort, pagination, read/unread, Forgotten Gems, favourites folders, colour labels, and per-bookmark notes.
- **AI Chat** — natural-language questions over your collection via local Claude Code / Codex CLI.
- **Bookmark Podcast** — AI-generated audio digest with a live waveform.
- **Stats** — KPIs, timeline, category growth, engagement leaders, posting-hour heatmap, top domains.
- **Voice playback** — browser TTS, ElevenLabs, or Sarvam AI.
- **Sync & Classify** — `ft sync` from X, classify with regex / OpenAI / Claude / Codex.

---

## Credits

- **[Field Theory CLI](https://github.com/afar1/fieldtheory-cli)** by [Andrew Farah](https://x.com/andrewfarah) — the original sync backbone
- **[birdclaw](https://birdclaw.sh)** by [Peter Steinberger](https://github.com/steipete) — alternate source that unlocks likes, inbox & digests
- Built with React, Express, Vite, better-sqlite3
- AI features powered by Claude Code CLI / Codex CLI
