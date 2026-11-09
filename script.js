const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Preloader: counter + circle, then the circle bursts and the page is revealed
const preloader = document.querySelector('.preloader');

if (preloader && document.documentElement.classList.contains('is-loading')) {
  const circle = preloader.querySelector('.preloader-circle');
  const count = preloader.querySelector('.preloader-count');
  const minDuration = 2200;
  const startTime = performance.now();
  let pageLoaded = document.readyState === 'complete';

  window.addEventListener('load', () => { pageLoaded = true; });

  function finishPreloader() {
    preloader.classList.add('is-burst');

    setTimeout(() => {
      preloader.classList.add('is-done');
      document.documentElement.classList.remove('is-loading');
      setTimeout(() => preloader.remove(), 900);
    }, 900);
  }

  function stepPreloader(now) {
    const t = Math.min(1, (now - startTime) / minDuration);
    const eased = 1 - Math.pow(1 - t, 2.2);
    const progress = Math.min(eased, pageLoaded ? 1 : 0.92);

    count.textContent = `${Math.floor(progress * 100)}%`;
    circle.style.setProperty('--s', (0.68 + progress * 0.32).toFixed(3));

    if (progress < 1) {
      requestAnimationFrame(stepPreloader);
    } else {
      count.textContent = '100%';
      setTimeout(finishPreloader, 250);
    }
  }

  requestAnimationFrame(stepPreloader);
}

// Menu overlay toggle
const menuToggle = document.getElementById('menu-toggle');
const menuClose = document.getElementById('menu-close');
const navOverlay = document.getElementById('nav-overlay');

function openMenu() {
  navOverlay.classList.add('open');
  menuToggle.setAttribute('aria-expanded', 'true');
}

function closeMenu() {
  navOverlay.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
}

menuToggle.addEventListener('click', openMenu);
menuClose.addEventListener('click', closeMenu);
navOverlay.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', closeMenu);
});

// Hero letter-by-letter entrance
function splitLetters(el) {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.innerHTML = '';

  const wrapper = document.createElement('span');
  wrapper.setAttribute('aria-hidden', 'true');

  [...text].forEach((char, i) => {
    const letter = document.createElement('span');
    letter.className = 'letter';
    letter.textContent = char === ' ' ? ' ' : char;
    letter.style.setProperty('--i', i);
    wrapper.appendChild(letter);
  });

  el.appendChild(wrapper);
}

if (!prefersReducedMotion) {
  document.querySelectorAll('[data-split]').forEach(splitLetters);
}

// Nav links letter-flip hover
function buildLetterFlip(link) {
  const text = link.dataset.text || link.textContent.trim();
  link.setAttribute('aria-label', text);
  link.innerHTML = '';

  const wrap = document.createElement('span');
  wrap.className = 'nav-link-text';
  wrap.setAttribute('aria-hidden', 'true');

  [...text].forEach((char, i) => {
    const flip = document.createElement('span');
    flip.className = 'letter-flip';
    flip.style.setProperty('--i', i);

    const top = document.createElement('span');
    top.className = 'letter-top';
    top.textContent = char === ' ' ? ' ' : char;

    const bottom = document.createElement('span');
    bottom.className = 'letter-bottom';
    bottom.textContent = char === ' ' ? ' ' : char;

    flip.appendChild(top);
    flip.appendChild(bottom);
    wrap.appendChild(flip);
  });

  link.appendChild(wrap);
}

if (!prefersReducedMotion) {
  document.querySelectorAll('.nav-link, .social-link').forEach(buildLetterFlip);
}

// "Quién soy" statement: split into words/letters, letters rise in a wave around the cursor
function splitWave(el) {
  const fullText = el.textContent.replace(/\s+/g, ' ').trim();
  const letters = [];
  let wordIndex = 0;

  // Keep a highlighted phrase glued to the punctuation right after it ("visuales,")
  el.querySelectorAll('em').forEach(em => {
    const next = em.nextSibling;
    const match = next && next.nodeType === Node.TEXT_NODE && next.textContent.match(/^[.,;:!?]+/);
    if (!match) return;
    const glue = document.createElement('span');
    glue.className = 'wv-glue';
    em.replaceWith(glue);
    glue.append(em, match[0]);
    next.textContent = next.textContent.slice(match[0].length);
  });

  function splitNode(node) {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        splitNode(child);
        return;
      }
      if (child.nodeType !== Node.TEXT_NODE) return;

      const frag = document.createDocumentFragment();
      child.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(' '));
          return;
        }
        const word = document.createElement('span');
        word.className = 'wv-w';
        word.setAttribute('aria-hidden', 'true');
        word.style.setProperty('--wi', wordIndex++);
        [...part].forEach(char => {
          const letter = document.createElement('span');
          letter.className = 'wv-c';
          letter.textContent = char;
          word.appendChild(letter);
          letters.push(letter);
        });
        frag.appendChild(word);
      });
      child.replaceWith(frag);
    });
  }

  splitNode(el);

  // Screen readers read this copy instead of letter by letter
  const readable = document.createElement('span');
  readable.className = 'visually-hidden';
  readable.textContent = fullText;
  el.prepend(readable);
  el.classList.add('js-wave');
  return letters;
}

if (!prefersReducedMotion) {
  document.querySelectorAll('[data-wave]').forEach(el => {
    const RADIUS = 150; // px around the cursor that the wave reaches
    const letters = splitWave(el).map(node => ({ node, x: 0, y: 0, f: 0 }));
    const area = el.closest('section') || el;
    let mouse = null;
    let running = false;

    // Letter centers relative to the paragraph (offsets ignore transforms, so the wave doesn't feed back on itself)
    function measure() {
      letters.forEach(l => {
        l.x = l.node.offsetLeft + l.node.offsetWidth / 2;
        l.y = l.node.offsetTop + l.node.offsetHeight / 2;
      });
    }

    function frame() {
      const box = el.getBoundingClientRect();
      let active = false;

      letters.forEach(l => {
        let target = 0;
        if (mouse) {
          const dx = mouse.x - (box.left + l.x);
          const dy = (mouse.y - (box.top + l.y)) * 1.4; // flatter wave: rows matter more than columns
          const t = Math.max(0, 1 - Math.hypot(dx, dy) / RADIUS);
          target = t * t * (3 - 2 * t); // smoothstep for a soft edge
        }
        let f = l.f + (target - l.f) * 0.18;
        if (target === 0 && f < 0.003) f = 0;
        if (f !== l.f) {
          l.f = f;
          l.node.style.setProperty('--f', f.toFixed(3));
        }
        if (f > 0) active = true;
      });

      if (mouse || active) requestAnimationFrame(frame);
      else running = false;
    }

    function startWave() {
      if (running) return;
      running = true;
      requestAnimationFrame(frame);
    }

    area.addEventListener('pointerenter', e => {
      if (e.pointerType === 'touch') return;
      measure();
    });
    area.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      mouse = { x: e.clientX, y: e.clientY };
      startWave();
    });
    area.addEventListener('pointerleave', () => { mouse = null; });
    window.addEventListener('resize', measure);
    measure();
  });
}

// Servicios: an astronaut walks past holographic panels as you scroll
const walkSection = document.querySelector('.walk-section');

if (walkSection && !prefersReducedMotion) {
  const scrollBox = walkSection.querySelector('.walk-scroll');
  const scene = walkSection.querySelector('.walk-scene');
  const track = walkSection.querySelector('.walk-track');
  const panels = [...track.querySelectorAll('.holo')];
  const sky = walkSection.querySelector('.walk-sky');
  const hills = walkSection.querySelector('.walk-hills');
  const astro = walkSection.querySelector('.astronaut');
  const ship = walkSection.querySelector('.ship');
  const shipInner = ship.querySelector('.ship-inner');
  const shipSmoke = ship.querySelector('.ship-smoke');
  const shipLight = ship.querySelector('.ship-window-light');
  const shipFlame = ship.querySelector('.ship-flame');

  // SVG parts that move; data-pivot is the joint (hip, knee, shoulder...) they rotate around
  const joints = {};
  astro.querySelectorAll('[data-joint]').forEach(el => {
    joints[el.dataset.joint] = { el, pivot: el.dataset.pivot };
  });

  // Scroll is split in "steps": one per gap between panels, one to walk to the ship,
  // and END_STEPS for boarding + take-off
  const END_STEPS = 2;
  const walkSteps = panels.length; // (panels - 1) gaps + 1 to reach the ship
  const WALK_END = walkSteps / (walkSteps + END_STEPS); // share of the scroll spent walking

  walkSection.classList.add('is-walking');
  walkSection.style.setProperty('--steps', walkSteps + END_STEPS);

  const STRIDE = 150;       // px of ground covered by one full step cycle
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const range = (v, a, b) => clamp01((v - a) / (b - a)); // 0 before a, 1 after b
  let spacing = 0;
  let totalWalk = 0;
  let sceneH = 0;
  let sceneW = 0;
  let hatchLift = 0;
  let target = 0;   // where the scroll says she should be (px walked)
  let dist = 0;     // where she is now (eases toward target)
  let phase = 0;    // walk-cycle angle
  let amp = 0;      // 0 = standing still, 1 = full stride
  let seqTarget = 0; // ending sequence 0..1 (boarding -> take-off), from the scroll
  let seq = 0;       // eased version of seqTarget
  let active = -1;
  let running = false;
  let visible = false;

  // Panels sit in a row; the "focus" spot is just in front of the astronaut.
  // The ship is parked after the last panel, its hatch lined up with where she stops.
  function layout() {
    astro.style.transform = ''; // measure her without the boarding scale
    const sceneBox = scene.getBoundingClientRect();
    const astroBox = astro.getBoundingClientRect();
    const astroRight = astroBox.right - sceneBox.left;
    const astroCenter = astroRight - astroBox.width / 2;
    const panelW = Math.max(185, Math.min(300, sceneBox.width * 0.26, sceneBox.width - astroRight - 28));
    const focusX = Math.min(astroRight + 28 + panelW / 2, sceneBox.width - panelW / 2 - 16);
    spacing = panelW + Math.max(90, sceneBox.width * 0.22);
    totalWalk = walkSteps * spacing;
    sceneW = sceneBox.width;
    sceneH = sceneBox.height;
    scene.style.setProperty('--panel-w', `${panelW}px`);
    panels.forEach((panel, i) => {
      panel.style.left = `${focusX + i * spacing - panelW / 2}px`;
    });

    // the ship sits outside the track (so it can be in front of her); script.js moves it with the ground.
    // When she stops, she is right behind the middle of the ship.
    const shipW = astroBox.height * 1.45 * (200 / 230);
    hatchLift = astroBox.height * 0.25; // small step up into the ship, hidden behind its body
    ship.style.setProperty('--ship-w', `${shipW}px`);
    ship.style.left = `${astroCenter + totalWalk - shipW / 2}px`;
    readScroll();
  }

  function readScroll() {
    const rect = scrollBox.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    const progress = total > 0 ? clamp01(-rect.top / total) : 0;
    target = range(progress, 0.03, WALK_END) * totalWalk; // short pause on the first panel
    seqTarget = range(progress, WALK_END, 0.98);
  }

  // Boarding + take-off, all derived from seq (0..1) so scrolling back reverses it
  function renderEnding(now) {
    const board = range(seq, 0, 0.25);    // she climbs in from behind the ship
    const light = range(seq, 0.2, 0.35);  // porthole lights up: she's inside
    const fire = range(seq, 0.38, 0.55);  // engines ignite
    const t = range(seq, 0.55, 1);
    const lift = t * t;                   // ease-in: slow start, fast exit

    astro.style.opacity = (1 - board).toFixed(3);
    astro.style.transform = board ? `translateY(${(-board * hatchLift).toFixed(1)}px)` : '';
    shipLight.setAttribute('opacity', (light * 0.75).toFixed(3));

    const flicker = 0.85 + 0.15 * Math.sin(now * 0.05);
    shipFlame.setAttribute('opacity', fire.toFixed(3));
    shipFlame.setAttribute('transform', `translate(100 164) scale(1 ${(fire * flicker * (1 + lift * 2.5)).toFixed(3)}) translate(-100 -164)`);

    const shake = fire > 0 && lift < 0.05 ? Math.sin(now * 0.08) * 1.6 * fire : 0;
    shipInner.style.transform =
      `translate(${(lift * sceneW * 0.35 + shake).toFixed(1)}px, ${(-lift * sceneH * 1.3).toFixed(1)}px) rotate(${(lift * 14).toFixed(2)}deg)`;

    shipSmoke.style.opacity = (fire * (1 - range(seq, 0.7, 1))).toFixed(3);
    shipSmoke.style.transform = `scale(${(0.6 + fire * 0.4 + lift * 0.6).toFixed(3)})`;

    return fire > 0 && seq < 1; // keep animating while the flame flickers
  }

  function rotate(name, deg) {
    const j = joints[name];
    if (j) j.el.setAttribute('transform', `rotate(${deg.toFixed(2)} ${j.pivot})`);
  }

  function frame(now = performance.now()) {
    const prev = dist;
    dist += (target - dist) * 0.12;
    if (Math.abs(target - dist) < 0.05) dist = target;
    const moved = dist - prev;

    // stride grows with speed and fades out when she stops
    amp += (Math.min(1, Math.abs(moved) / 3) - amp) * 0.1;
    phase += (moved / STRIDE) * Math.PI * 2;

    // SVG rotate(): positive = clockwise. Facing right, negative swings a limb forward.
    const s = Math.sin(phase);
    const swing = 28 * amp;
    rotate('thighFront', -s * swing);
    rotate('shinFront', Math.max(0, s) * 45 * amp);   // knee bends while the leg is behind
    rotate('thighBack', s * swing);
    rotate('shinBack', Math.max(0, -s) * 45 * amp);
    rotate('armFront', s * swing * 0.7);              // arms swing opposite to the legs
    rotate('armBack', -s * swing * 0.7);
    // ponytail bounces twice per stride, a little behind the steps, and leans back while walking
    rotate('hair', (4 + Math.sin(phase * 2 + 1.2) * 7) * amp);
    joints.body.el.setAttribute('transform', `translate(0 ${(-Math.abs(Math.cos(phase)) * 3 * amp).toFixed(2)})`);

    // parallax: the further away, the slower it moves
    track.style.transform = `translate3d(${-dist}px, 0, 0)`;
    ship.style.transform = `translate3d(${-dist}px, 0, 0)`;
    scene.style.setProperty('--walk-x', `${-dist}px`); // ground grid (CSS ::before)
    hills.style.backgroundPositionX = `${-dist * 0.3}px`;
    sky.style.backgroundPositionX = `${-dist * 0.08}px`;

    const nowActive = Math.min(panels.length - 1, Math.round(dist / spacing));
    if (nowActive !== active) {
      panels.forEach((panel, i) => panel.classList.toggle('is-active', i === nowActive));
      active = nowActive;
    }

    seq += (seqTarget - seq) * 0.12;
    if (Math.abs(seqTarget - seq) < 0.001) seq = seqTarget;
    const flickering = renderEnding(now);

    if (visible && (dist !== target || amp > 0.01 || seq !== seqTarget || flickering)) {
      requestAnimationFrame(frame);
    } else {
      running = false;
    }
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  window.addEventListener('scroll', () => {
    if (!visible) return;
    readScroll();
    start();
  }, { passive: true });

  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) { readScroll(); start(); }
  }).observe(scrollBox);

  window.addEventListener('resize', () => {
    layout();
    dist = target;
    seq = seqTarget;
    start();
  });

  layout();
  dist = target;
  seq = seqTarget;
  frame();
}

