// Walking up to a photograph: the chosen cover is lifted off the curved wall
// into a fixed "ghost" and travels in ONE continuous motion into the film
// gate, unfurling and widening its crop on the way. The rest of the wall fades
// first, the room sinks, and the album page is rendered underneath while the
// photo is still in flight; the gate's real position is blended into the
// flight path as soon as it exists, so the photo never stops or jumps.
import { sound } from './projector-sound.js';

const html = document.documentElement;
const FLIGHT = 950;        // ms, cover → gate
const UNFURL = 520;        // ms, curled → flat (inside the flight)
const WALL_FADE = 280;     // ms, the other albums sink into the dark
const RETARGET = 320;      // ms to blend from the estimated to the real gate
let pending;

function bezier(x1, y1, x2, y2) {
  const ax = 1 - 3 * x2 + 3 * x1, bx = 3 * x2 - 6 * x1, cx = 3 * x1;
  const ay = 1 - 3 * y2 + 3 * y1, by = 3 * y2 - 6 * y1, cy = 3 * y1;
  return t => {
    let u = t;
    for (let i = 0; i < 8; i++) {
      const x = ((ax * u + bx) * u + cx) * u - t;
      const dx = (3 * ax * u + 2 * bx) * u + cx;
      if (Math.abs(x) < 1e-5 || Math.abs(dx) < 1e-6) break;
      u = Math.min(1, Math.max(0, u - x / dx));
    }
    return ((ay * u + by) * u + cy) * u;
  };
}
const flightEase = bezier(.36, 0, .14, 1);
const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => ({
  left: lerp(a.left, b.left, t), top: lerp(a.top, b.top, t),
  width: lerp(a.width, b.width, t), height: lerp(a.height, b.height, t)
});

// Where the first photo will sit in the gate, from the film page's CSS.
// Only a starting guess: the real rectangle replaces it mid-flight.
function estimateGate(ratio) {
  const vw = html.clientWidth, narrow = innerWidth <= 600;
  const main = document.getElementById('main');
  const pageWidth = narrow ? vw : Math.min(vw, 980, innerHeight * 1.2 + 80);
  const gateWidth = pageWidth - (narrow ? 32 : 80);
  const gateHeight = gateWidth / (narrow ? 1.04 : 1.66);
  const winWidth = gateWidth * (narrow ? .94 : .948);
  const winHeight = gateHeight * (narrow ? .8 : .81);
  const width = Math.min(winWidth, winHeight * ratio), height = width / ratio;
  const gateTop = (main?.offsetTop || 104) + (narrow ? 24 + 89 : 8 + 71);
  return { left: (vw - width) / 2, top: gateTop + (gateHeight - height) / 2, width, height };
}

export function openAlbum({ href, image, rect, transform, zoom = 1, focus = { x: .5, y: .5 } }) {
  if (pending) return;
  // Pay the audio start-up cost now, while the photo is still at rest,
  // instead of as a hitch when it lands.
  sound.prime();
  const ratio = image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 1.5;
  const ghost = document.createElement('div');
  ghost.className = 'album-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  const sheet = document.createElement('div');
  sheet.className = 'album-ghost-sheet';
  const img = new Image();
  img.src = image.currentSrc || image.src;
  img.alt = '';
  img.style.transformOrigin = (focus.x * 100) + '% ' + (focus.y * 100) + '%';
  sheet.append(img);
  ghost.append(sheet);
  const setBox = box => {
    ghost.style.left = box.left + 'px';
    ghost.style.top = box.top + 'px';
    ghost.style.width = box.width + 'px';
    ghost.style.height = box.height + 'px';
  };
  setBox(rect);
  document.body.append(ghost);
  html.classList.add('handoff');

  const curl = transform && transform !== 'none' ? transform : 'translate(0,0)';
  sheet.animate([{ transform: curl }, { transform: 'translate(0,0)' }],
    { duration: UNFURL, easing: 'cubic-bezier(.3,.05,.2,1)', fill: 'forwards' });
  img.animate([{ transform: 'scale(' + zoom + ')' }, { transform: 'scale(1)' }],
    { duration: FLIGHT, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });

  const estimate = estimateGate(ratio);
  let gate = null, gateSince = 0, frame = 0, start = performance.now();
  let arrived, cancelled = false;
  const done = new Promise(resolve => { arrived = resolve; });

  const fly = now => {
    if (cancelled) return;
    const t = Math.min(1, (now - start) / FLIGHT);
    let target = estimate;
    if (gate) {
      const real = gate();
      target = real.width ? mix(estimate, real, smooth((now - gateSince) / RETARGET)) : estimate;
    }
    setBox(mix(rect, target, flightEase(t)));
    if (t < 1 || (gate && now - gateSince < RETARGET)) frame = requestAnimationFrame(fly);
    else if (gate) { sound.settle(); arrived(); }
    else frame = requestAnimationFrame(fly);      // landed early: hold until the gate exists
  };
  frame = requestAnimationFrame(fly);

  const sink = setTimeout(() => {
    html.classList.remove('gallery');
    html.classList.add('cinema');
  }, 150);
  const go = setTimeout(() => { location.hash = href; }, WALL_FADE + 20);

  let fallback;
  const finish = () => {
    cancelled = true;
    cancelAnimationFrame(frame);
    clearTimeout(fallback);
    clearTimeout(sink);
    clearTimeout(go);
    ghost.remove();
    html.classList.remove('handoff');
    pending = undefined;
  };
  pending = {
    src: img.src,
    // `measure` returns the gate's live rectangle; resolves once the photo is
    // sitting exactly on it.
    land(measure) {
      clearTimeout(fallback);
      gate = measure;
      gateSince = performance.now();
      return done;
    },
    // Page chrome (title, caption row, sprocket holes) may come up now.
    reveal() {
      html.classList.remove('handoff');
    },
    // The real frame is fully visible underneath; dissolve the stand-in.
    release() {
      const fade = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' });
      fade.finished.then(finish, finish);
    },
    cancel: finish
  };
  // If the viewer never claims the photo (route changed, load failed), clean up.
  fallback = setTimeout(() => pending?.cancel(), 4000);
}

// The film viewer asks whether it is receiving a photo from the wall.
export function takeHandoff(src) {
  if (!pending) return null;
  const a = new URL(pending.src, location.href).href;
  const b = new URL(src, location.href).href;
  if (a !== b) { pending.cancel(); return null; }
  return pending;
}

export const handoffActive = () => !!pending;
