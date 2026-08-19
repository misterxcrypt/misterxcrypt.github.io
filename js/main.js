/* ───────────────────────────────────────────────────────────────
   Theme. The head script has already applied any stored choice, so
   this only handles switching and persisting it. With nothing stored
   we read the OS preference, so the first click always flips what you
   can actually see.
   ─────────────────────────────────────────────────────────────── */
(function () {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  const root = document.documentElement;

  function resolved() {
    if (root.dataset.theme) return root.dataset.theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  btn.addEventListener('click', () => {
    const next = resolved() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    // Keep the resolved [data-dark] flag in step with the choice: it is the
    // single scope every dark-world style hangs off.
    if (typeof window.__resolveDark === 'function') window.__resolveDark();
    try { localStorage.setItem('theme', next); } catch (e) {}
  });
})();

/* ───────────────────────────────────────────────────────────────
   Section highlighting, in both the topbar and the mobile strip.
   ─────────────────────────────────────────────────────────────── */
(function () {
  const sections = Array.from(document.querySelectorAll('main section[id]'));
  const links = Array.from(document.querySelectorAll('.topbar__nav a, .subnav a'));
  if (!sections.length || !links.length) return;

  let ticking = false;

  function update() {
    const marker = window.scrollY + window.innerHeight * 0.3;
    let current = null;

    sections.forEach((section) => {
      if (marker >= section.offsetTop) current = section;
    });

    const id = current ? '#' + current.getAttribute('id') : null;
    links.forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === id);
    });

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
  }, { passive: true });

  window.addEventListener('resize', update, { passive: true });
  update();
})();


/* ───────────────────────────────────────────────────────────────
   Navigation chrome: reading progress, condensed state, and a
   sliding indicator that follows the active link. All of it is
   progressive: without JS the nav is still a working list of links.
   ─────────────────────────────────────────────────────────────── */
(function () {
  const bar    = document.getElementById('scrollbar');
  const topbar = document.querySelector('.topbar');
  const nav    = document.querySelector('.topbar__nav');
  if (!topbar) return;

  let pill = null;
  if (nav) {
    pill = document.createElement('span');
    pill.className = 'navpill';
    nav.appendChild(pill);
  }

  function movePill() {
    if (!pill || !nav) return;
    const active = nav.querySelector('a.active');
    if (!active) { pill.style.opacity = '0'; return; }
    const n = nav.getBoundingClientRect();
    const a = active.getBoundingClientRect();
    pill.style.width = a.width + 'px';
    pill.style.transform = 'translateX(' + (a.left - n.left) + 'px)';
    pill.style.opacity = '1';
  }

  let ticking = false;
  function frame() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    if (bar) bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
    topbar.classList.toggle('is-stuck', window.scrollY > 24);
    movePill();
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  }, { passive: true });
  window.addEventListener('resize', frame, { passive: true });

  // Fonts change link widths, so re-measure once they have settled.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(movePill);
  frame();
})();

/* ───────────────────────────────────────────────────────────────
   Motion (GSAP + ScrollTrigger).

   Two hard rules:
   1. Nothing is hidden until we know GSAP loaded and the visitor has
      not asked for reduced motion. The `js-anim` class is what makes
      `[data-reveal]` transparent, and we only add it once both checks
      pass, so a failed CDN or a no-JS visitor still sees the page.
   2. Motion carries hierarchy, not decoration: content enters in
      reading order, and parallax is limited to background layers.
   ─────────────────────────────────────────────────────────────── */
(function () {
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The head script hid the reveal targets. If we cannot animate them for any
  // reason, give them straight back rather than leaving a blank page.
  if (reduced || typeof window.gsap === 'undefined') {
    root.classList.remove('js-anim');
    return;
  }

  const gsap = window.gsap;
  if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

  // Hero enters in reading order, once, on load. fromTo (not from) because
  // the CSS start state is already opacity 0, so a plain `from` would tween
  // 0 to 0 and leave the hero invisible.
  const heroBits = gsap.utils.toArray('.hero [data-reveal]');
  gsap.fromTo(heroBits,
    { y: 18, opacity: 0 },
    { y: 0, opacity: 1, ease: 'power3.out', duration: 0.8, stagger: 0.09 });

  if (!window.ScrollTrigger) {
    gsap.set('[data-reveal]', { opacity: 1 });
    return;
  }

  // Everything below the fold reveals as it arrives. Cards in the same
  // row animate together rather than one-by-one, which reads as a
  // deliberate group instead of a wave.
  const below = 'main section:not(.hero) [data-reveal]';

  ScrollTrigger.batch(below, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) => gsap.to(batch, {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: 'power3.out',
      stagger: 0.07,
      overwrite: true
    })
  });
  gsap.set(below, { y: 22 });

  // Safety net. A reveal that never fires is a blank section, which is far
  // worse than an un-animated one. ScrollTrigger can miss when the page is
  // jumped rather than scrolled: an anchor link, a restored scroll position,
  // or a programmatic scroll that emits no scroll event. This observer
  // force-reveals anything that reaches the viewport by any route, so the
  // animation stays a nicety and never becomes a dependency.
  const rescue = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      gsap.to(entry.target, { opacity: 1, y: 0, duration: .45, ease: 'power2.out', overwrite: true });
      rescue.unobserve(entry.target);
    });
  }, { rootMargin: '120px 0px' });

  document.querySelectorAll(below).forEach((el) => rescue.observe(el));

  // Jumping to an anchor changes what is on screen without a scroll event,
  // so re-measure once the jump has settled.
  window.addEventListener('hashchange', () => setTimeout(() => ScrollTrigger.refresh(), 60));
  window.addEventListener('load', () => ScrollTrigger.refresh());

  // Parallax: background layers only, so nothing readable ever drifts.
  if (document.querySelector('.hero__glow')) {
    gsap.to('.hero__glow', {
      y: 90,
      scale: 1.08,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 }
    });
  }

  const graph = document.querySelector('.hero__visual');
  if (graph) {
    gsap.to(graph, {
      y: -46,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 }
    });
  }

  // The grove artwork draws itself the first time it scrolls into view.
  const grove = document.querySelector('.grove');
  if (grove) {
    const strokes = grove.querySelectorAll('path');
    strokes.forEach((path) => {
      const len = path.getTotalLength();
      gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
    });
    gsap.to(strokes, {
      strokeDashoffset: 0,
      duration: 1.4,
      ease: 'power2.out',
      stagger: 0.08,
      scrollTrigger: { trigger: grove, start: 'top 85%', once: true }
    });
  }

  // Verified metrics count up once, on entry. The final value is the
  // documented figure, not live telemetry, so it runs a single time and
  // the correct number is already in the HTML if this never fires.
  gsap.utils.toArray('[data-count]').forEach((el) => {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const obj = { v: 0 };
    gsap.to(obj, {
      v: target,
      duration: 1.4,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      onUpdate: () => { el.textContent = Math.round(obj.v).toLocaleString('en-US') + suffix; },
      onComplete: () => { el.textContent = target.toLocaleString('en-US') + suffix; }
    });
  });

  // Diagram elements reveal as each case study arrives. The diagram
  // vocabulary varies per figure, so collect whatever primitives are
  // present and skip empty sets rather than handing GSAP a null target.
  gsap.utils.toArray('.diagram').forEach((fig) => {
    const shapes = fig.querySelectorAll(
      '.dg__box, .dg__hub, .dg__node, .dg__cell, .dg__seed, .dg__stack, .dg__gate, .dg__chip'
    );
    const marks  = fig.querySelectorAll('.dg__pip, .dg__flow, .dg__brace, .dg__scan, .dg__halo');
    const labels = fig.querySelectorAll('.dg__t, .dg__s, .dg__lab, .dg__cap');

    const tl = gsap.timeline({
      scrollTrigger: { trigger: fig, start: 'top 85%', once: true }
    });

    if (shapes.length) tl.from(shapes, { opacity: 0, y: 10, duration: .45, ease: 'power2.out', stagger: .08 }, 0);
    if (marks.length)  tl.from(marks,  { opacity: 0, scale: .9, transformOrigin: 'center', duration: .4, ease: 'power2.out', stagger: .06 }, .2);
    if (labels.length) tl.from(labels, { opacity: 0, duration: .35, ease: 'none', stagger: .02 }, .15);
  });
})();