// Hero planet: a purple gas giant painted on a canvas.
// 1) a cloud texture is generated once with fractal noise,
// 2) every frame each pixel of the sphere looks up that texture (shifted = rotation) and is lit,
// 3) a ring of glowing dust particles is drawn half behind and half in front of the planet.
const heroPlanetCanvas = document.querySelector('.hero-planet-canvas');

if (heroPlanetCanvas) {
  const ctx = heroPlanetCanvas.getContext('2d');
  const TILT = -0.36;           // ring + bands tilt (radians), rising to the right like the reference
  const RING_FLAT = 0.24;       // how flat the ring ellipse looks (minor/major)
  const TEX_W = 1024; // high enough that the clouds stay sharp on big screens
  const TEX_H = 512;

  // --- 3D value noise (sampling on a cylinder makes the texture wrap seamlessly) ---
  function hash3(x, y, z) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440662683)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const fade = t => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  function noise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
    const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
    return lerp(
      lerp(lerp(c(0, 0, 0), c(1, 0, 0), xf), lerp(c(0, 1, 0), c(1, 1, 0), xf), yf),
      lerp(lerp(c(0, 0, 1), c(1, 0, 1), xf), lerp(c(0, 1, 1), c(1, 1, 1), xf), yf),
      zf);
  }
  function fbm(x, y, z) {
    let sum = 0, amp = 0.5, freq = 1;
    for (let o = 0; o < 6; o++) { // 6 octaves = finer cloud detail
      sum += amp * noise3(x * freq, y * freq, z * freq);
      amp *= 0.5;
      freq *= 2;
    }
    return sum;
  }

  // purple palette, dark -> light
  // deep violet -> purple -> orchid pink (no white, like the reference)
  const PALETTE = [
    [0.00, [30, 6, 64]],
    [0.30, [66, 18, 132]],
    [0.50, [106, 38, 186]],
    [0.68, [146, 64, 212]],
    [0.84, [190, 92, 222]],
    [1.00, [226, 128, 236]],
  ];
  function paletteAt(t) {
    t = Math.max(0, Math.min(1, t));
    for (let i = 1; i < PALETTE.length; i++) {
      if (t <= PALETTE[i][0]) {
        const [t0, c0] = PALETTE[i - 1];
        const [t1, c1] = PALETTE[i];
        const k = (t - t0) / (t1 - t0);
        return [lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k), lerp(c0[2], c1[2], k)];
      }
    }
    return PALETTE[PALETTE.length - 1][1];
  }

  // --- 1) cloud texture (equirectangular map), generated once ---
  const tex = new Uint8ClampedArray(TEX_W * TEX_H * 3);
  for (let v = 0; v < TEX_H; v++) {
    for (let u = 0; u < TEX_W; u++) {
      const a = (u / TEX_W) * Math.PI * 2;
      const px = Math.cos(a) * 1.6;
      const pz = Math.sin(a) * 1.6;
      const py = (v / TEX_H) * 3.2;
      const warp = fbm(px * 1.2, py * 1.2, pz * 1.2);
      let base = fbm(px * 1.9 + warp * 1.4, py * 3 + warp, pz * 1.9);
      base += 0.12 * Math.sin(py * 7 + warp * 4);            // soft latitude bands
      const clouds = fbm(px * 4 + 5, py * 4.4, pz * 4 + 2);
      const c = Math.max(0, Math.min(1, (clouds - 0.5) / 0.14)); // crisper cloud wisps
      const col = paletteAt((base - 0.2) * 1.6);              // more contrast between light and dark areas
      const i = (v * TEX_W + u) * 3;
      tex[i] = lerp(col[0], 222, c * 0.35);   // cloud wisps tint to pink, not white
      tex[i + 1] = lerp(col[1], 120, c * 0.35);
      tex[i + 2] = lerp(col[2], 232, c * 0.35);
    }
  }

  // --- sizes, sphere lookup tables and dust particles (rebuilt on resize) ---
  const sphere = document.createElement('canvas');
  const sctx = sphere.getContext('2d');
  let W = 0, H = 0, R = 0, D = 0, cx = 0, cy = 0, dpr = 1;
  let img, px, lonBase, row, light, rim, edge;
  let particles = [];

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const box = heroPlanetCanvas.getBoundingClientRect();
    W = Math.round(box.width * dpr);
    H = Math.round(box.height * dpr);
    if (!W || !H) return false;
    heroPlanetCanvas.width = W;
    heroPlanetCanvas.height = H;
    cx = W / 2;
    cy = H / 2;
    R = W * 0.215; // planet radius (the canvas is 1.4x the wrap, so the planet is ~60% of the wrap)

    // the sphere is rendered pixel by pixel at its real size (up to 760px) so it stays sharp
    D = Math.min(Math.round(R * 2), 760);
    sphere.width = sphere.height = D;
    img = sctx.createImageData(D, D);
    const r = D / 2;
    const L = [0.82, -0.45, 0.38];                   // light from the upper right side: clear day/night edge
    const ll = Math.hypot(...L);
    const lx = L[0] / ll, ly = L[1] / ll, lz = L[2] / ll;
    const cosT = Math.cos(-TILT), sinT = Math.sin(-TILT);
    const pxList = [], lonList = [], rowList = [], lightList = [], rimList = [], edgeList = [];

    for (let y = 0; y < D; y++) {
      for (let x = 0; x < D; x++) {
        const dx = (x + 0.5 - r) / r;
        const dy = (y + 0.5 - r) / r;
        const d2 = dx * dx + dy * dy;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2);
        // lighting uses the screen normal
        const diff = Math.max(0, dx * lx + dy * ly + nz * lz);
        // texture coords use the normal rotated into the planet's tilted frame
        const tx = dx * cosT - dy * sinT;
        const ty = dx * sinT + dy * cosT;
        pxList.push((y * D + x) * 4);
        lonList.push(Math.atan2(tx, nz) / (Math.PI * 2) + 0.5);
        rowList.push(Math.min(TEX_H - 1, Math.floor(((Math.asin(Math.max(-1, Math.min(1, ty))) / Math.PI) + 0.5) * TEX_H)));
        lightList.push(0.03 + 1.08 * Math.pow(diff, 1.3)); // stronger day/night contrast
        const edgeFactor = Math.pow(1 - nz, 2.4);
        rimList.push(edgeFactor * (0.3 + 1.5 * Math.max(0, dx * 0.7 - dy * 0.6))); // glowing atmosphere on the lit side
        edgeList.push(Math.min(1, (1 - Math.sqrt(d2)) * r));                          // anti-aliased border
      }
    }
    lastTexel = -1; // size changed: force a repaint of the sphere
    px = Int32Array.from(pxList);
    lonBase = Float32Array.from(lonList);
    row = Int32Array.from(rowList);
    light = Float32Array.from(lightList);
    rim = Float32Array.from(rimList);
    edge = Float32Array.from(edgeList);

    // dust particles: denser in a few bands, like rings within the ring
    const bands = [[1.36, 0.1, 0.6], [1.62, 0.2, 1], [1.95, 0.18, 0.75], [2.2, 0.08, 0.4]];
    const count = W < 700 ? 1400 : 2600;
    particles = [];
    for (let i = 0; i < count; i++) {
      const b = bands[Math.floor(Math.random() * bands.length)];
      const g = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; // ~gaussian
      const rr = (b[0] + g * b[1]) * R;
      const warm = Math.random() < 0.25;
      particles.push({
        r: rr,
        a: Math.random() * Math.PI * 2,
        w: (0.00045 + Math.random() * 0.0004) * (1.6 * R / rr), // inner dust orbits faster
        s: (0.5 + Math.random() * 1.1) * dpr,
        color: warm ? `rgba(224, 122, 245, ${(0.35 + Math.random() * 0.5) * b[2]})`
                    : `rgba(190, 140, 255, ${(0.35 + Math.random() * 0.55) * b[2]})`,
      });
    }
    return true;
  }

  // --- 2) planet surface: rotate by shifting the texture longitude ---
  function renderSphere(rot) {
    const data = img.data;
    for (let i = 0; i < px.length; i++) {
      let u = lonBase[i] + rot;
      u -= Math.floor(u);
      const t = (row[i] * TEX_W + Math.floor(u * TEX_W)) * 3;
      const l = light[i];
      const rm = rim[i];
      const o = px[i];
      // night side keeps a faint purple (not black) so it melts into the page background
      data[o] = tex[t] * l + 12 + 190 * rm;   // rim light in magenta-pink
      data[o + 1] = tex[t + 1] * l + 3 + 70 * rm;
      data[o + 2] = tex[t + 2] * l + 26 + 220 * rm;
      data[o + 3] = 255 * edge[i];
    }
    sctx.putImageData(img, 0, 0);
  }

  // --- 3) ring: soft dust haze + particles, split into back (behind planet) and front ---
  // wide, overlapping haze bands so the ring reads as one glowing dust band
  const HAZE = [[1.36, 0.14, 0.2], [1.62, 0.4, 0.3], [1.95, 0.3, 0.22], [2.22, 0.12, 0.12]];
  function drawRing(front, now) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(TILT);
    ctx.globalCompositeOperation = 'lighter';

    ctx.save();
    ctx.filter = `blur(${Math.round(R * 0.025)}px)`; // soft, dusty edges (ignored where unsupported)
    ctx.scale(1, RING_FLAT); // a circle scaled flat = the ring seen at an angle
    HAZE.forEach(([rr, w, a]) => {
      ctx.beginPath();
      ctx.arc(0, 0, rr * R, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
      ctx.lineWidth = w * R;
      ctx.strokeStyle = `rgba(150, 80, 230, ${a})`;
      ctx.stroke();
    });
    ctx.restore();

    particles.forEach(p => {
      const sin = Math.sin(p.a);
      if ((sin > 0) !== front) return;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.cos(p.a) * p.r, sin * p.r * RING_FLAT, p.s, p.s);
    });
    ctx.restore();
  }

  function drawFlare(x, y, size, now, phase) {
    const k = 0.6 + 0.4 * Math.sin(now * 0.0015 + phase);
    const s = size * k;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.5);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    glow.addColorStop(1, 'rgba(216, 77, 242, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(243, 232, 255, ${0.7 * k})`;
    ctx.lineWidth = 1.2 * dpr;
    ctx.beginPath();
    ctx.moveTo(-s, 0); ctx.lineTo(s, 0);
    ctx.moveTo(0, -s); ctx.lineTo(0, s);
    ctx.stroke();
    ctx.restore();
  }

  function drawMoon(now) {
    const mr = R * 0.12;
    const mx = cx - R * 1.32;
    const my = cy - R * 1.05 + Math.sin(now * 0.0006) * R * 0.03;
    const g = ctx.createRadialGradient(mx + mr * 0.35, my - mr * 0.35, mr * 0.1, mx, my, mr);
    g.addColorStop(0, '#d9c4f5');
    g.addColorStop(0.55, '#7a4ab0');
    g.addColorStop(1, '#1a0a33');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
  }

  // The planet turns slowly: only repaint the sphere when the texture moved at least one texel
  let lastTexel = -1;
  function draw(now, rot) {
    const texel = Math.floor(rot * TEX_W);
    if (texel !== lastTexel) {
      renderSphere(rot);
      lastTexel = texel;
    }
    ctx.clearRect(0, 0, W, H);

    // glow around the planet
    const glow = ctx.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 2.1);
    glow.addColorStop(0, 'rgba(155, 93, 229, 0.28)');
    glow.addColorStop(0.4, 'rgba(106, 47, 196, 0.08)');
    glow.addColorStop(1, 'rgba(26, 10, 51, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    drawMoon(now);
    drawRing(false, now);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sphere, cx - R, cy - R, R * 2, R * 2);

    // soft atmosphere just outside the edge: blends the planet into the sky
    // thin atmosphere line hugging the edge (kept narrow so the planet stays crisp)
    const atmo = ctx.createRadialGradient(cx, cy, R * 0.99, cx, cy, R * 1.07);
    atmo.addColorStop(0, 'rgba(200, 90, 240, 0.35)');
    atmo.addColorStop(1, 'rgba(90, 31, 192, 0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = atmo;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawRing(true, now);

    drawFlare(cx - R * 1.55, cy - R * 1.5, R * 0.16, now, 0);
    drawFlare(cx + R * 1.75, cy + R * 0.55, R * 0.1, now, 2);
    drawFlare(cx + R * 0.9, cy - R * 1.45, R * 0.07, now, 4);
  }

  let rot = 0;
  let last = 0;
  let running = false;
  let ready = false;

  function frame(now) {
    const dt = last ? Math.min(now - last, 50) : 16;
    last = now;
    rot += dt * 0.0000125; // one turn every ~80 seconds
    particles.forEach(p => { p.a += p.w * dt * 0.06; });
    draw(now, rot);
    if (running) requestAnimationFrame(frame);
  }

  function start() {
    if (running || !ready || prefersReducedMotion) return;
    running = true;
    last = 0;
    requestAnimationFrame(frame);
  }

  function init() {
    ready = build();
    if (!ready) return;
    if (prefersReducedMotion) draw(0, 0.2);
    else start();
  }

  new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) start();
    else running = false;
  }).observe(heroPlanetCanvas);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      ready = build();
      if (prefersReducedMotion && ready) draw(0, 0.2);
    }, 200);
  });

  init();
}

