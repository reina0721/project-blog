const header = () => document.querySelector<HTMLElement>('.site-header');
const root = document.documentElement;
let extremum = scrollY;
let anchorTimer: number | undefined;
let route: AbortSignal | undefined;

function scrollPosition() {
  const page = document.scrollingElement!;
  return Math.max(0, Math.min(scrollY, page.scrollHeight - page.clientHeight));
}

function rebase() {
  extremum = scrollPosition();
}

export function headerIsHidden() {
  return header()?.hasAttribute('data-scroll-hidden') ?? false;
}

export function restoreHeaderVisibility(hidden: boolean) {
  const bar = header();
  rebase();
  if (!bar) return;
  const shouldHide = hidden && extremum >= Math.max(350, bar.offsetHeight);
  if (bar.hasAttribute('data-scroll-hidden') === shouldHide) return;
  bar.setAttribute('data-scroll-instant', '');
  bar.toggleAttribute('data-scroll-hidden', shouldHide);
  // Commit the restored position before a route snapshot or keyboard focus paints.
  bar.getBoundingClientRect();
  bar.removeAttribute('data-scroll-instant');
}

function finishAnchorScroll() {
  if (anchorTimer === undefined) return;
  clearTimeout(anchorTimer);
  anchorTimer = undefined;
  rebase();
}

function startAnchorScroll() {
  clearTimeout(anchorTimer);
  // A link already at its destination produces no scrollend event.
  anchorTimer = window.setTimeout(finishAnchorScroll, 1200);
  rebase();
}

function onScroll() {
  const bar = header();
  if (!bar) return;
  const y = scrollPosition();
  if (route || root.matches('[data-motion-stage],[data-restoring-reading],[data-drawer-active],[data-gallery-open]')) {
    extremum = y;
    return;
  }
  const hidden = bar.hasAttribute('data-scroll-hidden');
  const nearTop = y < Math.max(350, bar.offsetHeight);
  if (nearTop && hidden) bar.removeAttribute('data-scroll-hidden');
  if (anchorTimer !== undefined || bar.matches('[data-scroll-keyboard]:focus-within')) {
    extremum = y;
    return;
  }
  if (hidden && !nearTop) {
    extremum = Math.max(extremum, y);
    if (extremum - y < 12) return;
    bar.removeAttribute('data-scroll-hidden');
  } else {
    extremum = Math.min(extremum, y);
    if (nearTop || y - extremum < 16) return;
    bar.setAttribute('data-scroll-hidden', '');
  }
  extremum = y;
}

function bindHeaderSize() {
  size.disconnect();
  const bar = header();
  if (bar) size.observe(bar, { box: 'border-box' });
  rebase();
}

const size = new ResizeObserver(([entry]) => {
  const bar = entry?.target;
  if (!(bar instanceof HTMLElement) || !bar.isConnected) return;
  bar.parentElement?.style.setProperty('--header-height', `${entry.borderBoxSize[0].blockSize}px`);
  if (headerIsHidden() && scrollPosition() < Math.max(350, bar.offsetHeight)) restoreHeaderVisibility(false);
});

document.addEventListener('wheel', finishAnchorScroll, { passive: true });
document.addEventListener('pointerdown', () => {
  finishAnchorScroll();
  header()?.removeAttribute('data-scroll-keyboard');
}, true);
document.addEventListener('keydown', () => {
  finishAnchorScroll();
  header()?.setAttribute('data-scroll-keyboard', '');
}, true);
document.addEventListener('focusin', event => {
  rebase();
  if (event.target instanceof Element && event.target.closest('.site-header[data-scroll-keyboard]')) restoreHeaderVisibility(false);
});
document.addEventListener('click', event => {
  const link = event.composedPath().find(node => node instanceof HTMLAnchorElement);
  if (link?.hash && link.origin === location.origin && link.pathname === location.pathname && link.search === location.search) {
    startAnchorScroll();
  }
}, true);
document.addEventListener('scroll', onScroll, { passive: true });
document.addEventListener('scrollend', finishAnchorScroll);
window.addEventListener('hashchange', startAnchorScroll);
window.addEventListener('resize', rebase);
window.addEventListener('pageshow', () => { route = undefined; rebase(); });
document.addEventListener('astro:before-preparation', event => {
  finishAnchorScroll();
  rebase();
  route = event.signal;
  event.signal.addEventListener('abort', () => {
    if (route === event.signal) route = undefined;
  }, { once: true });
});
document.addEventListener('blue:route-cancel', () => { route = undefined; rebase(); });
document.addEventListener('astro:before-swap', event => {
  const resume = () => {
    if (route === event.signal) { route = undefined; rebase(); }
  };
  void event.viewTransition.finished.then(resume, resume);
});
document.addEventListener('astro:after-swap', bindHeaderSize);
bindHeaderSize();
