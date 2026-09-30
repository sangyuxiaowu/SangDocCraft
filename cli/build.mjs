import { build } from 'esbuild';
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { brotliCompressSync, constants } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const appPackage = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const nodePaths = [fileURLToPath(new URL('./node_modules/', import.meta.url))];
await rm(new URL('./dist/', import.meta.url), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
const tauriOnly = {
  name: 'tauri-only',
  setup(build) {
    build.onResolve({ filter: /^@tauri-apps\/api\/(?:core|window)$/ }, ({ path }) => ({ path, namespace: 'tauri-only' }));
    build.onLoad({ filter: /.*/, namespace: 'tauri-only' }, () => ({ contents: `
      export const invoke = () => { throw new Error('Tauri is not supported by the CLI'); };
      export const convertFileSrc = invoke, getCurrentWindow = invoke;
    ` }));
  },
};
const inlinePlaywrightMetadata = {
  name: 'inline-playwright-metadata',
  setup(bundle) {
    bundle.onLoad({ filter: /[\\/]playwright-core[\\/]lib[\\/]coreBundle\.js$/ }, async ({ path }) => {
      let source = await readFile(path, 'utf8');
      const packageRoot = new URL('./node_modules/playwright-core/', import.meta.url);
      const replacements = [
        ['packageJSON = require(import_path9.default.join(packageRoot, "package.json"));',
          `packageJSON = ${await readFile(new URL('package.json', packageRoot), 'utf8')};`],
        ['registry = new Registry(require(import_path20.default.join(packageRoot, "browsers.json")));',
          `registry = new Registry(${await readFile(new URL('browsers.json', packageRoot), 'utf8')});`],
      ];
      for (const [original, replacement] of replacements) {
        if (!source.includes(original)) throw new Error(`Playwright metadata reference changed: ${original}`);
        source = source.replace(original, replacement);
      }
      return { contents: source, loader: 'js' };
    });
  },
};
const browser = await build({
  entryPoints: ['src/browser.ts'],
  bundle: true,
  nodePaths,
  plugins: [tauriOnly],
  write: false,
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  minify: true,
  define: { __APP_VERSION__: JSON.stringify(appPackage.version) },
});
const compressedBrowserBundle = brotliCompressSync(Buffer.from(browser.outputFiles[0].text), {
  params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
}).toString('base64');

await build({
  entryPoints: ['src/cli.mjs'],
  outfile: 'dist/scripts/sdc-html.cjs',
  bundle: true,
  nodePaths,
  plugins: [inlinePlaywrightMetadata],
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  minify: true,
  banner: { js: '#!/usr/bin/env node' },
  define: { __BROWSER_BUNDLE__: JSON.stringify(compressedBrowserBundle) },
});

await mkdir(new URL('./dist/references/', import.meta.url), { recursive: true });
await Promise.all([
  cp(new URL('./SKILL.md', import.meta.url), new URL('./dist/SKILL.md', import.meta.url)),
  cp(new URL('./sample/', import.meta.url), new URL('./dist/references/', import.meta.url), { recursive: true }),
  cp(new URL('../src/data/templates/system-guide.md', import.meta.url), new URL('./dist/references/document.md', import.meta.url)),
]);