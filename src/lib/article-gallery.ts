import type Viewer from 'viewerjs';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const labels: Record<string, string> = {
  'zoom-in': '放大', 'zoom-out': '缩小', 'one-to-one': '原始比例',
  'rotate-left': '逆时针旋转', 'rotate-right': '顺时针旋转',
  'flip-horizontal': '水平翻转', 'flip-vertical': '垂直翻转',
  reset: '重置', play: '自动播放', fullscreen: '全屏', thumbs: '缩略图',
  close: '关闭', prev: '上一张', next: '下一张',
};
const extraIcons: Record<string, string> = {
  fullscreen: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
  thumbs: 'M3 5h7v6H3z M14 5h7v6h-7z M3 15h7v5H3z M14 15h7v5h-7z',
  close: 'M5 5l14 14M19 5 5 19',
};

function articleImages(article: HTMLElement) {
  return Array.from(article.querySelectorAll<HTMLImageElement>('img')).filter(image => {
    if (!(image.currentSrc || image.src || image.srcset) || image.closest('button, [hidden], [aria-hidden="true"]')) return false;
    const link = image.closest<HTMLAnchorElement>('a[href]');
    return !link || link.href === image.src || link.href === image.currentSrc ||
      /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(link.pathname);
  });
}

function fullImageURL(image: HTMLImageElement) {
  const linked = image.closest<HTMLAnchorElement>('a[href]');
  if (linked) return linked.href;
  // A picture can contain different crops. Use the largest candidate from
  // the source the browser actually chose for this image.
  const sources = Array.from(image.closest('picture')?.querySelectorAll('source') ?? []);
  for (const set of [...sources.map(source => source.srcset), image.srcset]) {
    const candidates = Array.from(set.matchAll(/(?:^|,\s*)(\S+)\s+([\d.]+)[wx](?=\s*(?:,|$))/g));
    if (!candidates.some(match => new URL(match[1], image.baseURI).href === image.currentSrc)) continue;
    const largest = candidates.reduce((best, candidate) => Number(candidate[2]) > Number(best[2]) ? candidate : best);
    return new URL(largest[1], image.baseURI).href;
  }
  return image.currentSrc || image.src;
}

// A linked image can render even when its host serves it as a generic binary.
// Keep it in the document if the gallery chunk could not load.
function showImagePreview(trigger: HTMLImageElement, signal: AbortSignal) {
  const dialog = document.createElement('dialog');
  dialog.className = 'article-image-preview';
  dialog.setAttribute('aria-label', '原图预览');
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '关闭';
  close.addEventListener('click', () => dialog.close());
  const image = new Image();
  image.alt = trigger.alt;
  image.src = fullImageURL(trigger);
  dialog.append(close, image);
  document.body.append(dialog);

  function dispose() {
    dialog.remove();
    delete document.documentElement.dataset.galleryOpen;
    signal.removeEventListener('abort', dispose);
    if (!signal.aborted) (trigger.closest('a') || trigger).focus({ preventScroll: true });
  }
  signal.addEventListener('abort', dispose, { once: true });
  dialog.addEventListener('close', dispose, { once: true });
  document.documentElement.dataset.galleryOpen = '';
  dialog.showModal();
}

// Keep the library's pan, zoom and rotation on the live image while moving
// between its current bounds and the thumbnail in the reading column.
function thumbnailTransition(image: HTMLImageElement, thumbnail: HTMLImageElement, closing: boolean) {
  if (reducedMotion.matches || !thumbnail.isConnected || !image.offsetWidth || !image.offsetHeight) return;
  const target = thumbnail.getBoundingClientRect();
  if (!target.width || !target.height || target.bottom <= 0 || target.top >= innerHeight) return;
  const rect = image.getBoundingClientRect();
  const transform = getComputedStyle(image).transform;
  const matrix = transform === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(transform);
  const x = matrix.e + target.left - rect.left + (target.width - rect.width) / 2;
  const y = matrix.f + target.top - rect.top + (target.height - rect.height) / 2;
  const small = `translate(${x}px, ${y}px) scale(${target.width / image.offsetWidth}, ${target.height / image.offsetHeight})`;
  return image.animate([{ transform: small }, { transform }], {
    duration: closing ? 180 : 240,
    direction: closing ? 'reverse' : 'normal',
    easing: 'cubic-bezier(.22,.68,.16,1)',
  });
}

