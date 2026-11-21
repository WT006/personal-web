import { ROOM_LIGHT_GLSL, spot } from './room-light.js';

// Each vertex is projected by the same gallery surface used to place the live captions.
const vertex = `
  attribute vec2 uv;
  attribute vec3 positionLight;
  uniform vec2 stage, origin, viewport;
  varying mediump vec2 photoUV;
  varying highp vec2 screen;
  varying mediump float light;
  void main() {
    vec2 clip = positionLight.xy / stage * 2. - 1.;
    screen = positionLight.xy + origin;          // viewport px
    gl_Position = vec4(clip.x, -clip.y, 0., 1.);
    photoUV = uv;
    light = positionLight.z;
  }`;
const fragment = `
  precision highp float;
  uniform sampler2D photo;
  uniform vec2 crop, pointer;
  uniform float hover;
  varying mediump vec2 photoUV;
  varying highp vec2 screen;
  varying mediump float light;
  ${ROOM_LIGHT_GLSL}
  void main() {
    vec2 focus = mix(vec2(.5), pointer, .32);
    vec2 sampleUV = (photoUV - focus) / (1. + .10 * hover) + focus;
    vec4 color = texture2D(photo, .5 + (sampleUV - .5) * crop);
    // Hover: a touch brighter, with cool white light gathering at the edges.
    vec2 border = min(photoUV, 1. - photoUV);
    float edge = 1. - smoothstep(0., .09, min(border.x, border.y / 2.1));
    vec3 lit = color.rgb * (1. + .05 * hover) + vec3(.86, .91, 1.) * edge * hover * .09;
    // Under the spotlight: full exposure, plus a soft sheen on the print that
    // slides across the surface as the light moves.
    float near = spotFalloff(screen);
    float sheen = pow(near, 5.) * .075;
    gl_FragColor = vec4((lit * roomLight(screen) + vec3(1., .99, .965) * sheen) * light, 1.);
  }`;

function buildMesh() {
  const points = [];
  const indices = [];
  const columns = 28, rows = 40;
  for (let y = 0; y <= rows; y++) {
    for (let x = 0; x <= columns; x++) {
      points.push(x / columns, y / rows);
      const i = y * (columns + 1) + x;
      if (x < columns && y < rows) indices.push(i, i + columns + 1, i + 1, i + 1, i + columns + 1, i + columns + 2);
    }
  }
  return { uv: new Float32Array(points), indices: new Uint16Array(indices) };
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
  gl.bufferData(gl.ARRAY_BUFFER, mesh.uv, gl.STATIC_DRAW);
  const uv = gl.getAttribLocation(program, 'uv');
  gl.enableVertexAttribArray(uv);
  gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 0, 0);
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
  const positions = new Float32Array(mesh.uv.length / 2 * 3);
  const vertices = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
  gl.bufferData(gl.ARRAY_BUFFER, positions.byteLength, gl.DYNAMIC_DRAW);
  const position = gl.getAttribLocation(program, 'positionLight');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);
  const u = Object.fromEntries('stage origin viewport pointer hover crop spot spotRadius'.split(' ')
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
    begin(width, offset, height, gutter, left = 0, top = 0) {
      const density = Math.min(devicePixelRatio, 1.5);
      const w = Math.max(1, Math.round(width * density));
      const h = Math.max(1, Math.round(height * density));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      canvas.style.top = offset + 'px';
      canvas.style.left = -gutter + 'px';
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u.stage, width, height);
      gl.uniform2f(u.origin, left - gutter, top + offset);
      gl.uniform2f(u.viewport, innerWidth, innerHeight);
      gl.uniform2f(u.spot, spot.x, spot.y);
      gl.uniform1f(u.spotRadius, spot.r);
    },
    paint(item, rect, project, top, gutter) {
      const texture = textureFor(item.image);
      if (!texture) return false;
      const aspect = rect.width / rect.height;
      const imageAspect = item.image.naturalWidth / item.image.naturalHeight;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform2f(u.crop, Math.min(1, aspect / imageAspect), Math.min(1, imageAspect / aspect));
      gl.uniform2f(u.pointer, item.x, item.y);
      gl.uniform1f(u.hover, item.hover);
      for (let i = 0, j = 0; i < mesh.uv.length; i += 2) {
        const point = project(rect.x + mesh.uv[i] * rect.width, rect.y + mesh.uv[i + 1] * rect.height);
        positions[j++] = point.x + gutter;
        positions[j++] = point.y - top;
        positions[j++] = point.light;
      }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
      gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
      return true;
    },
    dispose() {
      canvas.removeEventListener('webglcontextlost', onLost);
      textures.forEach(texture => gl.deleteTexture(texture));
      gl.deleteBuffer(buffer);
      gl.deleteBuffer(indexBuffer);
      gl.deleteBuffer(vertices);
      gl.deleteProgram(program);
      canvas.remove();
      if (!gl.isContextLost()) gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  };
}
