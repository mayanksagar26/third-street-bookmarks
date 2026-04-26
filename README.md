# Third Street Bookmarks

A personal Twitter/X bookmark archiver with an AI-powered classifier and a clean dark-mode web UI.

## What it does

- Syncs your X bookmarks into a local SQLite database (`~/.ft-bookmarks/bookmarks.db`)
- Classifies each bookmark into categories (AI news, tools, research, startups, etc.) using GPT-4o-mini or fast offline keyword rules
- Serves a browsable web interface styled after X — sidebar category filters, tweet cards, engagement stats

## Stack

- **Frontend** — Vanilla HTML/CSS/JS, X-inspired dark theme
- **Backend** — Node.js HTTP server (`server.js`) on port 3456
- **Classifier** — Python (`classify.py`), uses OpenAI API if `OPENAI_API_KEY` is set, falls back to regex rules offline
- **Sync** — `ft` CLI tool (via npm global)

## Getting started

**1. Install dependencies**
```bash
npm install -g ft
```

**2. Sync your bookmarks**
```bash
ft sync
```

**3. Classify bookmarks**
```bash
# Offline (keyword rules)
python3 classify.py

# With AI (GPT-4o-mini)
OPENAI_API_KEY=sk-... python3 classify.py
```

**4. Start the server**
```bash
node server.js
```

Open `http://localhost:3456` in your browser.

## Categories

`ai-news` · `tool` · `technique` · `launch` · `startup` · `research` · `career` · `opinion` · `education` · `finance` · `security` · `design` · `productivity` · `culture` · `business` · `science` · `misc` · and more
