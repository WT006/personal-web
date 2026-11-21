// Synthesised film advance, modelled on a measured reference clip.
// Everything lives between ~2kHz and 16kHz (no low thump): each sound is a very
// fast transient that drops ~10dB within 10–40ms, followed by a dry, gritty
// tail around -15dB that hangs on for 150–200ms.
//
// Timeline, from the moment the strip is yanked (T = travel time, ~0.3s):
//   0      咔  claw catches              (0.6)
//   .1     哒  claw bites, loudest        (1.0)
//   .14    唰  film drags through the gate, tail runs to the stop
//   T      嗒  frame registers in the gate (0.66, with a small echo click)
// The real recording (assets/film-advance.m4a) is preferred; the synthesis
// below is the fallback and follows the same timeline (ms after the click):
//   22 咔 · 292 唰 begins · 354 heavy hit · 732 嗒 (loudest) · 824 echo
export const TIMELINE = { catch: 22, pull: 292, yank: 354, stop: 732, echo: 824 };
const CLIP_URL = new URL('./assets/film-advance.m4a', import.meta.url);
const CLIP_LEAD = .15;      // leading silence trimmed from the recording (s)
const CLIP_LEVEL = .5;
let clip, clipGain;
// Decode without an AudioContext so nothing waits on the first user gesture.
const clipReady = (async () => {
  try {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const response = await fetch(CLIP_URL);
    if (!OAC || !response.ok) return;
    const data = await response.arrayBuffer();
    clip = await new OAC(1, 1, 44100).decodeAudioData(data);
  } catch {}
})();

const KEY = 'film-sound';
const LEVEL = .2;
let ctx, master, noise, grit;

export { clipReady };

export const sound = {
  get enabled() {
    try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
  },
  set enabled(on) {
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch {}
    if (master) master.gain.value = on ? LEVEL : 0;
    if (clipGain) clipGain.gain.value = on ? CLIP_LEVEL : 0;
  },
  // Play one frame advance. `from` (s) skips into the timeline, e.g. when a
  // drag hands over mid-pull.
  advance(from = 0) {
    if (!this.enabled || !setup()) return;
    if (clip) {
      const source = ctx.createBufferSource();
      source.buffer = clip;
      source.connect(clipGain);
      source.start(ctx.currentTime + .002, CLIP_LEAD + from);
      return;
    }
    const T = TIMELINE, t = ctx.currentTime + .005 - from;
    const at = ms => t + ms / 1000;
    if (from <= T.catch / 1000) hit(at(T.catch), { level: .45, fall: .03, tail: .2, hold: .1 });
    hit(Math.max(t + from, at(T.pull)), { level: .35, fall: .04, tail: .35, hold: .06 });
    hit(Math.max(t + from, at(T.yank)), { level: .85, fall: .012, tail: .25, hold: .3 });
    hit(at(T.stop), { level: 1, fall: .02, tail: .18, hold: .1 });
    hit(at(T.echo), { level: .22, fall: .012, tail: .12, hold: .05 });
  },
  // Create the audio engine ahead of time (it costs ~100ms the first time).
  prime() {
    if (this.enabled) setup();
  },
  // A cover from the wall settling into the gate.
  settle() {
    if (!this.enabled || !setup()) return;
    hit(ctx.currentTime + .005, { level: .5, fall: .022, tail: .16, hold: .1 });
  },
  // Drag released without advancing: a single light catch.
  nudge() {
    if (!this.enabled || !setup()) return;
    hit(ctx.currentTime + .005, { level: .45, fall: .02, tail: .14, hold: .08 });
  }
};

function setup() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = LEVEL;
    clipGain = ctx.createGain();
    clipGain.gain.value = CLIP_LEVEL;
    clipGain.connect(ctx.destination);
    // Shared tone shaping: steep cut below ~2kHz, gentle roll-off at the top.
    let node = master;
    for (const [type, freq] of [['highpass', 2100], ['highpass', 2100], ['lowpass', 5800], ['lowpass', 8000]]) {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = .7;
      node.connect(f);
      node = f;
    }
    node.connect(ctx.destination);
    const length = ctx.sampleRate;
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    grit = ctx.createBuffer(1, length, ctx.sampleRate);
    const white = noise.getChannelData(0), rough = grit.getChannelData(0);
    // Grit: loudness jumps every ~1ms so the tail sounds dry and scratchy.
    const block = Math.round(ctx.sampleRate * .001);
    let amp = 1;
    for (let i = 0; i < length; i++) {
      white[i] = Math.random() * 2 - 1;
      if (i % block === 0) amp = Math.random() < .12 ? 1 : .15 + Math.random() * .45;
      rough[i] = white[i] * amp;
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return true;
}

// level: peak; fall: time to drop 10dB; tail: tail level relative to peak;
// hold: how long the tail lingers before fading out.
function hit(t, { level, fall, tail, hold }) {
  const click = ctx.createBufferSource();
  click.buffer = noise;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(level, t + .0015);
  env.gain.setTargetAtTime(0, t + .0015, fall / 1.15);
  click.connect(env).connect(master);
  click.start(t, Math.random() * .8, fall * 6);

  const rasp = ctx.createBufferSource();
  rasp.buffer = grit;
  const shape = ctx.createBiquadFilter();
  shape.type = 'bandpass';
  shape.frequency.setValueAtTime(4600, t);
  shape.frequency.exponentialRampToValueAtTime(3200, t + hold + .08);
  shape.Q.value = .45;
  const tenv = ctx.createGain();
  const g = level * tail * 2.2;          // grit is sparse, so lift it to match
  tenv.gain.setValueAtTime(0, t);
  tenv.gain.linearRampToValueAtTime(g, t + fall * .6);
  tenv.gain.linearRampToValueAtTime(g * .6, t + hold);
  tenv.gain.setTargetAtTime(0, t + hold, .03);
  rasp.connect(shape).connect(tenv).connect(master);
  rasp.start(t, Math.random() * .7, hold + .2);
}