/* ───────────────────────────────────────────────────────────────
   Hero graph probing. Hover or keyboard-focus an entity to read what
   it is. Pure enhancement: without JS the graph is still a labelled
   diagram with an accessible description on the <svg>.
   ─────────────────────────────────────────────────────────────── */
(function () {
  const wrap = document.querySelector('.graphwrap');
  const card = document.getElementById('gcard');
  if (!wrap || !card) return;

  const svg   = wrap.querySelector('.graph');
  const type  = card.querySelector('.gcard__type');
  const desc  = card.querySelector('.gcard__desc');
  const nodes = wrap.querySelectorAll('.gnode');

  function show(node) {
    type.textContent = node.dataset.label;
    desc.textContent = node.dataset.desc;
    card.hidden = false;
    wrap.classList.add('is-probing');

    // Map the node's viewBox coordinates to the rendered box.
    const box = svg.getBoundingClientRect();
    const vb  = svg.viewBox.baseVal;
    const x = (parseFloat(node.dataset.x) / vb.width)  * box.width;
    const y = (parseFloat(node.dataset.y) / vb.height) * box.height;
    card.style.left = x + 'px';
    card.style.top  = y + 'px';
  }

  function hide() {
    card.hidden = true;
    wrap.classList.remove('is-probing');
  }

  nodes.forEach((n) => {
    n.addEventListener('mouseenter', () => show(n));
    n.addEventListener('focus', () => show(n));
    n.addEventListener('mouseleave', hide);
    n.addEventListener('blur', hide);
    n.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hide(); n.blur(); } });
  });
  wrap.addEventListener('mouseleave', hide);
})();

/* ───────────────────────────────────────────────────────────────
   Footer wordmark: types itself out the first time it scrolls into
   view. The full text stays in the DOM for search and assistive tech;
   we only swap what is painted. With reduced motion the finished
   string is simply left alone.
   ─────────────────────────────────────────────────────────────── */
(function () {
  const els = Array.from(document.querySelectorAll('[data-typewriter]'));
  if (!els.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  const SPEED = 105; // ms per character

  function type(el) {
    const full = el.dataset.typewriter || el.textContent;
    el.setAttribute('aria-label', full);
    el.textContent = '';

    let i = 0;
    (function step() {
      el.textContent = full.slice(0, ++i);
      if (i < full.length) setTimeout(step, SPEED);
    })();
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      type(entry.target);
    });
  }, { threshold: 0.6 });

  els.forEach((el) => io.observe(el));
})();

/* ───────────────────────────────────────────────────────────────
   Research filtering. Items are hidden, never removed, so every
   article stays in the DOM for crawlers and answer engines.
   ─────────────────────────────────────────────────────────────── */
(function () {
  const buttons = document.querySelectorAll('.filter');
  if (!buttons.length) return;

  const items  = document.querySelectorAll('[data-cat]');
  const groups = document.querySelectorAll('.postgroup');

  function apply(cat) {
    items.forEach((el) => {
      if (el.classList.contains('postgroup')) return;
      el.classList.toggle('is-out', cat !== 'all' && el.dataset.cat !== cat);
    });
    // Hide a group whose every child is filtered out.
    groups.forEach((g) => {
      const kids = g.querySelectorAll('li');
      const anyLeft = [...kids].some((k) => !k.classList.contains('is-out'));
      g.classList.toggle('is-out', !anyLeft);
    });
  }

  buttons.forEach((b) => {
    b.addEventListener('click', () => {
      buttons.forEach((x) => x.classList.toggle('is-on', x === b));
      apply(b.dataset.filter);
    });
  });
})();

/* ───────────────────────────────────────────────────────────────
   Marquee duplication. A seamless loop needs the track twice, but
   shipping the second copy in the HTML means crawlers, text
   extractors and AI readers see every tool and discipline listed
   twice. Clone it at runtime instead: the source stays clean, the
   loop still works, and the clone is hidden from assistive tech.
   ─────────────────────────────────────────────────────────────── */
(function () {
  document.querySelectorAll('.toolstrip__viewport, .capstrip__viewport').forEach((view) => {
    const track = view.querySelector('ul');
    if (!track) return;
    const clone = track.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    view.appendChild(clone);
  });
})();

