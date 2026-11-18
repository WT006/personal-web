import { createSurface } from './album-surface.js';

// Project horizontal image strips onto a curved surface near the top of the viewport.
// Below the bend, the projection is flat and matches the ordinary cover image.
function paintCover(item, top, viewport) {
  const { image, canvas, context } = item;
  if (!context || !image.naturalWidth) return;
  const { width, height } = image.getBoundingClientRect();
  if (!width || !height || top > viewport || top + height < 0) return;

  const bendLine = Math.min(viewport * 0.33, height * 0.72);
  if (top >= bendLine) {
    item.cover.classList.remove('painted');
    return;
  }
  const density = Math.min(devicePixelRatio || 1, 1.5);
  const w = Math.round(width * density);
  const h = Math.round(height * density);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  context.setTransform(w / width, 0, 0, h / height, 0, 0);
  context.clearRect(0, 0, width, height);
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceX = (image.naturalWidth - width / scale) / 2;
  const sourceY = (image.naturalHeight - height / scale) / 2;
  const radius = Math.max(height * 0.62, 120);
  function project(y) {
    const distance = Math.max(0, bendLine - top - y);
    const angle = Math.min(distance / radius, 1.38);
    const beyond = distance - radius * angle;
    const depth = radius * (1 - Math.cos(angle)) + beyond * Math.sin(angle);
    const visibleLength = radius * Math.sin(angle) + beyond * Math.cos(angle);
    const perspective = 1 / (1 + depth / (width * 0.85));
    return { y: y + distance - visibleLength, width: width * perspective, shade: 1 - Math.cos(angle) };
  }
  const count = 80;
  const edges = Array.from({ length: count + 1 }, (_, i) => project(height * i / count));
  // Clip the overlapping bands to one continuous antialiased outline.
  context.save();
  context.beginPath();
  edges.forEach((edge, i) => {
    const x = (width - edge.width) / 2;
    if (i === 0) context.moveTo(x, edge.y);
    else context.lineTo(x, edge.y);
  });
  for (let i = count; i >= 0; i--) {
    context.lineTo((width + edges[i].width) / 2, edges[i].y);
  }
  context.closePath();
  context.clip();
  let upper = edges[0];
  for (let i = 0; i < count; i++) {
    const y = height * i / count;
    const lower = edges[i + 1];
    const stripWidth = Math.max(upper.width, lower.width);
    const x = (width - stripWidth) / 2;
    const stripHeight = lower.y - upper.y + 0.65 / density;
    context.drawImage(image, sourceX, sourceY + y / scale, width / scale, height / count / scale,
      x, upper.y, stripWidth, stripHeight);
    if (upper.shade > 0) {
      context.fillStyle = 'rgba(38,44,37,' + (upper.shade * 0.28) + ')';
      context.fillRect(x, upper.y, stripWidth, stripHeight);
    }
    upper = lower;
  }
  context.restore();
  item.cover.classList.add('painted');
}

