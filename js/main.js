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

  document.querySelectorAll('.masonry-item').forEach((el, i) => {
    const img = el.querySelector('img');
    const title = el.dataset.title || '';
    items.push({ src: img.src, title });
    el.addEventListener('click', () => openLightbox(i));
  });

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

// Protected page password check
const pwForm = document.getElementById('pw-form');
if (pwForm) {
  pwForm.addEventListener('submit', e => {
    e.preventDefault();
    const val = document.getElementById('pw-input').value;
    if (val === 'miki2024') {
      document.getElementById('protected-content').style.display = 'block';
      document.getElementById('pw-gate').style.display = 'none';
    } else {
      document.getElementById('pw-error').textContent = 'Incorrect password.';
    }
  });
}