/* ───────────────────────────────────────────────────────────────
   Diagram motion. The case-study diagrams animate with SMIL, which
   CSS cannot stop, so reduced-motion preference is honoured here by
   pausing each SVG's timeline. Diagrams also idle while off-screen:
   a scam network flowing in a diagram nobody is looking at is just
   battery cost.
   ─────────────────────────────────────────────────────────────── */
(function () {
  const svgs = Array.from(document.querySelectorAll('.diagram svg'));
  if (!svgs.length) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  function applyReduced() {
    if (!reduce.matches) return false;
    svgs.forEach((s) => { try { s.pauseAnimations(); } catch (e) {} });
    return true;
  }

  if (applyReduced()) {
    reduce.addEventListener?.('change', () => { if (!reduce.matches) location.reload(); });
    return;
  }

  if (!('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const svg = entry.target;
      try {
        if (entry.isIntersecting) svg.unpauseAnimations();
        else svg.pauseAnimations();
      } catch (e) {}
    });
  }, { rootMargin: '120px 0px' });

  svgs.forEach((s) => { try { s.pauseAnimations(); } catch (e) {} io.observe(s); });
})();

/* ───────────────────────────────────────────────────────────────
   Marginalia. The gutters carry a measuring rule and a glyph spine.
   Both are injected here rather than shipped in the HTML: they are
   presentational, and a text extractor or a screen reader has no use
   for a column of hashes. The rule's index mark is the only moving
   part, and it tracks reading position rather than running on its own
   schedule.
   ─────────────────────────────────────────────────────────────── */
(function () {
  // Deferred rather than an early return: bailing out permanently meant a
  // window widened past the threshold never got these until a reload.
  const mq = window.matchMedia('(min-width: 84rem)');
  if (!mq.matches) {
    mq.addEventListener('change', function once() {
      if (!mq.matches) return;
      mq.removeEventListener('change', once);
      build();
    });
    return;
  }
  build();
  function build() {

  const GLYPHS = '  #      #\n  ###   ##\n  ##### ##\n ####### #\n ######  #\n #### ####\n  ## #####\n   #######\n  ########\n #########\n  #### ###\n   ## ####\n    # ####\n     #####\n      ####\n       ###\n        ##\n  #      #\n  ###   ##\n  ##### ##\n ####### #\n ######  #\n #### ####\n  ## #####\n   #######\n  ########\n #########\n  #### ###\n   ## ####\n    # ####\n     #####\n      ####\n       ###\n        ##\n  #      #\n  ###   ##\n  ##### ##\n ####### #\n ######  #\n #### ####\n  ## #####\n   #######\n  ########\n #########\n  #### ###\n   ## ####\n    # ####\n     #####\n      ####\n       ###\n        ##\n  #      #\n  ###   ##\n  ##### ##\n ####### #\n ######  #\n #### ####\n  ## #####\n   #######\n  ########\n #########\n  #### ###\n   ## ####\n    # ####\n     #####\n      ####\n       ###\n        ##\n  #      #\n  ###   ##\n  ##### ##\n ####### #\n ######  #\n #### ####\n  ## #####\n   #######\n  ########\n #########\n  #### ###\n   ## ####\n    # ####\n     #####\n      ####\n       ###\n        ##\n  #      #\n  ###   ##\n  ##### ##\n ####### #\n ######  #\n #### ####\n  ## #####\n   #######\n  ########\n #########\n  #### ###\n   ## ####\n    # ####\n     #####\n      ####\n       ###\n        ##';

  const wrap = document.createElement('div');
  wrap.className = 'marginalia';
  wrap.setAttribute('aria-hidden', 'true');

  const left = document.createElement('div');
  left.className = 'marg marg--l';
  left.innerHTML = '<div class="marg__rule"></div><div class="marg__index" data-read="000"></div>';

  const right = document.createElement('div');
  right.className = 'marg marg--r';
  const pre = document.createElement('pre');
  pre.className = 'marg__glyphs';
  pre.textContent = GLYPHS;
  right.appendChild(pre);

  wrap.append(left, right);
  document.body.appendChild(wrap);

  const index = left.querySelector('.marg__index');

  let ticking = false;
  function frame() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    left.style.setProperty('--read', p.toFixed(4));
    index.dataset.read = String(Math.round(p * 100)).padStart(3, '0');
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  }, { passive: true });
  window.addEventListener('resize', frame, { passive: true });
  frame();
  }
})();

/* ───────────────────────────────────────────────────────────────
   Dark-world artifacts: case files, terminal fragments, connector
   strings and screen texture.

   Injected here rather than written into the HTML for two reasons.
   They are decorative, so a text extractor or screen reader has no
   use for them; and they belong to one theme, so keeping them out of
   the markup means the light theme cannot inherit them by accident.

   Nothing here invents data. Every dossier field is read out of the
   case study it attaches to, and the redacted line hides real text and
   returns it on hover or keyboard focus.
   ─────────────────────────────────────────────────────────────── */
