// ----- Reveal on scroll -----

const revealItems = document.querySelectorAll('[data-reveal]');
const revealObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  }
}, { threshold: 0.12, rootMargin: '0px 0px -80px 0px' });

revealItems.forEach((item, index) => {
  item.style.transitionDelay = `${Math.min(index * 40, 360)}ms`;
  revealObserver.observe(item);
});

// ----- Copy buttons (with confirmation pulse) -----

for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(button.dataset.copy || '');
      button.textContent = 'Copied ✓';
    } catch {
      button.textContent = 'Select text';
    }
    button.classList.add('is-copied');
    setTimeout(() => {
      button.textContent = original;
      button.classList.remove('is-copied');
    }, 1600);
  });
}

// ----- Tabs (per-client install snippets) -----

const tabButtons = document.querySelectorAll('.tab-button');
const tabPanels = document.querySelectorAll('.tab-panel');

for (const button of tabButtons) {
  button.addEventListener('click', () => {
    const target = button.dataset.tab;
    if (!target) return;

    for (const b of tabButtons) {
      b.classList.toggle('is-active', b === button);
      b.setAttribute('aria-selected', b === button ? 'true' : 'false');
    }

    for (const p of tabPanels) {
      p.classList.toggle('is-active', p.dataset.tab === target);
    }
  });
}

// ----- Subtle parallax on hero stage -----

const stage = document.querySelector('.hero-stage');
if (stage && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let raf = null;
  let mx = 0, my = 0;

  stage.addEventListener('mousemove', (e) => {
    const rect = stage.getBoundingClientRect();
    mx = ((e.clientX - rect.left) / rect.width  - 0.5) * 2;
    my = ((e.clientY - rect.top)  / rect.height - 0.5) * 2;
    if (!raf) raf = requestAnimationFrame(applyParallax);
  });

  stage.addEventListener('mouseleave', () => {
    mx = 0; my = 0;
    if (!raf) raf = requestAnimationFrame(applyParallax);
  });

  function applyParallax() {
    raf = null;
    const core = stage.querySelector('.orbit-core');
    if (core) core.style.translate = `${mx * 14}px ${my * 14}px`;
    const rings = stage.querySelectorAll('.ring');
    rings.forEach((ring, i) => {
      const depth = (i + 1) * 4;
      ring.style.translate = `${mx * depth}px ${my * depth}px`;
    });
  }
}