function showGallery(ViewerClass: typeof Viewer, article: HTMLElement, images: HTMLImageElement[],
  trigger: HTMLImageElement, pageSignal: AbortSignal, onClose: () => void) {
  const multi = images.length > 1;
  const viewport = article.closest<HTMLElement>('.site-viewport');
  const wasInert = viewport?.inert ?? false;
  const session = new AbortController();
  const listeners = { signal: session.signal };
  let overlay: HTMLElement;
  let current = trigger;
  let caption = '';
  let firstView = true;
  let returning = false;
  let autoplay: number | undefined;
  let animation: Animation | undefined;

  function dispose() {
    if (session.signal.aborted) return;
    session.abort();
    clearInterval(autoplay);
    animation?.cancel();
    viewer.destroy();
    if (viewport) viewport.inert = wasInert;
    delete document.documentElement.dataset.galleryOpen;
    if (!pageSignal.aborted && trigger.isConnected) (trigger.closest('a') || trigger).focus({ preventScroll: true });
    onClose();
  }

  function setPressed(name: string, pressed: boolean) {
    overlay.querySelector(`.viewer-toolbar .viewer-${name}`)?.setAttribute('aria-pressed', String(pressed));
  }

  function togglePlay() {
    if (autoplay === undefined) autoplay = window.setInterval(() => {
      const control = overlay.querySelector<HTMLElement>('.viewer-toolbar :focus, .viewer-navigation :focus');
      viewer.next(true);
      control?.focus({ preventScroll: true });
    }, 4000);
    else { clearInterval(autoplay); autoplay = undefined; }
    setPressed('play', autoplay !== undefined);
  }

  function toggleThumbs() {
    const hidden = overlay.classList.toggle('gallery-thumbs-hidden');
    const navbar = overlay.querySelector<HTMLElement>('.viewer-navbar')!;
    navbar.inert = hidden;
    navbar.setAttribute('aria-hidden', String(hidden));
    setPressed('thumbs', !hidden);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === overlay) await document.exitFullscreen();
      else await overlay.requestFullscreen();
    } catch (error) {
      console.warn('Fullscreen is unavailable:', error);
    }
  }

  const viewer = new ViewerClass(article, {
    className: multi ? 'article-gallery' : 'article-gallery gallery-single',
    initialViewIndex: images.indexOf(trigger), initialCoverage: .96,
    filter: image => images.includes(image),
    url: fullImageURL,
    inheritedAttributes: ['crossOrigin', 'decoding', 'referrerPolicy'],
    title: () => caption,
    navbar: multi, navigation: multi, button: false,
    zoomOnWheel: true, slideOnWheel: false, rotateOnTouch: false, maxZoomRatio: 3,
    transition: reducedMotion.matches ? false : { show: false, hide: false, view: false },
    toolbar: {
      position: 'top', zoomIn: true, zoomOut: true, oneToOne: true,
      rotateLeft: true, rotateRight: true, flipHorizontal: true, flipVertical: true, reset: true,
      play: { show: multi, click: togglePlay },
      fullscreen: { show: document.fullscreenEnabled, click: toggleFullscreen },
      thumbs: { show: multi, click: toggleThumbs },
      close: { click: () => viewer.hide() },
    },
    shown() {
      overlay = document.querySelector<HTMLElement>('.article-gallery.viewer-container')!;
      if (viewport) viewport.inert = true;
      document.documentElement.dataset.galleryOpen = '';
      overlay.removeAttribute('aria-labelledby');
      overlay.setAttribute('aria-label', '文章图廊');
      overlay.classList.add('gallery-opening');
      const toolbar = overlay.querySelector<HTMLElement>('.viewer-toolbar')!;
      toolbar.setAttribute('role', 'toolbar');
      toolbar.setAttribute('aria-label', '图片工具');
      for (const [name, label] of Object.entries(labels)) {
        const control = overlay.querySelector<HTMLElement>(`.viewer-toolbar .viewer-${name}, .viewer-navigation .viewer-${name}`);
        if (!control) continue;
        control.setAttribute('aria-label', label);
        control.title = label;
        const path = extraIcons[name];
        if (path) control.innerHTML = `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
      }
      if (multi) {
        const counter = document.createElement('span');
        counter.className = 'gallery-counter';
        counter.setAttribute('aria-live', 'polite');
        overlay.append(counter);
      }
      setPressed('thumbs', true);
      setPressed('play', false);
      setPressed('fullscreen', false);
      document.addEventListener('fullscreenchange', () => setPressed('fullscreen', document.fullscreenElement === overlay), listeners);
      overlay.addEventListener('keydown', event => {
        if (event.key === 'Tab') {
          const controls = Array.from(overlay.querySelectorAll<HTMLElement>('[tabindex="0"]'))
            .filter(item => item.getClientRects().length && !item.closest('[aria-hidden="true"]'));
          const first = controls[0];
          const last = controls.at(-1);
          if (event.shiftKey && first === document.activeElement) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && last === document.activeElement) {
            event.preventDefault();
            first?.focus();
          }
          return;
        }
        const control = event.target instanceof HTMLElement && event.target.closest<HTMLElement>('[role="button"]');
        if (control && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          event.stopPropagation();
          control.click();
        }
      }, listeners);
    },
    view({ detail }) {
      current = detail.originalImage;
      caption = current.closest('figure')?.querySelector(':scope > figcaption')?.textContent.trim() || current.alt.trim();
      // Viewer fits the photo before painting its title. The CSS placeholder
      // reserves the same wrapped text height during that first measurement.
      overlay.querySelector<HTMLElement>('.viewer-title')!.dataset.caption = caption;
      const counter = overlay.querySelector('.gallery-counter');
      if (counter) counter.textContent = `${detail.index + 1} / ${images.length}`;
    },
    viewed({ detail }) {
      if (!firstView) return;
      firstView = false;
      animation = thumbnailTransition(detail.image, current, false);
      overlay.querySelector<HTMLElement>('.viewer-toolbar .viewer-close')?.focus({ preventScroll: true });
    },
    hide(event) {
      if (returning) { event.preventDefault(); return; }
      animation?.cancel();
      const image = overlay.querySelector<HTMLImageElement>('.viewer-canvas > img');
      animation = image ? thumbnailTransition(image, current, true) : undefined;
      if (!animation) return;
      event.preventDefault();
      returning = true;
      clearInterval(autoplay);
      overlay.classList.remove('gallery-opening');
      overlay.classList.add('gallery-closing');
      animation.finished.then(dispose, () => {});
    },
    hidden: dispose,
  });
  pageSignal.addEventListener('abort', dispose, { ...listeners, once: true });
  viewer.show(true);
}

let page: AbortController | undefined;
function installGallery() {
  const article = document.querySelector<HTMLElement>('.reading-page .article-prose');
  if (!article || page) return;
  const controller = new AbortController();
  page = controller;
  const { signal } = controller;
  let opening = false;

  function enhance() {
    for (const image of articleImages(article!)) {
      const link = image.closest('a[href]');
      if (link) {
        link.setAttribute('aria-haspopup', 'dialog');
        continue;
      }
      image.tabIndex = 0;
      image.setAttribute('role', 'button');
      image.setAttribute('aria-haspopup', 'dialog');
      image.setAttribute('aria-label', image.alt ? `放大查看，${image.alt}` : '放大查看图片');
    }
  }
  enhance();
  const observer = new MutationObserver(enhance);
  observer.observe(article, { childList: true, subtree: true });
  signal.addEventListener('abort', () => observer.disconnect(), { once: true });

  async function activate(event: MouseEvent | KeyboardEvent) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (event instanceof KeyboardEvent && !['Enter', ' '].includes(event.key)) return;
    if (!(event.target instanceof Element)) return;
    const img = event.target instanceof HTMLImageElement ? event.target : event.target.closest('a[href]')?.querySelector('img');
    if (!img || !article) return;
    const images = articleImages(article);
    if (!images.includes(img)) return;
    event.preventDefault();
    if (opening) return;
    opening = true;
    try {
      const { default: ViewerClass } = await import('viewerjs');
      if (signal.aborted || !img.isConnected) { opening = false; return; }
      showGallery(ViewerClass, article, articleImages(article), img, signal, () => { opening = false; });
    } catch (error) {
      opening = false;
      console.error('Article gallery could not be opened.', error);
      if (!signal.aborted && img.isConnected) showImagePreview(img, signal);
    }
  }
  article.addEventListener('click', activate, { signal });
  article.addEventListener('keydown', activate, { signal });
}

installGallery();
document.addEventListener('astro:after-swap', installGallery);
document.addEventListener('astro:before-swap', () => { page?.abort(); page = undefined; });
