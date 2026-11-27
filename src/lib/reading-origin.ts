import type { TransitionBeforeSwapEvent } from 'astro:transitions/client';
import { headerIsHidden, restoreHeaderVisibility } from './header-scroll';

type Route = Pick<TransitionBeforeSwapEvent, 'from' | 'to' | 'navigationType'>;

interface Position {
  scroll: number;
  offset: number;
  width: number;
  height: number;
  keyboard: boolean;
  headerHidden?: boolean;
}

type SourceMark = Position & { slug: string };
type ChapterMark = Position & { to: string };

interface ReadingOrigin {
  id: string;
  href: string;
  index?: number;
  key?: string;
  mark: SourceMark;
}

interface ReadingEntry {
  id: string;
  href: string;
  origin?: ReadingOrigin;
  depth?: number;
  parent?: string;
  chapter?: ChapterMark;
  restore?: SourceMark;
}

interface BrowserNavigation {
  currentEntry: NavigationHistoryEntry | null;
  entries(): NavigationHistoryEntry[];
}

interface Restoration {
  mark: SourceMark | ChapterMark;
  keyboard: boolean;
  link?: HTMLElement;
  observer?: ResizeObserver;
  frame?: number;
  timer?: number;
}

const stateKey = 'blueNotesReading';
let current: ReadingEntry | undefined;
let leaving: ReadingEntry | undefined;
let arrowReturn: { from: string; to: string; keyboard: boolean } | undefined;
let restoring: Restoration | undefined;

const path = (url: URL) => url.pathname.replace(/\/+$/, '') || '/';
const routeURL = (href: string) => new URL(href, location.href);
const resource = (url: URL) => url.origin + url.pathname + url.search;
const source = (url: URL) => ['/', '/blog', '/archive'].includes(path(url));
const article = (url: URL) => path(url).startsWith('/blog/');
const slugPath = (slug: string) => '/blog/' + slug.split('/').map(encodeURIComponent).join('/');
const browsingHistory = () => Reflect.get(window, 'navigation') as BrowserNavigation | undefined;

function newEntry(href: string, state?: Partial<ReadingEntry>): ReadingEntry {
  const id = crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
  return { ...state, id, href };
}

function saveEntry(entry: ReadingEntry) {
  current = entry;
  // Astro's own index and scroll values must survive a reading state update.
  if (Number.isInteger(history.state?.index)) {
    try {
      history.replaceState({ ...history.state, [stateKey]: entry }, '');
    } catch {
      // Keep the current controls usable if the browser limits history writes.
    }
  }
}

function syncEntry(preserveHashContext = false) {
  const stored = history.state?.[stateKey] as ReadingEntry | undefined;
  if (stored?.href === location.href) {
    current = stored;
    return stored;
  }
  const prior = current;
  if (prior?.href === location.href) return prior;
  const sameResource = prior && resource(routeURL(prior.href)) === resource(routeURL(location.href));
  const entry = newEntry(location.href, preserveHashContext && sameResource
    ? { origin: prior.origin, parent: prior.parent }
    : undefined);
  saveEntry(entry);
  return entry;
}

function setBackLink(entry: ReadingEntry) {
  const back = document.querySelector<HTMLElement>('[data-reading-back]');
  if (!back || !entry.origin) return;
  const url = routeURL(entry.origin.href);
  if (url.origin !== location.origin || !source(url)) return;
  const label = path(url) === '/archive' ? '返回归档' : path(url) === '/' ? '返回最近文章' : '返回博客';
  if (path(url) === '/') url.hash = 'recent';
  back.setAttribute('href', url.pathname + url.search + url.hash);
  back.setAttribute('aria-label', label);
  back.title = label;
  const text = back.querySelector('[data-reading-back-label]');
  if (text) text.textContent = label;
}

function position(link: Element, keyboard: boolean): Position {
  const row = link.closest('li') || link;
  return {
    scroll: scrollY, offset: row.getBoundingClientRect().top, width: innerWidth, height: innerHeight,
    keyboard, headerHidden: headerIsHidden(),
  };
}

export function prepareReading(link: Element, url: URL, keyboard: boolean) {
  arrowReturn = undefined;
  if (url.origin !== location.origin) return;
  const here = routeURL(location.href);
  const entry = syncEntry(true);
  const asDestination = (state: Partial<ReadingEntry>) => ({ [stateKey]: newEntry(url.href, state) });
  const nextDepth = entry.depth === undefined ? undefined : entry.depth + 1;
  if (resource(url) === resource(here) && url.href !== here.href) {
    return asDestination({ origin: entry.origin, depth: nextDepth, parent: entry.parent, chapter: entry.chapter });
  }
  if (link.hasAttribute('data-reading-back') && entry.origin && resource(url) === resource(routeURL(entry.origin.href))) {
    return asDestination({ restore: { ...entry.origin.mark, keyboard: keyboard || entry.origin.mark.keyboard } });
  }
  if (!article(url)) return;
  const slug = link.querySelector<HTMLElement>('[data-article-slug]')?.dataset.articleSlug;
  if (source(here) && slug && slugPath(slug) === path(url)) {
    const index = Number.isInteger(history.state?.index) ? history.state.index as number : undefined;
    const origin = {
      id: entry.id,
      href: here.href,
      index,
      key: index === undefined ? undefined : browsingHistory()?.currentEntry?.key,
      mark: { slug, ...position(link, keyboard) },
    };
    return asDestination({ origin, depth: index === undefined ? undefined : 1 });
  }
  if (article(here) && link.closest('.notes-adjacent')) {
    saveEntry({ ...entry, chapter: { to: resource(url), ...position(link, keyboard) } });
    return asDestination({ origin: entry.origin, depth: nextDepth, parent: entry.id });
  }
}