(function () {
  const cases = Array.from(document.querySelectorAll('.case.card'));

  // Head-and-shoulders mass resolved as scan bars: what an identity
  // looks like when you only hold fragments of it.
  function mug(seed) {
    let bars = '';
    for (let i = 0; i < 11; i++) {
      const y = 6 + i * 5;
      const inset = i < 4
        ? 18 - i * 3.2                       // crown tapers in
        : Math.max(2, 8 - (i - 4) * 1.6);    // shoulders spread out
      const w = 54 - inset * 2;
      const jitter = ((seed * (i + 3)) % 5) - 2;
      const o = (0.22 + ((seed + i) % 5) * 0.14).toFixed(2);
      bars += '<rect x="' + (inset + jitter) + '" y="' + y + '" width="' + w +
              '" height="3" opacity="' + o + '"/>';
    }
    return '<svg viewBox="0 0 54 62" aria-hidden="true"><g fill="currentColor">' +
           bars + '</g></svg>';
  }

  function readRail(card, label) {
    const rows = Array.from(card.querySelectorAll('.rail__row'));
    for (const r of rows) {
      const k = r.querySelector('.rail__k');
      if (k && k.textContent.trim().toLowerCase() === label) {
        const v = r.querySelector('.rail__v');
        if (v) return v.textContent.trim();
        const img = r.querySelector('img');
        if (img) return img.getAttribute('alt') || '';
      }
    }
    return '';
  }

  cases.forEach((card, i) => {
    const ref     = readRail(card, 'reference') || 'CTI-00' + (i + 1);
    const period  = readRail(card, 'period');
    const role    = readRail(card, 'role');
    const disc    = readRail(card, 'discipline');
    const titleEl = card.querySelector('.case__title');
    const title   = titleEl ? titleEl.textContent.trim() : '';

    // The redacted line carries the case's real opening sentence. It is
    // hover-only and deliberately not focusable: the whole dossier is
    // aria-hidden because it repeats what the case study already says,
    // and a focusable node inside aria-hidden is a tab stop a screen
    // reader cannot announce. Nothing is lost — the same sentence sits
    // in the case body above, unredacted.
    const firstPara = card.querySelector('.case__col p');
    const secret = firstPara
      ? firstPara.textContent.trim().split(/(?<=\.)\s/)[0]
      : '';

    const d = document.createElement('div');
    d.className = 'dossier';
    d.setAttribute('aria-hidden', 'true');
    d.innerHTML =
      '<div class="dossier__bar"><span>FILE ' + ref.replace(/[^\w-]/g, '') +
        '</span><span class="dossier__state">CLOSED</span></div>' +
      '<div class="dossier__body">' +
        '<div class="dossier__mug">' + mug(i + 2) + '</div>' +
        '<div class="dossier__rows">' +
          row('subject', title) +
          row('field', disc) +
          row('operator', role) +
          row('window', period) +
          (secret
            ? '<div class="dossier__row"><span class="dossier__k">summary</span>' +
              '<span class="dossier__v"><span class="dossier__redact">' +
              esc(secret) + '</span></span></div>'
            : '') +
        '</div>' +
      '</div>';

    const layout = card.querySelector('.case__main') || card;
    layout.appendChild(d);
  });

  function row(k, v) {
    if (!v) return '';
    return '<div class="dossier__row"><span class="dossier__k">' + k +
           '</span><span class="dossier__v">' + esc(v) + '</span></div>';
  }
  function esc(t) {
    return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Terminal fragment between two major sections.
  const brk = document.createElement('pre');
  brk.className = 'asciibreak';
  brk.setAttribute('aria-hidden', 'true');
  brk.textContent =
    '┌──────────────────────────────────────────────┐\n' +
    '│  ARCHIVE / 04 FILES   ·   ACCESS: GRANTED    │\n' +
    '└──────────────────────────────────────────────┘';
  const exp = document.getElementById('experience');
  if (exp && exp.parentNode) exp.parentNode.insertBefore(brk, exp);

  // Connector strings down the case-study stack: pinned points, string
  // between them. Positions are measured, so the strings actually join
  // the files rather than being drawn at random.
  const stack = document.getElementById('case-studies');
  if (stack && cases.length > 1) {
    const layer = document.createElement('div');
    layer.className = 'strings';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = '<svg preserveAspectRatio="none"></svg>';
    stack.style.position = 'relative';
    stack.insertBefore(layer, stack.firstChild);
    const svg = layer.querySelector('svg');

    function draw() {
      const box = stack.getBoundingClientRect();
      const w = box.width, h = box.height;
      if (!w || !h) return;
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      const pts = cases.map((c) => {
        const r = c.getBoundingClientRect();
        return { x: r.left - box.left, y: r.top - box.top, w: r.width };
      });
      let d = '', dots = '';
      pts.forEach((p, i) => {
        const px = p.x + (i % 2 ? p.w - 14 : 14);
        const py = p.y + 14;
        dots += '<circle cx="' + px + '" cy="' + py + '" r="3"/>';
        if (i) {
          const q = pts[i - 1];
          const qx = q.x + ((i - 1) % 2 ? q.w - 14 : 14);
          const qy = q.y + 14;
          d += 'M' + qx + ' ' + qy + ' L' + px + ' ' + py + ' ';
        }
      });
      svg.innerHTML = '<path d="' + d + '"/>' + dots;
    }

    // Measuring at script time is too early: fonts have not settled, the
    // reveal transforms have not been applied, and disclosure panels are
    // still closed — which is how this produced a 144px box and negative
    // pin coordinates. A ResizeObserver on the section fires whenever its
    // real box changes, from any cause, so the strings are drawn against
    // the layout that actually exists.
    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; draw(); });
    };

    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(schedule);
      ro.observe(stack);
      cases.forEach((c) => ro.observe(c));
    } else {
      window.addEventListener('resize', schedule, { passive: true });
      window.addEventListener('load', schedule);
    }

    // Opening a case's detail panel changes the stack height under us.
    stack.addEventListener('toggle', schedule, true);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    schedule();
  }

  // Atmosphere and screen texture, each on its own fixed layer so neither
  // repaints while the page scrolls.
  const atmos = document.createElement('div');
  atmos.className = 'atmos';
  atmos.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(atmos, document.body.firstChild);

  const crt = document.createElement('div');
  crt.className = 'crt';
  crt.setAttribute('aria-hidden', 'true');
  document.body.appendChild(crt);
})();

/* ───────────────────────────────────────────────────────────────
   Margin hand. A handful of drawn marks placed against real anchors
   in the page — circled emphasis, an arrow, a bracket, a spark.

   Every stroke is generated with jitter rather than typed as a fixed
   path, so no two marks are identical and none of them sit level. A
   perfectly smooth bezier reads as a graphic; a slightly wrong one
   reads as a hand. Seeded, so the same page draws the same way twice.

   Dark-only and aria-hidden. Six marks total: the brief asked for
   discovered details, and a detail stops being one when it is
   everywhere.
   ─────────────────────────────────────────────────────────────── */
