// Тема: переключатель в шапке, выбор запоминается.
// Анимация как в Animated Theme Toggler (magicui.design): View Transitions API,
// новая тема «раскрывается» кругом из центра кнопки (400 мс).
(() => {
  const root = document.documentElement;
  const btn = document.querySelector('.theme-switch');
  if (!btn) return;
  const DURATION = 400;
  let busy = false;

  const apply = () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    document.dispatchEvent(new CustomEvent('themechange'));
  };

  btn.addEventListener('click', () => {
    if (busy) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof document.startViewTransition !== 'function' || reduce) { apply(); return; }

    const r = btn.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const maxR = Math.hypot(Math.max(x, w - x), Math.max(y, h - y));

    busy = true;
    root.classList.add('vt-theme');
    // если вкладка скрыта и браузер не отдаёт кадры, колбэк перехода может не вызваться — применяем тему в любом случае
    let applied = false;
    const applyOnce = () => { if (!applied) { applied = true; apply(); } };
    const vt = document.startViewTransition(applyOnce);
    const done = () => { applyOnce(); root.classList.remove('vt-theme'); busy = false; };
    setTimeout(done, DURATION + 1100);
    vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${maxR}px at ${x}px ${y}px)`] },
        { duration: DURATION, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(done);
    vt.finished.then(done, done);
  });
})();

// Текст «Привет!…»: слова по очереди заливаются цветом текста темы (из тусклого в полный).
(() => {
  const el = document.querySelector('[data-fill]');
  if (!el) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let n = 0;
  const wrap = node => {
    [...node.childNodes].forEach(c => {
      if (c.nodeType === 3) {
        const frag = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(part); return; }
          const s = document.createElement('span');
          s.className = 'fill-word';
          s.style.setProperty('--i', n++);
          s.textContent = part;
          frag.append(s);
        });
        c.replaceWith(frag);
      } else if (c.nodeType === 1 && c.tagName !== 'BR') {
        wrap(c);
      }
    });
  };
  wrap(el);
  el.style.setProperty('--n', n);
  el.classList.add('fill-ready');
  if (reduce || !('IntersectionObserver' in window)) { el.classList.add('fill-on'); return; }
  // запускается каждый раз, когда блок появляется в кадре; сбрасывается, когда полностью ушёл из него
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.intersectionRatio >= 0.3) {
        requestAnimationFrame(() => el.classList.add('fill-on'));
      } else if (e.intersectionRatio === 0 && el.classList.contains('fill-on')) {
        el.classList.add('fill-reset');
        el.classList.remove('fill-on');
        void el.offsetWidth;
        el.classList.remove('fill-reset');
      }
    });
  }, { threshold: [0, 0.3] });
  io.observe(el);
})();

// Мокапы: появляются, когда попадают в экран (и сбрасываются, когда уходят).
(() => {
  const els = document.querySelectorAll('[data-play]');
  if (!('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('play'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => e.target.classList.toggle('play', e.isIntersecting));
  }, { threshold: 0.6 });
  els.forEach(el => io.observe(el));
})();

// Ховер карточек проектов: 3D-наклон за курсором + пружинное увеличение
// (повторяет эффект «Sharing the Craft» с johnyvino.com).
(() => {
  if (!window.matchMedia) return;
  if (!matchMedia('(hover: hover)').matches) return;
  if (matchMedia('(max-width: 734px)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const cards = document.querySelectorAll('.card');
  if (!cards.length) return;

  const config = { maxTilt: 14, perspective: 800, ease: 0.22, restThreshold: 0.01, hoverScale: 1.035, springStiffness: 0.14, springDamping: 0.72 };

  cards.forEach(card => {
    const { maxTilt, perspective, ease } = config;
    let rafId = null;
    let targetRx = 0, targetRy = 0, currentRx = 0, currentRy = 0;
    let targetScale = 1, currentScale = 1, scaleVel = 0;
    let active = false, pendingEvent = null, cachedRect = null;

    const applyTransform = () => {
      card.style.transform = `perspective(${perspective}px) rotateX(${currentRx.toFixed(3)}deg) rotateY(${currentRy.toFixed(3)}deg) scale(${currentScale.toFixed(4)})`;
    };

    const consumePointer = () => {
      if (!pendingEvent) return;
      if (!cachedRect) cachedRect = card.getBoundingClientRect();
      const relX = (pendingEvent.clientX - cachedRect.left) / cachedRect.width;
      const relY = (pendingEvent.clientY - cachedRect.top) / cachedRect.height;
      targetRy = (relX - 0.5) * maxTilt * 2;
      targetRx = -(relY - 0.5) * maxTilt * 2;
      pendingEvent = null;
    };

    const animate = () => {
      consumePointer();
      const dx = targetRx - currentRx;
      const dy = targetRy - currentRy;
      currentRx += dx * ease;
      currentRy += dy * ease;
      scaleVel += (targetScale - currentScale) * config.springStiffness;
      scaleVel *= config.springDamping;
      currentScale += scaleVel;
      applyTransform();

      const rotSettled = Math.abs(dx) < config.restThreshold && Math.abs(dy) < config.restThreshold;
      const scaleSettled = Math.abs(targetScale - currentScale) < 0.0005 && Math.abs(scaleVel) < 0.0005;
      if (!rotSettled || !scaleSettled || active) {
        rafId = requestAnimationFrame(animate);
      } else {
        rafId = null;
        currentScale = 1; scaleVel = 0;
        card.style.transform = '';
        cachedRect = null;
      }
    };
    const schedule = () => { if (rafId === null) rafId = requestAnimationFrame(animate); };

    card.addEventListener('mouseenter', () => {
      active = true;
      targetScale = config.hoverScale;
      cachedRect = card.getBoundingClientRect();
      card.classList.add('is-tilting');
      schedule();
    });
    card.addEventListener('mousemove', e => { pendingEvent = e; schedule(); }, { passive: true });
    card.addEventListener('mouseleave', () => {
      active = false;
      targetRx = 0; targetRy = 0; targetScale = 1; pendingEvent = null;
      card.classList.remove('is-tilting');
      schedule();
    });
  });
})();
// Карусель фото: горизонтальный скролл только внутри блока (колесо с shift / тач / перетаскивание мышью).
(() => {
  const el = document.querySelector('[data-carousel]');
  if (!el) return;
  let down = false, startX = 0, startLeft = 0, moved = false;
  el.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') return;
    down = true; moved = false; startX = e.clientX; startLeft = el.scrollLeft;
  });
  window.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 3) { moved = true; el.classList.add('is-drag'); }
    if (moved) el.scrollLeft = startLeft - dx;
  });
  window.addEventListener('pointerup', () => { down = false; el.classList.remove('is-drag'); });
  // горизонтальный жест трекпада двигает только карусель, вертикальный скролл страницы не трогаем
  el.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); el.scrollLeft += e.deltaX; }
  }, { passive: false });
})();

// Видео в мокапах: запускаются сами, на паузе вне экрана, при возврате играют снова (даже если браузер отложил autoplay).
(() => {
  const vids = document.querySelectorAll('.phone__screen video');
  if (!vids.length) return;
  vids.forEach(v => { v.muted = true; v.defaultMuted = true; });
  if (!('IntersectionObserver' in window)) { vids.forEach(v => v.play().catch(() => {})); return; }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause();
  }), { threshold: 0.2 });
  vids.forEach(v => io.observe(v));
})();

// Лайтбокс: тап/клик по картинке проекта открывает её крупнее поверх контента с затемнением фона.
// Отдельно обрабатываем касание (touch), т.к. мобильный Safari не всегда шлёт click по тапу на картинку.
(() => {
  const imgs = document.querySelectorAll('.pv2 .fig img');
  if (!imgs.length) return;
  const lb = document.createElement('div');
  lb.className = 'lb';
  lb.innerHTML = '<button class="lb__close" type="button" aria-label="Закрыть">\u00d7</button><img alt="">';
  document.body.appendChild(lb);
  const lbImg = lb.querySelector('img');
  const open = src => { if (!src) return; lbImg.src = src; lb.classList.add('is-open'); document.body.style.overflow = 'hidden'; };
  const close = () => {
    lb.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { if (!lb.classList.contains('is-open')) lbImg.removeAttribute('src'); }, 250);
  };
  imgs.forEach(img => {
    let sx = 0, sy = 0, moved = false;
    img.addEventListener('touchstart', e => { const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; moved = false; }, { passive: true });
    img.addEventListener('touchmove', e => { const t = e.changedTouches[0]; if (Math.abs(t.clientX - sx) > 10 || Math.abs(t.clientY - sy) > 10) moved = true; }, { passive: true });
    img.addEventListener('touchend', e => { if (!moved) { e.preventDefault(); open(img.currentSrc || img.src); } }, { passive: false });
    img.addEventListener('click', () => open(img.currentSrc || img.src));
  });
  // закрытие: тап/клик в любом месте оверлея
  lb.addEventListener('click', close);
  lb.addEventListener('touchend', e => { e.preventDefault(); close(); }, { passive: false });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && lb.classList.contains('is-open')) close(); });
})();

// Контакты: копирование Telegram/почты в буфер по клику или тапу на иконку копирования.
(() => {
  const btns = document.querySelectorAll('.ccard__copy');
  if (!btns.length) return;
  const CHECK = '<svg class="ccard__copyicon" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M8 16.5l5.5 5.5L24 11.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const copy = text => {
    let ok = false;
    // запасной способ: synchronously в момент жеста — работает в большинстве браузеров
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.left = '-1000px'; ta.style.width = '1px'; ta.style.height = '1px';
      document.body.appendChild(ta); ta.focus(); ta.select();
      try { ta.setSelectionRange(0, text.length); } catch (e) {}
      ok = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) {}
    // основной способ на https: современный Clipboard API
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        ok = true;
        navigator.clipboard.writeText(text).catch(function () {});
      }
    } catch (e) {}
    return ok;
  };
  btns.forEach(btn => {
    const orig = btn.innerHTML;
    const name = btn.getAttribute('data-name') || 'Скопировано';
    let timer = null;
    btn.addEventListener('click', () => {
      if (!copy(btn.getAttribute('data-copy'))) return;
      btn.classList.add('is-copied');
      btn.innerHTML = CHECK;
      btn.setAttribute('aria-label', name + ' скопирован');
      clearTimeout(timer);
      timer = setTimeout(() => { btn.classList.remove('is-copied'); btn.innerHTML = orig; btn.setAttribute('aria-label', 'Скопировать ' + name.toLowerCase()); }, 1400);
    });
  });
})();
