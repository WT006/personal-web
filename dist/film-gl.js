// WebGL projector gate. Draws the film strip (current frame, black frame line,
// next frame) during an advance, with effects a DOM transform can't do:
//  - the pull is not rigid: the claw sits at the bottom-right, so that corner
//    moves first and the rest of the frame follows a few ms later;
//  - real horizontal motion blur, with highlights stretched into a trail;
//  - a curved shutter blade that closes from the bottom-right and opens from
//    the bottom-left, as in the reference clip;
//  - the next frame registering slightly over-exposed.
// At rest the DOM frame is shown instead (sharp, accessible, with its glow).

const VERT = `
attribute vec2 a;
varying vec2 uv;
void main() { uv = vec2(a.x * .5 + .5, .5 - a.y * .5); gl_Position = vec4(a, 0., 1.); }`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 uv;
uniform sampler2D uOut, uIn;
uniform vec2 uOutFit, uInFit, uRes, uClose, uOpen;
uniform float uPitch, uDir, uTime, uDur, uLag, uS0, uHasIn, uExpo, uFlicker, uShift;

// Pull-down travel: leaves rest abruptly, peaks mid-way, and is still moving
// when it reaches the stop (so the stop reads as a hard catch, not a glide).
const float V0 = .75, V1 = .55;
float travel(float t) { float t2 = t * t, t3 = t2 * t; return (t3 - 2. * t2 + t) * V0 + (3. * t2 - 2. * t3) + (t3 - t2) * V1; }
float speed(float t) { float t2 = t * t; return (3. * t2 - 4. * t + 1.) * V0 + (6. * t - 6. * t2) + (3. * t2 - 2. * t) * V1; }

vec3 cell(sampler2D tex, vec2 fit, vec2 q) {
  vec2 r = (q - .5) / fit + .5;
  if (r.x < 0. || r.x > 1. || r.y < 0. || r.y > 1.) return vec3(0.);
  return texture2D(tex, r).rgb;
}
vec3 strip(float xs, float y) {
  if (xs >= 0. && xs <= uRes.x) return cell(uOut, uOutFit, vec2(xs / uRes.x, y));
  float xi = xs - uDir * uPitch;
  if (uHasIn > .5 && xi >= 0. && xi <= uRes.x) return cell(uIn, uInFit, vec2(xi / uRes.x, y));
  return vec3(0.);
}
float ease(float t) { t = clamp(t, 0., 1.); return t * t * (3. - 2. * t); }

