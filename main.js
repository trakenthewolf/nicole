// Toggle mobile nav
const navToggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('site-nav');
if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
  nav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      if (nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

// Dynamic year in footer
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Smooth scroll offset for sticky header (only for same-page anchors)
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const targetId = link.getAttribute('href');
    if (!targetId || targetId === '#') return;
    const el = document.querySelector(targetId);
    if (!el) return;
    e.preventDefault();
    const header = document.querySelector('.site-header');
    const offset = header ? header.getBoundingClientRect().height + 8 : 0;
    const top = el.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

// PDF import and auto-fill CV sections
const importBtn = document.getElementById('importar-pdf');
if (importBtn) {
  importBtn.addEventListener('click', async () => {
    try {
      // Ensure pdf.js is available
      const pdfjsLib = window['pdfjsLib'];
      if (!pdfjsLib) {
        alert('No se pudo cargar PDF.js. Revisa tu conexión o vuelve a intentarlo.');
        return;
      }
      // Worker for pdf.js
      if (pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.3.136/pdf.worker.min.js';
      }

      const url = 'nicole cv.pdf';
      const loadingTask = pdfjsLib.getDocument(url);
      const pdf = await loadingTask.promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map(it => it.str);
        fullText += strings.join(' ') + '\n';
      }

      // Dump raw text (para depurar o verificación)
      const dump = document.getElementById('cv-text-dump');
      if (dump) dump.textContent = fullText.trim();

      // Heurísticas simples para extraer datos
      autoFillFromText(fullText);
      alert('Se importó el texto del PDF y se intentó completar tu CV. Revisa y ajusta si es necesario.');
    } catch (err) {
      console.error(err);
      alert('Ocurrió un error al leer el PDF.');
    }
  });
}

