import materialStyles from './angular-ripple.scss?inline';

type StartWave = ReturnType<typeof import('./angular-ripple-engine').createInk>;

const installations = new WeakMap<HTMLElement, Promise<void>>();
const styled = new WeakSet<Document | ShadowRoot>();
let sheet: CSSStyleSheet | undefined;

function installStyles(root: Document | ShadowRoot) {
  if (styled.has(root)) return;
  if (typeof CSSStyleSheet !== 'undefined' && typeof CSSStyleSheet.prototype.replaceSync === 'function' && 'adoptedStyleSheets' in root) {
    sheet ??= new CSSStyleSheet();
    if (!sheet.cssRules.length) sheet.replaceSync(materialStyles);
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  } else {
    const style = document.createElement('style');
    style.textContent = materialStyles;
    (root instanceof Document ? root.head : root).append(style);
  }
  styled.add(root);
}

function listen(trigger: HTMLElement, layer: HTMLElement, start: StartWave) {
  trigger.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || trigger.matches(':disabled, [aria-disabled="true"]')) return;
    const { clientX: x, clientY: y, pointerId, pointerType } = event;
    const touch = pointerType === 'touch';
    const events = new AbortController();
    const options = { capture: true, passive: true, signal: events.signal };
    let release: ReturnType<StartWave> | undefined;
    let pending: number | undefined;
    const show = () => { release = start(x, y, true); };
    const finish = (cancelled: boolean) => {
      events.abort();
      window.clearTimeout(pending);
      if (release) release(cancelled);
      else if (!cancelled) start(x, y, false);
    };
    const cancel = () => finish(true);
    window.addEventListener('pointerup', up => { if (up.pointerId === pointerId) finish(false); }, options);
    window.addEventListener('pointercancel', next => { if (next.pointerId === pointerId) cancel(); }, options);
    window.addEventListener('blur', cancel, { signal: events.signal });
    window.addEventListener('pagehide', cancel, options);
    if (touch) {
      // Let a touch turn into scrolling without painting a tap or cancelling
      // the browser's gesture. A short tap is painted on release.
      window.addEventListener('pointermove', next => {
        if (next.pointerId === pointerId && Math.hypot(next.clientX - x, next.clientY - y) > 10) cancel();
      }, options);
      document.addEventListener('scroll', cancel, options);
      pending = window.setTimeout(show, 80);
    } else {
      trigger.addEventListener('pointerleave', next => { if (next.pointerId === pointerId) cancel(); }, { signal: events.signal });
      show();
    }
  }, { passive: true });

  // Native links fire a zero-detail click on Enter. This also handles
  // assistive activation without adding a second wave to a pointer click.
  trigger.addEventListener('click', event => {
    if (event.detail !== 0 || trigger.matches(':disabled, [aria-disabled="true"]')) return;
    const rect = layer.getBoundingClientRect();
    start(rect.left + rect.width / 2, rect.top + rect.height / 2, false);
  }, { passive: true });
}

/** Resolves once the official renderer is listening. The caller can then
 * detach its previous pressed state. A failed installation can be retried. */
export function attachSolidRipple(layer: HTMLElement, trigger: HTMLElement): Promise<void> {
  const current = installations.get(layer);
  if (current) return current;
  const ready = import('./angular-ripple-engine').then(({ createInk }) => {
    const root = layer.getRootNode();
    if (!(root instanceof Document || root instanceof ShadowRoot)) throw new Error('Attach the ripple layer first.');
    installStyles(root);
    layer.classList.add('mat-ripple');
    listen(trigger, layer, createInk(layer));
  }).catch(error => {
    installations.delete(layer);
    throw error;
  });
  installations.set(layer, ready);
  return ready;
}
