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
  const items = Array.from(roll.querySelectorAll('.album-cover'), cover => {
    const canvas = cover.querySelector('canvas');
    const image = cover.querySelector('img');
    image.addEventListener('load', schedule, options);
    return { cover, image, canvas, context: canvas.getContext('2d') };
  });
  let frame = 0;
  let lastTime = 0;
  let eased = window.scrollY;
  function draw(time) {
    frame = 0;
    const elapsed = Math.min(time - lastTime, 64);
    lastTime = time;
    const actual = window.scrollY;
    eased += (actual - eased) * (1 - Math.exp(-elapsed / 75));
    const lag = actual - eased;
    if (motion.matches) {
      eased = actual;
      roll.style.transform = '';
      return;
    }
    roll.style.transform = Math.abs(lag) > 0.25 ? 'translateY(' + lag + 'px)' : '';
    for (const item of items) {
      paintCover(item, item.cover.getBoundingClientRect().top, innerHeight);
    }
    if (Math.abs(lag) > 0.25) schedule();
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(draw);
  }
  window.addEventListener('scroll', schedule, { ...options, passive: true });
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
    sizeObserver.disconnect();
    cancelAnimationFrame(frame);
  };
}
