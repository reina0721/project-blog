import '@material/web/labs/card/elevated-card.js';
import '@material/web/list/list.js';
import '@material/web/list/list-item.js';
import { connectControlRipple } from './control-ripple';

// Only the compact chronological lists use Material's roving focus. Independent
// article cards and destinations in a wrapping directory keep ordinary Tab order.
function upgradeArchive(list: HTMLUListElement) {
  if (!list.isConnected || list.matches(':focus-within') || list.querySelector('a[data-reading-entry]')) return;
  const rows = Array.from(list.children);
  if (!rows.length || rows.some(row => !row.querySelector(':scope > md-list-item'))) return;
  const materialList = document.createElement('md-list');
  for (const attr of list.attributes) materialList.setAttribute(attr.name, attr.value);
  for (const row of rows) {
    // Material's ListController accepts a slotted wrapper exposing its item.
    Object.assign(row, { item: row.querySelector('md-list-item') });
    row.setAttribute('role', 'listitem');
    materialList.append(row);
  }
  list.replaceWith(materialList);
}

async function enhance(link: HTMLAnchorElement) {
  const layout = link.querySelector('.entry-fallback');
  if (!layout || !link.isConnected) return;
  const item = document.createElement('md-list-item');
  item.type = 'link';
  item.setAttribute('href', link.getAttribute('href')!);
  if (link.target) item.setAttribute('target', link.target);
  item.inert = true;
  item.setAttribute('data-entry-preparing', '');
  link.after(item);
  await item.updateComplete;
  const native = item.shadowRoot?.querySelector('a');
  if (!native || !link.isConnected) {
    item.remove();
    return;
  }
  item.toggleAttribute('data-archive-ripple', link.hasAttribute('data-archive-ripple'));
  await connectControlRipple(item, native);
  // The 2.5 component applies role=listitem to its internal anchor. Our outer
  // list already owns that structure; expose the native link as a link.
  native.removeAttribute('role');
  for (const name of ['aria-label', 'target', 'rel', 'download', 'referrerpolicy', 'hreflang', 'ping']) {
    if (link.hasAttribute(name)) native.setAttribute(name, link.getAttribute(name)!);
  }
  const ring = item.shadowRoot?.querySelector('md-focus-ring');
  ring?.addEventListener('visibility-changed', () => item.toggleAttribute('data-focus-visible', ring.visible));

  function commit() {
    if (!link.isConnected) return;
    if (link === document.activeElement) {
      link.addEventListener('blur', () => queueMicrotask(commit), { once: true });
      return;
    }
    if (link.matches(':active') || link.hasAttribute('data-pressed')) {
      const controller = new AbortController();
      const resume = () => {
        controller.abort();
        requestAnimationFrame(commit);
      };
      for (const event of ['pointerup', 'pointercancel', 'blur', 'pageshow']) {
        window.addEventListener(event, resume, { capture: true, signal: controller.signal });
      }
      return;
    }
    const list = link.closest<HTMLUListElement>('ul[data-material-list]');
    for (const attr of link.attributes) {
      if (attr.name !== 'aria-label') item.setAttribute(attr.name, attr.value);
    }
    item.append(...Array.from(layout!.children));
    link.remove();
    item.inert = false;
    item.removeAttribute('data-entry-preparing');
    if (list) {
      if (list.matches(':focus-within')) list.addEventListener('focusout', () => queueMicrotask(() => upgradeArchive(list)));
      else upgradeArchive(list);
    }
  }
  commit();
}
for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[data-reading-entry]')) void enhance(anchor);
