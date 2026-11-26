import {
  navigate, supportsViewTransitions, transitionEnabledOnThisPage,
  type Direction, type TransitionBeforeSwapEvent,
} from 'astro:transitions/client';
import {
  afterReadingSwap, beforeReadingSwap, initReading, isReadingReturning,
  prepareReading, readingOriginSlug, returnToReadingOrigin,
} from './reading-origin';

interface RouteMotion {
  from: URL;
  to: URL;
  kind: 'section' | 'article' | 'chapter' | 'home-blog';
  direction: Direction;
  wasReading: boolean;
  willRead: boolean;
  title?: { slug: string; x: number; y: number; font: number };
}

const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const nativeLinkAttributes = '[data-astro-reload],[download],[ping],[referrerpolicy],[attributionsrc],[rel~="noreferrer"]';
const path = (url: URL) => url.pathname.replace(/\/+$/, '') || '/';
const isIndex = (url: URL) => ['/', '/blog', '/archive'].includes(path(url));
const slugPath = (slug: string) => '/blog/' + slug.split('/').map(encodeURIComponent).join('/');
const tabs = () => Array.from(document.querySelectorAll<HTMLAnchorElement>('.main-nav a[href]'));

function signal(name: string, detail?: unknown) {
  document.dispatchEvent(new CustomEvent('blue:route-' + name, { detail }));
}

function samePage(from: URL, to: URL) {
  return from.origin === to.origin && path(from) === path(to) && from.search === to.search;
}

function sectionIndex(url: URL) {
  const target = path(url).startsWith('/blog/') ? '/blog' : path(url);
  return tabs().findIndex(tab => path(new URL(tab.href)) === target);
}

function routeMotion(from: URL, to: URL, incoming: Document, hint?: Direction): RouteMotion | undefined {
  if (samePage(from, to)) return;
  const wasReading = !!document.querySelector('.site-leading[data-leading="back"]');
  const willRead = !!incoming.querySelector('.site-leading[data-leading="back"]');
  let kind: RouteMotion['kind'] = 'section';
  let direction = hint || (sectionIndex(to) < sectionIndex(from) ? 'back' : 'forward');
  if ((isIndex(from) && willRead) || (wasReading && isIndex(to))) {
    kind = 'article';
    direction = willRead ? 'forward' : 'back';
  } else if (path(from) === '/' && path(to) === '/blog') {
    kind = 'home-blog';
  } else if (wasReading && willRead) {
    kind = 'chapter';
    const adjacent = Array.from(document.querySelectorAll('.notes-adjacent [rel][href]'))
      .find(link => samePage(new URL(link.getAttribute('href')!, from), to));
    const rel = adjacent?.getAttribute('rel');
    if (rel === 'prev' || rel === 'next') direction = rel === 'next' ? 'forward' : 'back';
  }
  return { from, to, kind, direction, wasReading, willRead };
}

function measureTitle(node?: HTMLElement) {
  if (!node?.dataset.articleSlug) return;
  const rect = node.getBoundingClientRect();
  if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= innerHeight) return;
  return { slug: node.dataset.articleSlug, x: rect.left, y: rect.top, font: parseFloat(getComputedStyle(node).fontSize) };
}

function selectedTitle(info: RouteMotion, stage: 'leave' | 'enter') {
  if (info.kind !== 'article') return;
  const articleURL = info.willRead ? info.to : info.from;
  const node = Array.from(document.querySelectorAll<HTMLElement>('[data-article-slug]'))
    .find(el => slugPath(el.dataset.articleSlug!) === path(articleURL));
  if (!node) return;
  const restored = document.querySelector<HTMLElement>('[data-reading-return] [data-article-slug]');
  if (restored && restored.dataset.articleSlug !== node.dataset.articleSlug) return;
  const originSlug = readingOriginSlug();
  if (stage === 'leave' && info.wasReading && originSlug && originSlug !== node.dataset.articleSlug) return;
  return measureTitle(node) ? node : undefined;
}

let groups: HTMLElement[] = [];
let groupTimer: number | undefined;
let finishTimer: number | undefined;
let currentTitle: HTMLElement | undefined;
let previousLeading: Element | undefined;
let currentMotion: RouteMotion | undefined;

function clearGroups() {
  clearTimeout(groupTimer);
  for (const node of groups) {
    delete node.dataset.groupOrder;
    node.style.removeProperty('--entry-wait');
    node.style.removeProperty('--entry-lead');
  }
  groups = [];
}

function enterGroups(title?: HTMLElement, lead = 0) {
  clearGroups();
  if (reduced.matches || location.hash || isReadingReturning()) return;
  for (const node of document.querySelectorAll<HTMLElement>('#main [data-enter-group]')) {
    const rect = node.getBoundingClientRect();
    if (node.contains(title ?? null) || !rect.height || rect.bottom <= 0 || rect.top >= innerHeight) continue;
    node.style.setProperty('--entry-wait', `${groups.length * 60}ms`);
    node.style.setProperty('--entry-lead', `${lead}ms`);
    node.dataset.groupOrder = String(groups.length);
    groups.push(node);
    if (groups.length === 4) break;
  }
  if (groups.length) groupTimer = window.setTimeout(clearGroups, 740);
}

