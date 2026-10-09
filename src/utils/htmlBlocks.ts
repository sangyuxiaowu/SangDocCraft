import DOMPurify from 'dompurify';
import { generate, parse, walk, type CssNode, type Declaration } from 'css-tree';
import { marked } from 'marked';

marked.use({
  extensions: [{
    name: 'sdcHtml',
    level: 'block',
    start(source) { return source.search(/^ {0,3}<section\b[^>]*\bdata-sdc-html(?:\s|=|>)/im); },
    tokenizer(source) {
      if (!/^ {0,3}<section\b[^>]*\bdata-sdc-html(?:\s|=|>)/i.test(source)) return;
      const tags = /<!--[\s\S]*?-->|<(?:style|script)\b[^>]*>[\s\S]*?<\/(?:style|script)\s*>|<\/?section\b(?:"[^"]*"|'[^']*'|[^'">])*\s*>/gi;
      let depth = 0;
      for (const match of source.matchAll(tags)) {
        if (!/^<\/?section\b/i.test(match[0])) continue;
        depth += /^<\//.test(match[0]) ? -1 : 1;
        if (depth === 0) return { type: 'sdcHtml', raw: source.slice(0, match.index! + match[0].length) };
      }
    },
    renderer(token) { return token.raw; },
  }],
});

function safeDeclarations(node: CssNode): string {
  const declarations: string[] = [];
  walk(node, {
    visit: 'Declaration',
    enter(declaration: Declaration) {
      const property = declaration.property.toLowerCase();
      const value = generate(declaration.value);
      // 这里允许 position 相关的属性通过安全检查，方便样式调整，和伪元素的使用
      if (/^(?:-(?:webkit|moz|ms|o)-)?(?:animation|transition)(?:-|$)/.test(property)
        || /^(?:behavior|-moz-binding|z-index)$/.test(property)) return;
      let unsafe = false;
      walk(declaration.value, (part) => {
        if (part.type === 'Url' || part.type === 'Raw'
          || part.type === 'Function' && /^(?:url|expression|(?:-webkit-)?image-set)$/i.test(part.name)) unsafe = true;
      });
      if (!unsafe) declarations.push(generate(declaration));
    },
  });
  return declarations.join(';');
}

export function compileScopedCss(css: string, scope: string): string {
  try {
    const ast = parse(css, { context: 'stylesheet' });
    const prefix = `[data-sdc-scope="${scope}"]`;
    const render = (node: CssNode): string => {
      if (node.type === 'StyleSheet' || node.type === 'Block') return node.children.toArray().map(render).join('\n');
      if (node.type === 'Atrule' && /^(?:media|supports)$/i.test(node.name) && node.block && node.prelude) {
        return `@${node.name} ${generate(node.prelude)} {${render(node.block)}}`;
      }
      if (node.type !== 'Rule' || node.prelude.type !== 'SelectorList') return '';
      if (node.block.children.toArray().some(child => child.type !== 'Declaration')) return '';
      const declarations = safeDeclarations(node.block);
      if (!declarations) return '';
      const selectors = node.prelude.children.toArray().map(selector => {
        const text = generate(selector);
        return text === ':scope' ? prefix : `${prefix} ${text}`;
      });
      return `${selectors.join(',')} {${declarations}}`;
    };
    return render(ast);
  } catch {
    return '';
  }
}

export function sanitizeDocumentHtml(html: string): string {
  if (typeof document === 'undefined') return '';
  const comments: string[] = [];
  const protectedHtml = html.replace(/<!--[\s\S]*?-->/g, comment => {
    const index = comments.push(comment) - 1;
    return `<span data-sdc-comment="${index}"></span>`;
  });
  const fragment = DOMPurify.sanitize(protectedHtml, {
    RETURN_DOM_FRAGMENT: true,
    ADD_TAGS: ['style', 'mjx-container', 'use'],
    ADD_ATTR: ['jax', 'display'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'input', 'button', 'textarea', 'select', 'animate', 'animateMotion', 'animateTransform', 'set', 'foreignObject'],
    FORBID_ATTR: ['srcdoc', 'autofocus'],
  });
  fragment.querySelectorAll('use').forEach(element => {
    const references = [element.getAttribute('href'), element.getAttribute('xlink:href')]
      .filter((reference): reference is string => reference !== null);
    if (element.namespaceURI !== 'http://www.w3.org/2000/svg' || !element.closest('svg')
      || references.length === 0 || references.some(reference => !/^#[^\s]+$/.test(reference))) {
      element.remove();
    }
  });
  fragment.querySelectorAll('[data-sdc-comment]').forEach(element => {
    const comment = comments[Number(element.getAttribute('data-sdc-comment'))];
    element.replaceWith(document.createComment(comment ? comment.slice(4, -3) : ''));
  });
  fragment.querySelectorAll('[data-sdc-scope]').forEach(element => element.removeAttribute('data-sdc-scope'));
  const scopes = new Map<Element, string>();
  fragment.querySelectorAll('section').forEach(section => {
    const scope = `sdc-${crypto.randomUUID()}`;
    scopes.set(section, scope);
    section.setAttribute('data-sdc-scope', scope);
    if (section.hasAttribute('data-sdc-html')) {
      section.setAttribute('style', `${section.getAttribute('style') || ''};display:flow-root!important;break-inside:avoid!important;page-break-inside:avoid!important;max-width:100%!important`);
    }
  });
  fragment.querySelectorAll('style').forEach(style => {
    const section = style.closest('section');
    const scope = section && scopes.get(section);
    if (!scope) { style.remove(); return; }
    style.textContent = compileScopedCss(style.textContent || '', scope);
    style.removeAttribute('media');
  });
  fragment.querySelectorAll<HTMLElement>('[style]').forEach(element => {
    try { element.setAttribute('style', safeDeclarations(parse(element.getAttribute('style') || '', { context: 'declarationList' }))); }
    catch { element.removeAttribute('style'); }
  });
  const container = document.createElement('div');
  container.append(fragment);
  return container.innerHTML;
}

export function transformMarkdownHeadings(html: string, transform: (heading: HTMLHeadingElement) => void): string {
  const container = document.createElement('div');
  container.innerHTML = html;
  container.querySelectorAll<HTMLHeadingElement>('h1,h2,h3,h4,h5,h6').forEach(heading => {
    if (!heading.closest('section[data-sdc-html]')) transform(heading);
  });
  return container.innerHTML;
}