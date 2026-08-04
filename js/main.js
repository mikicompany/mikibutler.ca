// Active nav link
const path = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('nav a').forEach(a => {
  if (a.getAttribute('href') === path) a.classList.add('active');
});

// Lightbox
const lightbox = document.getElementById('lightbox');
if (lightbox) {
  const lbImg = lightbox.querySelector('.lb-img');
  const lbCaption = lightbox.querySelector('.lightbox-caption');
  let items = [];
  let current = 0;

  const escapeHtml = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function openLightbox(index) {
    current = index;
    const item = items[current];
    lbImg.src = item.src;
    lbImg.alt = item.title;
    if (lbCaption) {
      const tag = item.tag ? `<span class="lb-cap-tag">${escapeHtml(item.tag)}</span>` : '';
      const title = item.title ? `<span class="lb-cap-title">${escapeHtml(item.title)}</span>` : '';
      const blurb = item.blurb ? `<span class="lb-cap-blurb">${escapeHtml(item.blurb)}</span>` : '';
      // Rebuild the nodes each open so the slide-in animation replays.
      lbCaption.innerHTML = tag + title + blurb;
      lbCaption.classList.toggle('has-blurb', !!item.blurb);
    }
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  function navigate(dir) {
    current = (current + dir + items.length) % items.length;
    openLightbox(current);
  }

  // Re-scannable so pages that render tiles dynamically (protected.html)
  // can hook newly added items into the lightbox.
  window.refreshLightbox = function () {
    items = [];
    document.querySelectorAll('.masonry-item').forEach(el => {
      const img = el.querySelector('img');
      // Video / embedded tiles play inline — skip them (no image to zoom).
      if (!img || el.querySelector('video, iframe')) return;
      const idx = items.length;
      items.push({ src: img.src, title: el.dataset.title || '', tag: el.dataset.tag || '', blurb: el.dataset.blurb || '' });
      el.onclick = () => openLightbox(idx);
    });
  };
  window.refreshLightbox();

  lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  lightbox.querySelector('.lightbox-prev').addEventListener('click', () => navigate(-1));
  lightbox.querySelector('.lightbox-next').addEventListener('click', () => navigate(1));
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  });
}

// Filter buttons
const filterBtns = document.querySelectorAll('.filter-btn');
if (filterBtns.length) {
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      document.querySelectorAll('.masonry-item').forEach(item => {
        const show = filter === 'all' || item.dataset.category === filter;
        item.style.display = show ? 'block' : 'none';
      });
    });
  });
}
