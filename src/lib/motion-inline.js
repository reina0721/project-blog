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
    return Array.from(document.querySelectorAll('[data-reading-entry][href]'))
      .find((row) => row.querySelector('[data-article-slug]')?.dataset.articleSlug === slug);
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
  let pendingTab;
  let pendingTimer;
  let departureTimer;
  function clearPending() {
    clearTimeout(pendingTimer);
    if (pendingTab) delete pendingTab.dataset.navPending;
    pendingTab = undefined;
  }
  function cancelDeparture() {
    clearTimeout(departureTimer);
    departureTimer = undefined;
  }
  // A cached navigation can finish before a quick tap paints. Read the
  // running renderer's clock; long holds have already shown the press.
  function pressTimeRemaining(link) {
    if (reduced.matches) return 0;
    const root = (link.shadowRoot || link).querySelector('md-ripple')?.shadowRoot;
    const solid = root?.querySelector('.mat-ripple-element:last-child');
    const growth = solid
      ? solid.getAnimations().find((animation) => animation.transitionProperty === 'transform')
      : root?.getAnimations?.().find((animation) => animation.effect?.pseudoElement === '::after' &&
          animation.effect.getKeyframes().some((frame) => frame.transform));
    if (!growth || growth.playState === 'finished') return 0;
    return Math.max(0, 105 - Number(growth.currentTime || 0));
  }
  function interruptDeparture() {
    if (departureTimer !== undefined) {
      cancelDeparture();
      clearPending();
    }
  }
  window.addEventListener('pointerdown', interruptDeparture, { capture: true, passive: true });
  window.addEventListener('keydown', interruptDeparture, true);
  window.addEventListener('pagehide', cancelDeparture);
  navigationApi?.addEventListener('navigate', cancelDeparture);

  window.addEventListener('click', (event) => {
    interruptDeparture();
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
        event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
    const selector = 'a[href], [data-md-control][href], [data-reading-entry][href]';
    // Prefer the public host over the anchor inside a Material button's shadow.
    const link = event.target.closest(selector) || event.composedPath().find((item) => item instanceof Element && item.matches(selector));
    if (!link || link.hasAttribute('download')) return;
    const target = link.getAttribute('target');
    if (target && target.toLowerCase() !== '_self') return;
    const url = new URL(link.getAttribute('href'), document.baseURI);
    clearPending();
    if (url.origin === location.origin && pathOf(url) !== pathOf(location.href)) {
      const tabs = document.querySelectorAll('.main-nav a[href]');
      const tab = tabs[sectionOrder(pathOf(url))];
      if (tab && !tab.hasAttribute('aria-current') && !reduced.matches) {
        pendingTab = tab;
        tab.dataset.navPending = '';
        try { sessionStorage.setItem('blue-notes:nav-intent', JSON.stringify([pathOf(location.href), pathOf(url), Date.now()])); }
        catch { /* Visual feedback on the current page works without storage. */ }
        pendingTimer = setTimeout(clearPending, 1800);
      }
    }
    clearReturnCue();
    const returnsToSource = link.hasAttribute('data-reading-back') && previousReadingEntry();
    if (isReadingSource(pathOf(location.href))) {
      const title = link.querySelector('[data-article-slug]');
      if (url.origin === location.origin && title && articlePath(title.dataset.articleSlug) === pathOf(url)) {
        const row = link.closest('li') || link;
        putEntryState('readingRow', { slug: title.dataset.articleSlug, offset: row.getBoundingClientRect().top,
          scroll: scrollY, width: innerWidth, height: innerHeight, keyboard: event.detail === 0 });
      } else if (entryState().readingRow && (url.origin !== location.origin || pathOf(url) !== pathOf(location.href))) {
        putEntryState('readingRow', null);
      }
    }
    // Keep browser handling for fragments, new tabs, downloads and links
    // carrying their own referrer or tracking semantics.
    const localRoute = url.origin === location.origin && pathOf(url) !== pathOf(location.href);
    const nativeOnly = link.matches('[referrerpolicy],[ping],[attributionsrc],[rel~="noreferrer"]');
    const wait = localRoute && event.isTrusted && !nativeOnly ? pressTimeRemaining(link) : 0;
    if (wait > 0) {
      event.preventDefault();
      departureTimer = setTimeout(() => {
        departureTimer = undefined;
        if (returnsToSource) history.back();
        else location.assign(url.href);
      }, wait);
    } else if (returnsToSource) {
      event.preventDefault();
      history.back();
    }
  });
  function returningMark() {
    if (!isReadingSource(pathOf(location.href))) return;
    const mark = entryState().readingRow;
    if (!mark?.slug || !Number.isFinite(mark.offset)) return;
    const from = navigationApi?.activation?.from?.url;
    if (from && (new URL(from).origin !== location.origin || pathOf(from) !== articlePath(mark.slug))) return;
    return mark;
  }
  function traversing() {
    return navigationApi?.activation?.navigationType === 'traverse' ||
      performance.getEntriesByType('navigation')[0]?.type === 'back_forward';
  }
  if (traversing() && returningMark()) root.dataset.restoringReading = '';
  function restoreRow() {
    const mark = returningMark();
    if (!mark) return;
    const link = rowFor(mark.slug);
    if (!link) return;
    root.dataset.restoringReading = '';
    const row = link.closest('li') || link;
    const focusTarget = link.shadowRoot?.querySelector('a[href]') || link;
    if (document.activeElement !== link) focusTarget.focus({ preventScroll: true, focusVisible: mark.keyboard });
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
    if (event.persisted || traversing()) {
      restoreRow();
      // A browser may apply its saved scroll position after pageshow.
      requestAnimationFrame(restoreRow);
    }
  });

  let entered = [];
  let entryTimer;
  function clearEntry() {
    clearTimeout(entryTimer);
    for (const node of entered) {
      delete node.dataset.groupOrder;
      node.style.removeProperty('--entry-wait');
    }
    entered = [];
  }
  function enterGroups(selectedTitle) {
    clearEntry();
    if (reduced.matches || location.hash || (traversing() && returningMark())) return;
    const bar = document.querySelector('.main-nav');
    const bottom = bar && getComputedStyle(bar).position === 'fixed' ? bar.getBoundingClientRect().top : innerHeight;
    for (const node of document.querySelectorAll('#main [data-enter-group]')) {
      if (selectedTitle && node.contains(selectedTitle)) continue;
      const rect = node.getBoundingClientRect();
      if (!rect.height || rect.bottom <= 0 || rect.top >= bottom) continue;
      node.style.setProperty('--entry-wait', (entered.length * 68) + 'ms');
      node.dataset.groupOrder = String(entered.length);
      entered.push(node);
      if (entered.length === 4) break;
    }
    if (entered.length) entryTimer = setTimeout(clearEntry, 680);
  }
  if (!nativeNavigation) {
    document.addEventListener('DOMContentLoaded', () => enterGroups(), { once: true });
    window.addEventListener('pageshow', (event) => { if (event.persisted) enterGroups(); });
  }
  window.addEventListener('pageshow', clearPending);
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') clearPending(); });
  window.addEventListener('pagehide', () => {
    clearEntry();
    clearPending();
    delete root.dataset.restoringReading;
  });
  reduced.addEventListener('change', () => {
    if (reduced.matches) { clearEntry(); clearPending(); }
  });

  // The section order comes from the same anchors visitors use.
  function sectionOrder(path) {
    const section = isArticle(path) ? '/blog' : path;
    return Array.from(document.querySelectorAll('.main-nav a[href]'))
      .findIndex((link) => pathOf(link.href) === section);
  }
  function chapterDirection(source, destination, outgoing, activation) {
    const other = outgoing ? destination : source;
    const link = Array.from(document.querySelectorAll('.notes-adjacent [rel][href]'))
      .find((item) => pathOf(item.getAttribute('href')) === other);
    const relation = link?.getAttribute('rel');
    if (relation === 'prev' || relation === 'next') {
      const step = relation === 'next' ? 1 : -1;
      return outgoing ? step : -step;
    }
    return activation.entry.index < activation.from.index ? -1 : 1;
  }

  function prepare(event, activation, outgoing) {
    clearActive?.();
    const transition = event.viewTransition;
    if (!transition) {
      if (!outgoing && nativeNavigation) enterGroups();
      return;
    }
    // The outgoing document can be suspended in the back/forward cache before
    // native pseudo-elements exist. The ready rejection is expected in that case.
    transition.ready.catch(() => {});
    if (!nativeNavigation || reduced.matches || !activation?.from?.url ||
        !activation.entry?.url || activation.navigationType === 'reload') {
      transition.skipTransition();
      if (!outgoing && nativeNavigation) enterGroups();
      return;
    }
    const from = new URL(activation.from.url);
    const to = new URL(activation.entry.url);
    const source = pathOf(from);
    const destination = pathOf(to);
    if (from.origin !== location.origin || to.origin !== location.origin || source === destination) {
      transition.skipTransition();
      if (!outgoing) enterGroups();
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
        // If the server was slow, the departing labels already had time to
        // respond to the click. Continue from that point on the arriving page.
        if (activation.navigationType === 'push') {
          try {
            const intent = JSON.parse(sessionStorage.getItem('blue-notes:nav-intent') || 'null');
            sessionStorage.removeItem('blue-notes:nav-intent');
            if (intent?.[0] === source && intent[1] === destination) {
              root.style.setProperty('--nav-lead', Math.min(235, Math.max(0, Date.now() - intent[2])) + 'ms');
            }
          } catch { /* Use the complete label motion when storage is unavailable. */ }
        }
        previousTab.dataset.motionLabel = 'leave';
        currentTab.dataset.motionLabel = 'enter';
      }
    }
    if (title) {
      title.style.setProperty('--selected-title-name', CSS.escape('a-title-' + title.dataset.articleSlug));
      title.dataset.motionSelected = '';
    }
    // The arriving native snapshot is live. Choreograph its actual children so
    // each glyph paints once, and its animation continues after the snapshot ends.
    if (!outgoing) enterGroups(title);
    const cleanup = () => {
      if (clearActive !== cleanup) return;
      delete root.dataset.pageMotion;
      delete root.dataset.motionStage;
      delete root.dataset.motionDirection;
      delete root.dataset.motionMarker;
      root.style.removeProperty('--motion-header-edge');
      root.style.removeProperty('--motion-pane-clip');
      root.style.removeProperty('--motion-pane-bottom');
      root.style.removeProperty('--nav-lead');
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
