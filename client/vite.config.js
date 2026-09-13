import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev the page comes from Vite, not Express, so nothing writes the API token
// into it — the proxy attaches it instead. The server mints the token into its
// data directory (owner-read-only) precisely so this can find it.
//
// Read per request rather than at startup: the file may not exist until the
// server first boots, and a stale value would fail every call with a 401 that
// looks like a bug in the app rather than in the dev setup.
const DATA_DIR = process.env.TSB_DATA_DIR
  ? path.resolve(process.env.TSB_DATA_DIR)
  : path.join(os.homedir(), '.tsb');

function devAuthHeader(proxyReq) {
  try {
    const token = fs.readFileSync(path.join(DATA_DIR, 'auth-token'), 'utf8').trim();
    if (token) proxyReq.setHeader('Authorization', `Bearer ${token}`);
  } catch {
    // No token yet — the request will 401 and the next one will succeed.
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3456',
        changeOrigin: false,
        configure: proxy => {
          proxy.on('proxyReq', devAuthHeader);
        },
      },
    },
  },
});
