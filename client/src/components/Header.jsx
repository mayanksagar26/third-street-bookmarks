import { useState, useRef, useEffect } from 'react';

const ELEVENLABS_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh' },
];

const SARVAM_VOICES = [
  { id: 'meera', name: 'Meera (Female)' },
  { id: 'pavithra', name: 'Pavithra (Female)' },
  { id: 'maitreyi', name: 'Maitreyi (Female)' },
  { id: 'arvind', name: 'Arvind (Male)' },
  { id: 'amol', name: 'Amol (Male)' },
  { id: 'amartya', name: 'Amartya (Male)' },
];

function fmt(n) { return Number(n || 0).toLocaleString(); }

export default function Header({
  searchQuery, onSearch, resultCount,
  ttsConfig, voicePlaying, showVoiceSetup,
  onVoiceToggle, onShowVoiceSetup, onSetTtsConfig, onCloseVoiceSetup,
}) {
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState(ttsConfig?.provider || '');
  const [key, setKey] = useState('');
  const [voice, setVoice] = useState('');
  const [testing, setTesting] = useState(false);
  const setupRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!showVoiceSetup) return;
    const handler = (e) => { if (!setupRef.current?.contains(e.target)) onCloseVoiceSetup(); };
    setTimeout(() => document.addEventListener('click', handler), 10);
    return () => document.removeEventListener('click', handler);
  }, [showVoiceSetup]);

  function handleSearch(val) {
    setInput(val);
    onSearch(val);
  }

  function clear() { setInput(''); onSearch(''); }

  function handleSave() {
    if (!provider || !key.trim()) return;
    const cfg = { provider, key: key.trim(), voice: voice || (provider === 'elevenlabs' ? ELEVENLABS_VOICES[0].id : SARVAM_VOICES[0].id) };
    onSetTtsConfig(cfg);
    onCloseVoiceSetup();
  }

  function handleDisconnect() {
    onSetTtsConfig(null);
    setProvider('');
    setKey('');
    setVoice('');
    onCloseVoiceSetup();
  }

  async function handleTest() {
    if (!provider || !key.trim()) return;
    setTesting(true);
    try {
      const v = voice || (provider === 'elevenlabs' ? ELEVENLABS_VOICES[0].id : SARVAM_VOICES[0].id);
      if (provider === 'elevenlabs') {
        const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v}`, {
          method: 'POST',
          headers: { 'xi-api-key': key.trim(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'Testing voice. Bookmarks ready.', model_id: 'eleven_monolingual_v1', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
        });
        if (!resp.ok) throw new Error(`Error ${resp.status}`);
        const blob = await resp.blob();
        new Audio(URL.createObjectURL(blob)).play();
      } else {
        const resp = await fetch('https://api.sarvam.ai/text-to-speech', {
          method: 'POST',
          headers: { 'api-subscription-key': key.trim(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs: ['Testing voice. Bookmarks ready.'], target_language_code: 'en-IN', speaker: v, enable_preprocessing: true }),
        });
        if (!resp.ok) throw new Error(`Error ${resp.status}`);
        const d = await resp.json();
        const b64 = d.audios?.[0];
        if (b64) {
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          new Audio(URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))).play();
        }
      }
    } catch (e) {
      alert(`Test failed: ${e.message}`);
    }
    setTesting(false);
  }

  const voices = provider === 'elevenlabs' ? ELEVENLABS_VOICES : provider === 'sarvam' ? SARVAM_VOICES : [];

  return (
    <div className="header" style={{ position: 'relative' }}>
      <span className="header-title" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Third Street Bookmarks</span>
      <div className="search-wrap">
        <span className="search-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.53 20.47l-3.66-3.66C19.195 15.24 20 13.214 20 11c0-4.97-4.03-9-9-9s-9 4.03-9 9 4.03 9 9 9c2.215 0 4.24-.804 5.808-2.13l3.66 3.66c.147.146.34.22.53.22s.385-.073.53-.22c.295-.293.295-.767.002-1.06zM3.5 11c0-4.135 3.365-7.5 7.5-7.5s7.5 3.365 7.5 7.5-3.365 7.5-7.5 7.5-7.5-3.365-7.5-7.5z"/>
          </svg>
        </span>
        <input
          className="search-input"
          type="text"
          placeholder="Search bookmarks…"
          value={input}
          onChange={e => handleSearch(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && clear()}
        />
        <button className={`search-clear ${input ? 'visible' : ''}`} onClick={clear}>✕</button>
      </div>
      {resultCount !== null && (
        <span className="header-count">{fmt(resultCount)} results</span>
      )}

      {/* Voice button */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          className={`voice-header-btn ${ttsConfig ? 'configured' : ''} ${voicePlaying ? 'playing' : ''}`}
          onClick={onVoiceToggle}
          title={voicePlaying ? 'Stop listening' : 'Listen to bookmarks'}
        >
          {voicePlaying ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
          )}
          {ttsConfig ? (voicePlaying ? 'Stop' : 'Listen') : 'Voice'}
        </button>

        <button
          className="voice-setup-dot"
          onClick={onShowVoiceSetup}
          title={ttsConfig ? 'Voice settings' : 'Add ElevenLabs or Sarvam API key'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
        </button>

        {showVoiceSetup && (
          <div className="voice-setup-panel" ref={setupRef} onClick={e => e.stopPropagation()}>
            <div className="voice-setup-header">
              <span className="voice-setup-title">🎙️ Voice Setup</span>
              {ttsConfig && (
                <button className="voice-setup-disconnect" onClick={handleDisconnect}>Disconnect</button>
              )}
            </div>

            {ttsConfig ? (
              <div className="voice-setup-connected">
                <div className="voice-setup-badge">
                  {ttsConfig.provider === 'elevenlabs' ? '🎙️' : '🔊'} {ttsConfig.provider === 'elevenlabs' ? 'ElevenLabs' : 'Sarvam'} connected
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                  Voice: {voices.find(v => v.id === ttsConfig.voice)?.name || ttsConfig.voice || 'Default'}
                </p>
                <button className="voice-setup-play-btn" onClick={() => { onVoiceToggle(); onCloseVoiceSetup(); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  Start Listening
                </button>
              </div>
            ) : (
              <>
                <p className="voice-setup-desc">Add your API key to listen to bookmarks with high-quality AI voices.</p>

                <div className="voice-provider-chips">
                  <button
                    className={`voice-provider-chip ${provider === 'elevenlabs' ? 'active' : ''}`}
                    onClick={() => { setProvider('elevenlabs'); setVoice(''); }}
                  >
                    🎙️ ElevenLabs
                  </button>
                  <button
                    className={`voice-provider-chip ${provider === 'sarvam' ? 'active' : ''}`}
                    onClick={() => { setProvider('sarvam'); setVoice(''); }}
                  >
                    🔊 Sarvam AI
                  </button>
                </div>

                {provider && (
                  <>
                    <input
                      className="voice-key-input"
                      type="password"
                      placeholder={provider === 'elevenlabs' ? 'sk_…' : 'your-sarvam-api-key'}
                      value={key}
                      onChange={e => setKey(e.target.value)}
                      autoFocus
                    />
                    {voices.length > 0 && (
                      <select className="voice-select" value={voice} onChange={e => setVoice(e.target.value)}>
                        <option value="">Default voice</option>
                        {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    )}
                    <div className="voice-setup-actions">
                      <button className="voice-test-btn" onClick={handleTest} disabled={!key.trim() || testing}>
                        {testing ? 'Testing…' : 'Test'}
                      </button>
                      <button className="voice-save-btn" onClick={handleSave} disabled={!key.trim()}>
                        Save & Connect
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
