// Touch browsers can defer :active until release. Show contact on pointerdown,
// while leaving scrolling, context menus and the anchor's navigation native.
let pressed: HTMLAnchorElement | null = null;
let pointerId: number | null = null;
let startX = 0;
let startY = 0;

function clearPress() {
  pressed?.removeAttribute('data-pressed');
  pressed = null;
  pointerId = null;
}

function press(target: EventTarget | null) {
  clearPress();
  pressed = target instanceof Element ? target.closest<HTMLAnchorElement>('a.action-link') : null;
  pressed?.setAttribute('data-pressed', '');
}

document.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button !== 0) return clearPress();
  press(event.target);
  if (!pressed) return;
  pointerId = event.pointerId;
  startX = event.clientX;
  startY = event.clientY;
}, { passive: true });

document.addEventListener('pointermove', (event) => {
  if (!pressed || event.pointerId !== pointerId) return;
  if (event.pointerType === 'mouse') {
    if (!pressed.contains(event.target as Node)) clearPress();
  } else if (Math.hypot(event.clientX - startX, event.clientY - startY) > 10) {
    clearPress();
  }
}, { passive: true });

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.repeat) press(event.target);
});
document.addEventListener('keyup', (event) => { if (event.key === 'Enter') clearPress(); });
window.addEventListener('pointerup', clearPress, true);
window.addEventListener('pointercancel', clearPress, true);
window.addEventListener('blur', clearPress);
window.addEventListener('pagehide', clearPress);
document.addEventListener('focusout', (event) => { if (event.target === pressed) clearPress(); });
document.addEventListener('contextmenu', clearPress);
