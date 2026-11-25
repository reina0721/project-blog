const viewer = document.querySelector('#viewer');
const image = viewer.querySelector('.light-img');
const fullLink = viewer.querySelector('#light-link');
const title = viewer.querySelector('#light-title');
for (const site of document.querySelectorAll('.site')) {
  const choice = site.querySelector('select');
  const link = site.querySelector('.panel-link');
  const thumb = link.querySelector('img');
  const name = site.querySelector('h2').textContent;
  choice?.addEventListener('change', () => {
    const option = choice.selectedOptions[0];
    const label = name + '，' + option.textContent;
    link.href = option.value;
    link.setAttribute('aria-label', label + '，查看原图');
    thumb.src = option.value;
    thumb.alt = label + '，按时间顺序排列的实采帧';
    site.querySelector('.fig-note').textContent = option.dataset.note;
  });
  link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !viewer.showModal) return;
    event.preventDefault();
    image.src = link.href;
    image.alt = thumb.alt;
    fullLink.href = link.href;
    title.textContent = name + ' · ' + (choice?.selectedOptions[0]?.textContent || site.querySelector('.site-controls').textContent);
    viewer.showModal();
  });
}
viewer.querySelector('#close').addEventListener('click', () => viewer.close());
viewer.addEventListener('click', event => {
  if (event.target === viewer) viewer.close();
});