void main() {
  float aspect = uRes.x / uRes.y;
  // Mirror the fields when running backwards, so the lead corner flips too.
  vec2 pm = vec2(uDir > 0. ? uv.x : 1. - uv.x, uv.y);
  vec2 P = vec2(pm.x * aspect, pm.y);

  // Each point starts (and stops) a little later the further it is from the claw.
  float reach = length(vec2(aspect, 1.) - P) / length(vec2(aspect, 1.));
  float t = (uTime - uLag * reach) / uDur;
  float tc = clamp(t, 0., 1.);
  float s = uS0 + (1. - uS0) * travel(tc);
  float v = (t > 0. && t < 1.) ? (1. - uS0) * speed(tc) / uDur : 0.;

  float xo = uv.x * uRes.x + uDir * s * uPitch + uShift;
  float blur = clamp(v * uPitch * 18., 0., uRes.x * .14);
  vec3 c = vec3(0.), trail = vec3(0.);
  float total = 0.;
  for (int k = 0; k < 14; k++) {
    float f = float(k) / 13.;
    float w = 1. - .7 * f;
    c += strip(xo + uDir * blur * f, uv.y) * w;
    total += w;
    vec3 b = strip(xo + uDir * blur * 2.4 * f, uv.y);
    trail += b * smoothstep(.6, 1., dot(b, vec3(.3, .59, .11))) * (1. - f);
  }
  c = c / total + trail / 14. * smoothstep(3., 40., blur);
  c *= 1. - .28 * smoothstep(6., uRes.x * .1, blur);

  // Shutter blade: a soft circular edge. Closes from beyond the bottom-right
  // corner, opens from beyond the bottom-left.
  float soft = .2;
  vec2 pc = vec2(aspect + .6, 1.8), po = vec2(-.6, 1.8);
  float rc = mix(length(vec2(aspect, 1.) - pc) - soft, length(pc) + soft, ease((uTime - uClose.x) / (uClose.y - uClose.x)));
  float ro = mix(length(vec2(0., 1.) - po) - soft, length(vec2(aspect, 0.) - po) + soft, ease((uTime - uOpen.x) / (uOpen.y - uOpen.x)));
  float closed = 1. - smoothstep(rc - soft, rc + soft, length(P - pc));
  float shut = smoothstep(ro - soft, ro + soft, length(P - po));
  c *= 1. - .975 * closed * shut;

  // Registering hot: highlights bloom more than the mid-tones.
  c = c * uExpo + pow(c, vec3(2.4)) * (uExpo - 1.) * .9;
  gl_FragColor = vec4(min(c * uFlicker, vec3(1.)), 1.);
}`;

export function createGate(win) {
  const canvas = document.createElement('canvas');
  canvas.className = 'film-gl';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
  if (!gl) return null;
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }
  gl.useProgram(program);
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(program, 'a');
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const u = {};
  for (const name of 'uOut uIn uOutFit uInFit uRes uClose uOpen uPitch uDir uTime uDur uLag uS0 uHasIn uExpo uFlicker uShift'.split(' '))
    u[name] = gl.getUniformLocation(program, name);
  gl.uniform1i(u.uOut, 0);
  gl.uniform1i(u.uIn, 1);
  const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const textures = new Map();
  let lost = false;
  canvas.addEventListener('webglcontextlost', () => { lost = true; });
  win.append(canvas);

  function texture(image) {
    const key = image.currentSrc || image.src;
    if (textures.has(key)) {
      const entry = textures.get(key);
      textures.delete(key);
      textures.set(key, entry);      // keep most recently used last
      return entry;
    }
    if (!image.complete || !image.naturalWidth || Math.max(image.naturalWidth, image.naturalHeight) > maxSize) return null;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    if (gl.getError() !== gl.NO_ERROR) { gl.deleteTexture(tex); return null; }
    const entry = { tex, ratio: image.naturalWidth / image.naturalHeight };
    textures.set(key, entry);
    while (textures.size > 6) {
      const [oldest, old] = textures.entries().next().value;
      gl.deleteTexture(old.tex);
      textures.delete(oldest);
    }
    return entry;
  }

  function size() {
    const density = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(win.clientWidth * density));
    const h = Math.max(1, Math.round(win.clientHeight * density));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    return { w, h, density };
  }
  const fit = (ratio, w, h) => {
    const fw = Math.min(w, h * ratio);
    return [fw / w, fw / ratio / h];
  };

  return {
    // Upload ahead of time (texture upload of a large photo costs a few ms).
    prepare(...images) { return !lost && images.every(image => texture(image)); },
    // state: { out, in, dir, time, dur, lag, s0, close, open, expo, flicker, shift, gap }
    draw(state) {
      if (lost) return false;
      const out = texture(state.out), inc = state.in ? texture(state.in) : null;
      if (!out) return false;
      const { w, h, density } = size();
      gl.viewport(0, 0, w, h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, out.tex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, (inc || out).tex);
      gl.uniform2fv(u.uOutFit, fit(out.ratio, w, h));
      gl.uniform2fv(u.uInFit, fit((inc || out).ratio, w, h));
      gl.uniform1f(u.uHasIn, inc ? 1 : 0);
      gl.uniform2f(u.uRes, w, h);
      gl.uniform1f(u.uPitch, w * (1 + state.gap));
      gl.uniform1f(u.uDir, state.dir);
      gl.uniform1f(u.uTime, state.time);
      gl.uniform1f(u.uDur, state.dur);
      gl.uniform1f(u.uLag, state.lag);
      gl.uniform1f(u.uS0, state.s0);
      gl.uniform2fv(u.uClose, state.close);
      gl.uniform2fv(u.uOpen, state.open);
      gl.uniform1f(u.uExpo, state.expo);
      gl.uniform1f(u.uFlicker, state.flicker);
      gl.uniform1f(u.uShift, state.shift * density);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return true;
    },
    dispose() {
      textures.forEach(entry => gl.deleteTexture(entry.tex));
      gl.deleteBuffer(quad);
      gl.deleteProgram(program);
      canvas.remove();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  };
}

// The same travel curve, for the DOM parts that follow the strip (sprockets).
export function travelAt(t, s0 = 0) {
  const c = Math.max(0, Math.min(1, t)), V0 = .75, V1 = .55, c2 = c * c, c3 = c2 * c;
  return s0 + (1 - s0) * ((c3 - 2 * c2 + c) * V0 + (3 * c2 - 2 * c3) + (c3 - c2) * V1);
}
