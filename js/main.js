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

  function openLightbox(index) {
    current = index;
    const item = items[current];
    lbImg.src = item.src;
    lbImg.alt = item.title;
    if (lbCaption) lbCaption.textContent = item.title;
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
    document.querySelectorAll('.masonry-item').forEach((el, i) => {
      const img = el.querySelector('img');
      const title = el.dataset.title || '';
      items.push({ src: img.src, title });
      el.onclick = () => openLightbox(i);
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
