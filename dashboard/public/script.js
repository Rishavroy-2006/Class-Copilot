/* =========================================
   CLASS COPILOT — Landing Page Scripts
   3D Scene, Animations, Interactions
   ========================================= */

// ===== THREE.JS 3D BACKGROUND SCENE =====
(function initThreeScene() {
  // Skip on mobile — 600 particles are invisible behind content anyway
  if (window.matchMedia('(max-width: 900px)').matches) return;

  const canvas = document.getElementById('bg-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  camera.position.z = 30;

  // ---- Particle System (floating WhatsApp-green particles) ----
  const particleCount = 600;
  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);

  const waGreen = new THREE.Color(0x25D366);
  const waTeal = new THREE.Color(0x128C7E);
  const cyan = new THREE.Color(0x06B6D4);
  const purple = new THREE.Color(0x8B5CF6);
  const colorPalette = [waGreen, waTeal, cyan, purple];

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 80;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 80;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 80;

    const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    sizes[i] = Math.random() * 2 + 0.5;
  }

  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const particleMaterial = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);

  // ---- Floating Torus (3D WhatsApp ring) ----
  const torusGeo = new THREE.TorusGeometry(8, 0.3, 16, 100);
  const torusMat = new THREE.MeshBasicMaterial({
    color: 0x25D366,
    wireframe: true,
    transparent: true,
    opacity: 0.08,
  });
  const torus = new THREE.Mesh(torusGeo, torusMat);
  torus.position.set(15, -5, -15);
  scene.add(torus);

  // ---- Second Torus ----
  const torus2Geo = new THREE.TorusGeometry(6, 0.2, 16, 80);
  const torus2Mat = new THREE.MeshBasicMaterial({
    color: 0x8B5CF6,
    wireframe: true,
    transparent: true,
    opacity: 0.05,
  });
  const torus2 = new THREE.Mesh(torus2Geo, torus2Mat);
  torus2.position.set(-18, 8, -20);
  scene.add(torus2);

  // ---- Icosahedron (geometric accent) ----
  const icoGeo = new THREE.IcosahedronGeometry(5, 1);
  const icoMat = new THREE.MeshBasicMaterial({
    color: 0x06B6D4,
    wireframe: true,
    transparent: true,
    opacity: 0.06,
  });
  const ico = new THREE.Mesh(icoGeo, icoMat);
  ico.position.set(-12, -10, -10);
  scene.add(ico);

  // ---- Connecting Lines (network effect) ----
  const lineCount = 30;
  const linePositions = [];
  for (let i = 0; i < lineCount; i++) {
    const x1 = (Math.random() - 0.5) * 60;
    const y1 = (Math.random() - 0.5) * 60;
    const z1 = (Math.random() - 0.5) * 40 - 10;
    const x2 = x1 + (Math.random() - 0.5) * 20;
    const y2 = y1 + (Math.random() - 0.5) * 20;
    const z2 = z1 + (Math.random() - 0.5) * 10;
    linePositions.push(x1, y1, z1, x2, y2, z2);
  }

  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x25D366,
    transparent: true,
    opacity: 0.04,
  });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  scene.add(lines);

  // Mouse interaction
  let mouseX = 0, mouseY = 0;
  let targetMouseX = 0, targetMouseY = 0;

  document.addEventListener('mousemove', (e) => {
    targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // Scroll-Y tracker — throttled with RAF + ticking for performance
  let scrollY = 0;
  let scrollTicking = false;
  window.addEventListener('scroll', () => {
    if (!scrollTicking) {
      scrollTicking = true;
      requestAnimationFrame(() => {
        scrollY = window.pageYOffset;
        scrollTicking = false;
      });
    }
  }, { passive: true });

  // Animation loop
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    // Smooth mouse following
    mouseX += (targetMouseX - mouseX) * 0.05;
    mouseY += (targetMouseY - mouseY) * 0.05;

    // Rotate particles
    particles.rotation.x = elapsed * 0.02 + mouseY * 0.1;
    particles.rotation.y = elapsed * 0.03 + mouseX * 0.1;

    // Animate particle positions subtly
    const posArray = particleGeometry.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
      posArray[i * 3 + 1] += Math.sin(elapsed + i * 0.1) * 0.005;
    }
    particleGeometry.attributes.position.needsUpdate = true;

    // Rotate geometric shapes
    torus.rotation.x = elapsed * 0.15;
    torus.rotation.y = elapsed * 0.1;
    torus.position.y = -5 + Math.sin(elapsed * 0.5) * 2;

    torus2.rotation.x = elapsed * 0.12;
    torus2.rotation.z = elapsed * 0.08;
    torus2.position.y = 8 + Math.cos(elapsed * 0.4) * 3;

    ico.rotation.x = elapsed * 0.1;
    ico.rotation.y = elapsed * 0.15;
    ico.position.y = -10 + Math.sin(elapsed * 0.6) * 2;

    lines.rotation.y = elapsed * 0.01;

    // Camera parallax on scroll
    camera.position.y = -(scrollY * 0.005);
    camera.lookAt(0, -(scrollY * 0.003), 0);

    renderer.render(scene, camera);
  }

  animate();

  // Handle resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();


