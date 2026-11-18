// Frames share one moving strip. Its centre slot sits behind the fixed aperture.
export function mountFilmViewer(view, frames, onError) {
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const gate = view.querySelector('.film-gate');
  const track = view.querySelector('.film-strip');
  const caption = view.querySelector('.film-caption');
  const counter = view.querySelector('.film-counter');
  const credit = view.querySelector('.film-credit');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const wrap = index => (index + frames.length) % frames.length;
  const shift = fraction => 'translate3d(0,' + (fraction * 100) + '%,0)';
  let current = 0, offset = 0, queued = 0;
  let busy = false, animation, drag;

  function createFrame(index) {
    const photo = frames[index];
    const frame = document.createElement('div');
    frame.className = 'film-frame';
    const exposure = document.createElement('div');
    exposure.className = 'film-exposure';
    exposure.style.setProperty('--ratio', photo.width / photo.height);
    exposure.style.setProperty('--glow', 'url(' + JSON.stringify(photo.src) + ')');
    const image = new Image();
    image.src = photo.src;
    image.alt = photo.caption;
    image.draggable = false;
    exposure.append(image);
    frame.append(exposure);
    return frame;
  }

  let slots = frames.length > 1
    ? [createFrame(wrap(-1)), createFrame(0), createFrame(1)]
    : [createFrame(0)];
  function register() {
    slots.forEach((frame, i) => {
      const slot = slots.length === 1 ? 0 : i - 1;
      frame.style.transform = shift(slot);
      if (slot) frame.setAttribute('aria-hidden', 'true');
      else frame.removeAttribute('aria-hidden');
    });
    const photo = frames[current];
    caption.textContent = photo.caption;
    counter.textContent = String(current + 1).padStart(2, '0') + ' / ' + String(frames.length).padStart(2, '0');
    credit.href = photo.source;
    credit.textContent = (photo.author === 'Unsplash' ? 'Unsplash' : photo.author + ' / Unsplash') + ' ↗';
  }
  track.append(...slots);
  register();

  function rotate(direction) {
    current = wrap(current + direction);
    const spare = createFrame(wrap(current + direction));
    if (direction > 0) {
      slots.shift().remove();
      slots.push(spare);
    } else {
      slots.pop().remove();
      slots.unshift(spare);
    }
    track.append(spare);
    register();
  }

  async function move(direction) {
    if (busy || frames.length < 2) return;
    busy = true;
    try {
      if (direction) await slots[1 + direction].querySelector('img').decode();
      if (controller.signal.aborted) return;
      const end = -direction;
      if (!motion.matches && Math.abs(end - offset) > .002) {
        const distance = end - offset;
        const duration = Math.max(180, 690 * Math.sqrt(Math.abs(distance)));
        animation = track.animate([
          { transform: shift(offset), filter: 'blur(0)', easing: 'cubic-bezier(.46,0,.77,.48)' },
          { transform: shift(offset + distance * .46), filter: 'blur(.7px)', offset: .44, easing: 'cubic-bezier(.22,.48,.18,1)' },
          { transform: shift(end + Math.sign(distance) * .002), filter: 'blur(0)', offset: .94 },
          { transform: shift(end), filter: 'blur(0)' }
        ], { duration, fill: 'both' });
        await animation.finished;
      }
      if (direction) rotate(direction);
    } catch {
      if (!controller.signal.aborted) {
        queued = 0;
        onError('这张照片暂时未能载入，请再试一次');
        // Refresh the offscreen slot so the next attempt can request it again.
        if (direction) {
          const i = 1 + direction;
          const fresh = createFrame(wrap(current + direction));
          slots[i].replaceWith(fresh);
          slots[i] = fresh;
          register();
        }
      }
    } finally {
      track.style.transform = '';
      animation?.cancel();
      animation = undefined;
      offset = 0;
      busy = false;
      if (queued && !controller.signal.aborted) {
        const next = Math.sign(queued);
        queued -= next;
        move(next);
      }
    }
  }

  function step(direction) {
    if (drag || frames.length < 2) return;
    if (busy) queued += direction;
    else move(direction);
  }
  view.querySelector('.film-prev').addEventListener('click', () => step(-1), options);
  view.querySelector('.film-next').addEventListener('click', () => step(1), options);
  window.addEventListener('keydown', event => {
    if (document.querySelector('dialog[open]') || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      if (!event.repeat) step(event.key === 'ArrowLeft' ? -1 : 1);
    }
  }, options);

  gate.addEventListener('pointerdown', event => {
    if (busy || drag || frames.length < 2 || !event.isPrimary || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: null, distance: 0 };
    gate.setPointerCapture(event.pointerId);
  }, options);
  gate.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 5) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    drag.distance = drag.axis === 'x' ? dx : dy;
    if (motion.matches) return;
    const length = drag.axis === 'x' ? gate.clientWidth : gate.clientHeight;
    offset = Math.max(-.96, Math.min(.96, drag.distance / length));
    track.style.transform = shift(offset);
  }, options);
  function release(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const distance = drag.distance;
    drag = null;
    const direction = event.type === 'pointerup' && Math.abs(distance) > 32 ? -Math.sign(distance) : 0;
    if (direction || offset) move(direction);
  }
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) gate.addEventListener(name, release, options);
  motion.addEventListener('change', () => { if (motion.matches) animation?.finish(); }, options);
  return { dispose() { controller.abort(); animation?.cancel(); } };
}
