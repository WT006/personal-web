import { createSurface } from './album-surface.js';
import { openAlbum } from './album-transition.js';
import { spot, falloff, lightAt } from './room-light.js';
import { sound } from './projector-sound.js';

// All distances here are in CSS pixels. The sheet spans both columns and the gaps.
// A cylinder with a tangent continuation keeps rows ordered as they turn away.
function galleryProjection(width, screenTop, clock, cameraX, cameraY, scrollLag) {
  const radius = Math.max(105, Math.min(innerHeight * .20, 185));
  const bendLine = radius * 1.28 + Math.tanh(scrollLag / 100) * 12;
  const limit = 1.12;
  const camera = Math.max(500, width * .88);
  const horizonTilt = .052 * Math.sin(clock * .46) + .036 * cameraX;
  return (x, y) => {
    const cross = x - width / 2;
    const wave = Math.sin(x / width * 3.8 - y * .0035 - clock * .85);
    const boundary = bendLine + cross * horizonTilt + 9 * wave;
    const distance = Math.max(0, boundary - (y + screenTop));
    const angle = Math.min(limit, distance / radius);
    const tail = Math.max(0, distance - radius * limit);
    const depth = radius * (1 - Math.cos(angle)) + tail * Math.sin(angle);
    const projected = radius * Math.sin(angle) + tail * Math.cos(angle);
    const scale = camera / (camera + depth);
    const tilt = .009 * Math.sin(clock * .53) + cameraX * .010;
    return {
      x: width / 2 + cross * scale + (4.5 * wave + cameraX * 5) * scale,
      y: y + distance - projected + (wave * 4 + tilt * cross + cameraY * 3) * scale,
      light: 1 - .14 * (1 - Math.cos(angle)) + .016 * wave
    };
  };
}

// Map the native link surface and its selectable caption onto the same four
// projected corners as the mesh. Browser hit testing follows this transform.
function placeElement(element, rect, project) {
  const { x, y, width: w, height: h } = rect;
  if (!w || !h) return;
  const a = project(x, y), b = project(x + w, y);
  const c = project(x + w, y + h), d = project(x, y + h);
  const dx1 = b.x - c.x, dx2 = d.x - c.x;
  const dy1 = b.y - c.y, dy2 = d.y - c.y;
  const sx = a.x - b.x + c.x - d.x, sy = a.y - b.y + c.y - d.y;
  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < .001) return;
  const g = (sx * dy2 - dx2 * sy) / det, k = (dx1 * sy - sx * dy1) / det;
  const matrix = [
    (b.x - a.x + g * (b.x - x)) / w, (b.y - a.y + g * (b.y - y)) / w, 0, g / w,
    (d.x - a.x + k * (d.x - x)) / h, (d.y - a.y + k * (d.y - y)) / h, 0, k / h,
    0, 0, 1, 0, a.x - x, a.y - y, 0, 1
  ];
  element.style.transform = 'matrix3d(' + matrix.join(',') + ')';
}