export function returnToReadingOrigin(link: Element, keyboard: boolean) {
  if (!link.hasAttribute('data-reading-back')) return false;
  const entry = syncEntry(true);
  const { origin } = entry;
  if (!origin || history.state?.[stateKey]?.id !== entry.id) return false;

  const nav = browsingHistory();
  let distance: number | undefined;
  if (nav?.currentEntry && origin.key) {
    const original = nav.entries().find(candidate => candidate.key === origin.key && candidate.url === origin.href);
    if (original) distance = nav.currentEntry.index - original.index;
  } else if (origin.index !== undefined && entry.depth === history.state.index - origin.index) {
    distance = entry.depth;
  }
  if (distance === undefined || !Number.isInteger(distance) || distance <= 0 || distance >= history.length) return false;
  arrowReturn = { from: entry.id, to: origin.id, keyboard };
  history.go(-distance);
  return true;
}

function stopRestoring() {
  if (!restoring) return;
  clearTimeout(restoring.timer);
  if (restoring.frame !== undefined) cancelAnimationFrame(restoring.frame);
  restoring.observer?.disconnect();
  const link = restoring.link?.isConnected ? restoring.link : document.querySelector('[data-reading-return]');
  link?.removeAttribute('data-reading-return');
  delete document.documentElement.dataset.restoringReading;
  restoring = undefined;
}

function restore(session: Restoration) {
  const { mark, keyboard } = session;
  const link = Array.from(document.querySelectorAll<HTMLElement>('[data-reading-entry][href]')).find(row => {
    if ('slug' in mark) return row.querySelector<HTMLElement>('[data-article-slug]')?.dataset.articleSlug === mark.slug;
    const href = row.getAttribute('href');
    return href && resource(routeURL(href)) === mark.to;
  });
  if (!link) return;
  if (session.link !== link) {
    session.link?.removeAttribute('data-reading-return');
    session.link = link;
    link.dataset.readingReturn = '';
    const target = link.shadowRoot?.querySelector<HTMLElement>('a[href]') || link;
    const options = { preventScroll: true, focusVisible: keyboard };
    target.focus(options);
  }
  const row = link.closest('li') || link;
  const sameSize = mark.width === innerWidth && mark.height === innerHeight;
  const y = sameSize ? mark.scroll : scrollY + row.getBoundingClientRect().top - mark.offset;
  if (Math.abs(scrollY - y) > 1) scrollTo({ top: y, behavior: 'instant' });
  // A late layout update can make a previously clamped scroll position reachable.
  restoreHeaderVisibility(mark.headerHidden === true);
}

function startRestoring(mark: SourceMark | ChapterMark, keyboard: boolean) {
  const session: Restoration = { mark, keyboard: keyboard || mark.keyboard };
  restoring = session;
  document.documentElement.dataset.restoringReading = '';
  restore(session);
  const schedule = () => {
    if (session.frame !== undefined) cancelAnimationFrame(session.frame);
    session.frame = requestAnimationFrame(() => {
      session.frame = undefined;
      if (restoring === session) restore(session);
    });
  };
  schedule();
  // Late fonts or Material upgrades may change the scrollable height.
  if (typeof ResizeObserver !== 'undefined') {
    session.observer = new ResizeObserver(schedule);
    session.observer.observe(document.body);
  }
  session.timer = window.setTimeout(stopRestoring, 850);
}

export function beforeReadingSwap(event: Route) {
  leaving = current && resource(routeURL(current.href)) === resource(event.from) ? current : undefined;
  stopRestoring();
}

export function afterReadingSwap(event: Route) {
  const entry = syncEntry();
  setBackLink(entry);
  const previous = leaving;
  const arrow = arrowReturn;
  leaving = undefined;
  arrowReturn = undefined;
  if (entry.restore) {
    const { restore, ...state } = entry;
    saveEntry(state);
    if (source(event.to)) startRestoring(restore, false);
  } else if (event.navigationType === 'traverse') {
    if (source(event.to) && previous?.origin?.id === entry.id) {
      const keyboard = arrow?.from === previous.id && arrow.to === entry.id && arrow.keyboard;
      startRestoring(previous.origin.mark, keyboard);
    } else if (article(event.to) && previous?.parent === entry.id && entry.chapter) {
      startRestoring(entry.chapter, false);
    }
  }
}

export const isReadingReturning = () => restoring !== undefined;
export const readingOriginSlug = () => current?.origin?.mark.slug;

export function initReading() {
  setBackLink(syncEntry());
  const interrupt = () => {
    stopRestoring();
    arrowReturn = undefined;
  };
  for (const type of ['pointerdown', 'keydown', 'wheel']) {
    window.addEventListener(type, interrupt, { capture: true, passive: true });
  }
  const syncHash = () => {
    if (current && resource(routeURL(current.href)) === resource(routeURL(location.href))) setBackLink(syncEntry(true));
  };
  window.addEventListener('hashchange', syncHash);
  window.addEventListener('popstate', syncHash);
  window.addEventListener('pagehide', interrupt);
}
