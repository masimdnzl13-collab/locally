import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Locally embeds Tideline in an iframe. Same ALLOWED_FRAME_ANCESTORS (comma-separated)
// and localhost fallback as the API (apps/api/src/config/frame-ancestors.ts) and the
// production nginx image (docker/15-frame-ancestors.envsh). The header only protects
// the framed HTML document, so it has to be set where the web app is served.
const DEFAULT_FRAME_ANCESTORS = ['http://localhost:3001', 'http://localhost:5173'];

function frameAncestorsCsp(raw: string | undefined) {
  const origins = (raw ?? '').split(',').map((x) => x.trim().replace(/\/+$/, '')).filter(Boolean);
  return `frame-ancestors 'self' ${(origins.length ? origins : DEFAULT_FRAME_ANCESTORS).join(' ')}`;
}

export default defineConfig(({ command, mode }) => {
  // The canonical .env lives at the tideline/ root, shared with the API.
  const env = { ...loadEnv(mode, fileURLToPath(new URL('../..', import.meta.url)), ''), ...process.env };
  // Image builds (Dockerfile) must say which API the bundle talks to; src/api.ts would otherwise
  // fall back to http://localhost:3000 and every dashboard request would fail in production.
  if (command === 'build' && env.REQUIRE_VITE_API_URL === 'true' && !env.VITE_API_URL?.trim())
    throw new Error('VITE_API_URL is missing: pass --build-arg VITE_API_URL=https://<api-domain> (see deploy/fly-deploy.sh)');
  if (!env.ALLOWED_FRAME_ANCESTORS?.trim())
    console.warn("ALLOWED_FRAME_ANCESTORS ayarlanmadı, sadece localhost'a izin veriliyor");
  const headers = { 'Content-Security-Policy': frameAncestorsCsp(env.ALLOWED_FRAME_ANCESTORS) };
  return {
    plugins: [react()],
    server: { headers },
    preview: { headers },
  };
});
