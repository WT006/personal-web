// A projector gate over one continuous strip of film. The photos are adjacent
// frames on that strip: advancing yanks the strip one frame sideways (the black
// frame line sweeps through the gate), the next frame snaps into register, and
// it flashes slightly hot before settling to its own exposure.
import { sound, TIMELINE as T } from './projector-sound.js';
import { takeHandoff } from './album-transition.js';
import { createGate, travelAt } from './film-gl.js';

let filterCount = 0;

// Travel profile for one frame of pull-down, as a function of s in [0, 1]
// (T.pull → T.stop). Velocity snaps up to its peak at the heavy hit (T.yank),
// then decays but is still ~15% of peak when the frame stops dead.
const profile = (() => {
  const N = 400, peak = (T.yank - T.pull) / (T.stop - T.pull), floor = .14, k = 5.5;
  const v = Array.from({ length: N + 1 }, (_, i) => {
    const s = i / N;
    return s < peak ? (s / peak) ** 2 : floor + (1 - floor) * Math.exp(-k * (s - peak));
  });
  const area = [0];
  for (let i = 1; i <= N; i++) area.push(area[i - 1] + (v[i] + v[i - 1]) / 2);
  return s => {
    const x = Math.max(0, Math.min(1, s)) * N, i = Math.min(N - 1, Math.floor(x));
    return (area[i] + (area[i + 1] - area[i]) * (x - i)) / area[N];
  };
})();
const TENSION = .012;      // the claw takes up slack before the pull (share of a frame)
const FRAME_LINE = .05;    // black gap between frames, as a share of the gate width

// WebGL advance, in ms after T.pull (the yank). Measured from the reference:
// the frame leaves led by its bottom-right corner while a curved blade closes,
// the gate is black for a beat, then the blade opens from the bottom-left and
// the next frame lands hot, its top-left corner registering last on 嗒.
const LAG = 70;                          // bottom-right → top-left delay
const DUR = T.stop - T.pull - LAG;       // travel time of the leading corner
const CLOSE = [10, 170], OPEN = [235, 395];
const AFTERGLOW = 650;                   // exposure settling after the stop
const smooth01 = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const exposureAt = t => {
  const stop = T.stop - T.pull;
  return 1 + .42 * (t < stop ? smooth01((t - OPEN[0]) / (stop - 30 - OPEN[0])) : Math.exp(-(t - stop) / 230));
};

