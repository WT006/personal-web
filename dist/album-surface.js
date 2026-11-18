// A single transparent WebGL layer draws the visible covers over their native links.
const vertex = `
  attribute vec2 uv;
  uniform vec2 stage, origin, size;
  uniform mediump vec2 pointer;
  uniform float clock, phase, bend;
  uniform mediump float hover;
  varying mediump vec2 photoUV;
  varying mediump float light;
  void main() {
    vec2 p = uv * size;
    float radius = max(size.y * .62, 120.);
    float distanceToBend = max(0., bend - p.y);
    float angle = min(distanceToBend / radius, 1.38);
    float beyond = distanceToBend - radius * angle;
    float depth = radius * (1. - cos(angle)) + beyond * sin(angle);
    float wave = sin(uv.x * 5.2 - uv.y * 2.6 - clock * 1.18 + phase);
    float slope = cos(uv.x * 5.2 - uv.y * 2.6 - clock * 1.18 + phase);
    vec2 delta = (uv - pointer) * size / size.y;
    float lift = exp(-dot(delta, delta) * 8.) * hover;
    float scale = 1. / (1. + depth / (size.x * .85));
    scale *= 0.982 + wave * .009 + lift * .008;
    p.x = (p.x - size.x * .5) * scale + size.x * .5;
    p.y += distanceToBend - radius * sin(angle) - beyond * cos(angle);
    p.y = (p.y - size.y * .5) * .975 + size.y * .5
        + size.y * (.010 * wave - .018 * lift);
    vec2 clip = (origin + p) / stage * 2. - 1.;
    gl_Position = vec4(clip.x, -clip.y, 0., 1.);
    photoUV = uv;
    light = 1. - (1. - cos(angle)) * .28 + slope * .015 + lift * .035;
  }`;
const fragment = `
  precision mediump float;
  uniform sampler2D photo;
  uniform vec2 crop, pointer;
  uniform float hover;
  varying mediump vec2 photoUV;
  varying mediump float light;
  void main() {
    vec2 focus = mix(vec2(.5), pointer, .32);
    vec2 sampleUV = (photoUV - focus) / (1. + .10 * hover) + focus;
    vec4 color = texture2D(photo, .5 + (sampleUV - .5) * crop);
    gl_FragColor = vec4(color.rgb * light, 1.);
  }`;

function buildMesh() {
  const points = [];
  const columns = 32, rows = 40;
  // Join adjacent rows with degenerate triangles for one draw per album.
  for (let y = 0; y < rows; y++) {
    if (y) points.push(0, y / rows);
    for (let x = 0; x <= columns; x++) {
      points.push(x / columns, y / rows, x / columns, (y + 1) / rows);
    }
    if (y < rows - 1) points.push(1, (y + 1) / rows);
  }
  return new Float32Array(points);
}

export function createSurface(roll, onLost) {
  const canvas = document.createElement('canvas');
  canvas.className = 'album-surface';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: true, depth: false, antialias: true });
  if (!gl) return null;
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }
  gl.useProgram(program);
  const mesh = buildMesh();
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
  const uv = gl.getAttribLocation(program, 'uv');
  gl.enableVertexAttribArray(uv);
  gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 0, 0);
  const u = Object.fromEntries('stage origin size pointer clock phase bend hover crop'.split(' ')
    .map(name => [name, gl.getUniformLocation(program, name)]));
  const textures = new Map();
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  roll.append(canvas);
  canvas.addEventListener('webglcontextlost', onLost);

  function textureFor(image) {
    if (textures.has(image)) return textures.get(image);
    if (!image.complete || !image.naturalWidth) return null;
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    try {
      if (Math.max(image.naturalWidth, image.naturalHeight) > maxTextureSize) throw new RangeError();
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      if (gl.getError() !== gl.NO_ERROR) throw new Error('Cover texture unavailable');
    } catch {
      gl.deleteTexture(texture);
      texture = null;
    }
    textures.set(image, texture);
    return texture;
  }

  return {
    begin(rect, offset, height, time) {
      const density = Math.min(devicePixelRatio, 1.5);
      const w = Math.max(1, Math.round(rect.width * density));
      const h = Math.max(1, Math.round(height * density));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      canvas.style.top = offset + 'px';
      canvas.style.height = height + 'px';
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u.stage, rect.width, height);
      gl.uniform1f(u.clock, time);
    },
    paint(item, rect, left, top) {
      const texture = textureFor(item.image);
      if (!texture) return false;
      const aspect = rect.width / rect.height;
      const imageAspect = item.image.naturalWidth / item.image.naturalHeight;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform2f(u.crop, Math.min(1, aspect / imageAspect), Math.min(1, imageAspect / aspect));
      gl.uniform2f(u.origin, rect.left - left, rect.top - top);
      gl.uniform2f(u.size, rect.width, rect.height);
      gl.uniform2f(u.pointer, item.x, item.y);
      gl.uniform1f(u.phase, item.phase);
      gl.uniform1f(u.hover, item.hover);
      gl.uniform1f(u.bend, Math.min(innerHeight * .33, rect.height * .72) - rect.top);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, mesh.length / 2);
      return true;
    },
    dispose() {
      canvas.removeEventListener('webglcontextlost', onLost);
      textures.forEach(texture => gl.deleteTexture(texture));
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      canvas.remove();
      if (!gl.isContextLost()) gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  };
}