(function () {
  // Same deferral as the marginalia: build on first match, not only at load.
  const mq = window.matchMedia('(min-width: 80rem)');
  if (!mq.matches) {
    mq.addEventListener('change', function once() {
      if (!mq.matches) return;
      mq.removeEventListener('change', once);
      build();
    });
    return;
  }
  build();
  function build() {

  // Small deterministic PRNG: the wobble should be arbitrary, not random
  // per reload, or the marks would twitch on every navigation.
  function rng(seed) {
    let s = seed * 9301 + 49297;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  // Walk a set of points, nudging each one off true.
  function rough(points, amp, rand) {
    return points.map(([x, y], i) => {
      if (i === 0 || i === points.length - 1) return [x, y];
      return [x + (rand() - 0.5) * amp, y + (rand() - 0.5) * amp];
    });
  }

  function toPath(pts) {
    return pts.reduce((d, [x, y], i) =>
      d + (i ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1), '');
  }

  // An ellipse drawn as an open, overshooting loop — the way you circle
  // something on paper, never quite closing and going slightly past.
  function circleMark(w, h, seed) {
    const rand = rng(seed);
    const pts = [];
    const start = -0.5, turns = Math.PI * 2.12;
    for (let i = 0; i <= 44; i++) {
      const t = start + (i / 44) * turns;
      const wob = 1 + (rand() - 0.5) * 0.08;
      pts.push([
        w / 2 + Math.cos(t) * (w / 2 - 4) * wob,
        h / 2 + Math.sin(t) * (h / 2 - 4) * wob
      ]);
    }
    return toPath(pts);
  }

  function arrowMark(w, h, seed) {
    const rand = rng(seed);
    const shaft = rough([[2, h - 4], [w * 0.34, h * 0.5], [w * 0.72, h * 0.26], [w - 6, 6]], 5, rand);
    const head = 'M' + (w - 6) + ' 6 L' + (w - 17) + ' ' + 10 +
                 ' M' + (w - 6) + ' 6 L' + (w - 10) + ' ' + 18;
    return toPath(shaft) + ' ' + head;
  }

  function bracketMark(w, h, seed) {
    const rand = rng(seed);
    return toPath(rough([[w - 3, 2], [4, 5], [3, h / 2], [4, h - 5], [w - 3, h - 2]], 3.4, rand));
  }

  function sparkMark(w, h, seed) {
    const rand = rng(seed);
    const c = [w / 2, h / 2];
    let d = '';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.3;
      const r1 = 2 + rand() * 1.5, r2 = w / 2 - 1 - rand() * 2;
      d += ' M' + (c[0] + Math.cos(a) * r1).toFixed(1) + ' ' + (c[1] + Math.sin(a) * r1).toFixed(1) +
           ' L' + (c[0] + Math.cos(a) * r2).toFixed(1) + ' ' + (c[1] + Math.sin(a) * r2).toFixed(1);
    }
    return d.trim();
  }

  const KINDS = { circle: circleMark, arrow: arrowMark, bracket: bracketMark, spark: sparkMark };

  function place(anchor, opts) {
    if (!anchor) return null;
    if (getComputedStyle(anchor).position === 'static') anchor.style.position = 'relative';

    const el = document.createElement('div');
    el.className = 'hand';
    el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, {
      width: opts.w + 'px', height: opts.h + 'px',
      left: opts.left, right: opts.right, top: opts.top, bottom: opts.bottom,
      transform: 'rotate(' + (opts.rot || 0) + 'deg)'
    });
    el.innerHTML = '<svg viewBox="0 0 ' + opts.w + ' ' + opts.h + '"><path d="' +
                   KINDS[opts.kind](opts.w, opts.h, opts.seed) + '"/></svg>';
    anchor.appendChild(el);
    return el;
  }

  function note(anchor, text, opts) {
    if (!anchor) return;
    if (getComputedStyle(anchor).position === 'static') anchor.style.position = 'relative';
    const n = document.createElement('span');
    n.className = 'handnote';
    n.setAttribute('aria-hidden', 'true');
    n.textContent = text;
    Object.assign(n.style, { left: opts.left, right: opts.right, top: opts.top, bottom: opts.bottom });
    anchor.appendChild(n);
  }

  const drawn = [];
  const $ = (s) => document.querySelector(s);

  // 1 — the headline number in the first case study, circled.
  const firstCallout = $('.case .callout__n');
  if (firstCallout) {
    drawn.push(place(firstCallout, {
      kind: 'circle', w: 200, h: 84, seed: 7,
      left: '-22px', top: '-14px', rot: -1.6
    }));
    note(firstCallout, 'the number that mattered', { left: '-14px', top: '76px' });
  }

  // 2 — an arrow into the convergence diagram, where the finding lives.
  // Anchored to the column, not the figure: .diagram scrolls horizontally,
  // so anything placed outside its box gets clipped by the overflow.
  const conv = $('.diagram--converge');
  if (conv && conv.parentElement) {
    drawn.push(place(conv.parentElement, {
      kind: 'arrow', w: 92, h: 70, seed: 21,
      left: '-112px', top: '18px', rot: 4
    }));
    note(conv.parentElement, 'gateways own the IDs', { left: '-208px', top: '-6px' });
  }

  // 3 — one mark per remaining case study, so the stack reads as a
  //     worked-through set rather than one annotated file and three not.
  const cases = Array.from(document.querySelectorAll('.case.card'));

  // CTI-002: bracket beside the scanning figure.
  const sweep = document.querySelector('.diagram--sweep');
  if (sweep && sweep.parentElement) {
    drawn.push(place(sweep.parentElement, {
      kind: 'bracket', w: 24, h: 96, seed: 88,
      left: '-42px', top: '12px', rot: 1
    }));
    note(sweep.parentElement, 'the whole plane, not a sample', { left: '-238px', top: '112px' });
  }

  // CTI-003: circled emphasis on the confidence bands.
  const fan = document.querySelector('.diagram--fan');
  if (fan && fan.parentElement) {
    drawn.push(place(fan.parentElement, {
      kind: 'spark', w: 20, h: 20, seed: 96,
      left: '-36px', top: '26px', rot: -6
    }));
    note(fan.parentElement, 'why it survived', { left: '-176px', top: '-4px' });
  }

  // CTI-004: arrow into the returned-for-evidence loop.
  const states = document.querySelector('.diagram--states');
  if (states && states.parentElement) {
    drawn.push(place(states.parentElement, {
      kind: 'arrow', w: 84, h: 62, seed: 104,
      left: '-96px', top: '30px', rot: 6
    }));
    note(states.parentElement, 'cases come back', { left: '-182px', top: '104px' });
  }

  // 4 — a bracket beside the experience spine.
  drawn.push(place($('#experience .section__head'), {
    kind: 'bracket', w: 26, h: 92, seed: 33,
    left: '-46px', top: '4px', rot: -1
  }));

  // 5 — a spark by the projects heading.
  drawn.push(place($('#projects .section__title'), {
    kind: 'spark', w: 22, h: 22, seed: 51,
    right: '-34px', top: '-6px', rot: 8
  }));

  // 6 — emphasis under the contact headline.
  drawn.push(place($('#contact .section__title'), {
    kind: 'circle', w: 260, h: 74, seed: 68,
    left: '-18px', top: '-8px', rot: 1.2
  }));

  // Draw each mark the first time it arrives, rather than on load.
  const marks = drawn.filter(Boolean);
  if (!marks.length || !('IntersectionObserver' in window)) return;

  marks.forEach((el) => {
    el.querySelectorAll('path, ellipse').forEach((p) => {
      const len = p.getTotalLength ? p.getTotalLength() : 400;
      p.style.setProperty('--len', len);
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
    });
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-drawn');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px' });

  function watch() {
    marks.forEach((el) => {
      if (!el.classList.contains('is-drawn')) io.observe(el);
    });
  }
  watch();

  // Entering the dark world is the moment these first become visible, so
  // re-arm then. Without this, every mark already on screen at the switch
  // stays at full dash offset — drawn, but invisible.
  const root = document.documentElement;
  new MutationObserver(() => {
    if (root.hasAttribute('data-dark')) watch();
  }).observe(root, { attributes: true, attributeFilter: ['data-dark'] });
  }
})();

