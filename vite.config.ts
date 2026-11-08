import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Actions supplies the path reported by GitHub Pages. Local previews use the
// project path too, so a broken root-relative asset is caught before deployment.
const basePath = process.env.PAGES_BASE_PATH ?? '/PaperRun';

export default defineConfig({
  base: `${basePath.replace(/\/$/, '')}/`,
  plugins: [react()],
});
