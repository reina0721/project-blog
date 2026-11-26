import { fileURLToPath } from 'node:url';
import { normalizePath } from 'vite';

const entry = normalizePath(fileURLToPath(new URL('./angular-ripple-engine.ts', import.meta.url)));

// Angular packages publish partially compiled declarations. Link the one
// browser entry ahead of time in both dev and production. The Angular
// compiler, Babel and this plugin never enter the client bundle.
export function angularRipple() {
  let output;
  return {
    name: 'angular-material-ripple',
    enforce: 'pre',
    load(id) {
      if (normalizePath(id.split('?')[0]) !== entry) return;
      return output ??= linkRenderer().catch(error => {
        output = undefined;
        throw error;
      });
    },
    watchChange(id) {
      if (normalizePath(id) === entry) output = undefined;
    },
  };
}

async function linkRenderer() {
  const [{ rolldown }, { transformAsync }, { default: linker }] = await Promise.all([
    import('rolldown'), import('@babel/core'), import('@angular/compiler-cli/linker/babel'),
  ]);
  const bundle = await rolldown({
    input: entry,
    platform: 'browser',
    transform: { define: { ngDevMode: 'false', ngJitMode: 'false', ngI18nClosureMode: 'false' } },
    plugins: [{
      name: 'angular-partial-declarations',
      async transform(code, id) {
        if (!code.includes('ɵɵngDeclare') || !normalizePath(id).includes('/node_modules/@angular/')) return;
        const result = await transformAsync(code, {
          filename: id, configFile: false, babelrc: false, compact: true, plugins: [linker],
        });
        return result.code;
      },
    }],
  });
  try {
    const result = await bundle.generate({ format: 'es', minify: true });
    return result.output[0].code;
  } finally {
    await bundle.close();
  }
}