/* ───────────────────────────────────────────────────────────────
   Investigation board. An original composition — pinned document
   fragments, redaction bars and connector string — generated as SVG
   behind the case studies in the dark world.

   Deterministic: a seeded PRNG lays out the documents, so the board is
   the same on every load rather than reshuffling under the reader. The
   whole layer is aria-hidden and only rendered when [data-dark] is on.
   ─────────────────────────────────────────────────────────────── */
(function () {
  const host = document.getElementById('case-studies');
  if (!host) return;

  function rng(seed) {
    let s = seed;
    return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  }

  const layer = document.createElement('div');
  layer.className = 'board';
  layer.setAttribute('aria-hidden', 'true');
  // The soft edge is painted inside the SVG rather than applied as a CSS
  // mask on the element. A mask on a 4300px-tall layer costs a compositing
  // pass on every scrolled frame; an SVG-internal mask renders once, with
  // the rest of the drawing.
  layer.innerHTML =
    '<svg preserveAspectRatio="xMidYMid slice">' +
      '<defs>' +
        '<radialGradient id="bd-fade" cx="50%" cy="40%" r="74%">' +
          '<stop offset="28%" stop-color="#fff" stop-opacity="1"/>' +
          '<stop offset="100%" stop-color="#fff" stop-opacity="0"/>' +
        '</radialGradient>' +
        '<mask id="bd-mask">' +
          '<rect width="100%" height="100%" fill="url(#bd-fade)"/>' +
        '</mask>' +
      '</defs>' +
      '<g mask="url(#bd-mask)"></g>' +
    '</svg>';
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  host.insertBefore(layer, host.firstChild);
  const svg = layer.querySelector('svg');

  function build() {
    const box = host.getBoundingClientRect();
    const W = Math.max(320, box.width), H = Math.max(400, box.height);
    if (!W || !H) return;
    svg.setAttribute('viewBox', '0 0 ' + Math.round(W) + ' ' + Math.round(H));

    const rand = rng(20260810);
    const docs = [];
    const count = Math.max(9, Math.min(22, Math.round(H / 340)));

    let out = '';
    for (let i = 0; i < count; i++) {
      const w = 90 + rand() * 80;
      const h = w * (1.15 + rand() * 0.35);
      // Kept to the outer thirds so the board never sits under the
      // reading column in the middle of the section.
      const side = i % 2;
      const x = side ? W * (0.72 + rand() * 0.2) - w / 2 : W * (0.08 + rand() * 0.16);
      const y = (i / count) * H + rand() * 90 - 40;
      const rot = (rand() - 0.5) * 16;
      docs.push({ x: x + w / 2, y: y + 8 });

      out += '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) +
             ') rotate(' + rot.toFixed(1) + ' ' + (w / 2).toFixed(1) + ' ' + (h / 2).toFixed(1) + ')">' +
             '<rect class="bd-doc" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2"/>' +
             '<rect class="bd-edge" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2"/>';

      // Text as ruled lines, with a couple struck out as redactions.
      const rows = Math.floor(h / 13) - 1;
      for (let r = 0; r < rows; r++) {
        const ly = 14 + r * 11;
        if (ly > h - 8) break;
        const lw = (w - 20) * (0.45 + rand() * 0.5);
        if (rand() < 0.22) {
          out += '<rect class="bd-redact" x="10" y="' + (ly - 5).toFixed(1) +
                 '" width="' + lw.toFixed(1) + '" height="7" rx="1"/>';
        } else {
          out += '<line class="bd-line" x1="10" y1="' + ly.toFixed(1) +
                 '" x2="' + (10 + lw).toFixed(1) + '" y2="' + ly.toFixed(1) + '"/>';
        }
      }
      out += '</g>';
    }

    // String between consecutive pins, then a few long cross-links.
    let strings = '', pins = '';
    docs.forEach((p, i) => {
      pins += '<circle class="bd-pin" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="2.6"/>';
      if (i) {
        const q = docs[i - 1];
        strings += '<path class="bd-string" d="M' + q.x.toFixed(1) + ' ' + q.y.toFixed(1) +
                   ' L' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + '"/>';
      }
    });
    for (let k = 0; k + 3 < docs.length; k += 3) {
      const a = docs[k], b = docs[k + 3];
      strings += '<path class="bd-string" d="M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) +
                 ' L' + b.x.toFixed(1) + ' ' + b.y.toFixed(1) + '"/>';
    }

    // Write into the masked group, not the svg root — the root also holds
    // the <defs> that define the fade, and replacing its contents would
    // delete the mask on the first redraw.
    const stage = svg.querySelector('g[mask]');
    if (stage) stage.innerHTML = out + strings + pins;
    else svg.innerHTML = out + strings + pins;
  }

  build();
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(build, 200); }, { passive: true });
  window.addEventListener('load', build);
})();