function clearScene() {
  clearTimeout(finishTimer);
  for (const key of ['pageMotion', 'motionStage', 'motionDirection', 'motionDriver', 'motionMarker', 'motionLeading']) {
    delete root.dataset[key];
  }
  for (const key of ['--motion-header-edge', '--motion-pane-clip']) root.style.removeProperty(key);
  if (currentTitle) {
    delete currentTitle.dataset.motionSelected;
    for (const key of ['--selected-title-name', '--title-x', '--title-y', '--title-scale']) currentTitle.style.removeProperty(key);
  }
  previousLeading?.remove();
  previousLeading = currentTitle = currentMotion = undefined;
}

function setScene(info: RouteMotion, stage: 'leave' | 'enter', mode: 'native' | 'css') {
  clearScene();
  currentMotion = info;
  root.dataset.pageMotion = info.kind;
  root.dataset.motionStage = stage;
  root.dataset.motionDriver = mode;
  root.dataset.motionDirection = info.direction;
  const slot = document.querySelector('.site-leading');
  const slotBox = slot?.getBoundingClientRect();
  if (info.wasReading !== info.willRead && slotBox?.height && slotBox.bottom > 0 && slotBox.top < innerHeight) {
    root.dataset.motionLeading = info.willRead ? 'open' : 'close';
    if (mode === 'css' && stage === 'enter') {
      const template = slot?.querySelector<HTMLTemplateElement>('template[data-leading-previous]');
      previousLeading = template?.content.firstElementChild?.cloneNode(true) as Element | undefined;
      if (previousLeading) slot?.append(previousLeading);
    }
  }
  const navBar = document.querySelector('.main-nav');
  if (navBar?.getClientRects().length && sectionIndex(info.from) !== sectionIndex(info.to) &&
      navBar.querySelector('[aria-current="page"] .nav-marker')) root.dataset.motionMarker = '';
  const headerEdge = Math.max(0, document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0);
  const mainTop = document.getElementById('main')?.getBoundingClientRect().top || 0;
  root.style.setProperty('--motion-header-edge', `${headerEdge}px`);
  root.style.setProperty('--motion-pane-clip', `${Math.max(0, headerEdge - mainTop)}px`);
  const node = selectedTitle(info, stage);
  if (node && (stage === 'leave' || node.dataset.articleSlug === info.title?.slug)) {
    currentTitle = node;
    node.style.setProperty('--selected-title-name', CSS.escape('a-title-' + node.dataset.articleSlug));
    if (mode === 'css' && info.title) {
      const rect = node.getBoundingClientRect();
      node.style.setProperty('--title-x', `${info.title.x - rect.left}px`);
      node.style.setProperty('--title-y', `${info.title.y - rect.top}px`);
      node.style.setProperty('--title-scale', String(info.title.font / parseFloat(getComputedStyle(node).fontSize)));
    }
    node.dataset.motionSelected = '';
  }
  if (stage === 'enter') enterGroups(currentTitle, mode === 'native' ? 90 : 0);
}

function cssArrival(info: RouteMotion) {
  setScene(info, 'enter', 'css');
  finishTimer = window.setTimeout(clearScene, 620);
}

function rippleWait(link: HTMLElement) {
  const tree = (link.shadowRoot || link).querySelector('md-ripple')?.shadowRoot;
  const solid = tree?.querySelector('.mat-ripple-element:last-child');
  const animation = solid
    ? solid.getAnimations().find(animation => 'transitionProperty' in animation && animation.transitionProperty === 'transform')
    : tree?.getAnimations().find(({ effect }) => effect instanceof KeyframeEffect &&
        effect.pseudoElement === '::after' && effect.getKeyframes().some(frame => frame.transform));
  return animation && animation.playState !== 'finished' ? Math.max(0, 105 - Number(animation.currentTime || 0)) : 0;
}

function waitForPress(link: HTMLElement, abort: AbortSignal) {
  const delay = reduced.matches ? 0 : rippleWait(link);
  if (!delay || abort.aborted) return;
  return new Promise<void>(resolve => {
    const finish = () => {
      clearTimeout(timer);
      abort.removeEventListener('abort', finish);
      resolve();
    };
    const timer = window.setTimeout(finish, delay);
    abort.addEventListener('abort', finish, { once: true });
  });
}

