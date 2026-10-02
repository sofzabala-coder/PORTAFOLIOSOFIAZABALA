const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
