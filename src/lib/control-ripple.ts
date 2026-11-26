import type { MdRipple } from '@material/web/ripple/ripple.js';
import { attachSolidRipple } from './solid-ripple';

// Material Web places the state layer inside the control's exact shape,
// including icon buttons whose touch target is larger than the visible circle.
// Keep that clipping box when switching its renderer.
export async function connectControlRipple(host: HTMLElement, trigger: HTMLElement) {
  if (host.hasAttribute('data-archive-ripple')) return;
  const boundary = (host.shadowRoot || host).querySelector<MdRipple>('md-ripple');
  if (!boundary) return;
  await boundary.updateComplete;
  const root = boundary.shadowRoot;
  if (!root || root.querySelector('.solid-ripple-layer')) return;

  const layer = document.createElement('span');
  layer.className = 'solid-ripple-layer';
  Object.assign(layer.style, {
    position: 'absolute', inset: '0', overflow: 'hidden',
    borderRadius: 'inherit', pointerEvents: 'none', transition: 'background-color 15ms linear',
  });
  root.append(layer);
  try {
    await attachSolidRipple(layer, trigger);
  } catch (error) {
    // The destination remains a usable link even if this optional bundle fails.
    layer.remove();
    console.error('Could not load the Material press indicator.', error);
    return;
  } finally {
    // Solid locations must never paint the archive's gradient, including
    // when a cached HTML page can no longer load its versioned script.
    boundary.detach();
  }

  // Hover is independent of press. Use the control's Material hover tokens,
  // including zero opacity for article links.
  const hover = 'color-mix(in srgb, var(--md-ripple-hover-color, var(--md-sys-color-on-surface)) calc(100% * var(--md-ripple-hover-opacity, .08)), transparent)';
  trigger.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'touch') layer.style.backgroundColor = hover;
  });
  trigger.addEventListener('pointerleave', () => layer.style.removeProperty('background-color'));
}
