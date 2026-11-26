import '@material/web/iconbutton/icon-button.js';
import { connectControlRipple } from './control-ripple';

const root = document.documentElement;
const narrow = matchMedia('(max-width: 720px)');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const dialog = document.querySelector<HTMLDialogElement>('#site-drawer')!;
const fallback = document.querySelector<HTMLDetailsElement>('.drawer-fallback')!;
const panel = dialog.querySelector<HTMLElement>('.drawer-panel')!;
const toggle = document.querySelector<HTMLElement>('[data-drawer-toggle]')!;
const closeButton = dialog.querySelector<HTMLElement>('[data-drawer-close]')!;

if (typeof dialog.showModal === 'function') {
  const nav = fallback.querySelector('nav')!;
  fallback.open = false;
  panel.append(nav);
  document.body.append(dialog);
  root.dataset.drawerReady = '';

  for (const host of [toggle, closeButton]) {
    void customElements.whenDefined('md-icon-button').then(async () => {
      const button = host as HTMLElement & { updateComplete: Promise<unknown> };
      await button.updateComplete;
      const trigger = host.shadowRoot?.querySelector('button');
      if (trigger) await connectControlRipple(host, trigger);
    });
  }

  let progress = 0;
  let closingTimer: number | undefined;
  let finishDeparture: (() => void) | undefined;
  let pendingLink: HTMLElement | undefined;
  let closingFocus = false;
  let departing = false;
  let returnFocus = false;
  let keyboardOpen = false;
  let gesture: { id: number; x: number; y: number; width: number; open: boolean; dragging: boolean } | undefined;

  function paint(value: number) {
    progress = Math.max(0, Math.min(1, value));
    root.style.setProperty('--drawer-progress', String(progress));
  }
  function expanded(value: boolean) {
    toggle.setAttribute('aria-expanded', String(value));
    toggle.shadowRoot?.querySelector('button')?.setAttribute('aria-expanded', String(value));
  }
  function show() {
    clearTimeout(closingTimer);
    if (dialog.open) return;
    // The viewport can be several screens tall. Scale around the visible
    // reading position, not the midpoint of the complete document.
    root.style.setProperty('--drawer-origin', (scrollY + innerHeight / 2) + 'px');
    root.dataset.drawerActive = '';
    dialog.showModal();
    if (!keyboardOpen) panel.focus({ preventScroll:true });
    panel.getBoundingClientRect();
  }
  function reset(focusButton = false) {
    clearTimeout(closingTimer);
    gesture = undefined;
    document.removeEventListener('touchmove', move);
    if (dialog.open) dialog.close();
    expanded(false);
    delete root.dataset.drawerActive;
    delete root.dataset.drawerDragging;
    root.style.removeProperty('--drawer-origin');
    root.style.removeProperty('--drawer-progress');
    if (pendingLink) delete pendingLink.dataset.navPending;
    pendingLink = undefined;
    progress = 0;
    if (focusButton && narrow.matches) (toggle.shadowRoot?.querySelector('button') || toggle).focus({ preventScroll: true });
    finishDeparture?.();
    finishDeparture = undefined;
  }
  function settle(open: boolean, focusButton = false) {
    clearTimeout(closingTimer);
    delete root.dataset.drawerDragging;
    if (open) {
      if (pendingLink) delete pendingLink.dataset.navPending;
      pendingLink = undefined;
      finishDeparture?.();
      finishDeparture = undefined;
      show();
      paint(1);
      expanded(true);
      const current = nav.querySelector<HTMLElement>('[aria-current="page"]') || nav.querySelector('a');
      (keyboardOpen && current ? current : panel).focus({ preventScroll: true });
    } else if (dialog.open) {
      closingFocus = focusButton;
      // Keep the transform's starting point when a finger releases between frames.
      panel.getBoundingClientRect();
      paint(0);
      expanded(false);
      if (reduced.matches) reset(focusButton);
      else closingTimer = window.setTimeout(() => reset(focusButton), 275);
    }
  }
  toggle.addEventListener('click', event => { keyboardOpen = event.detail === 0; returnFocus = true; settle(true); });
  closeButton.addEventListener('click', () => settle(false, true));
  dialog.addEventListener('click', event => {
    if (event.target === dialog) settle(false, returnFocus);
  });
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    settle(false, true);
  });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const last = nav.querySelector<HTMLAnchorElement>('a:last-child');
    const active = document.activeElement;
    if (event.shiftKey && (active === closeButton || active === panel || active === dialog)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && last && active === last) {
      event.preventDefault();
      (closeButton.shadowRoot?.querySelector('button') || closeButton).focus();
    }
  });
  panel.addEventListener('transitionend', event => {
    if (event.target === panel && event.propertyName === 'transform' && progress === 0 && !gesture && dialog.open) reset(closingFocus);
  });

  // Leave the outer 24px to the browser/OS. Register a non-passive move
  // listener only while a potential horizontal pull is in progress.
  document.addEventListener('touchstart', event => {
    if (!narrow.matches || event.touches.length !== 1 || departing) { end(true); return; }
    const touch = event.touches[0];
    if (!dialog.open && (touch.clientX < 24 || touch.clientX > 54)) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"], pre')) return;
    gesture = { id:touch.identifier, x:touch.clientX, y:touch.clientY, width:dialog.open ? panel.offsetWidth : Math.min(innerWidth * .78, 332),
      open:dialog.open, dragging:false };
    document.addEventListener('touchmove', move, { passive:false });
  }, { passive:true });
  function move(event: TouchEvent) {
    if (!gesture || event.touches.length !== 1) { end(true); return; }
    const touch = event.touches[0];
    if (touch.identifier !== gesture.id) return;
    const x = touch.clientX - gesture.x;
    const y = touch.clientY - gesture.y;
    if (!gesture.dragging) {
      if (Math.abs(y) > 10 && Math.abs(y) > Math.abs(x)) { end(true); return; }
      if ((gesture.open ? -x : x) < 10 || Math.abs(x) < Math.abs(y) * 1.4) return;
      if (!event.cancelable) { end(true); return; }
      gesture.dragging = true;
      returnFocus = false;
      keyboardOpen = false;
      root.dataset.drawerDragging = '';
      show();
    }
    if (event.cancelable) event.preventDefault();
    paint((gesture.open ? 1 : 0) + x / gesture.width);
  }
  function end(cancelled: boolean) {
    const previous = gesture;
    gesture = undefined;
    document.removeEventListener('touchmove', move);
    if (!previous?.dragging) return;
    settle(cancelled ? previous.open : previous.open ? progress > .7 : progress >= .3);
  }
  document.addEventListener('touchend', () => end(false), { passive:true });
  document.addEventListener('touchcancel', () => end(true), { passive:true });
  document.addEventListener('blue:route-leave', event => {
    const detail = (event as CustomEvent<{ link?: HTMLElement; waitUntil?: (done: Promise<void>) => void }>).detail;
    if (!dialog.open || !detail?.link || !nav.contains(detail.link)) return;
    departing = true;
    pendingLink = detail.link;
    pendingLink.dataset.navPending = '';
    const done = new Promise<void>(resolve => { finishDeparture = resolve; });
    detail.waitUntil?.(done);
    settle(false);
  });
  document.addEventListener('blue:route-cancel', () => {
    if (departing && narrow.matches) { departing = false; settle(true); }
  });
  const clearRoute = () => { departing = false; reset(); };
  document.addEventListener('blue:route-snapshot', clearRoute);
  window.addEventListener('pageswap', clearRoute);
  window.addEventListener('pagehide', clearRoute);
  narrow.addEventListener('change', clearRoute);
}
