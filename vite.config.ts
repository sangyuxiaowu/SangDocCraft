import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';
import packageJson from './package.json' with { type: 'json' };

export default defineConfig(({ mode }) => {
  const isTauriMode = mode === 'tauri';
  const env = loadEnv(mode, '.', '');
  let base = env.VITE_BASE || '/';
  if (!base.endsWith('/')) base += '/';

  return {
    base,
    plugins: [
      mode !== 'test' && react(),
      tailwindcss(),
      !isTauriMode && mode !== 'test' && VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          globIgnores: ['assets/mathjax-*.js'],
        },
        manifest: {
          name: 'SangDocCraft - 智能 Markdown 排版工具',
          short_name: 'SangDocCraft',
          description: '智能 Markdown 排版与文档导出工具。',
          lang: 'zh-CN',
          start_url: base,
          scope: base,
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#2563eb',
          icons: [
            {
              src: `${base}sangdoc-192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: `${base}sangdoc-512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
      }),
    ],
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
      // Mermaid's independently lazy-loaded Cynefin renderer is about 691 kB,
      // and the lazily loaded MathJax SVG renderer is about 1.8 MB.
      chunkSizeWarningLimit: 1900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const moduleId = id.replaceAll('\\', '/');
            if (moduleId.includes('/node_modules/mathjax-full/')) return 'mathjax';
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
