// Open a URL outside the app.
//
// In the macOS app this goes through a native command; in the browser build a
// new tab is the real browser already, so it is just `window.open`.

export async function openExternal(url) {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Links need no interception in a browser — `target="_blank"` already works. */
export function installExternalLinkHandler() {}
