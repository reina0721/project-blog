// Classic head script: native snapshot participants must be chosen before first paint.
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  /** @typedef {{url: string, index: number, key: string, getState: () => any}} PageEntry */
  /** @type {{ activation?: { from: PageEntry | null, entry: PageEntry, navigationType: string },
   *   currentEntry: PageEntry, entries: () => PageEntry[],
   *   updateCurrentEntry: (options: {state: any}) => void } | undefined} */
  const navigationApi = Reflect.get(window, 'navigation');
  const nativeNavigation = 'onpageswap' in window && 'onpagereveal' in window &&
    'CSSViewTransitionRule' in window && Boolean(navigationApi);
  const pathOf = (url) => new URL(url, location.href).pathname.replace(/\/+$/, '') || '/';
  const isIndex = (path) => path === '/blog' || path === '/archive';
  const isArticle = (path) => path.startsWith('/blog/');
  const isReadingSource = (path) => path === '/' || isIndex(path);
  const articlePath = (slug) => '/blog/' + slug.split('/').map(encodeURIComponent).join('/');
  let clearActive;
  let returnLink;
  let returnTimer;
  function clearReturnCue() {
    clearTimeout(returnTimer);
    if (returnLink) delete returnLink.dataset.readingReturn;
    returnLink = undefined;
  }
  window.addEventListener('pagehide', clearReturnCue);

  // Keep the selected row on its own history entry. Two visits to the same
  // archive can then return to different rows without sharing a global bookmark.
  function entryState() { return navigationApi?.currentEntry?.getState() ?? history.state ?? {}; }
  function putEntryState(field, value) {
    const updated = { ...entryState(), [field]: value };
    if (navigationApi?.currentEntry) navigationApi.updateCurrentEntry({ state: updated });
    else history.replaceState(updated, '');
  }
  function rowFor(slug) {
    return Array.from(document.querySelectorAll('a[href] [data-article-slug]'))
      .find((node) => node.dataset.articleSlug === slug)?.closest('a');
  }
  function safeSource(url) {
    if (!url) return;
    const source = new URL(url, location.href);
    return source.origin === location.origin && isReadingSource(pathOf(source)) ? source : undefined;
  }
  function previousReadingEntry() {
    if (!navigationApi?.currentEntry || !isArticle(pathOf(location.href))) return;
    const previous = navigationApi.entries().find((entry) => entry.index === navigationApi.currentEntry.index - 1);
    const row = previous?.getState()?.readingRow;
    if (!row?.slug || !safeSource(previous.url) || articlePath(row.slug) !== pathOf(location.href)) return;
    const activation = navigationApi.activation;
    if (entryState().readingFrom !== previous.key) {
      if (activation?.navigationType !== 'push' || activation.from?.key !== previous.key) return;
      putEntryState('readingFrom', previous.key);
    }
    return previous;
  }
  function setReadingBackLink() {
    const back = document.querySelector('[data-reading-back]');
    if (!back) return;
    const source = safeSource(previousReadingEntry()?.url || document.referrer);
    if (!source) return;
    const path = pathOf(source);
    if (path === '/') source.hash = 'recent';
    back.setAttribute('href', source.pathname + source.search + source.hash);
    const label = back.querySelector('[data-reading-back-label]');
    if (label) label.textContent = path === '/archive' ? '返回归档' : path === '/' ? '返回最近文章' : '返回博客';
  }
  document.addEventListener('DOMContentLoaded', setReadingBackLink, { once: true });
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
        event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
    const link = event.target.closest('a[href]');
    if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
    clearReturnCue();
    if (link.hasAttribute('data-reading-back') && previousReadingEntry()) {
      event.preventDefault();
      history.back();
      return;
    }
    if (!isReadingSource(pathOf(location.href))) return;
    const title = link.querySelector('[data-article-slug]');
    if (link.origin === location.origin && title && articlePath(title.dataset.articleSlug) === pathOf(link.href)) {
      const row = link.closest('li') || link;
      putEntryState('readingRow', { slug: title.dataset.articleSlug, offset: row.getBoundingClientRect().top,
        scroll: scrollY, width: innerWidth, height: innerHeight, keyboard: event.detail === 0 });
    } else if (entryState().readingRow && (link.origin !== location.origin || pathOf(link.href) !== pathOf(location.href))) {
      putEntryState('readingRow', null);
    }
  });
  function restoreRow() {
    if (!isReadingSource(pathOf(location.href))) return;
    const mark = entryState().readingRow;
    if (!mark?.slug || !Number.isFinite(mark.offset)) return;
    const from = navigationApi?.activation?.from?.url;
    if (from && (new URL(from).origin !== location.origin || pathOf(from) !== articlePath(mark.slug))) return;
    const link = rowFor(mark.slug);
    if (!link) return;
    const row = link.closest('li') || link;
    if (document.activeElement !== link) link.focus({ preventScroll: true, focusVisible: mark.keyboard });
    const sameViewport = mark.width === innerWidth && mark.height === innerHeight;
    const target = sameViewport ? mark.scroll : scrollY + row.getBoundingClientRect().top - mark.offset;
    if (Math.abs(target - scrollY) > 1) window.scrollTo({ top: target, behavior: 'instant' });
    if (returnLink !== link) {
      clearReturnCue();
      returnLink = link;
      link.dataset.readingReturn = '';
      returnTimer = setTimeout(clearReturnCue, 850);
    }
  }
  window.addEventListener('pageshow', (event) => {
    if (event.persisted || navigationApi?.activation?.navigationType === 'traverse' ||
        performance.getEntriesByType('navigation')[0]?.type === 'back_forward') {
      restoreRow();
      // A browser may apply its saved scroll position after pageshow.
      requestAnimationFrame(restoreRow);
    }
  });

  function useEntryFallback(fromUrl, type) {
    if (!fromUrl || reduced.matches || type === 'reload') return;
    const from = new URL(fromUrl);
    if (from.origin === location.origin && pathOf(from) !== pathOf(location.href)) {
      root.dataset.motionFallback = '';
    }
  }
  if (!nativeNavigation) {
    useEntryFallback(document.referrer, performance.getEntriesByType('navigation')[0]?.type);
    window.addEventListener('pageshow', (event) => {
      if (event.persisted && !reduced.matches) root.dataset.motionFallback = '';
    });
    window.addEventListener('pagehide', () => { delete root.dataset.motionFallback; });
    document.addEventListener('animationend', (event) => {
      if (event.animationName === 'entry-fallback') delete root.dataset.motionFallback;
    });
  }

  // The section order comes from the same anchors visitors use.
  function sectionOrder(path) {
    const section = isArticle(path) ? '/blog' : path;
    return Array.from(document.querySelectorAll('.main-nav a[href]'))
      .findIndex((link) => pathOf(link.href) === section);
  }
  function chapterDirection(source, destination, outgoing, activation) {
    const other = outgoing ? destination : source;
    const link = Array.from(document.querySelectorAll('.notes-adjacent a[rel]'))
      .find((item) => pathOf(item.href) === other);
    if (link?.rel === 'prev' || link?.rel === 'next') {
      const step = link.rel === 'next' ? 1 : -1;
      return outgoing ? step : -step;
    }
    return activation.entry.index < activation.from.index ? -1 : 1;
  }

  function prepare(event, activation, outgoing) {
    clearActive?.();
    const transition = event.viewTransition;
    if (!transition) return;
    // The outgoing document can be suspended in the back/forward cache before
    // native pseudo-elements exist. The ready rejection is expected in that case.
    transition.ready.catch(() => {});
    if (!nativeNavigation || reduced.matches || !activation?.from?.url ||
        !activation.entry?.url || activation.navigationType === 'reload') {
      transition.skipTransition();
      return;
    }
    const from = new URL(activation.from.url);
    const to = new URL(activation.entry.url);
    const source = pathOf(from);
    const destination = pathOf(to);
    if (from.origin !== location.origin || to.origin !== location.origin || source === destination) {
      transition.skipTransition();
      return;
    }

    const opening = isReadingSource(source) && isArticle(destination);
    const closing = isArticle(source) && isReadingSource(destination);
    let title;
    let previousTab;
    let currentTab;
    let kind = 'section';
    const sourceOrder = sectionOrder(source);
    const destinationOrder = sectionOrder(destination);
    let direction = destinationOrder - sourceOrder;
    if (source === '/' && destination === '/blog') {
      kind = 'home-blog';
    } else if (opening || closing) {
      kind = 'article';
      direction = opening ? 1 : -1;
      const path = opening ? destination : source;
      // Slugs may contain non-Latin text or a subdirectory.
      title = Array.from(document.querySelectorAll('[data-article-slug]')).find((node) =>
        articlePath(node.dataset.articleSlug) === path);
      if (title) {
        const rect = title.getBoundingClientRect();
        const bar = document.querySelector('.main-nav');
        const bottom = bar && getComputedStyle(bar).position === 'fixed' ? bar.getBoundingClientRect().top : innerHeight;
        if (!rect.height || rect.bottom <= 0 || rect.top >= bottom) title = undefined;
      }
      // A deeply scrolled article has no visible source title. In that case
      // include the list title in the arriving content, without an orphan snapshot.
      const pair = 'blue-notes:pending-title';
      try {
        // A push can receive a different destination entry key after commit.
        // The already committed source key and destination URL survive both events.
        const tag = JSON.stringify([activation.from.key, destination, title?.dataset.articleSlug || '']);
        if (outgoing) sessionStorage.setItem(pair, tag);
        else {
          if (sessionStorage.getItem(pair) !== tag) title = undefined;
          sessionStorage.removeItem(pair);
        }
      } catch {
        title = undefined;
      }
    } else if (isArticle(source) && isArticle(destination)) {
      kind = 'chapter';
      direction = chapterDirection(source, destination, outgoing, activation);
    }
    root.dataset.pageMotion = kind;
    root.dataset.motionStage = outgoing ? 'leave' : 'enter';
    root.dataset.motionDirection = direction < 0 ? 'back' : 'forward';
    const header = document.querySelector('.site-header');
    const headerEdge = Math.max(0, header?.getBoundingClientRect().bottom || 0);
    root.style.setProperty('--motion-header-edge', headerEdge + 'px');
    const main = document.querySelector('#main')?.getBoundingClientRect();
    root.style.setProperty('--motion-pane-clip', Math.max(0, headerEdge - (main?.top || 0)) + 'px');
    const navbar = document.querySelector('.main-nav');
    if (navbar && getComputedStyle(navbar).position === 'fixed') {
      const overhang = Math.max(0, (main?.bottom || 0) - navbar.getBoundingClientRect().top);
      root.style.setProperty('--motion-pane-bottom', overhang + 'px');
    }
    if (sourceOrder >= 0 && destinationOrder >= 0 && sourceOrder !== destinationOrder &&
        document.querySelector('.main-nav [aria-current="page"] i.nav-marker')) {
      root.dataset.motionMarker = '';
      if (!outgoing && matchMedia('(max-width: 720px)').matches) {
        const tabs = navbar.querySelectorAll('a[href]');
        previousTab = tabs[sourceOrder];
        currentTab = tabs[destinationOrder];
        previousTab.dataset.motionLabel = 'leave';
        currentTab.dataset.motionLabel = 'enter';
      }
    }
    if (title) {
      title.style.setProperty('--selected-title-name', CSS.escape('a-title-' + title.dataset.articleSlug));
      title.dataset.motionSelected = '';
    }
    const cleanup = () => {
      if (clearActive !== cleanup) return;
      delete root.dataset.pageMotion;
      delete root.dataset.motionStage;
      delete root.dataset.motionDirection;
      delete root.dataset.motionMarker;
      root.style.removeProperty('--motion-header-edge');
      root.style.removeProperty('--motion-pane-clip');
      root.style.removeProperty('--motion-pane-bottom');
      if (previousTab) delete previousTab.dataset.motionLabel;
      if (currentTab) delete currentTab.dataset.motionLabel;
      if (title) {
        title.style.removeProperty('--selected-title-name');
        delete title.dataset.motionSelected;
      }
      clearActive = undefined;
    };
    clearActive = cleanup;
    transition.finished.then(cleanup, cleanup);
  }

  window.addEventListener('pageswap', (event) => prepare(event, event.activation, true));
  window.addEventListener('pagereveal', (event) => {
    if (navigationApi?.activation?.navigationType === 'traverse') restoreRow();
    prepare(event, navigationApi?.activation, false);
  });
})();
