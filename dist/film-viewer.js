// Keep the projector gate fixed. Swap the photograph only while the shutter is dark.
export function mountFilmViewer(view, frames, { enlarge, onError }) {
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const gate = view.querySelector('.film-gate');
  const shutter = view.querySelector('.film-shutter');
  const image = gate.querySelector('img');
  const caption = view.querySelector('.film-caption');
  const counter = view.querySelector('.film-counter');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const cache = new Map();
  let current = 0, requested = 0, direction = 1;
  let busy = false, animation, start, swiped = false;

  function prepare(index) {
    if (!cache.has(index)) {
      const photo = new Image();
      photo.src = frames[index].src;
      cache.set(index, photo.decode().then(() => photo).catch(error => {
        cache.delete(index);
        throw error;
      }));
    }
    return cache.get(index);
  }

  function show(index) {
    current = index;
    const photo = frames[index];
    image.src = photo.src;
    image.alt = photo.caption;
    gate.setAttribute('aria-label', '放大第 ' + (index + 1) + ' 张照片');
    caption.textContent = photo.caption;
    counter.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(frames.length).padStart(2, '0');
    if (frames.length > 1) prepare((index + 1) % frames.length).catch(() => {});
  }

  async function animate(element, keyframes, duration) {
    if (motion.matches) return;
    animation = element.animate(keyframes, { duration, easing: 'linear', fill: 'both' });
    await animation.finished;
  }

  async function advance() {
    if (busy) return;
    busy = true;
    try {
      while (current !== requested && !controller.signal.aborted) {
        const next = requested, sign = direction;
        await prepare(next);
        if (controller.signal.aborted) return;
        await animate(shutter, [
          { opacity: 0, offset: 0 }, { opacity: .18, offset: .35 },
          { opacity: 1, offset: .76 }, { opacity: 1 }
        ], 145);
        if (controller.signal.aborted) return;
        show(next);
        animation?.cancel();
        await animate(image, [
          { transform: 'translateY(' + (sign * 7) + 'px)', opacity: .02, filter: 'brightness(1.30) blur(1.4px)' },
          { transform: 'translateY(' + (-sign * .8) + 'px)', opacity: 1, filter: 'brightness(1.16) blur(.35px)', offset: .46 },
          { transform: 'none', opacity: 1, filter: 'none' }
        ], 320);
        animation?.cancel();
      }
    } catch {
      if (!controller.signal.aborted) {
        requested = current;
        onError('这张照片暂时未能载入，请再试一次');
      }
    } finally {
      animation?.cancel();
      busy = false;
    }
  }

  function step(delta) {
    direction = delta;
    requested = (requested + delta + frames.length) % frames.length;
    advance();
  }
  view.querySelector('.film-prev').addEventListener('click', () => step(-1), options);
  view.querySelector('.film-next').addEventListener('click', () => step(1), options);
  window.addEventListener('keydown', event => {
    if (document.querySelector('dialog[open]') || event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      if (!event.repeat) step(event.key === 'ArrowLeft' ? -1 : 1);
    }
  }, options);
  gate.addEventListener('pointerdown', event => {
    swiped = false;
    if (event.pointerType === 'mouse' || !event.isPrimary) return;
    start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    gate.setPointerCapture(event.pointerId);
  }, options);
  gate.addEventListener('pointercancel', () => { start = null; }, options);
  gate.addEventListener('pointerup', event => {
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiped = true;
      step(dx < 0 ? 1 : -1);
    }
  }, options);
  gate.addEventListener('click', event => {
    if ((!swiped || !event.detail) && !busy) enlarge(current);
    swiped = false;
  }, options);
  show(0);
  return {
    select(index) { requested = index; show(index); },
    dispose() { controller.abort(); animation?.cancel(); cache.clear(); }
  };
}