function autoFillFromText(text) {
  if (!text) return;
  // Normalizar saltos de línea y espacios múltiples
  const raw = text.replace(/\u00A0/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const lower = raw.toLowerCase();

  // Email
  const emailMatch = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (emailMatch) {
    const email = emailMatch[0];
    const emailEl = document.getElementById('perfil-email');
    if (emailEl) {
      emailEl.textContent = email;
      emailEl.href = `mailto:${email}`;
    }
    // También actualizar CTA contacto
    const emailBtn = document.querySelector('#contacto a.btn[href^="mailto:"]');
    if (emailBtn) emailBtn.setAttribute('href', `mailto:${email}`);
  }

  // LinkedIn
  const linkedinMatch = raw.match(/https?:\/\/(?:www\.)?linkedin\.com\/[\w\-\/#?=.,]+/i);
  if (linkedinMatch) {
    const link = linkedinMatch[0];
    const linkEl = document.getElementById('perfil-linkedin');
    if (linkEl) {
      linkEl.textContent = 'LinkedIn';
      linkEl.href = link;
    }
    // También botón social
    const socialLink = document.querySelector('#contacto .social a:nth-child(2)');
    if (socialLink) socialLink.setAttribute('href', link);
  }

  // Ubicación (heurística: busca patrones comunes de ciudades o palabras clave)
  const locMatch = raw.match(/\b(Ciudad de|San|Santa|Buenos Aires|CABA|Bogotá|Lima|Santiago|Ciudad de México|CDMX|Monterrey|Guadalajara|Quito|La Paz|Asunción|Montevideo|Madrid|Barcelona|Valencia|Sevilla|Bilbao|Málaga)\b[^\n.,;]*/i);
  if (locMatch) {
    const locEl = document.getElementById('perfil-ubicacion');
    if (locEl) locEl.textContent = locMatch[0].trim();
  }

  // Resumen / Perfil: buscar sección encabezada como Perfil, Resumen, Sobre mí, Objetivo
  const summary = extractSection(raw, ['perfil', 'resumen', 'sobre mi', 'sobre mí', 'objetivo'], ['experiencia', 'historial', 'trayectoria', 'educación', 'formación', 'skills', 'habilidades']);
  if (summary) {
    const sEl = document.getElementById('perfil-summary');
    if (sEl) sEl.textContent = truncate(summary, 420);
  }

  // Experiencia
  const experiencia = extractSection(raw, ['experiencia', 'experiencia laboral', 'historial laboral', 'trayectoria'], ['educación', 'formación', 'skills', 'habilidades', 'idiomas']);
  if (experiencia) fillTimeline('experiencia-list', experiencia);

  // Educación
  const educacion = extractSection(raw, ['educación', 'formación', 'educacion'], ['experiencia', 'skills', 'habilidades', 'idiomas']);
  if (educacion) fillTimeline('educacion-list', educacion);

  // Habilidades / Skills
  const skills = extractSection(raw, ['habilidades', 'skills', 'competencias'], ['experiencia', 'educación', 'formación', 'idiomas']);
  if (skills) fillTags('habilidades-list', skills);
}

function extractSection(text, startKeywords, stopKeywords) {
  const lower = text.toLowerCase();
  let startIdx = -1;
  for (const key of startKeywords) {
    const idx = lower.indexOf(key.toLowerCase());
    if (idx !== -1 && (startIdx === -1 || idx < startIdx)) startIdx = idx;
  }
  if (startIdx === -1) return '';
  let endIdx = text.length;
  for (const key of stopKeywords) {
    const idx = lower.indexOf(key.toLowerCase(), startIdx + 1);
    if (idx !== -1 && idx < endIdx) endIdx = idx;
  }
  return text.slice(startIdx, endIdx).replace(/^\s*\S+\s*:/i, '').trim();
}

function fillTimeline(targetId, sectionText) {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.innerHTML = '';
  // Separar en entradas usando puntos, viñetas, o saltos de línea significativos
  const lines = sectionText
    .split(/\n|•|\u2022|\-|\u25CF/g)
    .map(s => s.trim())
    .filter(s => s.length > 6);

  const items = lines.slice(0, 8); // limitar para evitar exceso
  for (const line of items) {
    const art = document.createElement('article');
    art.className = 'timeline-item';
    const header = document.createElement('header');
    const h3 = document.createElement('h3');
    h3.textContent = line.length > 120 ? truncate(line, 120) : line;
    const meta = document.createElement('span');
    meta.className = 'meta';
    // Heurística para fechas (ej: 2020 - 2023, Ene 2021 – Dic 2022)
    const dateMatch = sectionText.match(/(19|20)\d{2}[^\d]{0,3}(?:a|\-|–|al|hasta)?[^\d]{0,3}(19|20)\d{2}/i);
    if (dateMatch) meta.textContent = dateMatch[0];
    header.appendChild(h3);
    if (meta.textContent) header.appendChild(meta);
    art.appendChild(header);
    el.appendChild(art);
  }
}

function fillTags(targetId, sectionText) {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.innerHTML = '';
  const candidates = sectionText
    .replace(/\n/g, ',')
    .split(/[;,•\u2022]/)
    .map(s => s.trim())
    .filter(s => s && s.length <= 40);
  const unique = Array.from(new Set(candidates)).slice(0, 24);
  for (const tag of unique) {
    const li = document.createElement('li');
    li.className = 'tag';
    li.textContent = tag;
    el.appendChild(li);
  }
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

// Corrección: Pantalla de bienvenida, botón "¿Quién soy?" y efecto flores
window.addEventListener('DOMContentLoaded', () => {
  const welcomeScreen = document.getElementById('welcome-screen');
  const mainPage = document.getElementById('main-page');
  const btnWho = document.getElementById('btn-who');
  const quienSoySection = document.getElementById('quien-soy');

  // Animación de flores al hacer clic en "¿Quién soy?"
  function getFlowerSVG() {
    return `<svg width="64" height="64" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="10" fill="#4ade80"/>
      <ellipse cx="24" cy="10" rx="6" ry="10" fill="#bbf7d0"/>
      <ellipse cx="24" cy="38" rx="6" ry="10" fill="#bbf7d0"/>
      <ellipse cx="10" cy="24" rx="10" ry="6" fill="#bbf7d0"/>
      <ellipse cx="38" cy="24" rx="10" ry="6" fill="#bbf7d0"/>
    </svg>`;
  }

  if (btnWho) {
    btnWho.addEventListener('click', () => {
      // Animación de flores distribuidas por toda la pantalla
      const numFlowers = 24;
      for (let i = 0; i < numFlowers; i++) {
        setTimeout(() => {
          const flower = document.createElement('div');
          flower.className = 'flower';
          const vw = Math.random() * window.innerWidth;
          const vh = Math.random() * window.innerHeight;
          flower.style.left = `${vw - 32}px`;
          flower.style.top = `${vh - 32}px`;
          flower.innerHTML = getFlowerSVG();
          document.body.appendChild(flower);
          setTimeout(() => flower.remove(), 1400);
        }, i * 40);
      }
      // Transición a la página principal y sección "¿Quién soy?"
      setTimeout(() => {
        if (welcomeScreen) welcomeScreen.style.display = 'none';
        if (mainPage) mainPage.style.display = 'block';
        if (quienSoySection) {
            quienSoySection.classList.add('visible');
            quienSoySection.scrollIntoView({ behavior: 'smooth' });
        }
        // Activar el scroll reveal después de la transición
        revealOnScroll();
      }, 1100);
    });
  }
  
  // Hobbies: Mostrar/ocultar modal hobbies y logros: añadir/quitar clase modal-open al body
  function toggleModal(open) {
    if (open) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
  }
  // Hobbies
  const hobbiesGrid = document.querySelector('.hobbies-grid');
  const hobbieDetail = document.querySelector('.hobbie-detail');
  const hobbieCloseBtn = hobbieDetail ? hobbieDetail.querySelector('.close-modal') : null;
  if (hobbiesGrid && hobbieDetail) {
    hobbiesGrid.addEventListener('click', function(e) {
      const card = e.target.closest('.hobbie-card');
      if (card) {
        const hobbie = card.dataset.hobbie;
        const img = card.querySelector('img').src;
        const title = card.querySelector('.hobbie-title').textContent;
        const text = card.querySelector('.hobbie-text').textContent;
        hobbieDetail.querySelector('.hobbie-detail-img').src = img;
        hobbieDetail.querySelector('.hobbie-detail-title').textContent = title;
        hobbieDetail.querySelector('.hobbie-detail-text').textContent = text;
        hobbieDetail.classList.add('visible');
        toggleModal(true);
      }
    });
    hobbieDetail.addEventListener('click', function(e) {
      if (e.target === hobbieDetail) {
        hobbieDetail.classList.remove('visible');
        toggleModal(false);
      }
    });
    if (hobbieCloseBtn) {
      hobbieCloseBtn.addEventListener('click', function() {
        hobbieDetail.classList.remove('visible');
        toggleModal(false);
      });
    }
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && hobbieDetail.classList.contains('visible')) {
        hobbieDetail.classList.remove('visible');
        toggleModal(false);
      }
    });
  }
  // Logros
  const logrosGrid = document.querySelector('.logros-grid');
  const logroDetail = document.querySelector('.logro-detail');
  const logroCloseBtn = logroDetail ? logroDetail.querySelector('.close-modal') : null;
  if (logrosGrid && logroDetail) {
    logrosGrid.addEventListener('click', function(e) {
      const card = e.target.closest('.logro-card');
      if (card) {
        const title = card.querySelector('.logro-title').textContent;
        const text = card.querySelector('.logro-text').textContent;
        logroDetail.querySelector('.logro-detail-title').textContent = title;
        logroDetail.querySelector('.logro-detail-text').textContent = text;
        logroDetail.classList.add('visible');
        toggleModal(true);
      }
    });
    logroDetail.addEventListener('click', function(e) {
      if (e.target === logroDetail) {
        logroDetail.classList.remove('visible');
        toggleModal(false);
      }
    });
    if (logroCloseBtn) {
      logroCloseBtn.addEventListener('click', function() {
        logroDetail.classList.remove('visible');
        toggleModal(false);
      });
    }
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && logroDetail.classList.contains('visible')) {
        logroDetail.classList.remove('visible');
        toggleModal(false);
      }
    });
  }
  
  // Animación reveal al hacer scroll
  // Efectos de entrada y salida al hacer scroll
  const revealItems = document.querySelectorAll('.reveal-item');
  
  function handleScroll() {
    const triggerHeight = window.innerHeight * 0.85;
    revealItems.forEach(item => {
      const top = item.getBoundingClientRect().top;
      if (top < triggerHeight) {
        item.classList.add('visible');
      } else {
        item.classList.remove('visible');
      }
    });
  }
  
  window.addEventListener('scroll', handleScroll);
  
  // Llamada inicial para elementos visibles al cargar la página
  handleScroll();
});