// Experimentación: pick a vinyl sleeve -> its record flies to the turntable and plays
const expSection = document.querySelector('.exp-section');

if (expSection) {
  const turntable = expSection.querySelector('.turntable');
  const deck = expSection.querySelector('.tt-deck');
  const record = deck.querySelector('.tt-record');
  const label = deck.querySelector('.tt-label');
  const statusText = expSection.querySelector('.tt-status-text');
  const track = expSection.querySelector('.sleeves-track');
  const sleeves = [...track.querySelectorAll('.sleeve')];
  const wait = ms => new Promise(resolve => setTimeout(resolve, prefersReducedMotion ? 0 : ms));
  let current = null;
  let busy = false;

  // The record label shows the sleeve's image (or its color when it has none yet)
  function setLabel(sleeve) {
    const img = sleeve.querySelector('.sleeve-art img');
    label.innerHTML = img ? `<img src="${img.getAttribute('src')}" alt="">` : '';
    label.style.background = getComputedStyle(sleeve).getPropertyValue('--sleeve-bg');
  }

  // Animate a copy of the record from the sleeve to the platter (FLIP: measure both ends, then move)
  async function flyRecord(sleeve) {
    if (prefersReducedMotion || !record.animate) return;
    const from = sleeve.querySelector('.sleeve-disc').getBoundingClientRect();
    const to = record.getBoundingClientRect();
    const fly = record.cloneNode(true);
    fly.classList.add('tt-fly');
    Object.assign(fly.style, {
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
    });
    document.body.appendChild(fly);
    const scale = to.width / from.width;
    await fly.animate([
      { transform: 'translate(0, 0) scale(1) rotate(0deg)' },
      { transform: `translate(${to.left - from.left}px, ${to.top - from.top - 40}px) scale(${scale}) rotate(200deg)`, offset: 0.7 },
      { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${scale}) rotate(360deg)` },
    ], { duration: 1000, easing: 'cubic-bezier(0.45, 0, 0.2, 1)' }).finished;
    fly.remove();
  }

  async function play(sleeve) {
    if (busy || sleeve === current) return;
    busy = true;
    sleeves.forEach(s => s.setAttribute('aria-pressed', String(s === sleeve)));

    // lift the arm and put the previous record back in its sleeve
    deck.classList.remove('is-playing');
    turntable.classList.remove('is-playing');
    if (current) {
      await wait(500);
      deck.classList.remove('has-record');
      current.classList.remove('is-out');
      await wait(350);
    }

    setLabel(sleeve);
    sleeve.classList.add('is-out');
    await flyRecord(sleeve);
    deck.classList.add('has-record');
    await wait(250);
    deck.classList.add('is-playing');
    turntable.classList.add('is-playing');
    statusText.textContent = `Sonando · ${sleeve.dataset.title} — ${sleeve.dataset.meta}`;
    current = sleeve;
    busy = false;
  }

  sleeves.forEach(sleeve => sleeve.addEventListener('click', () => play(sleeve)));

  // carousel arrows: move by one sleeve
  const step = () => (sleeves[1] ? sleeves[1].parentElement.offsetLeft - sleeves[0].parentElement.offsetLeft : 200);
  const behavior = prefersReducedMotion ? 'auto' : 'smooth';
  expSection.querySelector('.sleeves-prev').addEventListener('click', () => track.scrollBy({ left: -step(), behavior }));
  expSection.querySelector('.sleeves-next').addEventListener('click', () => track.scrollBy({ left: step(), behavior }));
}

// Twinkling stars scattered around a title
document.querySelectorAll('[data-sparkle]').forEach(title => {
  const COUNT = 7;
  for (let i = 0; i < COUNT; i++) {
    const star = document.createElement('span');
    star.className = 'sparkle';
    star.setAttribute('aria-hidden', 'true');
    // spread evenly along the width, with a little randomness, above/below the letters
    star.style.left = `${((i + Math.random()) / COUNT) * 110 - 5}%`;
    star.style.top = `${Math.random() < 0.5 ? Math.random() * 30 - 15 : 85 + Math.random() * 30}%`;
    star.style.setProperty('--size', `${5 + Math.random() * 6}px`);
    star.style.setProperty('--dur', `${3.5 + Math.random() * 3}s`);
    star.style.setProperty('--delay', `${-Math.random() * 6}s`);
    title.appendChild(star);
  }
});

// Constellation portrait: photo redrawn as purple stars that scatter away from the cursor
document.querySelectorAll('[data-constellation]').forEach(frame => {
  const img = frame.querySelector('img');
  const canvas = document.createElement('canvas');
  canvas.className = 'constellation-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');

  const STEP = 3.2;          // px between sample points (smaller = more stars)
  const PUSH_RADIUS = 70;    // px around the cursor that pushes stars away
  const COLORS = ['#5a1fc0', '#8a56b5', '#d84df2', '#b98bf0', '#f3e8ff']; // dark -> bright
  const sprites = COLORS.map(makeSprite);

  let stars = [];
  let links = [];
  let width = 0;
  let height = 0;
  let mouse = null;
  let running = false;
  let visible = false;
  let built = false;

  // Small glowing dot, pre-drawn once per color so each frame is just drawImage calls
  function makeSprite(color) {
    const s = document.createElement('canvas');
    s.width = s.height = 32;
    const g = s.getContext('2d');
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.18, color);
    grad.addColorStop(0.45, color + '55');
    grad.addColorStop(1, color + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    return s;
  }

  // Draw the photo like CSS object-fit: cover; object-position: 58% 50%
  function readPixels() {
    const off = document.createElement('canvas');
    off.width = Math.round(width);
    off.height = Math.round(height);
    const o = off.getContext('2d', { willReadFrequently: true });
    const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    o.drawImage(img, (width - dw) * 0.58, (height - dh) * 0.5, dw, dh);
    return o.getImageData(0, 0, off.width, off.height).data;
  }

  function build() {
    const rect = frame.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const data = readPixels(); // throws if the page is opened as file:// (canvas security)
    const w = Math.round(width);
    const cols = Math.floor(width / STEP);
    const rows = Math.floor(height / STEP);
    const lum = new Float32Array(cols * rows);

    // 1. Brightness on a grid of sample points
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = (Math.floor((r + 0.5) * STEP) * w + Math.floor((c + 0.5) * STEP)) * 4;
        lum[r * cols + c] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      }
    }

    // 2. Blurred copy (box blur) to compare each point with its neighbourhood
    const blur = new Float32Array(cols * rows);
    const R = 4;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let sum = 0;
        let n = 0;
        for (let y = Math.max(0, r - R); y <= Math.min(rows - 1, r + R); y++) {
          for (let x = Math.max(0, c - R); x <= Math.min(cols - 1, c + R); x++) {
            sum += lum[y * cols + x];
            n++;
          }
        }
        blur[r * cols + c] = sum / n;
      }
    }

    // 3. Stretch the global contrast (ignoring the 8% darkest / 2% brightest outliers)
    const sorted = Array.from(lum).sort((a, b) => a - b);
    const lo = sorted[Math.floor(sorted.length * 0.08)];
    const hi = sorted[Math.floor(sorted.length * 0.98)];
    const at = (r, c) => lum[Math.min(rows - 1, Math.max(0, r)) * cols + Math.min(cols - 1, Math.max(0, c))];

    stars = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = r * cols + c;
        const global = Math.min(1, Math.max(0, (lum[k] - lo) / (hi - lo || 1)));
        // local contrast: darker-than-surroundings spots (eyes, brows, lips) lose stars
        const detail = (lum[k] - blur[k]) / (hi - lo || 1);
        const b = Math.min(1, Math.max(0, global * 0.9 + detail * 1.6));
        // edge strength (Sobel-like): outlines of the features get extra bright stars
        const gx = at(r, c + 1) - at(r, c - 1);
        const gy = at(r + 1, c) - at(r - 1, c);
        const edge = Math.min(1, Math.hypot(gx, gy) / (hi - lo || 1) * 2.5) * global;

        const fill = Math.pow(b, 1.9) * 0.7;
        const outline = edge > 0.35 ? edge * 0.5 : 0;
        if (Math.random() > fill + outline) continue;
        addStar((c + 0.5) * STEP, (r + 0.5) * STEP, Math.max(b, edge));
      }
    }

    function addStar(x, y, b) {
      const hx = x + (Math.random() - 0.5) * STEP;
      const hy = y + (Math.random() - 0.5) * STEP;
      stars.push({
        hx, hy,
        x: prefersReducedMotion ? hx : Math.random() * width,
        y: prefersReducedMotion ? hy : Math.random() * height,
        vx: 0, vy: 0,
        b,
        size: 1.8 + b * 4 + (Math.random() < 0.02 ? 6 : 0), // a few bigger "hero" stars
        sprite: sprites[Math.min(COLORS.length - 1, Math.floor(Math.pow(b, 1.5) * COLORS.length))],
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 1.8,
        delay: Math.random() * 600,
      });
    }

    // Constellation lines: join some bright stars to their nearest bright neighbour
    const bright = stars.filter(s => s.b > 0.7 && Math.random() < 0.04);
    links = [];
    bright.forEach(a => {
      let best = null;
      let bestD = 34;
      bright.forEach(b => {
        if (a === b) return;
        const d = Math.hypot(a.hx - b.hx, a.hy - b.hy);
        if (d < bestD) { bestD = d; best = b; }
      });
      if (best) links.push([a, best]);
    });

    built = true;
  }

  function draw(now) {
    ctx.clearRect(0, 0, width, height);

    ctx.lineWidth = 0.6;
    ctx.strokeStyle = 'rgba(185, 139, 240, 0.28)';
    ctx.beginPath();
    links.forEach(([a, b]) => {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    });
    ctx.stroke();

    ctx.globalCompositeOperation = 'lighter';
    stars.forEach(s => {
      const twinkle = prefersReducedMotion ? 1 : 0.55 + 0.45 * Math.sin(now * 0.002 * s.speed + s.phase);
      ctx.globalAlpha = (0.25 + 0.6 * s.b) * twinkle;
      const size = s.size;
      ctx.drawImage(s.sprite, s.x - size / 2, s.y - size / 2, size, size);
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  let startTime = 0;

  function step(now) {
    if (!startTime) startTime = now;
    const elapsed = now - startTime;

    stars.forEach(s => {
      if (elapsed < s.delay) return; // stars fly in one after another
      let ax = (s.hx - s.x) * 0.045; // spring back home
      let ay = (s.hy - s.y) * 0.045;
      if (mouse) {
        const dx = s.x - mouse.x;
        const dy = s.y - mouse.y;
        const d = Math.hypot(dx, dy);
        if (d < PUSH_RADIUS && d > 0.01) {
          const force = Math.pow(1 - d / PUSH_RADIUS, 2) * 7;
          ax += (dx / d) * force;
          ay += (dy / d) * force;
        }
      }
      s.vx = (s.vx + ax) * 0.82;
      s.vy = (s.vy + ay) * 0.82;
      s.x += s.vx;
      s.y += s.vy;
    });

    draw(now);
    if (running) requestAnimationFrame(step);
  }

  function start() {
    if (running || !built || prefersReducedMotion) return;
    running = true;
    requestAnimationFrame(step);
  }

  function init() {
    try {
      build();
    } catch (err) {
      console.warn('Constellation portrait needs the page served over http (not file://). Showing the photo instead.', err);
      return; // the normal photo stays visible
    }
    frame.prepend(canvas);
    frame.classList.add('is-constellation');
    if (prefersReducedMotion) draw(0);
    else if (visible) start();
  }

  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
  });
  canvas.addEventListener('pointerleave', () => { mouse = null; });

  // Only animate while the portrait is on screen
  new IntersectionObserver(entries => {
    entries.forEach(entry => {
      visible = entry.isIntersecting;
      if (visible) start();
      else running = false;
    });
  }, { rootMargin: '100px' }).observe(frame);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!built) return;
      build();
      stars.forEach(s => { s.x = s.hx; s.y = s.hy; }); // no fly-in again on resize
      if (prefersReducedMotion) draw(0);
    }, 200);
  });

  img.loading = 'eager'; // we need the pixels as soon as possible
  if (img.complete && img.naturalWidth) init();
  else img.addEventListener('load', init, { once: true });
});

// Scroll reveal
if (!prefersReducedMotion) {
  const revealElements = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  revealElements.forEach(el => observer.observe(el));
} else {
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
}

// Scroll-reveal text (letter by letter, lights up as it scrolls into view)
const scrollRevealEls = document.querySelectorAll('[data-scroll-reveal]');

if (scrollRevealEls.length) {
  const revealTargets = [...scrollRevealEls].map(el => {
    const text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.innerHTML = '';

    const chars = [...text].map(char => {
      const span = document.createElement('span');
      span.className = 'vchar';
      span.textContent = char === ' ' ? ' ' : char;
      el.appendChild(span);
      return span;
    });

    return { el, chars };
  });

  if (prefersReducedMotion) {
    revealTargets.forEach(({ chars }) => chars.forEach(c => c.classList.add('lit')));
  } else {
    let ticking = false;

    function updateScrollReveal() {
      revealTargets.forEach(({ el, chars }) => {
        const rect = el.getBoundingClientRect();
        const progress = (window.innerHeight * 0.8 - rect.top) / (rect.height + window.innerHeight * 0.6);
        const litCount = Math.round(Math.max(0, Math.min(1, progress)) * chars.length);

        chars.forEach((c, i) => c.classList.toggle('lit', i < litCount));
      });
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(updateScrollReveal);
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    updateScrollReveal();
  }
}

// Tools marquee: duplicate the cards for a seamless loop
const toolsTrack = document.querySelector('.tools-track');

if (toolsTrack && !prefersReducedMotion) {
  [...toolsTrack.children].forEach(card => {
    const clone = card.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    toolsTrack.appendChild(clone);
  });
}

// Mi universo: counters start when each stat scrolls into view
const universeScroll = document.querySelector('.universe-scroll');

if (universeScroll) {
  const universe = universeScroll.closest('.universe-section');
  const stats = [...universe.querySelectorAll('.stat')];

  function setCount(el, value) {
    el.textContent = String(Math.round(value)).padStart(2, '0');
  }

  function animateCount(el) {
    const target = Number(el.dataset.target);
    const duration = 1600;
    const start = performance.now();

    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      setCount(el, target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if (prefersReducedMotion) {
    stats.forEach(stat => {
      stat.classList.add('is-visible');
      const count = stat.querySelector('.count');
      if (count) setCount(count, Number(count.dataset.target));
    });
  } else {
    const statObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        const count = entry.target.querySelector('.count');
        if (count) animateCount(count);
        statObserver.unobserve(entry.target);
      });
    }, { threshold: 0.6 });

    stats.forEach(stat => statObserver.observe(stat));

    let universeTicking = false;

    function updateUniverse() {
      const rect = universeScroll.getBoundingClientRect();
      const progress = (window.innerHeight - rect.top) / (rect.height + window.innerHeight);
      universe.style.setProperty('--p', Math.max(0, Math.min(1, progress)).toFixed(4));
      universeTicking = false;
    }

    window.addEventListener('scroll', () => {
      if (!universeTicking) {
        requestAnimationFrame(updateUniverse);
        universeTicking = true;
      }
    }, { passive: true });
    updateUniverse();
  }
}

// Projects spinning globe
const globeStage = document.querySelector('.globe-stage');

if (globeStage) {
  const globe = globeStage.querySelector('.globe');
  const section = globeStage.closest('.projects-section');
  const metaEl = section.querySelector('.globe-meta');
  const nameEl = section.querySelector('.globe-name');
  const halo = globeStage.querySelector('.globe-halo');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Repeat the real projects so the sphere looks full; copies are hidden from screen readers and Tab
  const originals = [...globe.children];
  const MIN_TILES = 24;
  while (globe.children.length < MIN_TILES) {
    originals.forEach(li => {
      if (globe.children.length >= MIN_TILES) return;
      const clone = li.cloneNode(true);
      const link = clone.querySelector('a');
      link.setAttribute('aria-hidden', 'true');
      link.tabIndex = -1;
      link.addEventListener('mousedown', e => e.preventDefault()); // a click must not focus a hidden copy
      globe.appendChild(clone);
    });
  }

  const cards = [...globe.querySelectorAll('.globe-card')];
  const realCards = cards.slice(0, originals.length);
  const total = cards.length;
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  const TAU = Math.PI * 2;
  const MAX_PITCH = 1.1;
  const REST_PITCH = -0.18;

  // Fibonacci sphere: spreads N points evenly over a sphere.
  // Each card stores its unit vector and the lat/lon angles that CSS uses to place it.
  const points = cards.map((card, i) => {
    const y = 1 - (2 * (i + 0.5)) / total;
    const r = Math.sqrt(1 - y * y);
    const theta = i * GOLDEN;
    const x = r * Math.cos(theta);
    const z = r * Math.sin(theta);
    return { card, x, y, z, lat: Math.asin(-y), lon: Math.atan2(x, z) };
  });

  let radius = 0;
  let yaw = 0;
  let pitch = REST_PITCH;
  let velYaw = 0;
  let velPitch = 0;
  let target = null;
  let drag = null;
  let moved = false;
  let mouse = null;   // last mouse position over the globe
  let hovered = null; // card under the mouse
  let front = null;
  let running = false;
  let last = 0;

  const wrapAngle = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  const clampPitch = p => Math.max(-MAX_PITCH, Math.min(MAX_PITCH, p));

  function placeCards() {
    radius = (halo.offsetWidth / 2) * 0.86;
    globeStage.style.setProperty('--tile', `${radius * 0.4}px`);
    points.forEach(p => {
      p.base = `rotateY(${p.lon}rad) rotateX(${p.lat}rad) translateZ(${radius}px)`;
      p.card.style.transform = p.base + (p === front ? ' scale(1.15)' : '');
    });
  }

  function setFront(p) {
    if (p === front) return;
    if (front) {
      front.card.classList.remove('is-front');
      front.card.style.transform = front.base;
    }
    front = p;
    p.card.classList.add('is-front');
    p.card.style.transform = p.base + ' scale(1.15)';
    if (!hovered) showLabel(p.card);
  }

  function showLabel(card) {
    metaEl.textContent = card.dataset.meta || '';
    nameEl.textContent = card.getAttribute('aria-label') || '';
  }

  // The globe keeps spinning under a still cursor, so we re-check every frame
  // which card is under it instead of relying on CSS :hover
  function updateHover() {
    let card = null;
    if (mouse && !drag) {
      const el = document.elementFromPoint(mouse.x, mouse.y);
      card = el && el.closest('.globe-card');
    }
    if (card === hovered) return;
    if (hovered) hovered.classList.remove('is-hover');
    hovered = card;
    if (card) {
      card.classList.add('is-hover');
      showLabel(card);
    } else if (front) {
      showLabel(front.card);
    }
  }

  // Same rotation CSS applies (rotateX(pitch) rotateY(yaw)), but we only need the depth (z)
  function render() {
    globe.style.transform = `rotateX(${pitch}rad) rotateY(${yaw}rad)`;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    let best = null;
    let bestZ = -Infinity;

    points.forEach(p => {
      const z1 = -p.x * sy + p.z * cy;
      const depth = p.y * sp + z1 * cp; // -1 (back) .. 1 (front)
      p.card.style.opacity = depth > 0 ? 0.6 + 0.4 * depth : 0.15 + 0.45 * (1 + depth);
      p.card.style.setProperty('--shade', ((1 - depth) * 0.35).toFixed(3));
      p.card.style.pointerEvents = depth > 0.2 ? '' : 'none';
      p.card.classList.toggle('is-back', depth < 0);
      p.card.parentElement.style.zIndex = String(Math.round((depth + 1) * 50));
      if (depth > bestZ) { bestZ = depth; best = p; }
    });

    setFront(best);
    updateHover();
  }

  function rotateTo(p) {
    target = {
      yaw: yaw + wrapAngle(-p.lon - yaw),
      pitch: clampPitch(-p.lat),
    };
    velYaw = velPitch = 0;
    if (reduceMotion) {
      yaw = target.yaw;
      pitch = target.pitch;
      target = null;
      render();
    } else {
      start();
    }
  }

  function step(now) {
    const dt = Math.min(now - last, 50) / 16.67;
    last = now;

    if (!drag) {
      if (target) {
        const k = 1 - Math.pow(1 - 0.12, dt);
        yaw += (target.yaw - yaw) * k;
        pitch += (target.pitch - pitch) * k;
        if (Math.abs(target.yaw - yaw) < 0.001 && Math.abs(target.pitch - pitch) < 0.001) {
          target = null;
        }
      } else {
        yaw += velYaw * dt;
        pitch = clampPitch(pitch + velPitch * dt);
        const friction = Math.pow(0.94, dt);
        velYaw *= friction;
        velPitch *= friction;
        if (Math.abs(velYaw) < 0.003) {
          yaw += 0.0025 * dt; // slow auto-spin
          pitch += (REST_PITCH - pitch) * 0.01 * dt; // drift back to the resting tilt
        }
      }
    }

    render();
    if (running) requestAnimationFrame(step);
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(step);
  }

  function stop() { running = false; }

  // Drag to spin (mouse spins both axes; on touch, vertical swipes still scroll the page)
  globeStage.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, t: performance.now() };
    moved = false;
    target = null;
  });

  globeStage.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) {
      moved = true;
      globeStage.classList.add('is-dragging');
      globeStage.setPointerCapture(e.pointerId);
    }
    if (!moved) return;

    const k = 1 / radius;
    const dx = (e.clientX - drag.lastX) * k;
    const dy = e.pointerType === 'mouse' ? (e.clientY - drag.lastY) * k : 0;
    yaw += dx;
    pitch = clampPitch(pitch - dy);

    const now = performance.now();
    const frames = Math.max(1, (now - drag.t) / 16.67);
    velYaw = dx / frames;
    velPitch = -dy / frames;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    drag.t = now;
    if (reduceMotion) render();
  });

  function endDrag() {
    if (!drag) return;
    if (performance.now() - drag.t > 80) velYaw = velPitch = 0; // released without flicking
    drag = null;
    globeStage.classList.remove('is-dragging');
  }

  globeStage.addEventListener('pointerup', endDrag);
  globeStage.addEventListener('pointercancel', endDrag);
  globeStage.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    mouse = { x: e.clientX, y: e.clientY };
    if (reduceMotion) updateHover();
  });
  globeStage.addEventListener('pointerleave', () => {
    mouse = null;
    updateHover();
  });

  // Click: a side card spins to the front; the front card opens its project
  globe.addEventListener('click', e => {
    const card = e.target.closest('.globe-card');
    if (!card) return;
    if (moved) { e.preventDefault(); moved = false; return; }
    const p = points.find(pt => pt.card === card);
    e.preventDefault();
    if (p !== front) rotateTo(p); // bring it to the front (seen when the window closes)
    // open the project's case study window (handled by the "Case study window" code)
    if (card.dataset.slug) {
      document.dispatchEvent(new CustomEvent('open-case', { detail: { slug: card.dataset.slug, from: card } }));
    }
  });

  // Keyboard: Tab to a project brings it to the front; arrows move between projects
  realCards.forEach(card => {
    card.addEventListener('focus', () => rotateTo(points.find(pt => pt.card === card)));
  });

  globeStage.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const current = realCards.findIndex(c => c.getAttribute('aria-label') === front.card.getAttribute('aria-label'));
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const next = realCards[(Math.max(current, 0) + dir + realCards.length) % realCards.length];
    rotateTo(points.find(pt => pt.card === next));
  });

  globeStage.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target === globeStage && front) front.card.click();
  });

  // Only animate while the section is on screen
  new IntersectionObserver(entries => {
    entries.forEach(entry => (entry.isIntersecting ? start() : stop()));
  }).observe(globeStage);

  window.addEventListener('resize', () => { placeCards(); render(); });
  placeCards();
  render();
}

// CTA section: orb clusters + spaceship cursor
const ctaSection = document.querySelector('.cta-section');

if (ctaSection) {
  const patterns = {
    left: ['1110', '0101', '1111', '0110', '1011', '1101'],
    right: ['1101', '0111', '0101', '1011', '1111', '1011'],
  };

  ctaSection.querySelectorAll('.ball-cluster').forEach(cluster => {
    let count = cluster.dataset.pattern === 'right' ? 3 : 0;

    patterns[cluster.dataset.pattern].forEach((row, r) => {
      [...row].forEach((cell, c) => {
        if (cell !== '1') return;
        const ball = document.createElement('span');
        ball.className = `ball ball--${(count % 6) + 1}`;
        ball.dataset.col = c;
        ball.style.gridColumn = c + 1;
        ball.style.gridRow = r + 1;
        ball.style.setProperty('--delay', `${-(count * 0.9) % 7}s`);
        cluster.appendChild(ball);
        count++;
      });
    });
  });

  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !prefersReducedMotion) {
    const title = ctaSection.querySelector('.cta-title');
    title.setAttribute('aria-label', [...title.querySelectorAll(':scope > span')].map(w => w.textContent.trim()).join(' '));

    const chars = [];
    title.querySelectorAll(':scope > span').forEach(word => {
      word.setAttribute('aria-hidden', 'true');
      const text = word.textContent;
      word.textContent = '';
      [...text].forEach(letter => {
        const outer = document.createElement('span');
        outer.className = 'wave-char';
        const inner = document.createElement('span');
        inner.className = 'wave-inner';
        inner.textContent = letter;
        outer.appendChild(inner);
        word.appendChild(outer);
        chars.push({ outer, inner });
      });
    });

    const pointer = { x: 0, y: 0 };
    let intensity = 0;
    let hovering = false;
    let waveLoop = false;

    function renderWave(now) {
      const fontSize = parseFloat(getComputedStyle(title).fontSize);
      const sigma = fontSize * 1.25;
      const amplitude = fontSize * 0.05;
      intensity += ((hovering ? 1 : 0) - intensity) * 0.06;

      chars.forEach(({ outer, inner }) => {
        const rect = outer.getBoundingClientRect();
        const dx = rect.left + rect.width / 2 - pointer.x;
        const dy = rect.top + rect.height / 2 - pointer.y;
        const distance = Math.hypot(dx, dy);
        const influence = Math.exp(-(distance * distance) / (2 * sigma * sigma)) * intensity;
        const ripple = Math.sin(distance / (fontSize * 0.35) - now / 320);

        inner.style.transform = `translateY(${(ripple * amplitude * influence).toFixed(2)}px)`;
        inner.style.opacity = (1 - influence * 0.22 * (0.5 + 0.5 * ripple)).toFixed(3);
      });

      if (hovering || intensity > 0.01) {
        requestAnimationFrame(renderWave);
      } else {
        waveLoop = false;
        chars.forEach(({ inner }) => {
          inner.style.transform = '';
          inner.style.opacity = '';
        });
      }
    }

    title.addEventListener('mouseenter', () => {
      hovering = true;
      if (!waveLoop) {
        waveLoop = true;
        requestAnimationFrame(renderWave);
      }
    });

    title.addEventListener('mousemove', e => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    });

    title.addEventListener('mouseleave', () => { hovering = false; });
  }

  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const ship = document.createElement('div');
    ship.className = 'ship-cursor';
    ship.setAttribute('aria-hidden', 'true');
    ship.innerHTML = `
      <svg viewBox="0 0 40 56" width="34" height="48">
        <path class="ship-flame" d="M16 40 L20 54 L24 40 Z" fill="#d84df2"/>
        <path d="M13 26 L3 40 L13 36 Z M27 26 L37 40 L27 36 Z" fill="#b98bf0"/>
        <path d="M20 2 L27 22 L27 38 L20 42 L13 38 L13 22 Z" fill="#2a1340" stroke="#b98bf0" stroke-width="1.6" stroke-linejoin="round"/>
        <circle cx="20" cy="17" r="3.2" fill="#ece6f5"/>
      </svg>`;
    document.body.appendChild(ship);

    let x = 0, y = 0, lastX = 0, lastY = 0;
    let angle = 0, targetAngle = 0;
    let looping = false;

    function renderShip() {
      let diff = ((targetAngle - angle + 540) % 360) - 180;
      angle += prefersReducedMotion ? diff : diff * 0.18;
      ship.style.transform = `translate(${x}px, ${y}px) rotate(${angle}deg)`;
      if (looping) requestAnimationFrame(renderShip);
    }

    ctaSection.classList.add('has-ship-cursor');

    ctaSection.addEventListener('mouseenter', e => {
      x = lastX = e.clientX;
      y = lastY = e.clientY;
      ship.classList.add('is-active');
      if (!looping) {
        looping = true;
        requestAnimationFrame(renderShip);
      }
    });

    ctaSection.addEventListener('mousemove', e => {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      if (Math.hypot(dx, dy) > 4) {
        targetAngle = Math.atan2(dx, -dy) * 180 / Math.PI;
        lastX = e.clientX;
        lastY = e.clientY;
      }
      x = e.clientX;
      y = e.clientY;
    });

    ctaSection.addEventListener('mouseleave', () => {
      ship.classList.remove('is-active');
      looping = false;
    });
  }
}

// Case study window: each project's content lives in <template id="case-SLUG"> in the HTML
const caseWin = document.querySelector('.case');

if (caseWin) {
  // <main> creates its own stacking layer (z-index: 1), which would keep this window
  // below the fixed header; living directly in <body> lets it cover the whole page
  document.body.appendChild(caseWin);
  const caseBody = caseWin.querySelector('.case-body');
  const caseScroll = caseWin.querySelector('.case-scroll');
  const caseCount = caseWin.querySelector('.case-count');
  const caseClose = caseWin.querySelector('.case-close');
  const caseNext = caseWin.querySelector('.case-next');
  const caseNextTitle = caseWin.querySelector('.case-next-title');
  // project order = order of the templates in the HTML
  const slugs = [...document.querySelectorAll('template[id^="case-"]')].map(t => t.id.slice(5));
  let current = null;
  let opener = null;     // element to give focus back to on close
  let pushedState = false;

  function fill(slug) {
    const tpl = document.getElementById(`case-${slug}`);
    caseBody.replaceChildren(tpl.content.cloneNode(true));
    const i = slugs.indexOf(slug);
    caseCount.textContent = `${String(i + 1).padStart(2, '0')} / ${String(slugs.length).padStart(2, '0')} · ${tpl.dataset.category || ''}`;
    const next = slugs[(i + 1) % slugs.length];
    caseNext.href = `#${next}`;
    caseNext.dataset.slug = next;
    caseNextTitle.textContent = document.getElementById(`case-${next}`).content.querySelector('.case-title').textContent;
    current = slug;
  }

  function openCase(slug, from, { fromHistory = false } = {}) {
    if (!document.getElementById(`case-${slug}`)) return;
    // the circle grows from the center of the card that was clicked
    // (3D-rotated cards can report odd positions, so the point is kept inside the screen)
    let ox = innerWidth / 2;
    let oy = innerHeight / 2;
    if (from) {
      const r = from.getBoundingClientRect();
      ox = Math.min(innerWidth, Math.max(0, r.left + r.width / 2));
      oy = Math.min(innerHeight, Math.max(0, r.top + r.height / 2));
    }
    caseWin.style.setProperty('--ox', `${ox}px`);
    caseWin.style.setProperty('--oy', `${oy}px`);
    // radius big enough to cover the screen from that point
    caseWin.style.setProperty('--or', `${Math.hypot(Math.max(ox, innerWidth - ox), Math.max(oy, innerHeight - oy)) + 20}px`);
    opener = from || document.activeElement;
    fill(slug);
    caseWin.hidden = false;
    caseScroll.scrollTop = 0;
    document.documentElement.classList.add('case-open');
    requestAnimationFrame(() => requestAnimationFrame(() => caseWin.classList.add('is-open')));
    caseClose.focus({ preventScroll: true });
    if (!fromHistory) {
      history.pushState({ caseSlug: slug }, '', `#${slug}`);
      pushedState = true;
    }
  }

  function closeCase({ fromHistory = false } = {}) {
    if (caseWin.hidden) return;
    caseWin.querySelectorAll('video').forEach(v => v.pause()); // stop the short film's sound
    caseWin.classList.remove('is-open');
    document.documentElement.classList.remove('case-open');
    const done = () => {
      caseWin.hidden = true;
      caseBody.replaceChildren();
      opener?.focus?.({ preventScroll: true });
    };
    if (prefersReducedMotion) done();
    else setTimeout(done, 700);
    current = null;
    if (!fromHistory) {
      if (pushedState) history.back();           // keep the browser history clean
      else history.replaceState(null, '', '#proyectos');
    }
    pushedState = false;
  }

  // "Next project": swap the content with a quick fade, without closing
  caseNext.addEventListener('click', e => {
    e.preventDefault();
    const next = caseNext.dataset.slug;
    caseBody.classList.add('is-swapping');
    setTimeout(() => {
      fill(next);
      caseScroll.scrollTop = 0;
      history.replaceState({ caseSlug: next }, '', `#${next}`);
      caseBody.classList.remove('is-swapping');
    }, prefersReducedMotion ? 0 : 250);
  });

  caseClose.addEventListener('click', () => closeCase());

  // Esc closes; Tab stays inside the window while it is open
  caseWin.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); closeCase(); return; }
    if (e.key !== 'Tab') return;
    const focusables = [...caseWin.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])')];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // the globe asks to open a project (see "open-case" in the globe code)
  document.addEventListener('open-case', e => openCase(e.detail.slug, e.detail.from));

  // back / forward buttons and shared links like .../#dale
  window.addEventListener('popstate', () => {
    const slug = location.hash.slice(1);
    if (slugs.includes(slug)) {
      if (slug !== current) {
        if (current) fill(slug);
        else openCase(slug, null, { fromHistory: true });
      }
    } else {
      pushedState = false;
      closeCase({ fromHistory: true });
    }
  });

  const startSlug = location.hash.slice(1);
  if (slugs.includes(startSlug)) openCase(startSlug, null, { fromHistory: true });
}