export function mountFilmViewer(view, frames, onError) {
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const gate = view.querySelector('.film-gate');
  const win = view.querySelector('.film-window');
  const perfs = [...view.querySelectorAll('.film-perfs')];
  const caption = view.querySelector('.film-caption');
  const counter = view.querySelector('.film-counter');
  const credit = view.querySelector('.film-credit');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const wrap = index => (index + frames.length) % frames.length;
  const px = value => 'translate3d(' + value.toFixed(2) + 'px,0,0)';

  // Light spilling from the screen onto the room.
  const ambient = document.createElement('div');
  ambient.className = 'cinema-ambient';
  ambient.setAttribute('aria-hidden', 'true');
  document.body.prepend(ambient);
  const ambientRest = () => getComputedStyle(ambient).getPropertyValue('--rest').trim() || .46;

  // The shutter darkens the whole gate for an instant mid-pull.
  const shutter = document.createElement('div');
  shutter.className = 'film-shutter';
  shutter.setAttribute('aria-hidden', 'true');
  win.after(shutter);

  // Horizontal motion blur, plus a streak pulled out of the highlights that
  // trails behind the direction of travel. Only active while the film moves.
  const filterId = 'film-smear-' + (++filterCount);
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  defs.setAttribute('class', 'film-defs');
  defs.setAttribute('aria-hidden', 'true');
  defs.innerHTML = `<filter id="${filterId}" x="-15%" y="0" width="130%" height="100%" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceGraphic" stdDeviation="0 0" result="soft"/>
    <feColorMatrix in="SourceGraphic" type="matrix" result="highs"
      values=".75 2.4 .25 0 -2.45  .7 2.35 .24 0 -2.4  .66 2.25 .23 0 -2.35  0 0 0 1 0"/>
    <feGaussianBlur in="highs" stdDeviation="0 0" result="streak"/>
    <feOffset in="streak" dx="0" result="trail"/>
    <feBlend in="soft" in2="trail" mode="screen"/>
  </filter>`;
  view.append(defs);
  const [softBlur, , streakBlur, streakOffset] = defs.querySelector('filter').children;
  function smear(speed, direction) {
    if (speed < .6) {
      win.style.filter = '';
      return;
    }
    softBlur.setAttribute('stdDeviation', Math.min(9, speed * .09).toFixed(2) + ' 0');
    streakBlur.setAttribute('stdDeviation', Math.min(24, speed * .26).toFixed(2) + ' 0');
    streakOffset.setAttribute('dx', (direction * Math.min(34, speed * .34)).toFixed(2));
    win.style.filter = 'url(#' + filterId + ')';
  }

  let glLoop = 0, glToken = 0;
  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 120));
  // The GPU gate (shader compile, first upload) is set up once the page has
  // settled, so mounting the album stays light. Until then, the DOM path runs.
  let glGate = null;

  let current = 0, queued = 0, perfOffset = 0;
  let busy = false, drag, running = [];

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
    frame.image = image;
    return frame;
  }

  function label() {
    const photo = frames[current];
    caption.textContent = photo.caption;
    counter.textContent = String(current + 1).padStart(2, '0') + ' / ' + String(frames.length).padStart(2, '0');
    credit.href = photo.source;
    credit.textContent = (photo.author === 'Unsplash' ? 'Unsplash' : photo.author + ' / Unsplash') + ' ↗';
    ambient.style.backgroundImage = 'url(' + JSON.stringify(photo.src) + ')';
  }

  function preload() {
    if (frames.length < 2) return;
    for (const d of [1, -1]) {
      const image = new Image();
      image.src = frames[wrap(current + d)].src;
      image.decode().then(() => idle(() => glGate?.prepare(image))).catch(() => {});
    }
  }

  function play(element, keyframes, timing) {
    const animation = element.animate(keyframes, { fill: 'both', ...timing });
    running.push(animation);
    return animation.finished;
  }
  function settle() {
    running.forEach(animation => animation.cancel());
    running = [];
  }

  const pitch = () => win.clientWidth * (1 + FRAME_LINE);
  function place(element, offset) { element.style.transform = offset ? px(offset) : ''; }
  function placePerfs(offset) {
    perfs.forEach(strip => { strip.style.backgroundPositionX = (perfOffset + offset).toFixed(2) + 'px'; });
  }

  // Registering: the frame lands a little hot and the exposure eases back.
  function expose(frame, { captionFrom = 0 } = {}) {
    return Promise.all([
      play(frame, [
        { filter: 'brightness(1.3) contrast(1.07)' },
        { filter: 'brightness(1.09) contrast(1.02)', offset: .3 },
        { filter: 'brightness(1) contrast(1)' }
      ], { duration: 480, easing: 'cubic-bezier(.2,.6,.35,1)' }),
      play(ambient, [{ opacity: .8 }, { opacity: ambientRest() }], { duration: 700, easing: 'ease-out' }),
      play(caption, [{ opacity: captionFrom }, { opacity: 1 }], { duration: 280, easing: 'ease-out' })
    ]);
  }

  let frame = createFrame(0);
  win.append(frame);
  label();
  preload();
  // Compile the shader and upload the first photo while idle (the canvas is
  // invisible at rest), so the first advance doesn't stall on it.
  // Wait until nothing is animating (e.g. the photo landing from the wall).
  const quiet = () => new Promise(resolve => {
    const check = () => busy ? setTimeout(check, 200) : setTimeout(resolve, 400);
    check();
  });
  frame.image.decode().catch(() => {}).then(quiet).then(() => idle(() => {
    if (controller.signal.aborted) return;
    glGate = createGate(win);
    if (!glGate) return;
    preload();                       // now the neighbours can be uploaded too
    if (busy || !glGate.prepare(frame.image)) return;
    glGate.draw({ out: frame.image, in: null, dir: 1, time: -1000, dur: DUR, lag: LAG, s0: 0,
      close: CLOSE, open: OPEN, expo: 1, flicker: 1, shift: 0, gap: FRAME_LINE });
  })).catch(() => {});
  const handoff = takeHandoff(frames[0].src);
  if (handoff) arrive(handoff);
  else if (!motion.matches) frame.image.decode().catch(() => {}).then(() => {
    if (!controller.signal.aborted && !busy) expose(frame).catch(() => {}).finally(() => { if (!busy) settle(); });
  });

  // A cover carried over from the album wall lands exactly where this frame
  // sits; only then does the real frame appear and the caption rise.
  async function arrive(handoff) {
    busy = true;
    const landing = frame;
    landing.style.opacity = '0';
    caption.style.opacity = '0';
    ambient.style.opacity = '0';
    try {
      // The photo is already in flight; hand it the gate's live position.
      await handoff.land(() => landing.querySelector('.film-exposure').getBoundingClientRect());
      if (controller.signal.aborted) return;
      await landing.image.decode().catch(() => {});
      if (controller.signal.aborted) return;
      handoff.reveal();
      // Bring the real frame (and its soft rim) up beneath the stand-in, then
      // dissolve the stand-in: the swap itself is invisible.
      await play(landing, [{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
      landing.style.opacity = '';
      handoff.release();
      play(ambient, [{ opacity: 0 }, { opacity: ambientRest() }], { duration: 1200, easing: 'ease-out' });
      play(caption, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
        { duration: 700, delay: 120, easing: 'cubic-bezier(.2,.6,.3,1)' });
      ambient.style.opacity = caption.style.opacity = '';
    } finally {
      if (controller.signal.aborted) handoff.cancel();
      busy = false;
      queued = 0;
    }
  }

  // Pull the strip one full frame in `direction`, following the sound's
  // timeline. A click starts at 0 (catch, hold, pull); a drag hands over at
  // T.pull with the strip already displaced by `from` px.
  function travel(outgoing, incoming, direction, from, startAt) {
    const distance = pitch();
    const to = -direction * distance;
    const slack = startAt < T.pull ? -direction * distance * TENSION : 0;
    return new Promise(resolve => {
      let start, last, lastTime;
      const tick = now => {
        if (controller.signal.aborted) return resolve();
        start ??= now;
        const clock = startAt + now - start;
        let offset, shade;
        if (clock < T.pull) {
          // 咔: the claw catches — the film tightens and the lamp flickers once.
          const k = Math.max(0, Math.min(1, (clock - T.catch) / 40));
          offset = from + slack * (1 - (1 - k) ** 3);
          shade = clock >= T.catch ? .16 * Math.exp(-(clock - T.catch) / 70) : 0;
        } else {
          const begin = from + slack;
          offset = begin + (to - begin) * profile((clock - T.pull) / (T.stop - T.pull));
          // Darkest while the black frame line crosses the middle of the gate.
          const across = offset / to;
          shade = .92 * Math.max(0, 1 - Math.abs(across - .5) / .28) ** 1.2;
        }
        const moving = clock < T.stop;
        if (!moving) offset = to;
        place(outgoing, offset);
        place(incoming, offset + direction * distance);
        placePerfs(offset);
        const speed = last === undefined ? 0 : Math.abs(offset - last) / Math.max(1, now - lastTime) * 16.7;
        last = offset;
        lastTime = now;
        smear(moving ? speed : 0, direction);
        shutter.style.opacity = moving && shade > .005 ? shade.toFixed(3) : '';
        if (moving) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  }

  // Advance on the GPU. Resolves when the frame is in register; keeps drawing
  // the settling exposure afterwards, then hands back to the DOM frame.
  function glTravel(outgoing, incoming, direction, s0, startAt) {
    cancelAnimationFrame(glLoop);
    const token = ++glToken;
    const tension = win.clientWidth * TENSION;
    const outImage = outgoing.image, inImage = incoming.image;
    return new Promise(resolve => {
      let start, landed = false;
      const tick = () => {
        if (controller.signal.aborted || token !== glToken) return resolve();
        const now = performance.now();
        start ??= now;
        const clock = startAt + now - start;
        const t = clock - T.pull;
        const k = smooth01((clock - T.catch) / 40);
        let shift = startAt < T.pull ? direction * tension * k * (1 - travelAt(t / DUR)) : 0;
        const echo = clock - T.echo;
        if (echo > 0 && echo < 90) shift -= direction * 2 * Math.sin(Math.PI * echo / 90);
        const flicker = clock >= T.catch && clock < T.pull ? 1 - .16 * Math.exp(-(clock - T.catch) / 70) : 1;
        glGate.draw({ out: outImage, in: inImage, dir: direction, time: t, dur: DUR, lag: LAG, s0,
          close: CLOSE, open: OPEN, expo: exposureAt(t), flicker, shift, gap: FRAME_LINE });
        if (!landed) {
          // The sprockets ride the middle of the strip.
          placePerfs(-direction * pitch() * travelAt((t - LAG * .5) / DUR, s0) - shift);
          win.classList.add('gl-on');
        }
        if (!landed && clock >= T.stop) { landed = true; resolve(); }
        if (clock < T.stop + AFTERGLOW) glLoop = requestAnimationFrame(tick);
        else win.classList.remove('gl-on');
      };
      tick();
    });
  }

  async function move(direction, pulled) {
    if (busy || frames.length < 2) return;
    busy = true;
    settle();
    const outgoing = frame;
    const next = wrap(current + direction);
    const incoming = pulled?.incoming ?? createFrame(next);
    const from = pulled?.offset ?? 0;
    let usedGl = false;
    if (!incoming.isConnected) {
      place(incoming, from + direction * pitch());
      win.append(incoming);
    }
    try {
      await incoming.image.decode();
      if (controller.signal.aborted) return;
      if (motion.matches) {
        sound.settle();
      } else {
        const startAt = pulled ? T.pull : 0;
        sound.advance(startAt / 1000);
        const delay = T.pull - startAt;
        play(caption, [{ opacity: 1 }, { opacity: .35 }], { duration: 180, delay, easing: 'ease-in' });
        play(ambient, [{ opacity: ambientRest() }, { opacity: .2 }], { duration: 220, delay, easing: 'ease-in' });
        const s0 = Math.min(.9, Math.abs(from) / pitch());
        if (glGate?.prepare(outgoing.image, incoming.image)) {
          usedGl = true;
          await glTravel(outgoing, incoming, direction, s0, startAt);
        } else {
          await travel(outgoing, incoming, direction, from, startAt);
        }
        if (controller.signal.aborted) return;
      }
      outgoing.remove();
      place(incoming, 0);
      perfOffset -= direction * pitch();
      placePerfs(0);
      current = next;
      frame = incoming;
      label();
      preload();
      settle();
      // The exposure settles on its own; the gate is free as soon as the frame
      // is in register, so the next pull or drag can start immediately.
      if (usedGl) {
        play(ambient, [{ opacity: .85 }, { opacity: ambientRest() }], { duration: 750, easing: 'ease-out' }).catch(() => {});
        play(caption, [{ opacity: .35 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' }).catch(() => {});
      } else if (!motion.matches) {
        expose(incoming, { captionFrom: .35 }).catch(() => {});
        // Echo of the stop: the frame seats with a tiny recoil.
        const echo = T.echo - T.stop;
        play(incoming, [
          { transform: px(0) },
          { transform: px(0), offset: echo / 160 },
          { transform: px(direction * 2), offset: (echo + 14) / 160 },
          { transform: px(0) }
        ], { duration: 160, easing: 'ease-out' }).catch(() => {});
      }
    } catch {
      if (!controller.signal.aborted) {
        settle();
        queued = 0;
        onError('这张照片暂时未能载入，请再试一次');
        incoming.remove();
        place(outgoing, 0);
        placePerfs(0);
        frame = outgoing;
      }
    } finally {
      if (!controller.signal.aborted) {
        smear(0);
        shutter.style.opacity = '';
      }
      busy = false;
      if (queued && !controller.signal.aborted) {
        const step = Math.sign(queued);
        queued -= step;
        move(step);
      }
    }
  }

  function step(direction) {
    if (drag || frames.length < 2) return;
    if (busy) queued = Math.max(-2, Math.min(2, queued + direction));
    else move(direction);
  }
  const soundButton = view.querySelector('.film-sound');
  function paintSound() {
    const on = sound.enabled;
    soundButton.setAttribute('aria-pressed', String(on));
    soundButton.setAttribute('aria-label', on ? '关闭放映机音效' : '打开放映机音效');
    soundButton.classList.toggle('muted', !on);
  }
  soundButton?.addEventListener('click', () => { sound.enabled = !sound.enabled; paintSound(); if (sound.enabled) sound.nudge(); }, options);
  if (soundButton) paintSound();
  // Start the audio engine (~100ms the first time) before the first advance.
  // Created while idle (it costs ~100ms); a gesture later only resumes it.
  idle(() => { if (!controller.signal.aborted) sound.prime(); });
  view.querySelector('.film-prev').addEventListener('click', () => step(-1), options);
  view.querySelector('.film-next').addEventListener('click', () => step(1), options);
  window.addEventListener('keydown', event => {
    if (document.querySelector('dialog[open]') || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      if (!event.repeat) step(event.key === 'ArrowLeft' ? -1 : 1);
    }
  }, options);

  // Dragging pulls the strip by hand; the neighbouring frame follows on the
  // side it is coming from. Let go past a threshold and the claw takes over.
  gate.addEventListener('pointerdown', event => {
    if (busy || drag || frames.length < 2 || !event.isPrimary || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: null, dx: 0, side: 0, neighbour: null };
    gate.setPointerCapture(event.pointerId);
  }, options);
  gate.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (drag.axis !== 'x') return;
    drag.dx = dx;
    if (motion.matches) return;
    const side = dx < 0 ? 1 : -1;            // dragging left reveals the next frame
    if (side !== drag.side) {
      drag.neighbour?.remove();
      drag.neighbour = createFrame(wrap(current + side));
      win.append(drag.neighbour);
      drag.side = side;
    }
    const offset = dx * .9;
    place(frame, offset);
    place(drag.neighbour, offset + side * pitch());
    placePerfs(offset);
  }, options);
  function release(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const { dx, axis, side, neighbour } = drag;
    drag = null;
    const offset = axis === 'x' && !motion.matches ? dx * .9 : 0;
    if (axis === 'x' && event.type === 'pointerup' && Math.abs(dx) > 40) {
      const direction = -Math.sign(dx);
      if (neighbour && side === direction) move(direction, { incoming: neighbour, offset });
      else { neighbour?.remove(); move(direction); }
      return;
    }
    if (!neighbour) return;
    // Not far enough: the film slips back into register.
    const held = frame;
    busy = true;
    const back = [{ transform: px(offset) }, { transform: px(0) }];
    const timing = { duration: 220, easing: 'cubic-bezier(.3,.7,.3,1)' };
    const strips = perfs.map(strip => strip.animate(
      [{ backgroundPositionX: (perfOffset + offset) + 'px' }, { backgroundPositionX: perfOffset + 'px' }], timing));
    Promise.all([
      held.animate(back, timing).finished,
      neighbour.animate([{ transform: px(offset + side * pitch()) }, { transform: px(side * pitch()) }], timing).finished,
      ...strips.map(a => a.finished)
    ]).catch(() => {}).finally(() => {
      neighbour.remove();
      place(held, 0);
      placePerfs(0);
      busy = false;
      sound.nudge();
    });
    place(held, 0);
    placePerfs(0);
  }
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) gate.addEventListener(name, release, options);
  motion.addEventListener('change', () => { if (motion.matches) running.forEach(a => a.finish()); }, options);

  return {
    dispose() {
      controller.abort();
      settle();
      cancelAnimationFrame(glLoop);
      glGate?.dispose();
      ambient.remove();
      defs.remove();
    }
  };
}