/* ───────────────────────────────────────────────────────────────
   Motion: section arrival and cursor response.

   Two behaviours, both cheap. The register bar is marked when its
   section arrives, and the CSS does the rest. The pointer writes two
   normalised numbers onto the hero, which the CSS turns into a small
   translate — so the per-frame work is one custom-property write, not
   a layout read.

   Both are skipped entirely under reduced motion rather than being
   shortened, because the honest reading of that preference is "do not
   move", not "move a bit less".
   ─────────────────────────────────────────────────────────────── */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // ── Section arrival ──
  const registers = Array.from(document.querySelectorAll('.register'));
  if (registers.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -18% 0px' });
    registers.forEach((r) => io.observe(r));
  }

  // ── Cursor response ──
  const hero = document.querySelector('.hero');
  const visual = document.querySelector('.graphwrap');
  if (!hero || !visual || !window.matchMedia('(hover: hover)').matches) return;

  let px = 0, py = 0, queued = false;

  function write() {
    visual.style.setProperty('--px', px.toFixed(3));
    visual.style.setProperty('--py', py.toFixed(3));
    queued = false;
  }

  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    // -1..1 from the centre of the hero, clamped so a fast exit cannot
    // fling the graph further than the design allows.
    px = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
    py = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
    if (!queued) { queued = true; requestAnimationFrame(write); }
  }, { passive: true });

  hero.addEventListener('pointerleave', () => {
    px = 0; py = 0;
    if (!queued) { queued = true; requestAnimationFrame(write); }
  }, { passive: true });
})();

/* ───────────────────────────────────────────────────────────────
   Agent view. Shows the machine-readable profile the site already
   publishes, so a visitor can see what a language model actually
   receives rather than only the designed surface.

   The panel is built on first use and the file fetched once, so an
   unused switch costs nothing. Focus moves into the panel on open and
   returns to the switch on close, and Escape closes it — it behaves as
   a dialog because that is what it is.
   ─────────────────────────────────────────────────────────────── */
