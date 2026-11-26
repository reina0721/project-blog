import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { angularRipple } from './src/lib/angular-ripple-build.mjs';
import { createMermaidFigures } from './src/lib/mermaid-build.mjs';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  markdown: {
    syntaxHighlight: { type: 'shiki', excludeLangs: ['math', 'mermaid'] },
  },
  integrations: [{
    name: 'mermaid-figures',
    hooks: {
      'astro:config:setup': async ({ command, updateConfig }) => {
        const mode = process.env.BLOG_GENERATE_MERMAID === '1' ? 'generate' :
          command === 'dev' ? 'dev' : 'prebuilt';
        const figures = await createMermaidFigures(mode);
        updateConfig({ markdown: { processor: satteri({ hastPlugins: [figures] }) } });
      },
    },
  }],
  vite: { plugins: [angularRipple()] },
});