export function mountAlbumRoll(roll) {
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(any-hover: hover) and (any-pointer: fine)');
  const items = Array.from(roll.querySelectorAll('.album-cover'), (cover, index) => {
    const canvas = cover.querySelector('canvas');
    const image = cover.querySelector('img');
    const item = {
      cover, image, canvas, context: null, phase: index * 1.47,
      x: .5, y: .5, targetX: .5, targetY: .5, hover: 0, active: false
    };
    const card = cover.closest('a');
    function point(event) {
      if (event.pointerType === 'touch' || !finePointer.matches || event.buttons) return;
      const rect = cover.getBoundingClientRect();
      item.targetX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      item.targetY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      item.active = true;
    }
    card.addEventListener('pointerenter', point, options);
    card.addEventListener('pointermove', point, options);
    card.addEventListener('pointerup', point, options);
    card.addEventListener('pointerleave', () => { item.active = false; }, options);
    image.addEventListener('load', schedule, options);
    return item;
  });
  let frame = 0;
  let lastTime = 0;
  let clock = 0;
  let eased = window.scrollY;
  let surface;
  let inView = true;
  function fallback() {
    surface?.dispose();
    surface = null;
    for (const item of items) item.cover.classList.remove('on-surface');
    schedule();
  }
  function draw(time) {
    frame = 0;
    const elapsed = Math.min(time - lastTime, 64);
    lastTime = time;
    if (motion.matches || document.hidden || !inView) {
      eased = window.scrollY;
      roll.style.transform = '';
      return;
    }
    if (surface === undefined) surface = createSurface(roll, fallback);
    clock += elapsed / 1000;
    const actual = window.scrollY;
    eased += (actual - eased) * (1 - Math.exp(-elapsed / 75));
    const lag = actual - eased;
    const driftX = 2.8 * Math.sin(clock * .53) + 1.2 * Math.sin(clock * .86);
    const driftY = 1.9 * Math.sin(clock * .67);
    roll.style.transform = 'translate3d(' + driftX + 'px,' + (lag + driftY) + 'px,0)';
    const bounds = roll.getBoundingClientRect();
    const top = Math.max(bounds.top, 0);
    const height = Math.min(innerHeight, bounds.bottom) - top;
    if (height > 0 && bounds.width > 0) {
      surface?.begin(bounds, top - bounds.top, height, clock);
      const ease = 1 - Math.exp(-elapsed / 100);
      for (const item of items) {
        const rect = item.cover.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > innerHeight || !rect.height) continue;
        item.hover += ((item.active ? 1 : 0) - item.hover) * ease;
        item.x += (item.targetX - item.x) * ease;
        item.y += (item.targetY - item.y) * ease;
        if (surface?.paint(item, rect, bounds.left, top)) {
          item.cover.classList.add('on-surface');
        } else {
          item.context ??= item.canvas.getContext('2d');
          if (Math.abs(lag) > .25 || !item.lastRect || rect.width !== item.lastRect.width ||
              rect.height !== item.lastRect.height || item.lastScroll !== actual) {
            paintCover(item, rect.top, innerHeight);
            if (item.image.naturalWidth) {
              item.lastRect = rect;
              item.lastScroll = actual;
            }
          }
        }
      }
    }
    schedule();
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(draw);
  }
  const visibility = new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    schedule();
  });
  visibility.observe(roll);
  window.addEventListener('scroll', schedule, { ...options, passive: true });
  document.addEventListener('visibilitychange', schedule, options);
  motion.addEventListener('change', schedule, options);
  const sizeObserver = new ResizeObserver(schedule);
  sizeObserver.observe(roll);
  window.addEventListener('resize', schedule, options);
  schedule();

  // Touch and wheel use native page scrolling. A mouse can also pull the film.
  let drag;
  let ignoreClick = false;
  roll.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    ignoreClick = false;
    drag = { id: event.pointerId, start: event.clientY, scroll: window.scrollY };
  }, options);
  window.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const delta = drag.start - event.clientY;
    if (!ignoreClick && Math.abs(delta) < 6) return;
    if (!ignoreClick) {
      roll.setPointerCapture(event.pointerId);
      roll.classList.add('dragging');
      items.forEach(item => { item.active = false; });
      ignoreClick = true;
    }
    window.scrollTo({ top: drag.scroll + delta, behavior: 'instant' });
  }, options);
  function release() {
    drag = undefined;
    roll.classList.remove('dragging');
  }
  window.addEventListener('pointerup', release, options);
  window.addEventListener('pointercancel', release, options);
  window.addEventListener('blur', release, options);
  roll.addEventListener('click', event => {
    if (ignoreClick && event.detail) event.preventDefault();
    ignoreClick = false;
  }, options);
  return () => {
    controller.abort();
    visibility.disconnect();
    surface?.dispose();
    sizeObserver.disconnect();
    cancelAnimationFrame(frame);
  };
}