// "Crea sin límites" -> galactic dust -> hidden game "Defensa Estelar"
const gameSection = document.querySelector('.cta-section');

if (gameSection && gameSection.querySelector('.game-stage')) {
  const title = gameSection.querySelector('.cta-title');
  const dustCanvas = gameSection.querySelector('.dust-canvas');
  const dctx = dustCanvas.getContext('2d');
  const invite = gameSection.querySelector('.game-invite');
  const peek = gameSection.querySelector('.game-peek');
  const HOLD_MS = 1000; // how long the cursor rests on the title before it bursts
  const DUST_COLORS = ['#f3e8ff', '#ece6f5', '#b98bf0', '#d84df2', '#c9a2f7'];

  // ===================== 1) title <-> dust =====================
  let dust = [];
  let dustState = 'idle'; // idle | dust | burst | gone | reform
  let charge = 0;          // 0..1 while the cursor rests on the title
  let overTitle = false;
  let mouse = null;
  let dustRunning = false;
  let stateTime = 0;
  let lastDust = 0;
  let dpr = 1;
  let DW = 0, DH = 0;

  // Draw the title text into an offscreen canvas and turn its lit pixels into particles
  function buildDust() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const box = gameSection.getBoundingClientRect();
    DW = Math.round(box.width * dpr);
    DH = Math.round(box.height * dpr);
    dustCanvas.width = DW;
    dustCanvas.height = DH;

    const off = document.createElement('canvas');
    off.width = Math.round(box.width);
    off.height = Math.round(box.height);
    const o = off.getContext('2d', { willReadFrequently: true });
    const fontSize = parseFloat(getComputedStyle(title).fontSize);
    o.fillStyle = '#fff';
    o.textAlign = 'center';
    o.textBaseline = 'alphabetic';
    o.font = `400 ${fontSize}px Anton, sans-serif`;

    title.querySelectorAll(':scope > span').forEach(word => {
      const r = word.getBoundingClientRect();
      const text = word.textContent.trim().toUpperCase();
      const m = o.measureText(text);
      // center the letters' own height inside the word's line box
      const y = r.top - box.top + r.height / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
      o.fillText(text, r.left - box.left + r.width / 2, y);
    });

    const step = Math.max(2, Math.round(fontSize / 42));
    const data = o.getImageData(0, 0, off.width, off.height).data;
    dust = [];
    for (let y = 0; y < off.height; y += step) {
      for (let x = 0; x < off.width; x += step) {
        if (data[(y * off.width + x) * 4 + 3] < 128) continue;
        const hx = x * dpr, hy = y * dpr;
        dust.push({
          hx, hy, x: hx, y: hy, vx: 0, vy: 0, a: 1,
          s: (step * 0.75 + Math.random()) * dpr,
          c: DUST_COLORS[Math.floor(Math.random() * DUST_COLORS.length)],
        });
      }
    }
  }

  function setDustState(state) {
    dustState = state;
    stateTime = 0;
    if (!dustRunning) {
      dustRunning = true;
      lastDust = 0;
      requestAnimationFrame(dustFrame);
    }
  }

  function enterDust() {
    if (dustState !== 'idle') return;
    buildDust();
    title.classList.add('is-dust');
    setDustState('dust');
  }

  function burst() {
    if (dustState !== 'dust' && dustState !== 'idle') return;
    if (dustState === 'idle') { buildDust(); title.classList.add('is-dust'); }
    const cx = DW / 2, cy = DH / 2;
    dust.forEach(p => {
      const dx = p.x - cx, dy = p.y - cy;
      const d = Math.hypot(dx, dy) || 1;
      const speed = (2 + Math.random() * 7) * dpr;
      p.vx = (dx / d) * speed - (dy / d) * speed * 0.6; // outward + a swirl
      p.vy = (dy / d) * speed + (dx / d) * speed * 0.6;
    });
    charge = 0;
    setDustState('burst');
  }

  // Bring the dust back from a ring around the center and re-form the title
  // the game UI uses the normal cursor; the ship cursor comes back when it closes
  function setGameUi(on) {
    gameSection.classList.toggle('has-game-ui', on);
    document.body.classList.toggle('has-game-ui', on);
  }

  function reform() {
    invite.hidden = true;
    setGameUi(false);
    buildDust();
    const cx = DW / 2, cy = DH / 2;
    dust.forEach(p => {
      const ang = Math.random() * Math.PI * 2;
      const rad = (0.3 + Math.random() * 0.4) * Math.min(DW, DH);
      p.x = cx + Math.cos(ang) * rad;
      p.y = cy + Math.sin(ang) * rad;
      p.vx = p.vy = 0;
      p.a = 0;
    });
    title.classList.add('is-dust');
    setDustState('reform');
  }

  function showInvite() {
    invite.hidden = false;
    setGameUi(true);
    invite.querySelector('[data-game="play"]').focus({ preventScroll: true });
  }

  function toIdle() {
    dustState = 'idle';
    title.classList.remove('is-dust');
    dctx.clearRect(0, 0, DW, DH);
    if (invite.hidden && gameStage.hidden) setGameUi(false);
  }

  function dustFrame(now) {
    // realDt = real elapsed time (timers stay accurate even if the browser slows frames down);
    // dt = capped step for the physics so particles never jump
    const realDt = lastDust ? Math.min(now - lastDust, 250) : 16;
    const dt = Math.min(realDt, 50);
    lastDust = now;
    stateTime += realDt;

    if (dustState === 'dust') {
      charge = overTitle ? Math.min(1, charge + realDt / HOLD_MS) : Math.max(0, charge - realDt / 500);
      if (charge >= 1) burst();
    }

    dctx.clearRect(0, 0, DW, DH);
    dctx.globalCompositeOperation = 'lighter';
    const cx = DW / 2, cy = DH / 2;
    let settled = true;
    let visible = 0;

    for (const p of dust) {
      if (dustState === 'dust' || dustState === 'reform') {
        const k = dustState === 'dust' ? 0.09 : 0.05;
        let ax = (p.hx - p.x) * k;
        let ay = (p.hy - p.y) * k;
        if (dustState === 'dust') {
          if (mouse) { // dust is pushed away from the cursor
            const dx = p.x - mouse.x, dy = p.y - mouse.y;
            const d = Math.hypot(dx, dy);
            const R = 90 * dpr;
            if (d < R && d > 0.1) {
              const f = Math.pow(1 - d / R, 2) * 6 * dpr;
              ax += (dx / d) * f;
              ay += (dy / d) * f;
            }
          }
          // the longer the cursor stays, the more the dust trembles
          ax += (Math.random() - 0.5) * charge * 2.4 * dpr;
          ay += (Math.random() - 0.5) * charge * 2.4 * dpr;
        } else {
          p.a = Math.min(1, p.a + realDt / 700);
        }
        p.vx = (p.vx + ax) * 0.8;
        p.vy = (p.vy + ay) * 0.8;
        p.x += p.vx;
        p.y += p.vy;
        if (Math.abs(p.x - p.hx) + Math.abs(p.y - p.hy) > 1.5 * dpr || p.a < 1) settled = false;
      } else if (dustState === 'burst') {
        const dx = p.x - cx, dy = p.y - cy;
        const d = Math.hypot(dx, dy) || 1;
        p.vx += (-dy / d) * 0.12 * dpr; // keeps swirling like a small galaxy
        p.vy += (dx / d) * 0.12 * dpr;
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.x += p.vx;
        p.y += p.vy;
        p.a -= realDt / 1500;
      }
      if (p.a <= 0) continue;
      visible++;
      dctx.globalAlpha = p.a;
      dctx.fillStyle = p.c;
      dctx.fillRect(p.x, p.y, p.s, p.s);
    }
    dctx.globalAlpha = 1;
    dctx.globalCompositeOperation = 'source-over';

    if (dustState === 'burst') {
      if (stateTime > 550 && invite.hidden && gameStage.hidden) showInvite();
      if (visible === 0) {
        dustState = 'gone';
        dctx.clearRect(0, 0, DW, DH);
      }
    } else if (dustState === 'dust') {
      if (!overTitle && charge === 0 && settled && stateTime > 300) toIdle();
    } else if (dustState === 'reform') {
      if (settled) toIdle();
    }

    if (dustState === 'idle' || dustState === 'gone') {
      dustRunning = false;
      return;
    }
    requestAnimationFrame(dustFrame);
  }

  // mouse: hover the title to turn it into dust, rest on it to make it burst
  if (!prefersReducedMotion) {
    title.addEventListener('pointerenter', e => {
      if (e.pointerType !== 'mouse') return;
      overTitle = true;
      enterDust();
    });
    title.addEventListener('pointerleave', () => { overTitle = false; });
    gameSection.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const box = gameSection.getBoundingClientRect();
      mouse = { x: (e.clientX - box.left) * dpr, y: (e.clientY - box.top) * dpr };
    });
    gameSection.addEventListener('pointerleave', () => { mouse = null; overTitle = false; });

    // touch: long press on the title
    let pressTimer = null;
    title.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      pressTimer = setTimeout(() => burst(), 600);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(type =>
      title.addEventListener(type, () => clearTimeout(pressTimer)));
    title.addEventListener('contextmenu', e => { if (pressTimer) e.preventDefault(); });
  }

  peek.addEventListener('click', () => {
    if (prefersReducedMotion) showInvite();
    else burst();
  });

  invite.querySelector('[data-game="play"]').addEventListener('click', () => {
    invite.hidden = true;
    startGame();
  });
  invite.querySelector('[data-game="later"]').addEventListener('click', () => {
    if (prefersReducedMotion) {
      invite.hidden = true;
      toIdle();
    } else {
      reform();
    }
  });

  // ===================== 2) the game =====================
  const gameStage = gameSection.querySelector('.game-stage');
  const gc = gameStage.querySelector('.game-canvas');
  const g = gc.getContext('2d');
  const hud = {
    score: gameStage.querySelector('.game-score'),
    best: gameStage.querySelector('.game-best'),
    wave: gameStage.querySelector('.game-wave'),
    lives: gameStage.querySelector('.game-lives'),
  };
  const overlay = gameStage.querySelector('.game-overlay');
  const overlayTitle = overlay.querySelector('.game-overlay-title');
  const overlayText = overlay.querySelector('.game-overlay-text');
  const overlayPrimary = overlay.querySelector('.game-overlay-primary');
  const pauseBtn = gameStage.querySelector('[data-game="pause"]');
  const muteBtn = gameStage.querySelector('[data-game="mute"]');
  const BEST_KEY = 'defensaEstelarBest';

  // ---- arcade sound (Web Audio: generated in code, no audio files) ----
  const sfx = (() => {
    let ac = null, master = null, musicTimer = null, step = 0;
    let muted = false;
    try { muted = localStorage.getItem('defensaEstelarMute') === '1'; } catch { /* ignore */ }
    const ensure = () => {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ac = new AC();
        master = ac.createGain();
        master.gain.value = muted ? 0 : 0.22;
        master.connect(ac.destination);
      }
      if (ac.state === 'suspended') ac.resume();
      return true;
    };
    // one short tone: square = chiptune voice; frequency can slide from f to f2
    const tone = (f, dur, type = 'square', vol = 0.3, f2 = null, when = 0) => {
      if (!ac) return;
      const t = ac.currentTime + when;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + dur + 0.02);
    };
    const noise = (dur, vol = 0.35) => { // explosion = filtered white noise
      if (!ac) return;
      const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = ac.createBufferSource();
      const filter = ac.createBiquadFilter();
      const g = ac.createGain();
      src.buffer = buf;
      filter.type = 'lowpass';
      filter.frequency.value = 1400;
      g.gain.value = vol;
      src.connect(filter).connect(g).connect(master);
      src.start();
    };
    // looping chiptune: bass on every beat + arpeggio melody (A minor, 140 bpm)
    const BASS = [110, 110, 87.31, 87.31, 98, 98, 82.41, 82.41];
    const LEAD = [440, 523.25, 659.25, 523.25, 349.23, 440, 523.25, 440,
                  392, 493.88, 587.33, 493.88, 329.63, 415.3, 493.88, 415.3];
    const beat = () => {
      tone(BASS[Math.floor(step / 2) % BASS.length], 0.2, 'triangle', 0.35);
      tone(LEAD[step % LEAD.length], 0.12, 'square', 0.08);
      step++;
    };
    return {
      startMusic() { if (!ensure() || musicTimer) return; step = 0; musicTimer = setInterval(beat, 214); },
      stopMusic() { clearInterval(musicTimer); musicTimer = null; },
      shoot() { tone(880, 0.08, 'square', 0.12, 440); },
      boom() { noise(0.35); tone(160, 0.3, 'square', 0.15, 50); },
      hurt() { noise(0.5, 0.5); tone(300, 0.6, 'sawtooth', 0.2, 60); },
      wave() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.15, 'square', 0.15, null, i * 0.1)); },
      over() { [392, 329.63, 261.63, 196].forEach((f, i) => tone(f, 0.3, 'square', 0.18, null, i * 0.22)); },
      get muted() { return muted; },
      toggle() {
        muted = !muted;
        try { localStorage.setItem('defensaEstelarMute', muted ? '1' : '0'); } catch { /* ignore */ }
        if (master) master.gain.value = muted ? 0 : 0.22;
        return muted;
      },
    };
  })();

  if (sfx.muted) { muteBtn.textContent = '🔇'; muteBtn.setAttribute('aria-label', 'Activar sonido'); }

  let GW = 0, GH = 0, gdpr = 1;
  let player, bullets, enemyShots, enemies, sparks, stars;
  let score, lives, wave, best, fireCd, diveCd, bannerT, invuln, formationT;
  let mode = 'off'; // off | playing | paused | over
  let lastFrame = 0;
  let targetX = null;
  const keys = { left: false, right: false };

  function readBest() {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
  }
  function saveBest() {
    try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* storage blocked: keep in memory */ }
  }

  function resizeGame() {
    gdpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = gc.getBoundingClientRect();
    GW = r.width;
    GH = r.height;
    gc.width = Math.round(GW * gdpr);
    gc.height = Math.round(GH * gdpr);
    g.setTransform(gdpr, 0, 0, gdpr, 0, 0);
    if (player) player.y = GH - 58;
  }

  function makeStars() {
    stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * GW,
      y: Math.random() * GH,
      v: 0.015 + Math.random() * 0.06,
      r: Math.random() * 1.3 + 0.3,
    }));
  }

  // enemy formation: rows of different invaders, columns depend on the stage width
  function spawnWave() {
    enemies = [];
    const cols = Math.max(5, Math.min(9, Math.floor((GW - 60) / 54)));
    const rows = 4;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const type = row === 0 ? 'boss' : row === 1 ? 'moth' : 'orb';
        enemies.push({
          row, col, cols, type,
          hp: type === 'boss' ? 2 : 1,
          r: type === 'boss' ? 15 : type === 'moth' ? 12 : 11,
          pts: type === 'boss' ? 300 : type === 'moth' ? 150 : 100,
          state: 'form', x: 0, y: -40, t: 0, dir: 1, startX: 0, hitT: 0,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }
    formationT = 0;
    diveCd = 2200;
    bannerT = 1600;
  }

  function slot(e) {
    const spacing = Math.min(54, (GW - 60) / e.cols);
    const sway = Math.sin(formationT * 0.0011) * Math.min(40, GW * 0.05);
    const intro = Math.min(1, formationT / 1400);
    const ease = 1 - Math.pow(1 - intro, 3);
    return {
      x: GW / 2 + (e.col - (e.cols - 1) / 2) * spacing + sway,
      y: 78 + e.row * 42 - (1 - ease) * (GH * 0.7 + e.row * 30),
    };
  }

  function resetGame() {
    resizeGame();
    makeStars();
    player = { x: GW / 2, y: GH - 58 };
    targetX = GW / 2;
    bullets = [];
    enemyShots = [];
    sparks = [];
    score = 0;
    lives = 3;
    wave = 1;
    best = readBest();
    fireCd = 400;
    invuln = 0;
    spawnWave();
    updateHud();
  }

  function updateHud() {
    hud.score.textContent = score;
    hud.best.textContent = best;
    hud.wave.textContent = wave;
    hud.lives.textContent = '♥'.repeat(Math.max(0, lives));
    hud.lives.setAttribute('aria-label', `Vidas: ${lives}`);
  }

  function explode(x, y, colors, n = 18) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.05 + Math.random() * 0.22;
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c: colors[i % colors.length] });
    }
  }

  function hitPlayer() {
    if (invuln > 0) return;
    lives--;
    invuln = 1800;
    explode(player.x, player.y, ['#ece6f5', '#d84df2', '#b98bf0'], 30);
    sfx.hurt();
    updateHud();
    if (lives <= 0) gameOver();
  }

  function update(dt) {
    formationT += dt;
    bannerT = Math.max(0, bannerT - dt);
    invuln = Math.max(0, invuln - dt);
    const speedUp = 1 + (wave - 1) * 0.12;

    // stars drift down = feeling of flying forward
    stars.forEach(s => {
      s.y += s.v * dt;
      if (s.y > GH) { s.y = 0; s.x = Math.random() * GW; }
    });

    // player follows the pointer (or the arrow keys)
    if (keys.left) targetX = (targetX ?? player.x) - 0.45 * dt;
    if (keys.right) targetX = (targetX ?? player.x) + 0.45 * dt;
    targetX = Math.max(20, Math.min(GW - 20, targetX ?? player.x));
    player.x += (targetX - player.x) * Math.min(1, dt * 0.012);

    // auto-fire
    fireCd -= dt;
    if (fireCd <= 0 && bannerT < 1200) {
      bullets.push({ x: player.x, y: player.y - 20 });
      sfx.shoot();
      fireCd = 260;
    }
    bullets.forEach(b => { b.y -= 0.62 * dt; });
    bullets = bullets.filter(b => b.y > -20);

    // enemies: formation, dives and returns
    diveCd -= dt;
    if (diveCd <= 0 && formationT > 1600) {
      const candidates = enemies.filter(e => e.state === 'form');
      if (candidates.length) {
        const e = candidates[Math.floor(Math.random() * candidates.length)];
        e.state = 'dive';
        e.t = 0;
        e.startX = e.x;
        e.dir = Math.random() < 0.5 ? -1 : 1;
      }
      diveCd = (1500 + Math.random() * 1300) / speedUp;
    }

    enemies.forEach(e => {
      e.hitT = Math.max(0, e.hitT - dt);
      if (e.state === 'form') {
        const s = slot(e);
        e.x = s.x;
        e.y = s.y;
        if (formationT > 1600 && Math.random() < 0.00012 * dt * speedUp) {
          enemyShots.push({ x: e.x, y: e.y + 10 });
        }
      } else if (e.state === 'dive') {
        e.t += dt;
        e.y += (0.13 + 0.015 * wave) * dt;
        const pull = Math.min(1, e.t / 1600) * 0.6;
        e.x = e.startX + Math.sin(e.t * 0.0032) * 90 * e.dir + (player.x - e.startX) * pull;
        if (Math.random() < 0.0012 * dt) enemyShots.push({ x: e.x, y: e.y + 10 });
        if (e.y > GH + 30) { e.state = 'return'; e.y = -30; }
      } else if (e.state === 'return') {
        const s = slot(e);
        e.x += (s.x - e.x) * Math.min(1, dt * 0.004);
        e.y += (s.y - e.y) * Math.min(1, dt * 0.004);
        if (Math.abs(s.x - e.x) + Math.abs(s.y - e.y) < 3) e.state = 'form';
      }
    });

    enemyShots.forEach(s => { s.y += (0.22 + 0.02 * wave) * dt; });
    enemyShots = enemyShots.filter(s => s.y < GH + 10);

    // collisions: your shots vs invaders
    bullets.forEach(b => {
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + 4) {
          b.y = -100;
          e.hp--;
          e.hitT = 120;
          if (e.hp <= 0) {
            score += e.state === 'dive' ? e.pts * 2 : e.pts; // diving invaders are worth double
            explode(e.x, e.y, e.type === 'moth' ? ['#d84df2', '#f19aae'] : ['#b98bf0', '#ece6f5', '#8a56b5']);
            sfx.boom();
            if (score > best) { best = score; saveBest(); }
            updateHud();
          }
          break;
        }
      }
    });
    enemies = enemies.filter(e => e.hp > 0);

    // collisions: invaders and their shots vs you
    enemyShots.forEach(s => {
      if (Math.hypot(s.x - player.x, s.y - player.y) < 14) { s.y = GH + 100; hitPlayer(); }
    });
    enemies.forEach(e => {
      if (e.state === 'dive' && Math.hypot(e.x - player.x, e.y - player.y) < e.r + 14) {
        e.hp = 0;
        explode(e.x, e.y, ['#d84df2', '#b98bf0']);
        hitPlayer();
      }
    });
    enemies = enemies.filter(e => e.hp > 0);

    sparks.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt / 700;
    });
    sparks = sparks.filter(p => p.life > 0);

    if (mode === 'playing' && enemies.length === 0) {
      wave++;
      enemyShots = [];
      sfx.wave();
      spawnWave();
      updateHud();
    }
  }

  // ---- drawing ----
  function drawShip(x, y) {
    g.save();
    g.translate(x, y);
    g.shadowColor = '#d84df2';
    g.shadowBlur = 14;
    g.fillStyle = '#d84df2'; // engine flame
    g.beginPath();
    g.moveTo(-4, 14);
    g.lineTo(0, 22 + Math.random() * 6);
    g.lineTo(4, 14);
    g.fill();
    g.fillStyle = '#b98bf0'; // wings
    g.beginPath();
    g.moveTo(-7, 2); g.lineTo(-18, 14); g.lineTo(-7, 11);
    g.moveTo(7, 2); g.lineTo(18, 14); g.lineTo(7, 11);
    g.fill();
    g.fillStyle = '#2a1340'; // body
    g.strokeStyle = '#ece6f5';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(0, -20); g.lineTo(7, -4); g.lineTo(7, 12); g.lineTo(0, 15); g.lineTo(-7, 12); g.lineTo(-7, -4);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#ece6f5'; // cockpit
    g.beginPath();
    g.arc(0, -6, 2.6, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function drawEnemy(e, now) {
    g.save();
    g.translate(e.x, e.y);
    const flash = e.hitT > 0;
    if (e.type === 'moth') {
      // star-moth: magenta body with flapping wings
      const flap = Math.sin(now * 0.012 + e.phase) * 0.5 + 0.5;
      g.fillStyle = flash ? '#fff' : '#f19aae';
      g.beginPath();
      g.ellipse(-8, -2, 9, 4 + flap * 4, -0.5, 0, Math.PI * 2);
      g.ellipse(8, -2, 9, 4 + flap * 4, 0.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = flash ? '#fff' : '#d84df2';
      g.beginPath();
      g.arc(0, 0, 6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#12081d';
      g.fillRect(-3, -2, 2, 2);
      g.fillRect(1, -2, 2, 2);
    } else {
      // little ringed planet ("boss" = bigger, pink ring, needs 2 hits)
      const big = e.type === 'boss';
      const grad = g.createRadialGradient(-e.r * 0.35, -e.r * 0.35, 1, 0, 0, e.r);
      grad.addColorStop(0, flash ? '#fff' : big ? '#e6c8ff' : '#c9a2f7');
      grad.addColorStop(0.6, big ? '#8a56b5' : '#6a2fc4');
      grad.addColorStop(1, '#1a0a33');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, e.r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = big ? (e.hp === 1 ? '#d84df2' : '#f19aae') : '#b98bf0';
      g.lineWidth = big ? 2.2 : 1.6;
      g.beginPath();
      g.ellipse(0, 0, e.r * 1.6, e.r * 0.45, -0.35, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }

  function draw(now) {
    g.clearRect(0, 0, GW, GH);
    g.fillStyle = '#ece6f5';
    stars.forEach(s => {
      g.globalAlpha = 0.35 + s.v * 8;
      g.fillRect(s.x, s.y, s.r, s.r * (1 + s.v * 20));
    });
    g.globalAlpha = 1;

    g.fillStyle = '#d84df2';
    g.shadowColor = '#d84df2';
    g.shadowBlur = 10;
    bullets.forEach(b => g.fillRect(b.x - 1.5, b.y - 9, 3, 12));
    g.shadowBlur = 0;

    g.fillStyle = '#f19aae';
    enemyShots.forEach(s => {
      g.beginPath();
      g.arc(s.x, s.y, 3, 0, Math.PI * 2);
      g.fill();
    });

    enemies.forEach(e => drawEnemy(e, now));

    if (lives > 0 && (invuln === 0 || Math.floor(now / 120) % 2 === 0)) drawShip(player.x, player.y);

    g.globalCompositeOperation = 'lighter';
    sparks.forEach(p => {
      g.globalAlpha = p.life;
      g.fillStyle = p.c;
      g.fillRect(p.x, p.y, 2.4, 2.4);
    });
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';

    if (bannerT > 0 && mode === 'playing') {
      g.globalAlpha = Math.min(1, bannerT / 400);
      g.fillStyle = '#ece6f5';
      g.textAlign = 'center';
      g.font = `400 ${Math.min(56, GW * 0.09)}px Anton, sans-serif`;
      g.fillText(`OLEADA ${wave}`, GW / 2, GH / 2);
      g.globalAlpha = 1;
    }
  }

  function loop(now) {
    if (mode !== 'playing') return;
    const dt = lastFrame ? Math.min(now - lastFrame, 40) : 16;
    lastFrame = now;
    update(dt);
    draw(now);
    requestAnimationFrame(loop);
  }

  function showOverlay(titleText, text, primaryText, action) {
    overlayTitle.textContent = titleText;
    overlayText.textContent = text;
    overlayPrimary.textContent = primaryText;
    overlayPrimary.dataset.game = action;
    overlay.hidden = false;
    overlayPrimary.focus({ preventScroll: true });
  }

  function startGame() {
    gameStage.hidden = false;
    gameSection.classList.add('is-gaming');
    document.body.classList.add('is-gaming');
    setGameUi(true);
    overlay.hidden = true;
    sfx.startMusic(); // inside the click on "Jugar", so the browser allows sound
    requestAnimationFrame(() => {
      resetGame();
      mode = 'playing';
      lastFrame = 0;
      requestAnimationFrame(loop);
      gc.focus?.();
    });
  }

  function pauseGame() {
    if (mode !== 'playing') return;
    mode = 'paused';
    sfx.stopMusic();
    pauseBtn.textContent = '▶';
    pauseBtn.setAttribute('aria-label', 'Continuar');
    showOverlay('Pausa', 'Tu galaxia te espera.', 'Continuar', 'resume');
  }

  function resumeGame() {
    if (mode !== 'paused') return;
    overlay.hidden = true;
    mode = 'playing';
    sfx.startMusic();
    pauseBtn.textContent = '❚❚';
    pauseBtn.setAttribute('aria-label', 'Pausar');
    lastFrame = 0;
    requestAnimationFrame(loop);
  }

  function gameOver() {
    mode = 'over';
    sfx.stopMusic();
    sfx.over();
    if (score > best) { best = score; saveBest(); }
    updateHud();
    draw(performance.now());
    showOverlay('Fin de la misión', `Puntos: ${score} · Récord: ${best}`, 'Jugar de nuevo', 'restart');
  }

  function exitGame() {
    mode = 'off';
    sfx.stopMusic();
    gameStage.hidden = true;
    overlay.hidden = true;
    gameSection.classList.remove('is-gaming');
    document.body.classList.remove('is-gaming');
    if (prefersReducedMotion) toIdle();
    else reform();
  }

  gameStage.addEventListener('click', e => {
    const action = e.target.closest('[data-game]')?.dataset.game;
    if (action === 'pause') (mode === 'paused' ? resumeGame : pauseGame)();
    if (action === 'resume') resumeGame();
    if (action === 'restart') { overlay.hidden = true; resetGame(); mode = 'playing'; sfx.startMusic(); lastFrame = 0; requestAnimationFrame(loop); }
    if (action === 'mute') {
      const m = sfx.toggle();
      muteBtn.textContent = m ? '🔇' : '🔊';
      muteBtn.setAttribute('aria-label', m ? 'Activar sonido' : 'Silenciar');
    }
    if (action === 'exit') exitGame();
  });

  gc.addEventListener('pointermove', e => {
    const r = gc.getBoundingClientRect();
    targetX = e.clientX - r.left;
  });
  gc.addEventListener('pointerdown', e => {
    const r = gc.getBoundingClientRect();
    targetX = e.clientX - r.left;
  });

  window.addEventListener('keydown', e => {
    if (mode === 'off') return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { keys.left = true; e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { keys.right = true; e.preventDefault(); }
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      if (mode === 'playing') pauseGame();
      else if (mode === 'paused') resumeGame();
    }
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
  });

  // pause on its own when you scroll away or switch tabs
  new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) pauseGame();
  }, { threshold: 0.3 }).observe(gameStage);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

  window.addEventListener('resize', () => {
    if (mode !== 'off') {
      resizeGame();
      makeStars();
      if (mode !== 'playing') draw(performance.now());
    } else if (dustState === 'gone' && !invite.hidden) {
      buildDust();
    }
  });
}

// Starfield canvas
const canvas = document.getElementById('stars');
const ctx = canvas.getContext('2d');
let stars = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function createStars() {
  const count = Math.floor((canvas.width * canvas.height) / 8000);
  stars = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    radius: Math.random() * 1.2 + 0.3,
    baseAlpha: Math.random() * 0.5 + 0.3,
    phase: Math.random() * Math.PI * 2,
  }));
}

function drawStars(time = 0) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ece6f5';
  stars.forEach(star => {
    const twinkle = prefersReducedMotion ? star.baseAlpha : star.baseAlpha + Math.sin(time / 1000 + star.phase) * 0.3;
    ctx.globalAlpha = Math.max(0, Math.min(1, twinkle));
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  if (!prefersReducedMotion) {
    requestAnimationFrame(drawStars);
  }
}

window.addEventListener('resize', () => {
  resizeCanvas();
  createStars();
});

resizeCanvas();
createStars();
drawStars();