(function () {
  const sw = document.getElementById('agent-toggle');
  if (!sw) return;

  // Relative, not root-absolute. '/llms-full.txt' only resolves when the
  // site is served from a domain root — it breaks under file:// and from
  // any subpath, which is how this failed to load.
  const SRC = 'llms-full.txt';
  let panel, doc, loaded = false, lastFocus = null;

  function esc(t) {
    return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Headings and rules get weight; everything else stays exactly as
  // written. This marks the file's structure without rendering it into
  // something other than the file.
  function mark(text) {
    return esc(text)
      .replace(/^(#{1,6} .*)$/gm, '<b>$1</b>')
      .replace(/^(\s*[-*] .*)$/gm, '<i>$1</i>')
      .replace(/^(---+)$/gm, '<i>$1</i>');
  }

  function build() {
    panel = document.createElement('div');
    panel.className = 'agentview';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Machine-readable profile');
    panel.innerHTML =
      '<div class="agentview__bar">' +
        '<span><b>agent view</b> &nbsp;·&nbsp; ' + new URL(SRC, location.href).pathname + '</span>' +
        '<button type="button" class="agentview__close">close &nbsp;esc</button>' +
      '</div>' +
      '<pre class="agentview__doc" tabindex="-1">loading…</pre>';
    document.body.appendChild(panel);
    doc = panel.querySelector('.agentview__doc');
    panel.querySelector('.agentview__close').addEventListener('click', close);
  }

  async function load() {
    if (loaded) return;

    // Prefer the copy embedded in the page. No request, no protocol
    // restriction, and nothing to fail — the fetch below is only a
    // fallback for a build where the block was left out.
    const inline = document.getElementById('agent-doc');
    if (inline && inline.textContent.trim()) {
      doc.innerHTML = mark(inline.textContent.trim());
      loaded = true;
      return;
    }

    try {
      const res = await fetch(SRC, { cache: 'force-cache' });
      if (!res.ok) throw new Error(res.status);
      doc.innerHTML = mark(await res.text());
      loaded = true;
    } catch (e) {
      const isFile = location.protocol === 'file:';
      doc.innerHTML =
        (isFile
          ? 'Browsers block fetch() on file:// URLs, so the profile cannot be\n' +
            'read into this panel from a local file. Serve the folder over HTTP\n' +
            '(for example: python3 -m http.server) and it will load.\n\n'
          : 'Could not load ' + SRC + '.\n\n') +
        '<a href="' + SRC + '">Open ' + SRC + ' directly</a>';
      loaded = false;
    }
  }

  function open() {
    if (!panel) build();
    lastFocus = document.activeElement;
    panel.classList.add('is-open');
    sw.setAttribute('aria-checked', 'true');
    document.body.style.overflow = 'hidden';
    load().then(() => doc.focus());
    doc.focus();
  }

  function close() {
    if (!panel) return;
    panel.classList.remove('is-open');
    sw.setAttribute('aria-checked', 'false');
    document.body.style.overflow = '';
    // Return focus to the switch itself rather than to whatever happened to
    // hold it when the panel opened. The switch owns this state, so it is
    // where a keyboard user expects to land — and restoring a captured
    // activeElement lands on <body> whenever the panel was opened by
    // anything other than a direct click.
    (lastFocus && lastFocus !== document.body ? lastFocus : sw).focus();
  }

  sw.addEventListener('click', () => {
    if (sw.getAttribute('aria-checked') === 'true') close();
    else open();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sw.getAttribute('aria-checked') === 'true') close();
  });
})();

/* ───────────────────────────────────────────────────────────────
   AI Summary: build a portfolio prompt and open the selected
   provider. Content is taken from <main> only, so nav, footer,
   header and any agent panel are excluded automatically.
   ─────────────────────────────────────────────────────────────── */
(function () {
  if (typeof window.summarizeWith !== 'undefined') return;

  function buildAISummaryPrompt() {
    const main = document.querySelector('main');
    const portfolioContent = main
      ? main.innerText.replace(/\s+/g, " ").trim()
      : "";

    return `
You are summarizing the professional portfolio of Hariharan Mathan,
publicly known online as "MisterXCrypt".

IMPORTANT IDENTITY CONTEXT

Hariharan Mathan and MisterXCrypt refer to the same person.
Do not treat MisterXCrypt as a company, organisation, separate person,
or cybersecurity product.

PRIMARY PROFESSIONAL IDENTITY

Name: Hariharan Mathan
Public handle: MisterXCrypt
Professional focus: Cybersecurity Product Innovation / Cyber Threat Intelligence

PRIMARY SOURCES

Portfolio:
https://misterxcrypt.github.io/

LinkedIn:
https://www.linkedin.com/in/hariharanmathan/

GitHub:
https://github.com/misterxcrypt/

OBJECTIVE

Explain clearly who Hariharan Mathan is, what he specialises in,
what he has built, and what makes his cybersecurity background distinctive.

The reader may be a CISO, CTO, cybersecurity leader, security engineering
manager, technical recruiter, security-product founder, potential customer,
or research collaborator.

FOCUS ON

1. CURRENT PROFESSIONAL ROLE
Identify his current role and professional direction. Explain the progression
from cybersecurity analysis, threat intelligence and security research into
product innovation, engineering and product development.

2. CORE EXPERTISE
Prioritise:
- Cyber Threat Intelligence
- Attack Surface Management
- Digital Risk Protection
- Threat Research
- Detection Engineering
- Security Product Engineering
- OSINT
- Cybercrime Intelligence
- Security Automation
- Product Research

3. ATTACK SURFACE MANAGEMENT
Explain practical ASM experience where supported:
- External attack surface discovery
- Domains and subdomains
- IP intelligence
- Port and service discovery
- Technology fingerprinting
- Vulnerability exposure
- SSL/TLS intelligence
- DNS intelligence
- Exposed secrets
- Credential exposure
- Asset enrichment
- Risk scoring
- Internet-scale reconnaissance
- Infrastructure intelligence
- Security-data correlation

4. CYBER THREAT INTELLIGENCE
Highlight:
- Threat actors
- Threat campaigns
- Cybercrime infrastructure
- Phishing
- Fraud
- Dark web
- Telegram intelligence
- OSINT
- HUMINT
- IOC investigation
- Infrastructure attribution
- TTP analysis
- Threat research

5. DIGITAL RISK PROTECTION
Highlight:
- Brand impersonation
- Phishing domains
- Look-alike domains
- Typosquatting
- Certificate monitoring
- Fraudulent websites
- Rogue applications
- Malicious infrastructure
- Early detection
- IOC enrichment

6. PRODUCT ENGINEERING & INNOVATION

This is a major differentiator.

Do NOT describe Hariharan simply as someone who uses cybersecurity tools.

Explain that he works across:

SECURITY PROBLEM
→ INVESTIGATION
→ DATA COLLECTION
→ ENRICHMENT
→ CORRELATION
→ DETECTION
→ TECHNICAL PoC
→ PRODUCT CAPABILITY

Highlight evidence of:
- Product research
- Feature design
- Product specifications
- Technical PoCs
- Detection logic
- Risk-scoring models
- Data architecture
- Analyst workflows
- Product roadmaps
- Customer PoCs
- Pre-sales support
- Security automation

7. MAJOR PROJECTS

Identify the most important projects visible in the portfolio.

Prioritise:
- ASM
- CTI
- DRP
- Phishing intelligence
- Reconnaissance
- Security-data infrastructure
- Stealer intelligence
- Threat research
- Security automation

For important projects, briefly explain:
PROBLEM → WHAT WAS BUILT → TECHNOLOGY → SECURITY VALUE

8. TECHNICAL CAPABILITIES

Mention technologies only when they provide context.

Relevant technologies may include:
Python, FastAPI, Flask, React, AWS, Terraform, Docker, MongoDB,
Elasticsearch, DuckDB, Parquet, Celery, ZMap, zgrab2, Nmap, Shodan,
Censys, SecurityTrails, FOFA, VirusTotal, urlscan.io, Maltego,
Telegram, Tor, Burp Suite, Wireshark and Linux.

Do not turn this into a generic technology list.

9. EVIDENCE & ACHIEVEMENTS

Prioritise measurable evidence explicitly present in the portfolio.
Use exact numbers when explicitly present. NEVER invent metrics.
NEVER exaggerate.

10. PUBLIC WORK

Mention the public footprint when relevant:
Portfolio: https://misterxcrypt.github.io/
LinkedIn: https://www.linkedin.com/in/hariharanmathan/
GitHub: https://github.com/misterxcrypt/

Use public projects and research as evidence of practical experience.

11. PROFESSIONAL DIFFERENTIATOR

The key positioning should be:

Cyber Threat Intelligence
+
Attack Surface Management
+
Security Research
+
Detection Engineering
+
Product Innovation
+
Software Engineering

He bridges the gap between security research and security product development.

Emphasise the ability to turn an investigation or recurring analyst problem
into a repeatable product capability.

12. WRITING STYLE

Write in a professional, technical, concise, evidence-based, credible,
senior and modern style.

Avoid generic cybersecurity buzzwords, empty marketing claims,
unverified achievements, excessive adjectives, repetition and inflated
seniority.

Do not call Hariharan an "AI expert" unless explicit evidence supports it.

Do not invent employment history, projects, metrics, certifications
or responsibilities.

OUTPUT FORMAT

## Executive Summary
A 2–3 sentence overview.

## Core Expertise
A concise list.

## Major Work
The most important projects and contributions.

## Technical Strengths
Only technologies relevant to the story.

## Evidence
The strongest measurable/public evidence.

## Professional Positioning
A short explanation of what makes Hariharan distinctive.

## Learn More
Portfolio:
https://misterxcrypt.github.io/

LinkedIn:
https://www.linkedin.com/in/hariharanmathan/

GitHub:
https://github.com/misterxcrypt/

SOURCE PRIORITY

1. Current portfolio content
2. Public projects linked from the portfolio
3. Public research linked from the portfolio
4. LinkedIn
5. GitHub

If information conflicts, prefer the most recent explicitly documented information.
Do not infer unsupported facts.

CURRENT PORTFOLIO CONTENT

${portfolioContent}

Now produce the final concise professional summary.
`;
  }

  function summarizeWith(provider) {
    const prompt = encodeURIComponent(buildAISummaryPrompt());

    const providers = {
      claude: "https://claude.ai/new?q=" + prompt,
      chatgpt: "https://chatgpt.com/?q=" + prompt,
      gemini: "https://gemini.google.com/app?q=" + prompt,
      copilot: "https://copilot.microsoft.com/?q=" + prompt,
      perplexity: "https://www.perplexity.ai/search?q=" + prompt
    };

    if (!providers[provider]) {
      console.error("Unknown AI provider:", provider);
      return;
    }

    window.open(providers[provider], "_blank", "noopener,noreferrer");
  }

  window.summarizeWith = summarizeWith;
})();
