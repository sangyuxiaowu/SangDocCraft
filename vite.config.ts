import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import packageJson from './package.json' with { type: 'json' };

export default defineConfig(({ mode }) => {
  return {
    plugins: [mode !== 'test' && react(), tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true'
        ? null
        : { ignored: ['**/src-tauri/target/**'] },
    },
    build: {
      // Mermaid's independently lazy-loaded Cynefin renderer is about 691 kB.
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const moduleId = id.replaceAll('\\', '/');
            if (moduleId.includes('/node_modules/docx/')) return 'vendor-docx';
            if (/\/node_modules\/(?:react|react-dom|scheduler)\//.test(moduleId)) return 'vendor-react';
            if (moduleId.includes('/node_modules/marked/')) return 'vendor-marked';
            if (moduleId.includes('/node_modules/lucide-react/')) return 'vendor-icons';
          },
        },
      },
    },
  };
});