export function mountAlbumRoll(roll) {
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const items = Array.from(roll.querySelectorAll('.album-card'), card => {
    const cover = card.querySelector('.album-cover');
    const notes = card.querySelector('.album-notes');
    const image = cover.querySelector('img');
    const item = { card, cover, notes, image, x: .5, y: .5, targetX: .5, targetY: .5, hover: 0, active: false };
    function point(event) {
      if (event.pointerType === 'touch' || event.buttons) return;
      const rect = cover.getBoundingClientRect();
      item.targetX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      item.targetY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      item.active = true;
    }
    card.addEventListener('pointerenter', point, options);
    card.addEventListener('pointermove', point, options);
    card.addEventListener('pointerleave', () => { item.active = false; }, options);
    image.addEventListener('load', schedule, options);
    return item;
  });
  let frame = 0, lastTime = 0, clock = 0;
  let cameraX = 0, cameraY = 0, targetX = 0, targetY = 0;
  let eased = window.scrollY;
  let surface;
  let inView = true;
  let dirty = true;

  // The spotlight on the wall. It follows a mouse with a little inertia; with
  // no mouse (or when the pointer leaves the window) it rests above the heading
  // and drifts slowly.
  const lamp = document.createElement('div');
  lamp.className = 'gallery-light';
  lamp.setAttribute('aria-hidden', 'true');
  document.body.append(lamp);
  const head = roll.parentElement?.querySelector('.album-index-head');
  let pointer = null;
  const rest = t => ({ x: innerWidth * (.5 + .07 * Math.sin(t * .23)), y: innerHeight * (.2 + .04 * Math.sin(t * .31 + 1)) });
  function placeLamp() {
    spot.r = Math.max(260, Math.min(520, Math.hypot(innerWidth, innerHeight) * .27));
    const size = spot.r * 4;
    if (lamp.size !== size) { lamp.style.width = lamp.style.height = size + 'px'; lamp.size = size; }
    lamp.style.transform = `translate3d(${(spot.x - size / 2).toFixed(1)}px,${(spot.y - size / 2).toFixed(1)}px,0)`;
  }
  Object.assign(spot, rest(0));
  placeLamp();
  function moveLamp(elapsed) {
    const goal = pointer || rest(clock);
    const follow = 1 - Math.exp(-elapsed / (pointer ? 150 : 900));
    spot.x += (goal.x - spot.x) * follow;
    spot.y += (goal.y - spot.y) * follow;
    placeLamp();
    if (head) {
      // The heading sits a little nearer than the wall: it drifts against the
      // pointer and catches the light when the lamp passes behind it.
      const r = head.getBoundingClientRect();
      const lit = falloff(r.left + r.width / 2, r.top + r.height / 2);
      head.style.transform = `translate3d(${(-cameraX * 10).toFixed(2)}px,${(-cameraY * 6).toFixed(2)}px,0)`;
      head.style.setProperty('--head-light', (.74 + .26 * lit).toFixed(3));
    }
  }
  function measure() {
    for (const item of items) {
      const { card, cover, notes } = item;
      const x = card.offsetLeft, y = card.offsetTop, width = card.offsetWidth;
      item.photoRect = { x, y, width, height: cover.offsetHeight };
      item.textRect = { x, y: y + notes.offsetTop, width, height: notes.offsetHeight };
    }
    dirty = false;
  }
  function fallback() {
    surface?.dispose();
    surface = null;
    items.forEach(item => item.cover.classList.remove('on-surface'));
    schedule();
  }
  function draw(time) {
    frame = 0;
    const elapsed = Math.min(time - lastTime, 50);
    lastTime = time;
    if (motion.matches || document.hidden || !inView) {
      eased = window.scrollY;
      roll.style.transform = '';
      return;
    }
    if (dirty) measure();
    if (surface === undefined) surface = createSurface(roll, fallback);
    clock += elapsed / 1000;
    moveLamp(elapsed);
    const actual = window.scrollY;
    eased += (actual - eased) * (1 - Math.exp(-elapsed / 85));
    const lag = Math.max(-150, Math.min(150, actual - eased));
    roll.style.transform = 'translateY(' + lag + 'px)';
    const bounds = roll.getBoundingClientRect();
    const ease = 1 - Math.exp(-elapsed / 125);
    cameraX += (targetX - cameraX) * ease;
    cameraY += (targetY - cameraY) * ease;
    const project = galleryProjection(bounds.width, bounds.top, clock, cameraX, cameraY, lag);
    const gutter = 16;
    const top = Math.max(-gutter, -bounds.top);
    const bottom = Math.min(bounds.height + gutter, innerHeight - bounds.top);
    if (bottom > top && bounds.width > 0) {
      surface?.begin(bounds.width + gutter * 2, top, bottom - top, gutter, bounds.left, bounds.top);
      for (const item of items) {
        const photo = item.photoRect, notes = item.textRect;
        // Test projected bounds so a receding row survives until its last caption leaves.
        if (project(photo.x, notes.y + notes.height).y < top - 45 ||
            project(photo.x, photo.y).y > bottom + 45) {
          item.card.classList.add('outside-sheet');
          continue;
        }
        item.card.classList.remove('outside-sheet');
        placeElement(item.cover, photo, project);
        placeElement(item.notes, notes, project);
        // Light comes up fairly quickly and drains away slowly.
        const target = item.active ? 1 : 0;
        item.hover += (target - item.hover) * (1 - Math.exp(-elapsed / (target > item.hover ? 170 : 560)));
        shade(item, project, bounds);
        item.x += (item.targetX - item.x) * ease;
        item.y += (item.targetY - item.y) * ease;
        const painted = surface?.paint(item, photo, project, top, gutter);
        item.cover.classList.toggle('on-surface', !!painted);
      }
    }
    schedule();
  }
  // Every photo stands under the same fixed light: it casts a shadow away from
  // the source (longer the further it is), and its caption dims with it.
  function shade(item, project, bounds) {
    const photo = item.photoRect;
    const centre = project(photo.x + photo.width / 2, photo.y + photo.height / 2);
    const x = bounds.left + centre.x, y = bounds.top + centre.y;
    const near = falloff(x, y);
    // Cast shadow, thrown away from the lamp: long and soft when the light is
    // far, shorter, darker and crisper as it comes close.
    const dx = x - spot.x, dy = y - spot.y;
    const reach = Math.hypot(dx, dy) || 1;
    const length = 8 + 30 * Math.min(1, reach / (spot.r * 2.4));
    const sx = dx / reach * length, sy = dy / reach * length;
    const depth = .45 + .45 * near;
    const h = item.hover;
    const shadow = `${sx.toFixed(1)}px ${sy.toFixed(1)}px ${(52 - 18 * near).toFixed(0)}px -6px rgb(0 0 0 / ${depth.toFixed(3)}), ` +
      `${(sx * .15).toFixed(1)}px ${(sy * .15).toFixed(1)}px 6px rgb(0 0 0 / ${(.25 + .3 * near).toFixed(3)})` +
      (h > .01 ? `, 0 0 22px 1px rgb(226 234 255 / ${(.2 * h).toFixed(3)}), 0 0 70px 10px rgb(226 234 255 / ${(.08 * h).toFixed(3)})` : '');
    if (shadow !== item.shadow) item.cover.style.boxShadow = item.shadow = shadow;
    const lit = (lightAt(x, y) - .44) / .61;
    const caption = Math.min(1, .38 + .62 * lit + .35 * h).toFixed(2);
    if (caption !== item.caption) item.notes.style.opacity = item.caption = caption;
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(draw);
  }
  roll.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const bounds = roll.getBoundingClientRect();
    targetX = 2 * (event.clientX - bounds.left) / bounds.width - 1;
    targetY = 2 * event.clientY / innerHeight - 1;
  }, options);
  roll.addEventListener('pointerleave', () => { targetX = targetY = 0; }, options);
  window.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    pointer = { x: event.clientX, y: event.clientY };
    // The whole wall leans a touch toward the visitor, not only over the roll.
    targetX = 2 * event.clientX / innerWidth - 1;
    targetY = 2 * event.clientY / innerHeight - 1;
    schedule();
  }, { ...options, passive: true });
  document.addEventListener('mouseout', event => {
    if (!event.relatedTarget) { pointer = null; targetX = targetY = 0; }
  }, options);
  // Warm up audio while the visitor is still browsing, so opening an album
  // never waits on it.
  // (Creating it costs ~100ms, so do it while idle, not on the first gesture.)
  const primeAudio = setTimeout(() => (window.requestIdleCallback || (fn => fn()))(() => {
    if (!controller.signal.aborted) sound.prime();
  }), 700);
  controller.signal.addEventListener('abort', () => clearTimeout(primeAudio));
  const visibility = new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    schedule();
  });
  visibility.observe(roll);
  window.addEventListener('scroll', schedule, { ...options, passive: true });
  document.addEventListener('visibilitychange', schedule, options);
  motion.addEventListener('change', schedule, options);
  const sizeObserver = new ResizeObserver(() => { dirty = true; schedule(); });
  sizeObserver.observe(roll);
  for (const item of items) sizeObserver.observe(item.card);
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
    if (ignoreClick && event.detail) {
      event.preventDefault();
      ignoreClick = false;
      return;
    }
    ignoreClick = false;
    const card = event.target.closest('.album-card');
    if (!card || event.defaultPrevented || event.button || event.metaKey || event.ctrlKey ||
        event.shiftKey || event.altKey || motion.matches) return;
    const item = items.find(entry => entry.card === card);
    if (!item?.photoRect) return;
    event.preventDefault();
    const bounds = roll.getBoundingClientRect();
    const onWall = item.cover.classList.contains('on-surface');
    openAlbum({
      href: card.getAttribute('href'),
      image: item.image,
      rect: { left: bounds.left + item.photoRect.x, top: bounds.top + item.photoRect.y,
              width: item.photoRect.width, height: item.photoRect.height },
      transform: item.cover.style.transform,
      zoom: onWall ? 1 + .1 * item.hover : 1,
      focus: { x: .5 + (item.x - .5) * .32, y: .5 + (item.y - .5) * .32 }
    });
    card.classList.add('chosen');
  }, options);
  return () => {
    controller.abort();
    lamp.remove();
    if (head) head.style.transform = '';
    visibility.disconnect();
    surface?.dispose();
    sizeObserver.disconnect();
    cancelAnimationFrame(frame);
  };
}
