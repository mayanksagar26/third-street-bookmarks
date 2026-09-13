import { useState, useEffect, useCallback } from 'react';
import App from './App';
import Onboarding from './components/Onboarding';
import { apiUrl } from './api-base';

// Gate the app behind server readiness.
//
// Under `npm run dev` Vite can paint the page before the Express server has
// called listen(), so mounting App immediately means every initial fetch races
// it and fails. We poll a cheap endpoint until it answers, then hand off.

const POLL_INTERVAL_MS = 150;
const GIVE_UP_AFTER_MS = 30_000;

export default function Boot() {
  const [state, setState] = useState('waiting'); // waiting | onboarding | ready | failed

  // Settings decide which of the two ready states we land in. Read once the
  // server answers, since it's the server that owns settings.json.
  const resolveReady = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/settings'));
      const settings = await res.json();
      setState(settings?.onboarded ? 'ready' : 'onboarding');
    } catch {
      // Settings unreadable — the app itself still works, so don't trap the
      // user in setup over it.
      setState('ready');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    async function poll() {
      if (cancelled) return;
      try {
        // /api/health is the one unauthenticated route — readiness has to be
        // answerable before anything else, and it reveals nothing the open
        // port doesn't already.
        const res = await fetch(apiUrl('/api/health'));
        if (res.ok) {
          if (!cancelled) await resolveReady();
          return;
        }
      } catch {
        // Server not up yet — expected during the first few hundred ms.
      }
      if (cancelled) return;
      if (Date.now() - startedAt > GIVE_UP_AFTER_MS) {
        setState('failed');
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => { cancelled = true; };
  }, [resolveReady]);

  // Re-runnable from the app, so setup isn't a one-shot you can never see again.
  useEffect(() => {
    const replay = () => setState('onboarding');
    window.addEventListener('tsb:run-onboarding', replay);
    return () => window.removeEventListener('tsb:run-onboarding', replay);
  }, []);

  if (state === 'onboarding') return <Onboarding onFinish={() => setState('ready')} />;
  if (state === 'ready') return <App />;

  return (
    <div className="tsb-boot">
      <div className="tsb-boot-inner">
        <div className="tsb-boot-mark">Third Street</div>
        {state === 'waiting' ? (
          <>
            <div className="tsb-boot-spinner" />
            <div className="tsb-boot-note">Starting local server…</div>
          </>
        ) : (
          <>
            <div className="tsb-boot-error">Couldn’t reach the local server.</div>
            <div className="tsb-boot-note">
              Is it running? Start it with <code>npm start</code> (or{' '}
              <code>npm run dev</code>) and check the terminal for errors.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