// Lógica para animar elementos 3D en "Mis hobbies"
const hobbies3D = document.querySelectorAll('.hobby-item');
let currentAngle = 0;

function rotateHobbies() {
  currentAngle += 120;
  hobbies3D.forEach((item, index) => {
    const angle = currentAngle + index * 120;
    item.style.transform = `rotateY(${angle}deg)`;
  });
}

const hobbiesSection = document.getElementById('hobbies');
if (hobbiesSection) {
  hobbiesSection.addEventListener('click', rotateHobbies);
}

// Mostrar/ocultar botón de WhatsApp mientras se hace scroll (eliminado porque ahora está en la nav-bar)
(function manageWhatsAppVisibility(){
  const waBtn = document.querySelector('.whatsapp-float');
  if (!waBtn) return; // nada que hacer si no existe
  // Si existiera, lo forzamos a oculto para evitar parpadeos
  waBtn.classList.add('is-hidden');
})();
let lastY = window.pageYOffset;
let ticking = false;

function onScroll(){
  const currentY = window.pageYOffset;
  // Oculta cuando el usuario baja, muestra cuando sube o está cerca del fondo
  const nearBottom = (window.innerHeight + currentY) >= (document.body.offsetHeight - 80);
  if (currentY > lastY && !nearBottom) {
    waBtn.classList.add('is-hidden');
  } else {
    waBtn.classList.remove('is-hidden');
  }
  lastY = currentY;
  ticking = false;
}

window.addEventListener('scroll', () => {
  if (!ticking){
    window.requestAnimationFrame(onScroll);
    ticking = true;
  }
}, { passive: true });
