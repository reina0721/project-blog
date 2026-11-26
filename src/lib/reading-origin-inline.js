// Each real history entry owns its reading context. A new tab or a pasted
// article URL starts with the ordinary /blog/ link rendered by Astro.
(() => {
  const field = 'blueNotesReading';
  const transferKey = 'blue-notes:reading-transfer';
  const leftKey = 'blue-notes:reading-left';
  const nav = Reflect.get(window, 'navigation');
  const root = document.documentElement;
  const path = url => new URL(url, location.href).pathname.replace(/\/+$/, '') || '/';
  const resource = url => { const u = new URL(url, location.href); return u.origin + u.pathname + u.search; };
  const source = url => ['/', '/blog', '/archive'].includes(path(url));
  const article = url => path(url).startsWith('/blog/');
  const slugPath = slug => '/blog/' + slug.split('/').map(encodeURIComponent).join('/');
  const id = () => crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
  const traversal = () => nav?.activation?.navigationType === 'traverse' ||
    performance.getEntriesByType('navigation')[0]?.type === 'back_forward';
  function read(key) {
    try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; }
  }
  function write(key, value) {
    try {
      if (value) sessionStorage.setItem(key, JSON.stringify(value));
      else sessionStorage.removeItem(key);
    } catch { /* History entries still carry their own state. */ }
  }
  let current = history.state?.[field] || nav?.currentEntry?.getState()?.[field];
  let outgoing;
  let returningWithKeyboard;
  let recovered;
  let wasCached = false;
  let interrupted = false;
  let highlighted;
  let cueTimer;
  let layoutWatch;

  function save(changes) {
    current = { ...current, ...changes };
    try { history.replaceState({ ...history.state, [field]: current }, ''); } catch { /* Keep the active document usable. */ }
    if (nav?.currentEntry) {
      try { nav.updateCurrentEntry({ state: { ...nav.currentEntry.getState(), [field]: current } }); } catch { /* Cross-document commit may be in progress. */ }
    }
  }
  function incoming() {
    const active = nav?.activation;
    let transfer;
    if (active?.from) {
      if (active.navigationType !== 'push') return;
      const previous = active.from.getState()?.[field];
      transfer = previous?.transfer;
      if (!transfer || previous.id !== transfer.fromId) return;
    } else {
      // A record is published on pagehide. Pairing its one-use nonce with
      // the actual departed entry excludes uncommitted and copied URLs.
      const left = read(leftKey);
      transfer = read(transferKey);
      const type = performance.getEntriesByType('navigation')[0]?.type;
      if (!transfer || type !== 'navigate' || transfer.nonce !== left?.nonce ||
          transfer.fromId !== left.id || !document.referrer ||
          resource(document.referrer) !== transfer.fromUrl) return;
    }
    if (transfer.toUrl === resource(location.href)) return transfer;
  }
  if (!current) {
    const transfer = incoming();
    const state = { id: id(), href: location.href };
    if (transfer?.restore && source(location.href)) {
      recovered = true;
      Object.assign(state, { mark: transfer.restore });
    } else if (transfer && article(location.href)) {
      Object.assign(state, { origin: transfer.origin, depth: transfer.depth, parent: transfer.fromId });
    }
    save(state);
  }
  write(transferKey, null);

  function setBackLink() {
    const back = document.querySelector('[data-reading-back]');
    if (!back || !current.origin) return;
    const url = new URL(current.origin.href, location.href);
    if (url.origin !== location.origin || !source(url)) return;
    const label = path(url) === '/archive' ? '返回归档' : path(url) === '/' ? '返回最近文章' : '返回博客';
    if (path(url) === '/') url.hash = 'recent';
    back.setAttribute('href', url.pathname + url.search + url.hash);
    back.setAttribute('aria-label', label);
    back.setAttribute('title', label);
    const text = back.querySelector('[data-reading-back-label]');
    if (text) text.textContent = label;
  }
  document.addEventListener('DOMContentLoaded', setBackLink, { once: true });

  function beginTransfer(to, details) {
    outgoing = { nonce: id(), fromId: current.id, fromUrl: resource(location.href), toUrl: resource(to), ...details };
    save({ transfer: outgoing });
  }
  function abandonTransfer() {
    if (outgoing || current.transfer) save({ transfer: undefined });
    outgoing = undefined;
    returningWithKeyboard = undefined;
  }
  function position(link, keyboard) {
    const row = link.closest('li') || link;
    return { scroll: scrollY, offset: row.getBoundingClientRect().top, width: innerWidth, height: innerHeight, keyboard };
  }
  // Called by the click coordinator only after it has committed the action.
  function record(link, url, keyboard) {
    abandonTransfer();
    if (url.origin !== location.origin || !article(url)) return;
    const slug = link.querySelector('[data-article-slug]')?.dataset.articleSlug;
    if (source(location.href) && slug && slugPath(slug) === path(url)) {
      const mark = { slug, ...position(link, keyboard) };
      const origin = { id: current.id, key: nav?.currentEntry?.key, href: location.href, mark };
      save({ mark });
      beginTransfer(url, { origin, depth: 1 });
    } else if (article(location.href) && link.closest('.notes-adjacent')) {
      save({ chapter: { to: resource(url), ...position(link, keyboard) } });
      beginTransfer(url, { origin: current.origin, depth: current.depth ? current.depth + 1 : undefined });
    }
  }
  function back(link, keyboard) {
    if (!link.hasAttribute('data-reading-back') || !current.origin) return false;
    const origin = current.origin;
    returningWithKeyboard = keyboard === true;
    let distance;
    if (nav?.currentEntry) {
      const original = nav.entries().find(entry => entry.key === origin.key && entry.getState()?.[field]?.id === origin.id);
      if (original) distance = nav.currentEntry.index - original.index;
    } else if (current.href === location.href && history.state?.[field]?.id === current.id) {
      // depth counts only handshakes for consecutive same-tab article pushes.
      // A hash-created entry or an unverified handoff takes the ordinary href.
      distance = current.depth;
    }
    if (Number.isInteger(distance) && distance > 0 && distance < history.length) {
      history.go(-distance);
      return true;
    }
    if (origin.mark) beginTransfer(link.getAttribute('href'), { restore: origin.mark });
    return false;
  }

  function markToRestore() {
    if (!recovered && !wasCached && !traversal()) return;
    if (recovered) return current.mark;
    const previous = nav?.activation?.from?.getState()?.[field];
    const left = read(leftKey);
    const last = previous || left;
    if (source(location.href) && current.mark && (last?.origin?.id || last?.originId) === current.id) return current.mark;
    if (article(location.href) && current.chapter && last?.parent === current.id) return current.chapter;
  }
  function clearCue() {
    clearTimeout(cueTimer);
    if (highlighted) delete highlighted.dataset.readingReturn;
    highlighted = undefined;
  }
  function restore() {
    const mark = markToRestore();
    if (!mark || interrupted) return;
    const link = Array.from(document.querySelectorAll('[data-reading-entry][href]')).find(row => mark.slug
      ? row.querySelector('[data-article-slug]')?.dataset.articleSlug === mark.slug
      : resource(row.getAttribute('href')) === mark.to);
    if (!link) return;
    root.dataset.restoringReading = '';
    const target = link.shadowRoot?.querySelector('a[href]') || link;
    if (document.activeElement !== link) {
      target.focus({ preventScroll: true, focusVisible: !!(mark.keyboard || read(leftKey)?.keyboard) });
    }
    const row = link.closest('li') || link;
    const sameSize = mark.width === innerWidth && mark.height === innerHeight;
    const y = sameSize ? mark.scroll : scrollY + row.getBoundingClientRect().top - mark.offset;
    if (Math.abs(scrollY - y) > 1) scrollTo({ top: y, behavior: 'instant' });
    if (highlighted !== link) {
      clearCue();
      highlighted = link;
      link.dataset.readingReturn = '';
      cueTimer = setTimeout(clearCue, 850);
    }
  }
  if (markToRestore()) root.dataset.restoringReading = '';
  function interrupt() {
    interrupted = true;
    layoutWatch?.disconnect();
    abandonTransfer();
  }
  for (const type of ['pointerdown', 'keydown', 'wheel']) {
    window.addEventListener(type, interrupt, { capture: true, passive: true });
  }
  window.addEventListener('hashchange', () => {
    if (history.state?.[field]?.id) current = history.state[field];
    else save({ id: id(), href: location.href, depth: undefined, transfer: undefined });
  });
  window.addEventListener('pageshow', event => {
    wasCached = event.persisted;
    interrupted = false;
    setBackLink();
    restore();
    requestAnimationFrame(restore);
    // Fonts and upgraded list items may finish after pageshow and change the
    // scrollable height. Stop following layout as soon as the reader acts.
    if (markToRestore() && typeof ResizeObserver !== 'undefined') {
      layoutWatch?.disconnect();
      const watch = new ResizeObserver(() => requestAnimationFrame(restore));
      layoutWatch = watch;
      watch.observe(document.body);
      setTimeout(() => watch.disconnect(), 850);
    }
    abandonTransfer();
  });
  window.addEventListener('pagereveal', event => {
    event.viewTransition?.finished.then(restore, () => {});
  });
  window.addEventListener('pagehide', () => {
    write(leftKey, { id: current.id, originId: current.origin?.id, parent: current.parent, nonce: outgoing?.nonce, keyboard: returningWithKeyboard });
    write(transferKey, outgoing);
    clearCue();
    layoutWatch?.disconnect();
    recovered = false;
    delete root.dataset.restoringReading;
  });
  // Also consumed before the native cross-document snapshot is captured.
  Reflect.set(window, 'blueReading', { record, back, restore, isReturning: () => !!markToRestore(),
    originSlug: () => current.origin?.mark?.slug });
})();
