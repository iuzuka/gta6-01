// Solmar Bay — synthesized sound: effects and a looping music bed, all made
// with WebAudio oscillators and noise. No audio files, no network. The engine
// is created lazily on the first user gesture (browsers require that) and
// every call is safe before it exists.

let ctx = null;
let master = null;
let musicGain = null;
let sirenNodes = null;
let engineNodes = null;
let musicTimer = null;
let musicOn = false;
let muted = false;

function ensure() {
  if (ctx) return true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
  } catch {
    return false;
  }
  return true;
}

export function audioInit() {
  if (!ensure()) return;
  if (ctx.state === 'suspended') ctx.resume();
}

export function audioToggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

function tone(freq, dur, type, vol, slideTo) {
  if (!ensure() || muted) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(dur, vol, lowpass) {
  if (!ensure() || muted) return;
  const t0 = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
}

export const sfx = {
  shot() { noiseBurst(0.12, 0.5, 2400); tone(180, 0.09, 'square', 0.18, 60); },
  punch() { noiseBurst(0.08, 0.35, 900); tone(120, 0.08, 'sine', 0.3, 70); },
  crash() { noiseBurst(0.3, 0.5, 700); tone(90, 0.25, 'sawtooth', 0.2, 40); },
  pickup() { tone(660, 0.09, 'sine', 0.25); setTimeout(() => tone(990, 0.12, 'sine', 0.25), 70); },
  buy() { tone(880, 0.08, 'triangle', 0.25); setTimeout(() => tone(1174, 0.1, 'triangle', 0.25), 80); setTimeout(() => tone(1568, 0.16, 'triangle', 0.25), 170); },
  noCash() { tone(160, 0.22, 'sawtooth', 0.2, 110); },
  mission() { tone(523, 0.14, 'triangle', 0.3); setTimeout(() => tone(659, 0.14, 'triangle', 0.3), 130); setTimeout(() => tone(784, 0.22, 'triangle', 0.3), 260); },
  fail() { tone(220, 0.25, 'sawtooth', 0.2, 110); },
  click() { tone(900, 0.04, 'square', 0.12); },
  door() { noiseBurst(0.06, 0.2, 1200); tone(300, 0.06, 'sine', 0.15, 180); },
  sirenBlip() { tone(900, 0.16, 'sine', 0.12, 1400); },
  skid() { noiseBurst(0.18, 0.12, 3000); },
};

export function sirenStart() {
  if (!ensure() || sirenNodes) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 700;
  g.gain.value = 0.05;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.7;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 350;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  osc.connect(g);
  g.connect(master);
  osc.start();
  lfo.start();
  sirenNodes = { osc, lfo, g };
}

export function sirenStop() {
  if (!sirenNodes) return;
  try { sirenNodes.osc.stop(); sirenNodes.lfo.stop(); } catch { /* already stopped */ }
  sirenNodes = null;
}

export function engineStart() {
  if (!ensure() || engineNodes) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = 55;
  g.gain.value = 0.0;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  osc.connect(filter);
  filter.connect(g);
  g.connect(master);
  osc.start();
  engineNodes = { osc, g };
}

export function engineSet(speedNorm, on) {
  if (!engineNodes) return;
  const t = ctx.currentTime;
  engineNodes.osc.frequency.setTargetAtTime(50 + speedNorm * 140, t, 0.08);
  engineNodes.g.gain.setTargetAtTime(on ? 0.05 + speedNorm * 0.05 : 0, t, 0.1);
}

export function engineStop() {
  if (!engineNodes) return;
  try { engineNodes.osc.stop(); } catch { /* already stopped */ }
  engineNodes = null;
}

// A laid-back synthwave loop: a bass line and a sparse lead over a hat tick.
// Scheduled bar by bar so it keeps time without drifting.
const BASS = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42]; // A1 A1 C2 G1 ...
const LEAD = [220, 0, 261.63, 0, 329.63, 0, 293.66, 246.94];

export function musicStart() {
  if (musicOn || !ensure()) return;
  musicOn = true;
  let step = 0;
  const stepDur = 0.24;
  const playStep = () => {
    if (!musicOn || !ctx) return;
    const t = ctx.currentTime + 0.05;
    const bass = BASS[step % BASS.length];
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = bass;
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.95);
    osc.connect(g);
    g.connect(musicGain);
    osc.start(t);
    osc.stop(t + stepDur);
    const lead = LEAD[step % LEAD.length];
    if (lead) {
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = 'sine';
      o2.frequency.value = lead;
      g2.gain.setValueAtTime(0.22, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 1.8);
      o2.connect(g2);
      g2.connect(musicGain);
      o2.start(t);
      o2.stop(t + stepDur * 2);
    }
    if (step % 2 === 0) {
      const len = Math.floor(ctx.sampleRate * 0.03);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hg = ctx.createGain();
      hg.gain.value = 0.08;
      src.connect(hg);
      hg.connect(musicGain);
      src.start(t);
    }
    step++;
    musicTimer = setTimeout(playStep, stepDur * 1000);
  };
  playStep();
}

export function musicStop() {
  musicOn = false;
  if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
}
