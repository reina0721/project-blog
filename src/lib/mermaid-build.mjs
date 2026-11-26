import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mermaidTheme } from './mermaid-theme.mjs';

const require = createRequire(import.meta.url);
const mermaidScript = require.resolve('mermaid/dist/mermaid.min.js');
const contentRoot = new URL('../content/', import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 24);

// Astro caches rendered content between builds. Include rendering settings in
// its processor configuration so changing the theme also recompiles the images.
const rendererKey = hash(JSON.stringify([1, require('mermaid/package.json').version, mermaidTheme]));
const pending = new Map();
let browserReady;
let activeRenders = 0;

async function renderSvg(source, id) {
  const ready = browserReady ??= import('playwright-chromium').then(({ chromium }) => chromium.launch());
  activeRenders++;
  let page;
  try {
    page = await (await ready).newPage();
    await page.addScriptTag({ path: mermaidScript });
    return await page.evaluate(async ({ source, id, theme }) => {
      window.mermaid.initialize({
        ...theme, startOnLoad: false, securityLevel: 'strict',
        deterministicIds: true, deterministicIDSeed: id,
      });
      const result = await window.mermaid.render(`diagram-${id}`, source);
      const svg = new DOMParser().parseFromString(result.svg, 'image/svg+xml').documentElement;
      const { width, height } = svg.viewBox.baseVal;
      if (!(width > 0 && height > 0)) throw new Error('Mermaid returned an SVG without a usable viewBox');
      svg.setAttribute('width', String(width));
      svg.setAttribute('height', String(height));
      svg.style.backgroundColor = theme.themeVariables.background;
      return {
        svg: new XMLSerializer().serializeToString(svg),
        width: Math.ceil(width), height: Math.ceil(height),
        title: svg.querySelector(':scope > title')?.textContent?.trim() || 'Mermaid 图表',
        description: svg.querySelector(':scope > desc')?.textContent?.trim(),
      };
    }, { source, id, theme: mermaidTheme });
  } finally {
    // Content collections can compile several documents at once. Share the
    // Chromium process and isolate Mermaid's mutable state in separate pages.
    try {
      await page?.close();
    } finally {
      if (--activeRenders === 0) {
        browserReady = undefined;
        const browser = await ready.catch(() => undefined);
        await browser?.close();
      }
    }
  }
}

// The SVG travels with the compiled Markdown metadata. A clean output
// directory can therefore be rebuilt even when every post is an Astro cache hit.
export const mermaidFigures = {
  name: `mermaid-figures-${rendererKey}`,
  element: {
    filter: ['pre'],
    async visit(node, ctx) {
      if (!ctx.fileURL?.href.startsWith(contentRoot.href)) return;
      const code = node.children.find(child => child.type === 'element' && child.tagName === 'code');
      if (!code?.properties?.className?.includes('language-mermaid')) return;
      const source = ctx.textContent(code).trimEnd();
      const id = hash(`${rendererKey}\0${source}`);
      if (!pending.has(id)) pending.set(id, renderSvg(source, id).finally(() => pending.delete(id)));
      let asset;
      try {
        asset = await pending.get(id);
      } catch (cause) {
        throw new Error(`Failed to render a Mermaid diagram in ${ctx.fileURL.pathname}: ${cause.message}`, { cause });
      }
      const frontmatter = ctx.data.astro.frontmatter;
      (frontmatter.articleDiagramAssets ??= {})[id] = asset.svg;
      const url = `/diagrams/${id}.svg`;
      const properties = {
        className: ['mermaid-diagram'], src: url, alt: asset.title,
        width: asset.width, height: asset.height, decoding: 'async',
      };
      if (asset.description) properties.ariaDescription = asset.description;
      return {
        type: 'element', tagName: 'a',
        properties: { className: ['mermaid-preview'], href: url, ariaLabel: `放大查看，${asset.title}` },
        children: [{ type: 'element', tagName: 'img', properties, children: [] }],
      };
    },
  },
};
