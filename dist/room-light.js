// Footprints lighting: the wall is dim, and a single soft spotlight travels
// with the visitor's pointer (on touch screens it rests above the heading and
// drifts). The photos, their cast shadows, the captions and the wall all read
// from this one light. Positions are viewport pixels.
export const AMBIENT = .44;     // brightness of a photo far from the light
export const PEAK = 1.05;       // under the centre of the light
export const spot = { x: innerWidth / 2, y: innerHeight * .2, r: 400 };

// Gaussian falloff: 1 at the centre, .25 at one radius, ~0 beyond two.
export const falloff = (x, y) => {
  const d = Math.hypot(x - spot.x, y - spot.y) / spot.r;
  return Math.exp(-d * d * 1.4);
};
export const lightAt = (x, y) => AMBIENT + (PEAK - AMBIENT) * falloff(x, y);

export const ROOM_LIGHT_GLSL = `
  uniform vec2 spot;
  uniform float spotRadius;
  float spotFalloff(vec2 p) { float d = length(p - spot) / spotRadius; return exp(-d * d * 1.4); }
  float roomLight(vec2 p) { return mix(${AMBIENT.toFixed(3)}, ${PEAK.toFixed(3)}, spotFalloff(p)); }`;
