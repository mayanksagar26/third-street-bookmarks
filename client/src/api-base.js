// Attaches the API credential to the app's own `/api/...` calls.
//
// The server refuses every /api call without a per-launch bearer token. That is
// what stops a page you happen to visit from reading your bookmarks off
// 127.0.0.1 — the browser can reach the port, but it cannot guess the token.
//
// How the token reaches the page depends on who serves it:
//   - `npm start` (Express serves the built UI) — the server writes it into
//     index.html as `window.__TSB_API_TOKEN__`, so it lands here.
//   - `npm run dev` (Vite on :5173) — the Vite proxy attaches it to each
//     proxied request, and this file has nothing to do.
//
// Patching fetch rather than editing every component keeps the React source
// identical to the macOS app's, so changes there still port across cleanly.

const token = typeof window !== 'undefined' ? window.__TSB_API_TOKEN__ : null;

// Same-origin in the browser build: the UI and the API share a port (or Vite
// proxies /api), so relative paths already resolve to the right server.
export const API_ORIGIN = '';

export function apiUrl(path) {
  return path;
}

/** True for a request aimed at our own API, and nothing else. */
function isOurApi(target) {
  const url = String(target);
  if (url.startsWith('/api')) return true;
  return url.startsWith(`${window.location.origin}/api`);
}

function authorize(url, init) {
  if (!isOurApi(url)) return init;
  const headers = new Headers(init?.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers };
}

if (token) {
  const nativeFetch = window.fetch.bind(window);

  window.fetch = (input, init) => {
    if (typeof input === 'string' || input instanceof URL) {
      return nativeFetch(input, authorize(input, init));
    }
    if (typeof Request !== 'undefined' && input instanceof Request && isOurApi(input.url)) {
      const request = new Request(input, init);
      request.headers.set('Authorization', `Bearer ${token}`);
      return nativeFetch(request);
    }
    return nativeFetch(input, init);
  };
}
