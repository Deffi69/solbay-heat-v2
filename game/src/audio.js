// Synthesised sound: everything is WebAudio oscillators + noise, no audio files.
// Engine hum follows speed, sirens wail at wanted >= 2, a lazy synth groove plays in menus
// and while driving, and one-shots cover shots, hits, pickups and UI clicks.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.started = false;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      // Engine: sawtooth + lowpass, pitch tracks speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(lp).connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
      // Siren: two-tone triangle, LFO on frequency.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 720;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.7;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain).connect(this.sirenOsc.frequency);
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();
      lfo.start();
      this.started = true;
      this.startMusic();
    } catch { /* audio unavailable — game stays silent */ }
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }
  setEngine(speed01, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.08);
  }
  setSiren(on) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, this.ctx.currentTime, 0.2);
  }
  // Lazy sunset groove: Am – F – C – G arpeggios, soft triangle, low volume.
  startMusic() {
    if (this.musicTimer || !this.ctx) return;
    const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [130.8, 164.8, 196], [196, 246.9, 293.7]];
    const stepDur = 0.22;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const chord = chords[Math.floor(this.musicStep / 4) % chords.length];
      const note = chord[this.musicStep % 3];
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = note * 2;
      const g = this.ctx.createGain();
      const t = this.ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.045, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + stepDur);
      osc.connect(g).connect(this.master);
      osc.start(t); osc.stop(t + stepDur + 0.05);
      this.musicStep++;
    }, stepDur * 1000);
  }
  blip(freq, dur = 0.08, type = 'square', vol = 0.08) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type; osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  shot() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = 0.12;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(g).connect(this.master);
    src.start(t);
    this.blip(180, 0.06, 'sawtooth', 0.06);
  }
  chime() { this.blip(880, 0.1, 'sine', 0.1); setTimeout(() => this.blip(1320, 0.14, 'sine', 0.1), 90); }
  thud() { this.blip(70, 0.15, 'sine', 0.18); }
  click() { this.blip(660, 0.05, 'square', 0.05); }
}
