import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { angularRipple } from './src/lib/angular-ripple-build.mjs';
import { mermaidFigures } from './src/lib/mermaid-build.mjs';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  markdown: {
    syntaxHighlight: { type: 'shiki', excludeLangs: ['math', 'mermaid'] },
    processor: satteri({ hastPlugins: [mermaidFigures] }),
  },
  vite: { plugins: [angularRipple()] },
});
