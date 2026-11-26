// Classical head script so both documents can choose their snapshots before paint.
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const nav = Reflect.get(window, 'navigation');
  const reading = Reflect.get(window, 'blueReading');
  // Navigation API enriches history but is independent of cross-document VT.
  const canSnapshot = 'onpageswap' in window && 'onpagereveal' in window && 'CSSViewTransitionRule' in window;
  const intentKey = 'blue-notes:route';
  const lastKey = 'blue-notes:left';
  const path = (url) => new URL(url, location.href).pathname.replace(/\/+$/, '') || '/';
  const article = (url) => path(url).startsWith('/blog/');
  const index = (url) => ['/', '/blog', '/archive'].includes(path(url));
  const slugPath = slug => '/blog/' + slug.split('/').map(encodeURIComponent).join('/');
  const visit = () => performance.getEntriesByType('navigation')[0]?.type;
  const listen = (event, listener) => window.addEventListener(event, listener);
  function read(key) {
    try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; }
  }
  function store(key, value) {
    try {
      if (value) sessionStorage.setItem(key, JSON.stringify(value));
      else sessionStorage.removeItem(key);
    } catch { /* Native anchors also work with storage disabled. */ }
  }
  function signal(name, detail) { document.dispatchEvent(new CustomEvent('blue:route-' + name, { detail })); }
  function samePage(a, b) {
    const left = new URL(a, location.href), right = new URL(b, location.href);
    return left.origin === right.origin && path(left) === path(right) && left.search === right.search;
  }
  function localURL(value) {
    if (!value) return;
    const url = new URL(value, location.href);
    return url.origin === location.origin ? url.href : undefined;
  }
  function tabs() { return Array.from(document.querySelectorAll('.main-nav a[href]')); }
  function sectionIndex(url) {
    const target = article(url) ? '/blog' : path(url);
    return tabs().findIndex(tab => path(tab.href) === target);
  }
  function route(from, to, hint) {
    if (!from || !to || !localURL(from) || !localURL(to) || samePage(from, to)) return;
    const opening = index(from) && article(to), closing = article(from) && index(to);
    let kind = 'section';
    let direction = hint || (sectionIndex(to) < sectionIndex(from) ? 'back' : 'forward');
    if (opening || closing) {
      kind = 'article';
      direction = opening ? 'forward' : 'back';
    } else if (path(from) === '/' && path(to) === '/blog') {
      kind = 'home-blog';
    } else if (article(from) && article(to)) {
      kind = 'chapter';
      const outgoing = samePage(location.href, from);
      const adjacent = Array.from(document.querySelectorAll('.notes-adjacent [rel][href]'))
        .find(link => samePage(link.getAttribute('href'), outgoing ? to : from));
      const rel = adjacent?.getAttribute('rel');
      if (rel === 'prev' || rel === 'next') direction = (rel === 'next') === outgoing ? 'forward' : 'back';
    }
    return { from, to, kind, direction, swapLeading: article(from) !== article(to) };
  }
  function selected(info) {
    if (info.kind !== 'article') return;
    const articleURL = article(info.to) ? info.to : info.from;
    const node = Array.from(document.querySelectorAll('[data-article-slug]'))
      .find(el => slugPath(el.dataset.articleSlug) === path(articleURL));
    if (!node) return;
    const restored = document.querySelector('[data-reading-return] [data-article-slug]');
    if (restored && restored.dataset.articleSlug !== node.dataset.articleSlug) return;
    const originSlug = reading?.originSlug?.();
    if (article(info.from) && article(location.href) && originSlug && originSlug !== node.dataset.articleSlug) return;
    return measureTitle(node) ? node : undefined;
  }
  function measureTitle(node) {
    if (!node) return null;
    const r = node.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom <= 0 || r.top >= innerHeight) return null;
    return {slug: node.dataset.articleSlug, x: r.left, y: r.top, font: parseFloat(getComputedStyle(node).fontSize)};
  }
  function titleRecord(info) { return measureTitle(selected(info)); }

  let groups = [], groupTimer, finishTimer, currentTitle, driver, currentInfo, arrived = false;
  let pending, lastOutgoing, pendingTab;
  function clearGroups() {
    clearTimeout(groupTimer);
    for (const node of groups) {
      delete node.dataset.groupOrder;
      node.style.removeProperty('--entry-wait');
      node.style.removeProperty('--entry-lead');
    }
    groups = [];
  }
  function enterGroups(title, lead = 0) {
    clearGroups();
    if (reduced.matches || location.hash || reading?.isReturning?.()) return;
    for (const node of document.querySelectorAll('#main [data-enter-group]')) {
      const r = node.getBoundingClientRect();
      if (node.contains(title || null) || !r.height || r.bottom <= 0 || r.top >= innerHeight) continue;
      node.style.setProperty('--entry-wait', groups.length * 60 + 'ms');
      node.style.setProperty('--entry-lead', lead + 'ms');
      node.dataset.groupOrder = String(groups.length);
      groups.push(node);
      if (groups.length === 4) break;
    }
    if (groups.length) groupTimer = setTimeout(clearGroups, 740);
  }
  function clearScene() {
    clearTimeout(finishTimer);
    for (const key of ['pageMotion','motionStage','motionDirection','motionDriver','motionMarker','motionLeading']) delete root.dataset[key];
    for (const key of ['--motion-header-edge','--motion-pane-clip']) root.style.removeProperty(key);
    if (currentTitle) {
      delete currentTitle.dataset.motionSelected;
      for (const key of ['--selected-title-name','--title-x','--title-y','--title-scale']) currentTitle.style.removeProperty(key);
    }
    currentTitle = driver = currentInfo = undefined;
  }
  function setScene(info, stage, mode, oldTitle) {
    clearScene();
    currentInfo = info;
    driver = mode;
    root.dataset.pageMotion = info.kind;
    root.dataset.motionStage = stage;
    root.dataset.motionDriver = mode;
    root.dataset.motionDirection = info.direction;
    if (info.swapLeading) root.dataset.motionLeading = article(info.to) ? 'open' : 'close';
    const navBar = document.querySelector('.main-nav');
    if (navBar?.getClientRects().length && sectionIndex(info.from) !== sectionIndex(info.to) &&
      navBar.querySelector('[aria-current="page"] .nav-marker')) root.dataset.motionMarker = '';
    const headerEdge = Math.max(0, document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0);
    const mainTop = document.getElementById('main')?.getBoundingClientRect().top || 0;
    root.style.setProperty('--motion-header-edge', headerEdge + 'px');
    root.style.setProperty('--motion-pane-clip', Math.max(0, headerEdge - mainTop) + 'px');
    const node = selected(info);
    if (node && (stage === 'leave' || node.dataset.articleSlug === oldTitle?.slug)) {
      currentTitle = node;
      node.style.setProperty('--selected-title-name', CSS.escape('a-title-' + node.dataset.articleSlug));
      if (mode === 'css' && stage === 'enter') {
        const rect = node.getBoundingClientRect();
        node.style.setProperty('--title-x', (oldTitle.x - rect.left) + 'px');
        node.style.setProperty('--title-y', (oldTitle.y - rect.top) + 'px');
        node.style.setProperty('--title-scale', String(oldTitle.font / parseFloat(getComputedStyle(node).fontSize)));
      }
      node.dataset.motionSelected = '';
    }
    if (stage === 'enter') enterGroups(currentTitle, mode === 'native' ? 90 : 0);
  }
  function markTab(info) {
    pendingTab = tabs()[sectionIndex(info.to)];
    if (pendingTab && !pendingTab.hasAttribute('aria-current')) pendingTab.dataset.navPending = '';
  }
  function cancelPressTimer() {
    if (pending) clearTimeout(pending.timer);
  }
  function clearPending(cancel) {
    cancelPressTimer();
    if (pendingTab) delete pendingTab.dataset.navPending;
    pendingTab = undefined;
    if (cancel && pending) {
      store(intentKey, null);
      signal('cancel', pending.info);
      if (root.dataset.motionStage === 'leave') clearScene();
    }
    pending = undefined;
  }
  // On a warm navigation the original press can otherwise disappear before its
  // first painted frame. Long holds have already shown this feedback.
  function rippleWait(link) {
    const tree = (link.shadowRoot || link).querySelector('md-ripple')?.shadowRoot;
    const solid = tree?.querySelector('.mat-ripple-element:last-child');
    const animation = solid
      ? solid.getAnimations().find(a => a.transitionProperty === 'transform')
      : tree?.getAnimations().find(a => a.effect?.pseudoElement === '::after' && a.effect.getKeyframes().some(f => f.transform));
    return animation && animation.playState !== 'finished' ? Math.max(0,105 - Number(animation.currentTime || 0)) : 0;
  }
  function matchIntent(from, to) {
    const intent = read(intentKey);
    return intent && samePage(intent.from, from) && samePage(intent.to, to) ? intent : undefined;
  }

  listen('click', event => {
    if (!event.isTrusted || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const pathNodes = event.composedPath().filter(n => n instanceof Element);
    // Slotted titles/icons live outside the inner <a>. Prefer their public host;
    // use the actual link path for unenhanced and arbitrary Markdown anchors.
    const link = pathNodes.find(n => n.matches('.action-link[href]')) || pathNodes.find(n => n.matches('a[href]'));
    if (!link) return;
    const url = new URL(link.getAttribute('href'), document.baseURI);
    const target = link.getAttribute('target') || document.querySelector('base[target]')?.getAttribute('target');
    if (target && target.trim().toLowerCase() !== '_self' || link.matches('[download],[ping],[referrerpolicy],[attributionsrc],[rel~="noreferrer"]')) return;
    const info = route(location.href, url.href);
    if (!info) return;
    clearPending(true);
    clearGroups();
    const back = link.hasAttribute('data-reading-back');
    const record = () => reading?.record?.(link, url, event.detail === 0);
    const note = { ...info, title: titleRecord(info) };
    const journey = {info, timer: undefined, dispatched:false};
    pending = journey;
    store(intentKey, note);
    if (!reduced.matches) markTab(info);
    const closing = [];
    signal('leave', { ...info, link, waitUntil: promise => closing.push(Promise.resolve(promise)) });
    const css = !canSnapshot && !reduced.matches;
    if (!back && !closing.length && !css && (reduced.matches || !rippleWait(link))) {
      journey.dispatched = true;
      record();
      signal('request', info);
      // Preserve the link's native action, history, and referrer semantics.
      return;
    }
    event.preventDefault();
    const depart = () => {
      if (journey !== pending) return;
      if (css) setScene(info, 'leave', 'css', note.title);
      const wait = reduced.matches ? 0 : css ? 200 : rippleWait(link);
      const go = () => {
        if (journey !== pending) return;
        journey.dispatched = true;
        record();
        signal('request', info);
        if (!(back && reading?.back?.(link, event.detail === 0))) location.assign(url.href);
      };
      if (wait) journey.timer = setTimeout(go, wait);
      else go();
    };
    if (closing.length) Promise.allSettled(closing).then(depart);
    else depart();
  });
  function cancelBeforeCommit() {
    if (pending && !pending.dispatched) clearPending(true);
  }
  window.addEventListener('pointerdown', cancelBeforeCommit, {capture:true, passive:true});
  window.addEventListener('keydown', cancelBeforeCommit, true);
  nav?.addEventListener('navigate', cancelBeforeCommit);
  nav?.addEventListener('navigateerror', () => clearPending(true));

  function inferredArrival(persisted) {
    if (visit() === 'reload' && !persisted) return;
    const intent = read(intentKey);
    if (intent && samePage(intent.to, location.href)) return intent;
    if (persisted || visit() === 'back_forward') {
      const last = read(lastKey);
      if (last && samePage(last.to || location.href, location.href)) {
        const info = route(last.from, location.href, last.direction);
        if (info) return {...info, title:last.title};
      }
    }
  }
  function arrive(event, persisted = false) {
    if (arrived) return;
    arrived = true;
    clearPending(false);
    const activation = nav?.activation;
    if (persisted || visit() === 'back_forward' || activation?.navigationType === 'traverse') reading?.restore?.();
    const remembered = inferredArrival(persisted);
    const from = localURL(activation?.from?.url) || remembered?.from;
    const info = route(from, location.href, remembered?.direction);
    const memory = info ? matchIntent(info.from, info.to) || remembered : undefined;
    store(intentKey, null);
    const vt = event?.viewTransition;
    if (!info || reduced.matches || (!persisted && visit() === 'reload')) {
      vt?.skipTransition();
      if (!reduced.matches) enterGroups();
      return;
    }
    if (vt && canSnapshot) {
      setScene(info, 'enter', 'native', memory?.title);
      vt.ready.catch(() => {
        if (currentInfo === info && document.visibilityState === 'visible') cssArrival(info, memory?.title);
      });
      vt.finished.then(() => { if (currentInfo === info && driver === 'native') clearScene(); }, () => {});
    } else {
      vt?.skipTransition();
      cssArrival(info, memory?.title);
    }
  }
  function cssArrival(info, title) {
    setScene(info, 'enter', 'css', title);
    finishTimer = setTimeout(clearScene, 620);
  }
  listen('pageswap', event => {
    signal('snapshot', pending?.info);
    const act = event.activation;
    const info = route(localURL(act?.from?.url) || location.href, localURL(act?.entry?.url) || pending?.info.to,
      pending?.info.direction || (act?.navigationType === 'traverse' && act.entry.index < act.from?.index ? 'back' : undefined));
    if (!info || reduced.matches) { event.viewTransition?.skipTransition(); return; }
    const note = { ...info, title: titleRecord(info) };
    lastOutgoing = note;
    store(intentKey, note);
    if (event.viewTransition && canSnapshot) {
      setScene(info, 'leave', 'native', note.title);
      event.viewTransition.ready.catch(() => {});
    } else event.viewTransition?.skipTransition();
  });
  listen('pagereveal', e => arrive(e));
  listen('pageshow', e => {
    if (!arrived) {
      if (!canSnapshot) arrive(undefined, e.persisted);
      else requestAnimationFrame(() => { if (!arrived) arrive(undefined, e.persisted); });
    }
  });
  // Browsers without page-reveal events can prepare CSS on DOMContentLoaded,
  // before pageshow waits for images and other subresources.
  if (!canSnapshot) document.addEventListener('DOMContentLoaded', () => {
    if (!arrived) arrive(undefined);
  }, {once:true});
  listen('pagehide', () => {
    const outgoing = lastOutgoing || pending?.info;
    const activeRow = document.activeElement?.closest('[data-reading-entry]');
    const visible = document.querySelector('h1[data-article-slug]') || activeRow?.querySelector('[data-article-slug]');
    store(lastKey, {from:location.href, to:outgoing?.to, direction:outgoing?.direction, title:lastOutgoing?.title || measureTitle(visible)});
    arrived = false;
    lastOutgoing = undefined;
    clearPending(false);
    clearGroups();
    clearScene();
  });
  reduced.addEventListener('change', e => {
    if (e.matches) { clearPending(true); clearGroups(); clearScene(); }
  });
})();
