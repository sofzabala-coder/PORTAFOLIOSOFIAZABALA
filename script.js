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

// Scroll-driven 3D cubes (hold on each face, then flip to the next)
const cubeScroll = document.querySelector('.cube-scroll');

if (cubeScroll) {
  const cubeSection = cubeScroll.closest('.cube-section');
  const cubes = [...cubeSection.querySelectorAll('.cube')];
  let cubeTicking = false;

  if (prefersReducedMotion) {
    cubeSection.classList.add('cube-section--flat');
  }

  function updateCubes() {
    const rect = cubeScroll.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    const progress = total > 0 ? Math.max(0, Math.min(1, -rect.top / total)) : 0;

    const segment = progress * 3;
    const step = Math.min(2, Math.floor(segment));
    const t = Math.max(0, Math.min(1, (segment - step - 0.25) / 0.5));
    const angle = (step + t * t * (3 - 2 * t)) * 90;

    cubeSection.style.setProperty('--angle', `${angle}deg`);

    if (prefersReducedMotion) {
      const active = Math.round(angle / 90);
      cubes.forEach(cube => {
        [...cube.children].forEach((face, i) => face.classList.toggle('is-active', i === active));
      });
    }
    cubeTicking = false;
  }

  function onCubeScroll() {
    if (!cubeTicking) {
      requestAnimationFrame(updateCubes);
      cubeTicking = true;
    }
  }

  window.addEventListener('scroll', onCubeScroll, { passive: true });
  window.addEventListener('resize', onCubeScroll);
  updateCubes();
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

// Projects coverflow wheel
const wheel = document.querySelector('.wheel');

if (wheel) {
  const track = wheel.querySelector('.wheel-track');
  const originals = [...track.children];

  while (track.children.length < 8) {
    originals.forEach(slide => {
      const clone = slide.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });
  }

  const slides = [...track.children];
  const n = slides.length;
  const prevD = new Array(n).fill(null);
  const stepAngle = 11;
  let index = 0;
  let dragStart = null;
  let moved = false;

  const wrapOffset = (i, pos) => ((i - pos + n / 2) % n + n) % n - n / 2;

  function layout(pos, animate) {
    const w = slides[0].offsetWidth;
    const radius = w * 6.3;

    slides.forEach((slide, i) => {
      const d = wrapOffset(i, pos);
      const abs = Math.abs(d);
      const jumped = prevD[i] === null || Math.abs(d - prevD[i]) > n / 2;
      prevD[i] = d;

      const rad = d * stepAngle * Math.PI / 180;
      const x = radius * Math.sin(rad);
      const y = radius * (1 - Math.cos(rad)) * 0.5;
      const scale = 1 - Math.min(abs, 2.5) * 0.04;

      slide.style.transition = animate && !jumped ? '' : 'none';
      slide.style.transform = `translate(${x}px, ${y}px) rotate(${d * stepAngle}deg) scale(${scale})`;
      slide.style.opacity = abs <= 2 ? 1 : Math.max(0, 1 - (abs - 2) * 2);
      slide.style.zIndex = String(10 - Math.round(abs));
      slide.style.pointerEvents = abs > 2.5 ? 'none' : '';
      slide.classList.toggle('is-active', abs < 0.5);
    });
  }

  function goTo(newIndex) {
    index = newIndex;
    layout(index, true);
  }

  wheel.addEventListener('pointerdown', e => {
    dragStart = { x: e.clientX, pos: index };
    moved = false;
  });

  wheel.addEventListener('pointermove', e => {
    if (!dragStart) return;
    const dx = e.clientX - dragStart.x;
    if (!moved && Math.abs(dx) > 6) {
      moved = true;
      wheel.classList.add('is-dragging');
      wheel.setPointerCapture(e.pointerId);
    }
    if (moved) {
      const stepPx = slides[0].offsetWidth * 1.2;
      layout(dragStart.pos - dx / stepPx, false);
    }
  });

  function endDrag(e) {
    if (!dragStart) return;
    const dx = e.clientX - dragStart.x;
    const stepPx = slides[0].offsetWidth * 1.2;
    const target = Math.round(dragStart.pos - dx / stepPx);
    dragStart = null;
    wheel.classList.remove('is-dragging');
    if (moved) goTo(target);
  }

  wheel.addEventListener('pointerup', endDrag);
  wheel.addEventListener('pointercancel', endDrag);

  track.addEventListener('click', e => {
    if (moved) { moved = false; return; }
    const slide = e.target.closest('.slide');
    if (!slide) return;
    const offset = Math.round(wrapOffset(slides.indexOf(slide), index));
    if (offset !== 0) goTo(index + offset);
  });

  wheel.parentElement.querySelector('.wheel-prev').addEventListener('click', () => goTo(index - 1));
  wheel.parentElement.querySelector('.wheel-next').addEventListener('click', () => goTo(index + 1));

  wheel.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') goTo(index - 1);
    if (e.key === 'ArrowRight') goTo(index + 1);
  });

  window.addEventListener('resize', () => layout(index, false));
  layout(index, false);
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
