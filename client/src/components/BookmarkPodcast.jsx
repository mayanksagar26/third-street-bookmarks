import { useState, useRef, useEffect } from 'react';
import VoiceBubble from './VoiceBubble';

const PROVIDERS = [
  {
    id: 'browser',
    name: 'Browser TTS',
    desc: 'Free, built-in. No setup required.',
    icon: '🔊',
    needsKey: false,
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    desc: 'High quality voices. Needs API key.',
    icon: '🎙️',
    needsKey: true,
    placeholder: 'sk_...',
    keyLabel: 'ElevenLabs API Key',
    docsUrl: 'https://elevenlabs.io/api',
  },
  {
    id: 'openai',
    name: 'OpenAI TTS',
    desc: 'Natural voices via OpenAI. Needs API key.',
    icon: '✨',
    needsKey: true,
    placeholder: 'sk-...',
    keyLabel: 'OpenAI API Key',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
];

function generateScript(bookmarks) {
  const top = bookmarks
    .filter(b => !b.isRead && b.text)
    .sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
    .slice(0, 8);

  const intro = `Welcome to your Third Street Bookmarks daily digest. Here are ${top.length} highlights from your collection.`;
  const segments = top.map((b, i) => {
    const prefix = i === 0 ? 'First up' : i === top.length - 1 ? 'And finally' : `Next`;
    const cat = b.primaryCategory ? ` — a ${b.primaryCategory} pick` : '';
    return {
      text: `${prefix}${cat}, from ${b.authorName || b.authorHandle}: ${b.text}`,
      bookmark: b,
    };
  });
  const outro = { text: "That's your digest for today. Happy reading.", bookmark: null };

  return [{ text: intro, bookmark: null }, ...segments, outro];
}

export default function BookmarkPodcast({ bookmarks, onClose }) {
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [connected, setConnected] = useState(false);
  const [script, setScript] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const utteranceRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  function connect(provider) {
    const seg = generateScript(bookmarks);
    setScript(seg);
    setCurrentIdx(0);
    setConnected(true);
    setShowBubble(true);
  }

  function speakCurrent(idx, segments) {
    if (!synthRef.current || !segments[idx]) return;
    synthRef.current.cancel();
    const utter = new SpeechSynthesisUtterance(segments[idx].text);
    utter.rate = 0.95;
    utter.pitch = 1;
    utter.onend = () => {
      const next = idx + 1;
      if (next < segments.length) {
        setCurrentIdx(next);
        speakCurrent(next, segments);
      } else {
        setIsPlaying(false);
      }
    };
    utteranceRef.current = utter;
    synthRef.current.speak(utter);
    setIsPlaying(true);
  }

  function handlePlayPause() {
    if (!synthRef.current) return;
    if (isPlaying) {
      synthRef.current.pause();
      setIsPlaying(false);
    } else {
      if (synthRef.current.paused) {
        synthRef.current.resume();
        setIsPlaying(true);
      } else {
        speakCurrent(currentIdx, script);
      }
    }
  }

  function handleSkip() {
    synthRef.current?.cancel();
    const next = currentIdx + 1;
    if (next < script.length) {
      setCurrentIdx(next);
      if (isPlaying) speakCurrent(next, script);
    }
  }

  function handleClose() {
    synthRef.current?.cancel();
    setIsPlaying(false);
    setShowBubble(false);
    setConnected(false);
    setSelectedProvider(null);
  }

  if (showBubble) {
    return (
      <div className="mode-container">
        <div className="mode-topbar">
          <button className="mode-back-btn" onClick={() => { handleClose(); onClose(); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            Back
          </button>
          <h2 className="mode-title">Bookmark Podcast</h2>
        </div>
        <div className="podcast-player-screen">
          <div className="podcast-script-info">
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              {script.length} segments · Browser TTS · The floating player is in the top-right corner
            </p>
            <button className="podcast-play-main" onClick={handlePlayPause}>
              {isPlaying
                ? <><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> Pause</>
                : <><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Play</>
              }
            </button>
          </div>
          <div className="podcast-segment-list">
            {script.map((seg, i) => (
              <div
                key={i}
                className={`podcast-segment ${i === currentIdx ? 'active' : ''}`}
                onClick={() => { setCurrentIdx(i); if (isPlaying) speakCurrent(i, script); }}
              >
                <span className="podcast-seg-num">{i + 1}</span>
                <span className="podcast-seg-text">{seg.text.slice(0, 120)}{seg.text.length > 120 ? '…' : ''}</span>
                {i === currentIdx && isPlaying && <span className="podcast-seg-playing">▶</span>}
              </div>
            ))}
          </div>
        </div>
        <VoiceBubble
          isPlaying={isPlaying}
          currentText={script[currentIdx]?.text}
          onPlayPause={handlePlayPause}
          onSkip={handleSkip}
          onClose={handleClose}
        />
      </div>
    );
  }

  return (
    <div className="mode-container">
      <div className="mode-topbar">
        <button className="mode-back-btn" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          Back
        </button>
        <h2 className="mode-title">Bookmark Podcast</h2>
      </div>
      <div className="podcast-setup">
        <div className="podcast-setup-icon">🎙️</div>
        <h2 className="podcast-setup-title">Connect your TTS model</h2>
        <p className="podcast-setup-desc">
          Turn your bookmarks into a daily audio digest. Choose a voice provider to get started.
        </p>

        <div className="podcast-providers">
          {PROVIDERS.map(p => (
            <div
              key={p.id}
              className={`podcast-provider-card ${selectedProvider?.id === p.id ? 'selected' : ''}`}
              onClick={() => setSelectedProvider(p)}
            >
              <div className="podcast-provider-icon">{p.icon}</div>
              <div className="podcast-provider-info">
                <div className="podcast-provider-name">{p.name}</div>
                <div className="podcast-provider-desc">{p.desc}</div>
              </div>
              {!p.needsKey && <span className="podcast-provider-badge">Free</span>}
            </div>
          ))}
        </div>

        {selectedProvider?.needsKey && (
          <div className="podcast-key-input-wrap">
            <label className="podcast-key-label">{selectedProvider.keyLabel}</label>
            <input
              className="podcast-key-input"
              type="password"
              placeholder={selectedProvider.placeholder}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
            <a className="podcast-key-docs" href={selectedProvider.docsUrl} target="_blank" rel="noopener noreferrer">
              Get API key →
            </a>
          </div>
        )}

        {selectedProvider && (
          <button
            className="podcast-connect-btn"
            onClick={() => connect(selectedProvider)}
            disabled={selectedProvider.needsKey && !apiKey.trim()}
          >
            Generate Podcast
          </button>
        )}
      </div>
    </div>
  );
}
