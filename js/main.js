(function () {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav__link');

  function setActiveNav() {
    const scrollY = window.scrollY + 200;

    sections.forEach((section) => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');

      if (scrollY >= top && scrollY < top + height) {
        navLinks.forEach((link) => {
          link.classList.toggle('active', link.getAttribute('href') === '#' + id);
        });
      }
    });
  }

  window.addEventListener('scroll', setActiveNav, { passive: true });
  setActiveNav();

  navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    });
  });
})();

(function () {
  const section = document.getElementById('notable');
  if (!section) return;

  const items = Array.from(section.querySelectorAll('.notable__item'));
  const tabs = Array.from(section.querySelectorAll('.notable__tab'));
  const panel = section.querySelector('.notable__panel');
  const titleEl = section.querySelector('.notable__title');
  const descEl = section.querySelector('.notable__desc');
  const linkEl = section.querySelector('.notable__link');
  const nextBtn = section.querySelector('.notable__next');

  if (!items.length || !tabs.length || !panel || !titleEl || !descEl || !linkEl || !nextBtn) {
    return;
  }

  let current = 0;
  let switching = false;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fadeMs = reduceMotion ? 0 : 280;

  function readItem(index) {
    const article = items[index];
    const heading = article.querySelector('h3');
    const paragraph = article.querySelector('p');
    const anchor = article.querySelector('a[href]');
    return {
      title: heading ? heading.textContent.trim() : '',
      description: paragraph ? paragraph.textContent.trim() : '',
      href: anchor ? anchor.getAttribute('href') : '',
      linkLabel: anchor ? anchor.textContent.trim() : 'Read more',
      external: Boolean(anchor && anchor.target === '_blank'),
    };
  }

  function applyContent(index) {
    const data = readItem(index);
    titleEl.textContent = data.title;
    descEl.textContent = data.description;

    if (data.href) {
      linkEl.href = data.href;
      linkEl.textContent = data.linkLabel;
      linkEl.hidden = false;
      if (data.external) {
        linkEl.target = '_blank';
        linkEl.rel = 'noopener noreferrer';
      } else {
        linkEl.removeAttribute('target');
        linkEl.removeAttribute('rel');
      }
    } else {
      linkEl.hidden = true;
      linkEl.removeAttribute('href');
    }

    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
    });

    panel.setAttribute('aria-labelledby', tabs[index].id);
    current = index;
  }

  function select(index, { focusTab } = {}) {
    if (index < 0 || index >= items.length || index === current || switching) return;

    const nextIndex = index;
    switching = true;
    panel.classList.add('is-switching');

    window.setTimeout(() => {
      applyContent(nextIndex);
      panel.classList.remove('is-switching');
      switching = false;
      if (focusTab) tabs[nextIndex].focus();
    }, fadeMs);
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(index));

    tab.addEventListener('keydown', (e) => {
      let nextIndex = null;

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        nextIndex = (current + 1) % items.length;
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        nextIndex = (current - 1 + items.length) % items.length;
      } else if (e.key === 'Home') {
        nextIndex = 0;
      } else if (e.key === 'End') {
        nextIndex = items.length - 1;
      }

      if (nextIndex === null) return;
      e.preventDefault();
      select(nextIndex, { focusTab: true });
    });
  });

  nextBtn.addEventListener('click', () => {
    select((current + 1) % items.length);
  });

  applyContent(0);
})();
