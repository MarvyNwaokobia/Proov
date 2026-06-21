type SoundType = 'silence' | 'rain' | 'forest' | 'waves' | 'cafe';

let ctx: AudioContext | null = null;
let activeNodes: AudioNode[] = [];
let activeSource: AudioBufferSourceNode | null = null;
let currentSound: SoundType = 'silence';

function getCtx(): AudioContext {
  if (!ctx || ctx.state === 'closed') ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function createNoise(ac: AudioContext, seconds = 4): AudioBuffer {
  const buf = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function loopNoise(ac: AudioContext): AudioBufferSourceNode {
  const src = ac.createBufferSource();
  src.buffer = createNoise(ac, 4);
  src.loop = true;
  return src;
}

function startRain(ac: AudioContext) {
  const src = loopNoise(ac);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 800;
  const gain = ac.createGain();
  gain.gain.value = 0.12;
  src.connect(lp).connect(gain).connect(ac.destination);
  src.start();
  activeSource = src;
  activeNodes.push(src, lp, gain);
}

function startForest(ac: AudioContext) {
  const src = loopNoise(ac);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1200;
  bp.Q.value = 0.5;
  const gain = ac.createGain();
  gain.gain.value = 0.08;
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.3;
  const lfoGain = ac.createGain();
  lfoGain.gain.value = 300;
  lfo.connect(lfoGain).connect(bp.frequency);
  lfo.start();
  src.connect(bp).connect(gain).connect(ac.destination);
  src.start();
  activeSource = src;
  activeNodes.push(src, bp, gain, lfo, lfoGain);
}

function startWaves(ac: AudioContext) {
  const src = loopNoise(ac);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 400;
  const gain = ac.createGain();
  gain.gain.value = 0.15;
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.08;
  const lfoGain = ac.createGain();
  lfoGain.gain.value = 0.12;
  lfo.connect(lfoGain).connect(gain.gain);
  lfo.start();
  src.connect(lp).connect(gain).connect(ac.destination);
  src.start();
  activeSource = src;
  activeNodes.push(src, lp, gain, lfo, lfoGain);
}

function startCafe(ac: AudioContext) {
  const src = loopNoise(ac);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2000;
  bp.Q.value = 0.3;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3000;
  const gain = ac.createGain();
  gain.gain.value = 0.06;
  src.connect(bp).connect(lp).connect(gain).connect(ac.destination);
  src.start();
  activeSource = src;
  activeNodes.push(src, bp, lp, gain);
}

export function playAmbient(sound: SoundType): void {
  stopAmbient();
  currentSound = sound;
  if (sound === 'silence') return;
  const ac = getCtx();
  switch (sound) {
    case 'rain': startRain(ac); break;
    case 'forest': startForest(ac); break;
    case 'waves': startWaves(ac); break;
    case 'cafe': startCafe(ac); break;
  }
}

export function stopAmbient(): void {
  if (activeSource) { try { activeSource.stop(); } catch {} }
  activeNodes.forEach(n => { try { n.disconnect(); } catch {} });
  activeNodes = [];
  activeSource = null;
  currentSound = 'silence';
}

export function getCurrentSound(): SoundType { return currentSound; }

export const AMBIENT_OPTIONS: { value: SoundType; label: string; emoji: string }[] = [
  { value: 'silence', label: 'Silent', emoji: '🔇' },
  { value: 'rain', label: 'Rain', emoji: '🌧' },
  { value: 'forest', label: 'Forest', emoji: '🌲' },
  { value: 'waves', label: 'Waves', emoji: '🌊' },
  { value: 'cafe', label: 'Café', emoji: '☕' },
];

export type { SoundType };
