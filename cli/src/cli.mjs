import { writeFile } from 'node:fs/promises';
import { resolve, dirname, basename, extname, join } from 'node:path';
import { chromium } from 'playwright-core';
import { packSangDocument } from '../../src/utils/documentPackage';
import { loadDocument } from './source.mjs';

const layoutScript = `<style>@media screen {.a4-page {zoom: var(--sdc-page-scale, 1);}}</style>
<script>(() => {
  const resize = () => document.documentElement.style.setProperty('--sdc-page-scale',
    String(Math.min(1, Math.max(0.1, (document.documentElement.clientWidth - 24) / (210 * 96 / 25.4)))));
  addEventListener('resize', resize);
  resize();
})()</script>`;

function parseArgs(args) {
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) return null;
  let input;
  let output;
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (['-o', '--output', '--meta', '--theme', '--images', '--title'].includes(arg)) {
      const value = args[++index];
      if (!value || value.startsWith('-') || (arg === '--title' && !value.trim())) {
        throw new Error(arg === '--title' ? '请提供非空 --title' : `请提供 ${arg} 的路径`);
      }
      if (arg === '-o' || arg === '--output') output = value;
      else if (arg === '--title') options.title = value.trim();
      else options[arg.slice(2)] = resolve(value);
    } else if (!arg.startsWith('-') && !input) {
      input = arg;
    } else {
      throw new Error(`无效参数: ${arg}`);
    }
  }
  if (!input) throw new Error('请提供文件夹、.md 或 .sdc 输入');
  const source = resolve(input);
  const destination = resolve(output || join(dirname(source), `${basename(source, extname(source))}.html`));
  const format = extname(destination).toLowerCase();
  if (format !== '.html' && format !== '.sdc') throw new Error('输出文件必须以 .html 或 .sdc 结尾');
  if (source === destination) throw new Error('输出文件不能覆盖输入');
  return { source, destination, format, options };
}

async function launchBrowser() {
  if (process.env.SDC_CHROME_PATH) {
    return chromium.launch({ executablePath: process.env.SDC_CHROME_PATH, headless: true });
  }
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch {}
  }
  throw new Error('找不到 Chrome 或 Edge。请安装浏览器，或设置 SDC_CHROME_PATH 指向 Chromium 可执行文件');
}

export async function run(args) {
  const paths = parseArgs(args);
  if (!paths) {
    console.log('用法: sdc-html <文件夹|input.md|input.sdc> [-o output.html|output.sdc] [--title 标题] [--meta meta.json] [--theme theme.json] [--images images/]\n新建文档必须提供 --title 或在 meta.json 中设置 title；HTML 导出需要 Chrome 或 Edge。');
    return;
  }
  const document = await loadDocument(paths.source, paths.options);
  if (paths.format === '.sdc') {
    await writeFile(paths.destination, new Uint8Array(packSangDocument(document)));
    console.log(paths.destination);
    return;
  }
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><head></head><body></body></html>');
    await page.addScriptTag({ content: __BROWSER_BUNDLE__ });
    const html = await page.evaluate(async (input) => window.renderSdcHtml(input), {
      ...document,
      assets: document.assets.map((asset) => ({ ...asset, data: Array.from(asset.data) })),
    });
    if (!html.includes('</body>')) throw new Error('HTML 导出结果缺少 body 结束标签');
    await writeFile(paths.destination, html.replace('</body>', `${layoutScript}\n</body>`), 'utf8');
    console.log(paths.destination);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  run(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}