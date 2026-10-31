import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localReferenceAssets } from './reference-assets.js';

export default defineConfig({
  plugins: [react(), localReferenceAssets()],
  base: process.env.VITE_BASE_PATH ?? '/eurogame-card-engine/',
  define: { __BUILD_SHA__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? 'local') },
  build: { sourcemap: false }
});