document.addEventListener('click', event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
      !transitionEnabledOnThisPage()) return;
  const elements = event.composedPath().filter(node => node instanceof Element);
  const anchor = elements.find(node => node.matches('a[href],area[href]'));
  const action = elements.find(node => node instanceof HTMLElement && node.matches('.action-link[href]'));
  const link = action || anchor;
  if (!link) return;
  const target = link.getAttribute('target') || document.querySelector('base[target]')?.getAttribute('target');
  if (link.matches(nativeLinkAttributes) || anchor?.matches(nativeLinkAttributes) || (target && target.trim().toLowerCase() !== '_self')) {
    // Astro inspects the actual anchor, which may be in a Material shadow root.
    anchor?.setAttribute('data-astro-reload', '');
    return;
  }
  let url: URL;
  try { url = new URL(link.getAttribute('href')!, document.baseURI); } catch { return; }
  if (url.origin !== location.origin || url.protocol !== location.protocol) return;
  const currentPage = samePage(new URL(location.href), url);
  if (currentPage && !url.hash) {
    event.preventDefault();
    signal('leave', { link });
    return;
  }
  if (!action && !currentPage) return;

  // Slotted Material content need not have its anchor in its light DOM ancestry.
  // Claim the click before Astro's delegated handler and let the press run first.
  event.preventDefault();
  queueMicrotask(() => {
    if (!link.isConnected) return;
    const keyboard = event.detail === 0;
    if (returnToReadingOrigin(link, keyboard)) return;
    const mode = link.getAttribute('data-astro-history');
    const history = mode === 'replace' || mode === 'push' ? mode : 'auto';
    void navigate(url.href, { history, sourceElement: link, state: prepareReading(link, url, keyboard) });
  });
}, { capture: true });

interface PreparedRoute {
  stopWatching: () => void;
  motion?: RouteMotion;
}

const preparations = new WeakMap<AbortSignal, PreparedRoute>();
let arriving: { event: TransitionBeforeSwapEvent; motion?: RouteMotion } | undefined;

document.addEventListener('astro:before-preparation', event => {
  const link = event.sourceElement instanceof HTMLElement ? event.sourceElement : undefined;
  const tab = tabs()[sectionIndex(event.to)];
  if (!reduced.matches && tab && !tab.hasAttribute('aria-current')) tab.dataset.navPending = '';
  const prepared: PreparedRoute = {
    stopWatching() {
      if (tab) delete tab.dataset.navPending;
      event.signal.removeEventListener('abort', cancel);
    },
  };
  const cancel = () => {
    prepared.stopWatching();
    if (prepared.motion && currentMotion === prepared.motion && root.dataset.motionStage === 'leave') clearScene();
    signal('cancel');
  };
  preparations.set(event.signal, prepared);
  event.signal.addEventListener('abort', cancel, { once: true });

  const waitForDrawer: Promise<unknown>[] = [];
  if (link) signal('leave', { link, waitUntil: (promise: Promise<unknown>) => waitForDrawer.push(promise) });
  const load = event.loader;
  event.loader = async () => {
    await Promise.all([load(), Promise.allSettled(waitForDrawer), link && waitForPress(link, event.signal)]);
    if (event.signal.aborted) return;
    if (event.defaultPrevented) { cancel(); return; }

    signal('snapshot');
    clearGroups();
    const direction = link?.dataset.direction;
    const hint = direction === 'back' || direction === 'forward' ? direction :
      event.navigationType === 'traverse' ? (event.direction === 'back' ? 'back' : 'forward') : undefined;
    const motion = routeMotion(event.from, event.to, event.newDocument, hint);
    if (motion && !reduced.matches) {
      prepared.motion = motion;
      motion.title = measureTitle(selectedTitle(motion, 'leave'));
      if (supportsViewTransitions) setScene(motion, 'leave', 'native');
    }
  };
});

document.addEventListener('astro:before-swap', event => {
  beforeReadingSwap(event);
  const prepared = preparations.get(event.signal);
  prepared?.stopWatching();
  preparations.delete(event.signal);
  const motion = reduced.matches ? undefined : prepared?.motion;
  arriving = { event, motion };
  if (!motion) {
    void event.viewTransition.ready.catch(() => {});
    event.viewTransition.skipTransition();
  }
});

function markHomeRestored(restoring: boolean) {
  root.toggleAttribute('data-home-restored', document.body.dataset.section === 'home' && restoring);
}

document.addEventListener('astro:after-swap', () => {
  if (!arriving) return;
  const { event, motion } = arriving;
  arriving = undefined;
  afterReadingSwap(event);
  markHomeRestored(!!event.to.hash || event.navigationType === 'traverse' || isReadingReturning());
  if (!motion) { clearScene(); enterGroups(); return; }
  const transition = event.viewTransition;
  if (typeof ViewTransition === 'undefined' || !(transition instanceof ViewTransition)) {
    cssArrival(motion);
    return;
  }
  setScene(motion, 'enter', 'native');
  void transition.ready.catch(() => {
    if (currentMotion === motion && !event.signal.aborted && document.visibilityState === 'visible') cssArrival(motion);
  });
  const cleanup = () => {
    if (currentMotion === motion && root.dataset.motionDriver === 'native') clearScene();
  };
  void transition.finished.then(cleanup, cleanup);
});

window.addEventListener('pagehide', () => { clearGroups(); clearScene(); });
window.addEventListener('pageshow', event => { if (event.persisted) markHomeRestored(true); });
reduced.addEventListener('change', event => {
  if (event.matches) { clearGroups(); clearScene(); }
});

initReading();
const visit = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
markHomeRestored(!!location.hash || visit?.type === 'back_forward');
enterGroups();
