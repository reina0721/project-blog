(() => {
  const entries = [
    { id: 'window', title: '窗边的蓝', date: '11.24', body: '傍晚，窗框把蓝天切成了两块。我把那点颜色留下来，试着用它画一条很轻的线。' },
    { id: 'rain', title: '给雨声留个位子', date: '11.18', body: '雨声在屋檐下停了一拍。我也把这一页留得松一点，让字和字之间还有呼吸的地方。' },
    { id: 'mark', title: '铅笔画过的界线', date: '11.06', body: '草稿边缘有一道铅笔印。擦掉之后我又画了回来，有些边界清楚一点，纸上的东西才放得稳。' },
  ];
  const descriptions = {
    plain: '直接换页，作为对照。',
    shared: '只有刚选中的标题移动。',
    echo: '标题身后短暂留下一层浅蓝字影。',
    blur: '标题保持清晰，同卷文章短暂失焦。',
  };
  const scene = document.querySelector('#scene');
  const layer = document.querySelector('#layer');
  const status = document.querySelector('#status');
  const stopButton = document.querySelector('#stop');
  const reduce = document.querySelector('#reduce');
  const slow = document.querySelector('#slow');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let page = 'list';
  let mode = 'shared';
  let userReduced = false;
  let cancelVisuals = () => {};
  let runController;

  function getEntry(id) { return entries.find((item) => item.id === id); }
  function suggestions(except) {
    const items = entries.filter((entry) => entry.id !== except);
    return '<aside class="suggestions"><h3>同卷文章</h3>' + items.map((entry) =>
      '<button type="button" data-page="' + entry.id + '">' + entry.title + '</button>'
    ).join('') + '</aside>';
  }
  function render(next) {
    page = next;
    scene.dataset.page = page;
    const entry = getEntry(page);
    if (page === 'home') {
      scene.innerHTML = '<div class="home-intro"><p class="kicker">主页</p><h2 tabindex="-1">一册手记</h2>' +
        '<p>把日常里值得回头看的几笔留在这里。</p><button class="entry-button" type="button" data-page="list">进入博客</button></div>';
    } else if (page === 'list') {
      const rows = entries.map((item) =>
        '<button type="button" class="row" data-page="' + item.id + '"><span class="entry-title" data-title="' +
        item.id + '">' + item.title + '</span><time>' + item.date + '</time></button>').join('');
      scene.innerHTML = '<div class="scene-grid"><div><p class="kicker">2026 / 十一月</p><h2 tabindex="-1">文章</h2>' +
        rows + '</div>' + suggestions() + '</div>';
    } else {
      scene.innerHTML = '<div class="scene-grid"><article><button class="text-action" type="button" data-page="list">← 返回文章</button>' +
        '<h2 class="article-heading" tabindex="-1"><span class="entry-title" data-title="' + entry.id + '">' + entry.title +
        '</span></h2><p class="meta">2026.' + entry.date + ' · 手记</p><p class="article-copy">' + entry.body +
        '</p></article>' + suggestions(entry.id) + '</div>';
    }
    document.querySelector('#path').textContent = entry ? '博客 / 正文' : page === 'list' ? '博客 / 文章列表' : '主页';
    for (const tab of document.querySelectorAll('.stage-nav button')) {
      if (tab.dataset.page === (page === 'home' ? 'home' : 'list')) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
  }

  function showTransition(next, focus = false) {
    cancelVisuals();
    if (next === page) return;
    const previous = page;
    const id = previous === 'list' ? next : next === 'list' ? previous : '';
    const source = id && scene.querySelector('[data-title="' + id + '"]');
    const oldBounds = source && source.getBoundingClientRect();
    render(next);
    if (focus) {
      const focusTarget = next === 'list' && getEntry(previous)
        ? scene.querySelector('.row[data-page="' + previous + '"]') : scene.querySelector('h2');
      focusTarget?.focus({ preventScroll: true });
    }
    const target = id && scene.querySelector('[data-title="' + id + '"]');
    const duration = (slow.checked ? 2 : 1) * 245;
    if (reduce.checked || preference.matches || typeof layer.animate !== 'function') return;
    const animations = [];
    const options = { duration, easing: 'cubic-bezier(.22,.78,.25,1)', fill: 'both' };
    if (previous === 'home' && next === 'list') {
      const wash = document.createElement('div');
      wash.className = 'wash';
      layer.append(wash);
      animations.push(wash.animate([
        { transform: 'translateX(-88%)', opacity: .82 },
        { opacity: .95, offset: .62 },
        { transform: 'translateX(' + layer.clientWidth + 'px)', opacity: 0 },
      ], options));
    } else if (oldBounds && target && mode !== 'plain') {
      const end = target.getBoundingClientRect();
      const local = layer.getBoundingClientRect();
      const style = getComputedStyle(target);
      if (!end.width || !end.height) return;
      const title = document.createElement('div');
      title.textContent = target.textContent;
      title.className = 'travel-title';
      Object.assign(title.style, {
        left: (end.left - local.left) + 'px', top: (end.top - local.top) + 'px',
        width: end.width + 'px', fontFamily: style.fontFamily, fontSize: style.fontSize,
        fontWeight: style.fontWeight, lineHeight: style.lineHeight, color: style.color,
      });
      const x = oldBounds.left - end.left;
      const y = oldBounds.top - end.top;
      const sx = oldBounds.width / end.width;
      const sy = oldBounds.height / end.height;
      const start = 'translate(' + x + 'px,' + y + 'px) scale(' + sx + ',' + sy + ')';
      if (mode === 'echo') {
        const echo = title.cloneNode(true);
        echo.classList.add('echo');
        echo.style.color = '#2155ae';
        layer.append(echo);
        animations.push(echo.animate([
          { transform: start, opacity: 0 },
          { transform: 'translate(' + (x * .48 + 4) + 'px,' + (y * .48 + 4) + 'px) scale(' +
            (1 + (sx - 1) * .48) + ',' + (1 + (sy - 1) * .48) + ')', opacity: .24, offset: .42 },
          { transform: 'none', opacity: 0 },
        ], { ...options, easing: 'ease-out' }));
      }
      if (mode === 'blur') {
        const aside = scene.querySelector('.suggestions');
        animations.push(aside.animate([
          { filter: 'blur(0px)' },
          { filter: 'blur(3px)', offset: .32 },
          { filter: 'blur(0px)' },
        ], options));
      }
      target.style.visibility = 'hidden';
      layer.append(title);
      animations.push(title.animate([{ transform: start }, { transform: 'none' }], options));
    }
    if (!animations.length) return;
    const cleanup = () => {
      if (cancelVisuals !== cleanup) return;
      for (const animation of animations) animation.cancel();
      if (target) target.style.removeProperty('visibility');
      layer.replaceChildren();
      cancelVisuals = () => {};
    };
    cancelVisuals = cleanup;
    Promise.allSettled(animations.map((animation) => animation.finished)).then(cleanup);
  }

  function stopRun() {
    runController?.abort();
    runController = undefined;
    stopButton.disabled = true;
  }
  function wait(milliseconds, signal) {
    return new Promise((resolve) => {
      if (signal.aborted) { resolve(); return; }
      const timer = setTimeout(done, milliseconds);
      function done() {
        clearTimeout(timer);
        signal.removeEventListener('abort', done);
        resolve();
      }
      signal.addEventListener('abort', done, { once: true });
    });
  }
  async function run(kind) {
    stopRun();
    cancelVisuals();
    const controller = new AbortController();
    runController = controller;
    stopButton.disabled = false;
    const rapid = kind === 'rapid';
    render(kind === 'home' ? 'home' : 'list');
    const steps = kind === 'home' ? ['list'] : rapid ? ['window', 'list', 'rain', 'list'] :
      entries.flatMap((entry) => [entry.id, 'list']);
    status.textContent = kind === 'home' ? '从主页进入博客…' : rapid ? '连续发出四次操作…' : '按顺序打开三篇文章并返回…';
    for (const next of steps) {
      await wait(rapid ? 65 : slow.checked ? 850 : 560, controller.signal);
      if (controller.signal.aborted) return;
      showTransition(next);
    }
    await wait(slow.checked ? 530 : 275, controller.signal);
    if (controller.signal.aborted) return;
    stopRun();
    status.textContent = kind === 'home' ? '已进入博客。' : rapid ? '四次操作结束，最后一次返回文章列表。' : '三篇文章已分别打开并返回。';
  }
  function syncControls() {
    cancelVisuals();
    reduce.disabled = preference.matches;
    reduce.checked = preference.matches || userReduced;
    slow.disabled = reduce.checked;
    document.querySelector('#mode-note').textContent = preference.matches ? '系统已开启减弱动态。' :
      reduce.checked ? '当前所有切换都直接完成。' : descriptions[mode];
  }
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.run) { run(button.dataset.run); return; }
    stopRun();
    if (button === stopButton) {
      cancelVisuals();
      status.textContent = '演示已停，可继续手动切换。';
    } else if (button.dataset.page) {
      showTransition(button.dataset.page, event.detail === 0);
      status.textContent = '当前位置：' + (getEntry(page)?.title || (page === 'home' ? '主页' : '文章列表')) + '。';
    }
  });
  document.addEventListener('change', (event) => {
    stopRun();
    if (event.target.name === 'mode') mode = event.target.value;
    if (event.target === reduce) userReduced = reduce.checked;
    syncControls();
  });
  preference.addEventListener('change', syncControls);
  render(page);
  syncControls();
})();
