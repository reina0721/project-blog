import '@material/web/button/filled-tonal-button.js';
import '@material/web/button/text-button.js';
import '@material/web/iconbutton/icon-button.js';
import { connectControlRipple } from './control-ripple';

const tagNames = {
  tonal: 'md-filled-tonal-button',
  text: 'md-text-button',
  icon: 'md-icon-button',
} as const;
const preparedLinks = new WeakSet<HTMLAnchorElement>();

function resumeAfterInteraction(link: HTMLAnchorElement) {
  if (document.activeElement === link) {
    link.addEventListener('blur', () => void upgradeLink(link), { once: true });
    return;
  }
  const controller = new AbortController();
  const resume = () => {
    controller.abort();
    requestAnimationFrame(() => void upgradeLink(link));
  };
  document.addEventListener('astro:before-swap', () => controller.abort(), { once: true, signal: controller.signal });
  for (const event of ['pointerup', 'pointercancel', 'blur', 'pagehide']) {
    window.addEventListener(event, resume, { capture: true, signal: controller.signal });
  }
}

async function upgradeLink(link: HTMLAnchorElement) {
  const kind = link.dataset.mdControl as keyof typeof tagNames;
  const tag = tagNames[kind];
  if (!tag || !link.isConnected) return;

  // Keep the native link visible, focusable and fully functional until the
  // library has rendered its own native link in the shadow root.
  const control = document.createElement(tag);
  control.setAttribute('data-md-preparing', '');
  control.inert = true;
  control.setAttribute('href', link.getAttribute('href')!);
  if (link.hasAttribute('aria-label')) control.setAttribute('aria-label', link.getAttribute('aria-label')!);
  if (link.target) control.setAttribute('target', link.target);
  link.after(control);
  await control.updateComplete;
  const native = control.shadowRoot?.querySelector('a');
  if (!native || !link.isConnected) {
    control.remove();
    return;
  }
  await connectControlRipple(control, native);
  if (!link.isConnected) {
    control.remove();
    return;
  }

  // A visitor may already be using the fallback while the bundle loads.
  if (link === document.activeElement || link.matches(':active') || link.hasAttribute('data-pressed')) {
    control.remove();
    resumeAfterInteraction(link);
    return;
  }

  // The focused anchor lives in the shadow tree. Reuse the official focus
  // ring's keyboard-visible state for the light-DOM icon, cue and tooltip.
  const focusRing = control.shadowRoot?.querySelector('md-focus-ring');
  focusRing?.addEventListener('visibility-changed', () => {
    control.toggleAttribute('data-focus-visible', focusRing.visible);
  });

  const icon = Array.from(link.children).find(child => child.matches('svg, [data-md-icon]'));
  if (kind !== 'icon' && icon) {
    icon.slot = 'icon';
    if (icon !== link.firstElementChild) control.setAttribute('trailing-icon', '');
  }
  for (const attribute of link.attributes) control.setAttribute(attribute.name, attribute.value);
  // These native anchor attributes are not all forwarded by Material Web.
  for (const name of ['download', 'target', 'rel', 'hreflang', 'referrerpolicy', 'ping', 'attributionsrc', 'type', 'aria-current', 'data-astro-reload', 'data-astro-history']) {
    if (link.hasAttribute(name)) native.setAttribute(name, link.getAttribute(name)!);
  }
  control.append(...Array.from(link.childNodes));
  link.remove();
  control.inert = false;
  control.removeAttribute('data-md-preparing');
}

function enhanceControls() {
  for (const link of document.querySelectorAll<HTMLAnchorElement>('a[data-md-control]')) {
    if (preparedLinks.has(link)) continue;
    preparedLinks.add(link);
    void upgradeLink(link);
  }

  for (const link of document.querySelectorAll<HTMLAnchorElement>('a.action-link:has(> md-ripple)')) {
    void connectControlRipple(link, link);
  }
}

document.addEventListener('astro:page-load', enhanceControls);
enhanceControls();
