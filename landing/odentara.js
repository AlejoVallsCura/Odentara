(function () {
  /* ═══════════════════════════════════════════════════════════════
     LENIS  — smooth scroll
     GSAP   — hero entrance + ScrollTrigger reveals
     Fallback: si las libs no cargan, todo visible igualmente
  ═══════════════════════════════════════════════════════════════ */

  const hasGsap   = typeof gsap          !== "undefined";
  const hasST     = typeof ScrollTrigger !== "undefined";
  const hasLenis  = typeof Lenis         !== "undefined";

  // header disponible para todos los paths
  const header = document.querySelector("[data-site-header]");

  // Fallback inmediato: si GSAP no está, mostrar todos los reveals
  if (!hasGsap) {
    document.querySelectorAll(".reveal").forEach(el => el.classList.add("in"));
  }

  if (!hasGsap || !hasST || !hasLenis) {
    // Sin libs: continuar con funcionalidad básica (nav, preview, form)
    initCore();
    return;
  }

  // ── Registrar plugins ──────────────────────────────────────────
  gsap.registerPlugin(ScrollTrigger);

  // ── Lenis ──────────────────────────────────────────────────────
  const lenis = new Lenis({
    duration: 1.15,
    easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 0.9,
    touchMultiplier: 1.4,
  });

  // Conectar Lenis → GSAP RAF + ScrollTrigger
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(time => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  ScrollTrigger.defaults({ scroller: window });

  // Deshabilitar scroll-behavior CSS nativo (Lenis lo maneja)
  document.documentElement.style.scrollBehavior = "auto";

  // Recalcular ScrollTrigger una vez que todo está renderizado
  window.addEventListener("load", () => ScrollTrigger.refresh());

  // Anchor links → Lenis scrollTo (evita conflicto CSS smooth vs Lenis)
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", e => {
      const id = anchor.getAttribute("href");
      if (id === "#") return;
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        lenis.scrollTo(target, { duration: 1.2, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
      }
    });
  });

  // ── Header: transparent over hero, frosted glass on scroll ─────
  ScrollTrigger.create({
    trigger: ".hero",
    start: "top top",
    end: "bottom top",
    onLeave:   () => { header.classList.remove("is-hero"); header.classList.add("is-scrolled"); },
    onEnterBack: () => { header.classList.add("is-hero"); header.classList.remove("is-scrolled"); },
  });

  // ── Hero entrance timeline ─────────────────────────────────────
  const heroContent = document.querySelector(".hero__content");
  if (heroContent) {
    const eyebrow  = heroContent.querySelector(".eyebrow");
    const h1       = heroContent.querySelector("h1");
    const lead     = heroContent.querySelector(".hero__lead");
    const actions  = heroContent.querySelector(".hero__actions");
    const proof    = heroContent.querySelectorAll(".hero__proof span");
    const preview  = document.querySelector(".product-preview");

    gsap.set([eyebrow, h1, lead, actions, ...proof], { opacity: 0, y: 36 });
    if (preview) gsap.set(preview, { opacity: 0, x: 48 });

    const heroTL = gsap.timeline({ delay: 0.15 });
    heroTL
      .to(eyebrow,   { opacity: 1, y: 0, duration: 0.65, ease: "power3.out" })
      .to(h1,        { opacity: 1, y: 0, duration: 0.8,  ease: "power3.out" }, "-=0.4")
      .to(lead,      { opacity: 1, y: 0, duration: 0.7,  ease: "power3.out" }, "-=0.5")
      .to(actions,   { opacity: 1, y: 0, duration: 0.6,  ease: "power3.out" }, "-=0.4")
      .to(proof,     { opacity: 1, y: 0, stagger: 0.09, duration: 0.5, ease: "power2.out" }, "-=0.35")
      .to(preview,   { opacity: 1, x: 0, duration: 1.0,  ease: "power3.out" }, "-=0.75");
  }

  // ── Orb ambient animation ──────────────────────────────────────
  gsap.to(".hero__orb--1", {
    scale: 1.18, opacity: 0.75,
    duration: 7, repeat: -1, yoyo: true, ease: "sine.inOut",
  });
  gsap.to(".hero__orb--2", {
    scale: 1.12, opacity: 0.6, x: 20,
    duration: 9, repeat: -1, yoyo: true, ease: "sine.inOut",
  });
  gsap.to(".hero__orb--3", {
    scale: 1.2, opacity: 0.5, y: -15,
    duration: 11, repeat: -1, yoyo: true, ease: "sine.inOut",
  });

  // ── Trust band stagger ──────────────────────────────────────────
  gsap.from(".trust-item", {
    opacity: 0, y: 30, stagger: 0.12, duration: 0.7, ease: "power3.out",
    scrollTrigger: {
      trigger: ".trust-band",
      start: "top 88%",
      once: true,
    },
  });

  // ── Generic .reveal — excluir los que tienen stagger propio ────
  const staggerParents = ".workflow, .module-grid, .pricing-grid, .ai-feature-grid";
  document.querySelectorAll(".reveal").forEach(el => {
    if (el.closest(staggerParents)) return; // tiene stagger dedicado, no duplicar
    gsap.fromTo(el,
      { opacity: 0, y: 40 },
      {
        opacity: 1, y: 0, duration: 0.85, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      }
    );
  });

  // ── Module cards stagger ───────────────────────────────────────
  const moduleGrid = document.querySelector(".module-grid");
  if (moduleGrid) {
    gsap.set(".module-card", { opacity: 0, y: 48 });
    gsap.to(".module-card", {
      opacity: 1, y: 0, stagger: 0.1, duration: 0.75, ease: "power3.out",
      scrollTrigger: { trigger: moduleGrid, start: "top 82%", once: true },
    });
  }

  // ── Pricing cards stagger ──────────────────────────────────────
  const pricingGrid = document.querySelector(".pricing-grid");
  if (pricingGrid) {
    gsap.set(".price-card", { opacity: 0, y: 48 });
    gsap.to(".price-card", {
      opacity: 1, y: 0, stagger: 0.1, duration: 0.75, ease: "power3.out",
      scrollTrigger: { trigger: pricingGrid, start: "top 84%", once: true },
    });
  }

  // ── Workflow cards stagger ─────────────────────────────────────
  const workflow = document.querySelector(".workflow");
  if (workflow) {
    gsap.set(".workflow article", { opacity: 0, y: 38 });
    gsap.to(".workflow article", {
      opacity: 1, y: 0, stagger: 0.1, duration: 0.7, ease: "power3.out",
      scrollTrigger: { trigger: workflow, start: "top 84%", once: true },
    });
  }

  // ── Outcome list items stagger ─────────────────────────────────
  const outcomeList = document.querySelector(".outcome-list");
  if (outcomeList) {
    gsap.from(".outcome-list span", {
      opacity: 0, x: -24, stagger: 0.13, duration: 0.65, ease: "power3.out",
      scrollTrigger: { trigger: outcomeList, start: "top 84%", once: true },
    });
  }

  // ── AI feature grid ─────────────────────────────────────────────
  const aiGrid = document.querySelector(".ai-feature-grid");
  if (aiGrid) {
    gsap.set(".ai-feature-grid article", { opacity: 0, y: 30 });
    gsap.to(".ai-feature-grid article", {
      opacity: 1, y: 0, stagger: 0.1, duration: 0.65, ease: "power3.out",
      scrollTrigger: { trigger: aiGrid, start: "top 84%", once: true },
    });
  }

  // ── Chat bubble sequential reveal ──────────────────────────────
  const chatPreview = document.querySelector(".chat-preview");
  if (chatPreview) {
    gsap.from(".chat-bubble", {
      opacity: 0, y: 14, stagger: 0.22, duration: 0.55, ease: "power2.out",
      scrollTrigger: { trigger: chatPreview, start: "top 80%", once: true },
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     CORE FUNCTIONALITY (nav, preview switcher, contact form)
  ═══════════════════════════════════════════════════════════════ */
  initCore();

  function initCore() {
  const navToggle    = document.querySelector("[data-nav-toggle]");
  const contactForm  = document.querySelector("[data-contact-form]");
  const formNote     = document.querySelector("[data-form-note]");
  const previewPanel = document.querySelector("[data-preview-panel]");
  const previewTitle = document.querySelector("[data-preview-title]");
  const previewButtons = document.querySelectorAll("[data-preview-view]");

  // ── Mobile nav ─────────────────────────────────────────────────
  navToggle?.addEventListener("click", () => {
    const isOpen = header.classList.toggle("is-open");
    document.body.classList.toggle("nav-open", isOpen);
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navToggle.innerHTML = isOpen
      ? '<i class="fa-solid fa-xmark"></i>'
      : '<i class="fa-solid fa-bars"></i>';
    // Pausar Lenis cuando nav mobile está abierto (overflow:hidden bloquea scroll)
    if (typeof lenis !== "undefined") { isOpen ? lenis.stop() : lenis.start(); }
  });

  document.querySelectorAll(".site-nav a, .header-actions a").forEach(link => {
    link.addEventListener("click", () => {
      header?.classList.remove("is-open");
      document.body.classList.remove("nav-open");
      navToggle?.setAttribute("aria-expanded", "false");
      if (navToggle) navToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
      // Reanudar Lenis al cerrar nav
      if (typeof lenis !== "undefined") lenis.start();
    });
  });

  // ── Product preview views ──────────────────────────────────────
  const previewTitles = {
    dashboard:    "Dashboard",
    appointments: "Agenda de turnos",
    patients:     "Pacientes",
    records:      "Historias clinicas",
    billing:      "Caja y facturacion",
    settings:     "Configuracion",
  };

  const previewViews = {
    dashboard: `
      <div class="app-preview-hero">
        <div>
          <span>Dashboard</span>
          <strong>Resumen del consultorio</strong>
          <p>Turnos del dia, pacientes activos y actividad reciente.</p>
        </div>
        <button type="button"><i class="fa-solid fa-calendar-day" aria-hidden="true"></i> Hoy</button>
      </div>
      <div class="app-metrics-grid">
        <article><i class="fa-solid fa-users" aria-hidden="true"></i><div><span>Pacientes activos</span><strong>186</strong></div></article>
        <article><i class="fa-solid fa-calendar-check" aria-hidden="true"></i><div><span>Turnos de hoy</span><strong>12</strong></div></article>
        <article><i class="fa-solid fa-bolt" aria-hidden="true"></i><div><span>Sobreturnos</span><strong>1</strong></div></article>
      </div>
      <div class="app-table-card">
        <div class="app-table-head"><strong>Proximos turnos</strong><span>Estado</span></div>
        <table>
          <tbody>
            <tr><td><b>09:00</b><small>45m</small></td><td>Sofia Martinez</td><td><span class="app-badge success">Confirmado</span></td></tr>
            <tr><td><b>10:30</b><small>60m</small></td><td>Juan Perez</td><td><span class="app-badge info">En sala</span></td></tr>
            <tr><td><b>12:00</b><small>30m</small></td><td>Carla Nunez</td><td><span class="app-badge warning">Pendiente</span></td></tr>
          </tbody>
        </table>
      </div>
    `,
    appointments: `
      <div class="app-preview-toolbar">
        <div class="app-toolbar-nav">
          <button type="button" aria-label="Dia anterior"><i class="fa-solid fa-chevron-left"></i></button>
          <strong>lunes, 27 de abril de 2026</strong>
          <button type="button" aria-label="Dia siguiente"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
        <div class="app-view-switcher"><span class="is-active">Hoy</span><span>Semana</span><span>Mes</span></div>
      </div>
      <div class="app-prof-legend">
        <strong>Profesionales</strong>
        <span class="is-active">Dr. Alvarez</span>
        <span>Dra. Molina</span>
      </div>
      <div class="app-calendar-day">
        <div class="app-calendar-gutter"><span>08:00</span><span>09:00</span><span>10:00</span><span>11:00</span><span>12:00</span><span>13:00</span></div>
        <div class="app-calendar-column">
          <div class="app-prof-header">Dr. Alvarez</div>
          <div class="app-cal-line"></div><div class="app-cal-line"></div><div class="app-cal-line"></div><div class="app-cal-line"></div><div class="app-cal-line"></div><div class="app-cal-line"></div>
          <article class="app-cal-apt teal" style="top:34px;height:54px"><strong>Camila Rossi</strong><span>09:30 - 45min</span></article>
          <article class="app-cal-apt violet" style="top:128px;height:68px"><strong>Marcos Vega</strong><span>11:00 - 60min</span></article>
          <article class="app-cal-apt amber" style="top:232px;height:42px"><strong>Sobreturno</strong><span>13:15 - 15min</span></article>
        </div>
      </div>
    `,
    patients: `
      <div class="app-preview-hero inline">
        <div>
          <span>Pacientes</span>
          <strong>Registro de Pacientes</strong>
          <p>Visualiza, edita y administra los datos base de cada paciente.</p>
        </div>
        <button type="button"><i class="fa-solid fa-user-plus" aria-hidden="true"></i> Nuevo Paciente</button>
      </div>
      <div class="app-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><span>Buscar pacientes por nombre o DNI...</span></div>
      <div class="app-table-card">
        <table class="app-patient-table">
          <thead><tr><th>Paciente</th><th>Contacto</th><th>DNI</th><th>Acciones</th></tr></thead>
          <tbody>
            <tr><td><span class="app-avatar">SM</span><b>Sofia Martinez</b></td><td><small>+54 9 351 555-0182</small><small>sofia@mail.com</small></td><td>34.582.901</td><td><i class="fa-solid fa-file-medical"></i><i class="fa-solid fa-wallet"></i></td></tr>
            <tr><td><span class="app-avatar">JP</span><b>Juan Perez</b></td><td><small>+54 9 351 555-0133</small><small>Sin email</small></td><td>28.117.642</td><td><i class="fa-solid fa-file-medical"></i><i class="fa-solid fa-pen"></i></td></tr>
            <tr><td><span class="app-avatar">CN</span><b>Carla Nunez</b></td><td><small>+54 9 351 555-0441</small><small>carla@mail.com</small></td><td>41.900.317</td><td><i class="fa-solid fa-file-medical"></i><i class="fa-solid fa-wallet"></i></td></tr>
          </tbody>
        </table>
      </div>
    `,
    records: `
      <div class="app-clinical-card">
        <header>
          <img src="assets/odentara-logo.svg" alt="" />
          <div><strong>Circulo Odontologico</strong><span>Ficha Clinica Odontologica</span></div>
          <button type="button"><i class="fa-solid fa-print"></i> Imprimir</button>
        </header>
        <div class="app-clinical-info">
          <article><span>Paciente</span><strong>Sofia Martinez</strong></article>
          <article><span>Obra social</span><strong>OSDE 210</strong></article>
          <article><span>Ficha N</span><strong>000248</strong></article>
          <article><span>Telefono</span><strong>351 555-0182</strong></article>
        </div>
        <section class="app-odontogram">
          <div class="app-clinical-title">Odontograma inicial</div>
          <div class="app-teeth-row" aria-hidden="true">
            <span>18</span><span>17</span><span class="done">16</span><span>15</span><span class="alert">14</span><span>13</span><span>12</span><span>11</span>
          </div>
          <div class="app-teeth-row" aria-hidden="true">
            <span>48</span><span class="done">47</span><span>46</span><span>45</span><span>44</span><span class="alert">43</span><span>42</span><span>41</span>
          </div>
        </section>
        <div class="app-evolution">
          <article><time>27/04</time><strong>Control clinico</strong><span>Se registra evolucion y proximo tratamiento.</span></article>
          <article><time>12/04</time><strong>Imagen clinica</strong><span>Radiografia asociada a pieza 14.</span></article>
        </div>
      </div>
    `,
    billing: `
      <div class="app-preview-hero">
        <div>
          <span>Facturacion</span>
          <strong>Caja del consultorio</strong>
          <p>Cobros, pagos y movimientos registrados en el dia.</p>
        </div>
        <button type="button"><i class="fa-solid fa-plus" aria-hidden="true"></i> Nuevo cobro</button>
      </div>
      <div class="app-metrics-grid">
        <article><i class="fa-solid fa-circle-check" aria-hidden="true"></i><div><span>Cobrado hoy</span><strong>$48.500</strong></div></article>
        <article><i class="fa-solid fa-hourglass-half" aria-hidden="true"></i><div><span>Pendiente</span><strong>$12.200</strong></div></article>
        <article><i class="fa-solid fa-chart-simple" aria-hidden="true"></i><div><span>Este mes</span><strong>$342.000</strong></div></article>
      </div>
      <div class="app-table-card">
        <div class="app-table-head"><strong>Movimientos recientes</strong><span>Monto</span></div>
        <table>
          <tbody>
            <tr><td><b>10:30</b><small>Endodoncia</small></td><td>Sofia Martinez</td><td><span class="app-badge success">$18.500</span></td></tr>
            <tr><td><b>09:00</b><small>Limpieza</small></td><td>Juan Perez</td><td><span class="app-badge success">$8.200</span></td></tr>
            <tr><td><b>Ayer</b><small>Control</small></td><td>Carla Nunez</td><td><span class="app-badge warning">Pendiente</span></td></tr>
          </tbody>
        </table>
      </div>
    `,
    settings: `
      <div class="app-preview-hero">
        <div>
          <span>Configuracion</span>
          <strong>Panel de ajustes</strong>
          <p>Usuarios, roles, profesionales y datos del consultorio.</p>
        </div>
      </div>
      <div class="app-settings-grid">
        <article class="app-setting-item">
          <i class="fa-solid fa-building" aria-hidden="true"></i>
          <div><strong>Datos del consultorio</strong><span>Nombre, direccion y contacto</span></div>
          <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </article>
        <article class="app-setting-item">
          <i class="fa-solid fa-users" aria-hidden="true"></i>
          <div><strong>Usuarios y roles</strong><span>3 usuarios activos</span></div>
          <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </article>
        <article class="app-setting-item">
          <i class="fa-solid fa-user-doctor" aria-hidden="true"></i>
          <div><strong>Profesionales</strong><span>2 profesionales configurados</span></div>
          <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </article>
        <article class="app-setting-item">
          <i class="fa-solid fa-calendar-days" aria-hidden="true"></i>
          <div><strong>Horarios y agenda</strong><span>Dias, duraciones y slots</span></div>
          <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </article>
      </div>
    `,
  };

  function setPreviewView(viewName) {
    if (!previewPanel || !previewViews[viewName]) return;

    previewButtons.forEach(button => {
      const isActive = button.dataset.previewView === viewName;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    if (previewTitle) previewTitle.textContent = previewTitles[viewName];

    previewPanel.classList.remove("is-changing");
    previewPanel.innerHTML = previewViews[viewName];
    requestAnimationFrame(() => previewPanel.classList.add("is-changing"));
  }

  const viewOrder    = ["dashboard", "appointments", "patients", "records", "billing", "settings"];
  const AUTOPLAY_MS  = 3500;
  let currentViewIndex = 0;
  let autoplayTimer    = null;
  let userInteracted   = false;
  const fillEl         = document.getElementById("preview-autoplay-fill");

  function animateFill() {
    if (!fillEl) return;
    fillEl.style.transition = "none";
    fillEl.style.width = "0%";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fillEl.style.transition = `width ${AUTOPLAY_MS}ms linear`;
        fillEl.style.width = "100%";
      });
    });
  }
  function stopFill() {
    if (!fillEl) return;
    fillEl.style.transition = "none";
    fillEl.style.width = "0%";
  }
  function startAutoplay() {
    if (autoplayTimer) clearInterval(autoplayTimer);
    animateFill();
    autoplayTimer = setInterval(() => {
      if (userInteracted) return;
      currentViewIndex = (currentViewIndex + 1) % viewOrder.length;
      setPreviewView(viewOrder[currentViewIndex]);
      animateFill();
    }, AUTOPLAY_MS);
  }

  previewButtons.forEach(button => {
    button.addEventListener("click", () => {
      userInteracted = true;
      currentViewIndex = viewOrder.indexOf(button.dataset.previewView);
      setPreviewView(button.dataset.previewView);
      stopFill();
      if (autoplayTimer) clearInterval(autoplayTimer);
      autoplayTimer = setTimeout(() => {
        userInteracted = false;
        startAutoplay();
      }, 8000);
    });
  });

  setPreviewView("dashboard");
  startAutoplay();

  // ── Contact form ───────────────────────────────────────────────
  contactForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const formData = new FormData(contactForm);
    const payload  = Object.fromEntries(formData.entries());

    if (formNote) formNote.textContent = "Enviando solicitud...";
    contactForm.querySelector("button[type='submit']")?.setAttribute("disabled", "disabled");

    try {
      const response = await fetch(contactForm.action, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { Accept: "application/json", "Content-Type": "application/json" },
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.ok) throw new Error(result.error || "No se pudo enviar la solicitud.");

      contactForm.reset();
      if (formNote) {
        formNote.textContent = result.emailSent === false
          ? "Solicitud recibida. Te vamos a responder por email."
          : "Solicitud enviada. Te vamos a responder por email.";
      }
    } catch {
      const isLocalFile = window.location.protocol === "file:";
      if (formNote) {
        formNote.textContent = isLocalFile
          ? "Para probar el envio, abrila desde un servidor PHP o subila a Hostinger."
          : "No se pudo enviar. Escribinos a contacto@odentara.com.";
      }
    } finally {
      contactForm.querySelector("button[type='submit']")?.removeAttribute("disabled");
    }
  });
  } // end initCore

  /* ═══════════════════════════════════════════════════════════════
     TESTIMONIOS — Carrusel
  ═══════════════════════════════════════════════════════════════ */
  initCarousel();

  function initCarousel() {
    const wrap  = document.querySelector("[data-carousel]");
    if (!wrap) return;

    const track  = wrap.querySelector("[data-carousel-track]");
    const btnPrev = wrap.querySelector("[data-carousel-prev]");
    const btnNext = wrap.querySelector("[data-carousel-next]");
    const dotsWrap = wrap.querySelector("[data-carousel-dots]");
    const cards  = Array.from(track.children);

    let current  = 0;
    let autoTimer = null;

    // Cuántas cards visibles según viewport
    function visibleCount() {
      if (window.innerWidth <= 560) return 1;
      if (window.innerWidth <= 900) return 2;
      return 3;
    }

    function maxIndex() {
      return Math.max(0, cards.length - visibleCount());
    }

    // Construir dots (uno por "página")
    function buildDots() {
      dotsWrap.innerHTML = "";
      const pages = maxIndex() + 1;
      for (let i = 0; i < pages; i++) {
        const dot = document.createElement("button");
        dot.className = "tc-dot" + (i === current ? " is-active" : "");
        dot.setAttribute("aria-label", "Ir a página " + (i + 1));
        dot.addEventListener("click", () => goTo(i));
        dotsWrap.appendChild(dot);
      }
    }

    function updateDots() {
      dotsWrap.querySelectorAll(".tc-dot").forEach((d, i) => {
        d.classList.toggle("is-active", i === current);
      });
    }

    function goTo(index) {
      current = Math.max(0, Math.min(index, maxIndex()));
      const cardWidth = cards[0].getBoundingClientRect().width;
      const gap = 24;
      track.style.transform = `translateX(-${current * (cardWidth + gap)}px)`;
      updateDots();
      btnPrev.disabled = current === 0;
      btnNext.disabled = current >= maxIndex();
    }

    function next() { goTo(current >= maxIndex() ? 0 : current + 1); }
    function prev() { goTo(current <= 0 ? maxIndex() : current - 1); }

    // Auto-avance cada 4.5s
    function startAuto() {
      clearInterval(autoTimer);
      autoTimer = setInterval(next, 4500);
    }
    function stopAuto() { clearInterval(autoTimer); }

    btnNext.addEventListener("click", () => { next(); stopAuto(); startAuto(); });
    btnPrev.addEventListener("click", () => { prev(); stopAuto(); startAuto(); });
    wrap.addEventListener("mouseenter", stopAuto);
    wrap.addEventListener("mouseleave", startAuto);

    // Touch/swipe
    let touchStartX = 0;
    track.addEventListener("touchstart", e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener("touchend", e => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) { diff > 0 ? next() : prev(); }
    }, { passive: true });

    // Recalcular en resize
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { buildDots(); goTo(Math.min(current, maxIndex())); }, 150);
    });

    buildDots();
    goTo(0);
    startAuto();
  }

})();