// ===== CURSOR GLOW EFFECT =====
(function initCursorGlow() {
  // Skip cursor glow on small screens
  if (window.matchMedia('(max-width: 900px)').matches) return;

  const glow = document.getElementById('cursor-glow');
  if (!glow) return;

  let curX = 0, curY = 0;
  let targetX = 0, targetY = 0;

  document.addEventListener('mousemove', (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
  });

  function updateGlow() {
    curX += (targetX - curX) * 0.08;
    curY += (targetY - curY) * 0.08;
    glow.style.transform = `translate(${curX - 250}px, ${curY - 250}px)`;
    requestAnimationFrame(updateGlow);
  }

  updateGlow();
})();


// ===== NAVBAR SCROLL EFFECT =====
(function initNavbar() {
  const navbar = document.getElementById('navbar');
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');

  if (!navbar) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // Mobile toggle with accessibility
  if (toggle && links) {
    function openMenu() {
      links.classList.add('active');
      toggle.classList.add('active');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden'; // lock scroll
    }

    function closeMenu() {
      links.classList.remove('active');
      toggle.classList.remove('active');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = ''; // restore scroll
    }

    toggle.addEventListener('click', () => {
      const isOpen = links.classList.contains('active');
      isOpen ? closeMenu() : openMenu();
    });

    // Close on nav-link click
    links.querySelectorAll('.nav-link, .nav-cta-drawer').forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && links.classList.contains('active')) {
        closeMenu();
        toggle.focus();
      }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (links.classList.contains('active') && !links.contains(e.target) && !toggle.contains(e.target)) {
        closeMenu();
      }
    });
  }
})();


// ===== ACTIVE NAV SECTION HIGHLIGHTING =====
(function initActiveSectionNav() {
  const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
  if (!navLinks.length) return;

  const sections = Array.from(navLinks)
    .map(link => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          navLinks.forEach(link => link.classList.remove('section-active'));
          const activeLink = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
          if (activeLink) activeLink.classList.add('section-active');
        }
      });
    },
    { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
  );

  sections.forEach(section => sectionObserver.observe(section));
})();


// ===== SCROLL REVEAL ANIMATIONS =====
(function initScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          // Stagger animations
          setTimeout(() => {
            entry.target.classList.add('visible');
          }, index * 80);
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    }
  );

  document.querySelectorAll('.animate-on-scroll').forEach((el) => {
    observer.observe(el);
  });
})();


// ===== ANIMATED STAT COUNTERS =====
(function initCounters() {
  const counters = document.querySelectorAll('.stat-number');
  if (!counters.length) return;

  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach((counter) => {
    // Skip non-numeric stats (e.g. "Free" label)
    if (counter.classList.contains('stat-free')) return;
    counterObserver.observe(counter);
  });

  function animateCounter(el) {
    const target = parseFloat(el.dataset.target);
    const duration = 2000;
    const startTime = performance.now();
    const isFloat = target % 1 !== 0;

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * target;

      el.textContent = isFloat ? current.toFixed(1) : Math.floor(current);

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = isFloat ? target.toFixed(1) : target;
      }
    }

    requestAnimationFrame(update);
  }
})();


// ===== FEATURE CARD GLOW FOLLOW =====
(function initCardGlow() {
  document.querySelectorAll('.feature-card').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--mouse-x', `${x}%`);
      card.style.setProperty('--mouse-y', `${y}%`);
    });
  });
})();


// ===== COPY CODE BUTTON =====
(function initCopyButton() {
  const copyBtn = document.getElementById('copy-btn');
  if (!copyBtn) return;

  copyBtn.addEventListener('click', () => {
    const code = copyBtn.previousElementSibling?.textContent;
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        copyBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 9l3 3 7-7" stroke="#25D366" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        setTimeout(() => {
          copyBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="6" y="6" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M12 6V4a2 2 0 00-2-2H4a2 2 0 00-2 2v6a2 2 0 002 2h2" stroke="currentColor" stroke-width="1.5"/></svg>';
        }, 2000);
      });
    }
  });
})();


// ===== SMOOTH SCROLL =====
// Handled natively by CSS scroll-behavior + scroll-padding-top on html.
// No JS needed — removing the old handler eliminates crashes on href="#" links.



// ===== PARALLAX TILT ON FEATURE CARDS =====
(function initTiltCards() {
  if (window.matchMedia('(max-width: 900px)').matches) return;

  document.querySelectorAll('.feature-card, .step-card').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;

      card.style.transform = `perspective(800px) rotateX(${-y * 4}deg) rotateY(${x * 4}deg) translateY(-4px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) translateY(0)';
      card.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
    });

    card.addEventListener('mouseenter', () => {
      card.style.transition = 'transform 0.1s';
    });
  });
})();


// ===== CHAT ANIMATION LOOP =====
(function initChatLoop() {
  const chat = document.getElementById('wa-chat');
  if (!chat) return;

  const msgs = chat.querySelectorAll('.wa-msg-anim');

  // Reset and replay chat animation every 10 seconds
  function replayChat() {
    msgs.forEach((msg) => {
      msg.style.animation = 'none';
      msg.offsetHeight; // trigger reflow
      msg.style.animation = '';
    });
  }

  setInterval(replayChat, 10000);
})();


// Preloader removed — setting opacity to 0 after the page is
// already rendered causes a visible flicker. CSS handles initial
// body visibility natively.

