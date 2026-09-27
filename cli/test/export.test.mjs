import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

const execute = promisify(execFile);
const command = fileURLToPath(new URL('../dist/scripts/sdc-html.cjs', import.meta.url));

test('build creates only the skill, references, and executable scripts in dist', async () => {
  assert.deepEqual((await readdir(new URL('../dist/', import.meta.url))).sort(), ['SKILL.md', 'references', 'scripts'].sort());
  assert.deepEqual((await readdir(new URL('../dist/references/', import.meta.url))).sort(), ['document.md', 'meta.json', 'theme.json', 'theme.md']);
  assert.deepEqual(await readdir(new URL('../dist/scripts/', import.meta.url)), ['sdc-html.cjs']);
  const copies = [
    ['../SKILL.md', '../dist/SKILL.md'],
    ['../sample/meta.json', '../dist/references/meta.json'],
    ['../sample/theme.json', '../dist/references/theme.json'],
    ['../sample/theme.md', '../dist/references/theme.md'],
    ['../../src/data/templates/system-guide.md', '../dist/references/document.md'],
  ];
  for (const [source, destination] of copies) {
    assert.deepEqual(await readFile(new URL(destination, import.meta.url)), await readFile(new URL(source, import.meta.url)));
  }
});

test('exports a self-contained, paginated HTML document', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sdc-cli-'));
  const source = join(directory, 'sample.sdc');
  const output = join(directory, 'result.html');
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/wQAAAABJRU5ErkJggg==', 'base64');
  const sha256 = createHash('sha256').update(image).digest('hex');
  const id = `img-${sha256.slice(0, 24)}`;
  const json = (value) => strToU8(JSON.stringify(value));
  try {
    await writeFile(source, zipSync({
      'manifest.json': json({ format: 'SangDocCraft', formatVersion: 2, documentId: 'cli-test', title: 'CLI 测试', createdAt: '', modifiedAt: '' }),
      'document.md': strToU8(`# CLI 测试\n\n![test](@images/${id})\n\n$x^2$\n\n\`\`\`mermaid\nflowchart LR\nA --> B\n\`\`\``),
      'meta.json': json({ title: 'CLI 测试' }),
      'theme.json': json({}),
      'settings.json': json({ historyEnabled: false, historyIdleMinutes: 10 }),
      'images.json': json({ images: [{ id, fileName: 'test.png', description: '', mediaType: 'image/png', byteLength: image.length, sha256, scope: 'document' }] }),
      [`images/${id}.png`]: image,
    }));
    await execute(process.execPath, [command, source, '-o', output]);
    const html = await readFile(output, 'utf8');
    assert.match(html, /CLI 测试/);
    assert.match(html, /class="a4-page/);
    assert.match(html, /data:image\/png;base64,/);
    assert.ok(/class="math-inline"[^>]*><mjx-container[^>]*><svg/.test(html), html.match(/.{0,60}math-inline.{0,150}/)?.[0] || '公式标记不存在');
    assert.ok(/class="mermaid"[^>]*><svg/.test(html), html.match(/.{0,60}mermaid.{0,150}/)?.[0] || 'Mermaid 标记不存在');
    assert.match(html, /--sdc-page-scale/);
    assert.doesNotMatch(html, /@images\//);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('exports an editable folder to complete SDC and HTML', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sdc-folder-'));
  const source = join(directory, 'paper');
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/wQAAAABJRU5ErkJggg==', 'base64');
  const sdc = join(directory, 'paper.sdc');
  const html = join(directory, 'paper.html');
  try {
    await mkdir(join(source, 'images'), { recursive: true });
    await writeFile(join(source, 'document.md'), '# 白皮书\n\n![图示](<images/图 一.png>)');
    await writeFile(join(source, 'images', '图 一.png'), image);
    await writeFile(join(source, 'meta.json'), JSON.stringify({ title: '白皮书', author: '测试作者' }));
    await writeFile(join(source, 'theme.json'), JSON.stringify({ style: { fontSize: 16 }, header: { leftText: 'CLI' } }));
    await execute(process.execPath, [command, source, '-o', sdc], { env: { ...process.env, SDC_CHROME_PATH: join(directory, 'missing-chrome') } });
    const files = unzipSync(new Uint8Array(await readFile(sdc)));
    const manifest = JSON.parse(strFromU8(files['manifest.json']));
    const meta = JSON.parse(strFromU8(files['meta.json']));
    const theme = JSON.parse(strFromU8(files['theme.json']));
    const images = JSON.parse(strFromU8(files['images.json'])).images;
    assert.equal(manifest.formatVersion, 2);
    assert.equal(meta.title, '白皮书');
    assert.equal(meta.author, '测试作者');
    assert.equal(meta.organization, '');
    assert.equal(theme.id, 'minimal-clean');
    assert.equal(theme.style.fontSize, 16);
    assert.equal(theme.style.headingFonts.h1.fontSize, 24);
    assert.equal(theme.header.leftText, 'CLI');
    assert.equal(images.length, 1);
    assert.equal(files[`images/${images[0].id}.png`].length, image.length);
    assert.match(strFromU8(files['document.md']), new RegExp(`@images/${images[0].id}`));
    assert.deepEqual(JSON.parse(strFromU8(files['settings.json'])), { historyEnabled: false, historyIdleMinutes: 10 });
    assert.deepEqual(JSON.parse(strFromU8(files['history.json'])), []);
    assert.deepEqual(JSON.parse(strFromU8(files['chats.json'])), []);
    await execute(process.execPath, [command, source, '-o', html]);
    const result = await readFile(html, 'utf8');
    assert.match(result, /白皮书/);
    assert.match(result, /data:image\/png;base64,/);
    assert.match(result, /--base-font-size: 16px/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('accepts a Markdown file with explicit meta, theme, and image paths', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sdc-md-'));
  const markdown = join(directory, 'draft.md');
  const meta = join(directory, 'details.json');
  const theme = join(directory, 'style.json');
  const images = join(directory, 'assets');
  const sdc = join(directory, 'draft.sdc');
  try {
    await mkdir(images);
    await writeFile(join(images, 'logo.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/wQAAAABJRU5ErkJggg==', 'base64'));
    await writeFile(markdown, '# 内容\n\n![Logo](logo.png)');
    await writeFile(meta, JSON.stringify({ title: '自定标题' }));
    await writeFile(theme, JSON.stringify({ cover: { logoUrl: 'logo.png' }, style: { accentColor: '#000000' } }));
    await execute(process.execPath, [command, markdown, '--meta', meta, '--theme', theme, '--images', images, '-o', sdc]);
    const files = unzipSync(new Uint8Array(await readFile(sdc)));
    const exportedMeta = JSON.parse(strFromU8(files['meta.json']));
    const exportedTheme = JSON.parse(strFromU8(files['theme.json']));
    assert.equal(exportedMeta.title, '自定标题');
    assert.equal(exportedTheme.style.accentColor, '#000000');
    assert.equal(exportedTheme.cover.coverStyle, 'minimal');
    assert.match(exportedTheme.cover.logoUrl, /^@images\/img-/);
    assert.match(strFromU8(files['document.md']), /^# 内容/);
    const html = join(directory, 'draft.html');
    await execute(process.execPath, [command, markdown, '--meta', meta, '--theme', theme, '--images', images, '-o', html]);
    assert.match(await readFile(html, 'utf8'), /自定标题/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('fails on missing explicit configuration or local image', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sdc-errors-'));
  const markdown = join(directory, 'draft.md');
  try {
    await writeFile(markdown, '# 标题');
    await assert.rejects(execute(process.execPath, [command, markdown, '--meta', join(directory, 'missing.json'), '-o', join(directory, 'invalid.sdc')]));
    await writeFile(markdown, '# 标题\n\n![缺失](images/missing.png)');
    await assert.rejects(execute(process.execPath, [command, markdown, '--title', '标题', '-o', join(directory, 'invalid.sdc')]));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('does not resolve image examples inside fenced code', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sdc-code-'));
  const markdown = join(directory, 'example.md');
  const output = join(directory, 'example.sdc');
  const content = '# 示例\n\n```md\n![示例](images/not-a-file.png)\n```';
  try {
    await writeFile(markdown, content);
    await execute(process.execPath, [command, markdown, '--title', '示例', '-o', output]);
    const files = unzipSync(new Uint8Array(await readFile(output)));
    assert.equal(strFromU8(files['document.md']), content);
    assert.deepEqual(JSON.parse(strFromU8(files['images.json'])).images, []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('collects each remote image once and preserves failed URLs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sdc-remote-'));
  const markdown = join(directory, 'remote.md');
  const themePath = join(directory, 'theme.json');
  const output = join(directory, 'remote.sdc');
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/wQAAAABJRU5ErkJggg==', 'base64');
  const requests = new Map();
  const server = createServer((request, response) => {
    requests.set(request.url, (requests.get(request.url) || 0) + 1);
    if (request.url === '/ok.png') {
      response.writeHead(200, { 'Content-Type': 'image/png' });
      response.end(image);
    } else {
      response.writeHead(404);
      response.end();
    }
  });
  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const good = `${origin}/ok.png`;
    const failed = `${origin}/missing%20image.png`;
    await writeFile(markdown, `# 网络图片\n\n![首次](${good})\n\n![重复](${good})\n\n![失败](${failed})`);
    await writeFile(themePath, JSON.stringify({ cover: { logoUrl: good }, header: { logoUrl: failed } }));
    await execute(process.execPath, [command, markdown, '--title', '网络图片', '--theme', themePath, '-o', output]);
    const files = unzipSync(new Uint8Array(await readFile(output)));
    const images = JSON.parse(strFromU8(files['images.json'])).images;
    const text = strFromU8(files['document.md']);
    const theme = JSON.parse(strFromU8(files['theme.json']));
    assert.equal(images.length, 1);
    assert.equal(images[0].mediaType, 'image/png');
    assert.deepEqual(Buffer.from(files[`images/${images[0].id}.png`]), image);
    assert.equal(text.match(new RegExp(`@images/${images[0].id}`, 'g')).length, 2);
    assert.equal(theme.cover.logoUrl, `@images/${images[0].id}`);
    assert.ok(text.includes(failed));
    assert.equal(theme.header.logoUrl, failed);
    assert.equal(requests.get('/ok.png'), 1);
    assert.equal(requests.get('/missing%20image.png'), 1);
    const html = join(directory, 'remote.html');
    await execute(process.execPath, [command, markdown, '--title', '网络图片', '--theme', themePath, '-o', html]);
    const exportedHtml = await readFile(html, 'utf8');
    assert.match(exportedHtml, /data:image\/png;base64,/);
    assert.ok(exportedHtml.includes(failed));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test('requires a title for Markdown without meta and accepts --title', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sdc-title-'));
  const markdown = join(directory, 'draft.md');
  const output = join(directory, 'draft.sdc');
  try {
    await writeFile(markdown, '# 正文标题\n\n内容');
    await assert.rejects(execute(process.execPath, [command, markdown, '-o', output]), /请提供 --title/);
    await execute(process.execPath, [command, markdown, '--title', '指定文档标题', '-o', output]);
    const files = unzipSync(new Uint8Array(await readFile(output)));
    assert.equal(JSON.parse(strFromU8(files['meta.json'])).title, '指定文档标题');
    assert.equal(JSON.parse(strFromU8(files['manifest.json'])).title, '指定文档标题');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('dist runs without the source project or its node_modules', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sdc-standalone-'));
  const skill = join(directory, 'sdc-authoring');
  try {
    await cp(new URL('../dist/', import.meta.url), skill, { recursive: true });
    const executable = join(skill, 'scripts', 'sdc-html.cjs');
    const { stdout } = await execute(process.execPath, [executable, '--help'], { cwd: skill });
    assert.match(stdout, /用法/);
    const markdown = join(directory, 'note.md');
    const output = join(directory, 'note.sdc');
    await writeFile(markdown, '# 内容\n\n独立文档');
    await execute(process.execPath, [executable, markdown, '--title', '独立文档', '-o', output], { cwd: skill });
    assert.equal(JSON.parse(strFromU8(unzipSync(new Uint8Array(await readFile(output)))['meta.json'])).title, '独立文档');
    const html = join(directory, 'note.html');
    await execute(process.execPath, [executable, markdown, '--title', '独立文档', '-o', html], { cwd: skill });
    assert.match(await readFile(html, 'utf8'), /独立文档/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('ignores inline code image examples and collects only actual Markdown images', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sdc-inline-code-'));
  const markdown = join(directory, 'guide.md');
  const output = join(directory, 'guide.sdc');
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/wQAAAABJRU5ErkJggg==', 'base64');
  const content = '# Guide\n\n示例：`![样例](images/chart.png)`；`![带空格](<images/chart 1.png>)`。\n\n![真实图片](images/chart.png)';
  try {
    await mkdir(join(directory, 'images'));
    await writeFile(join(directory, 'images', 'chart.png'), image);
    await writeFile(markdown, content);
    await execute(process.execPath, [command, markdown, '--title', 'Guide', '-o', output]);
    const files = unzipSync(new Uint8Array(await readFile(output)));
    const body = strFromU8(files['document.md']);
    assert.match(body, /`!\[样例\]\(images\/chart\.png\)`/);
    assert.match(body, /`!\[带空格\]\(<images\/chart 1\.png>\)`/);
    assert.match(body, /!\[真实图片\]\(@images\/img-/);
    assert.equal(JSON.parse(strFromU8(files['images.json'])).images.length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});