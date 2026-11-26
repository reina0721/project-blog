import { defineConfig } from 'astro/config';
import { angularRipple } from './src/lib/angular-ripple-build.mjs';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  vite: { plugins: [angularRipple()] },
});
