import { TextureType } from './types';

// Pentatonic C major scale frequencies for joyful ascending Perfect chimes
const PENTATONIC_NOTES = [
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.0,  // A5
  1046.5, // C6
  1174.66,// D6
  1318.51,// E6
];

// Cozy café jazz chord progression: Cmaj7 -> Am7 -> Dm9 -> G13 -> Em7 -> A7 -> Dm9 -> G7sus4
const JAZZ_CHORDS: number[][] = [
  [261.63, 329.63, 392.0, 493.88], // Cmaj7
  [220.0, 261.63, 329.63, 392.0],  // Am7
  [293.66, 349.23, 440.0, 523.25], // Dm7/9
  [246.94, 329.63, 392.0, 440.0],  // G13 voicing
  [246.94, 293.66, 392.0, 493.88], // Em7
  [220.0, 277.18, 329.63, 392.0],  // A7
  [293.66, 349.23, 440.0, 523.25], // Dm7
  [246.94, 293.66, 392.0, 440.0],  // G7sus
];

// Playful light marimba melody over the 16 eighth-note steps per bar (2 bars = 32 steps, or 8 chords * 8 steps)
const MARIMBA_PATTERN: (number | null)[] = [
  659.25, null, 783.99, 880.0, null, 783.99, 659.25, null,
  587.33, null, 659.25, 783.99, null, 659.25, 523.25, null,
  587.33, 659.25, 698.46, null, 880.0, null, 783.99, 659.25,
  587.33, null, 523.25, 587.33, 659.25, null, 523.25, null,
];

export class BakeryAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private muted = false;
  private bgmPlaying = false;
  private schedulerId: number | null = null;
  private nextNoteTime = 0;
  private currentStep = 0;

  // 108 BPM gentle café swing/bossa feel -> eighth note = ~0.277s
  private readonly stepDuration = 0.275;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.bgmGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.masterGain.gain.value = this.muted ? 0 : 0.85;
      this.bgmGain.gain.value = 0.34;
      this.sfxGain.gain.value = 0.85;

      this.bgmGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  public unlock() {
    this.ensureContext();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.85, now, 0.03);
    }
  }

  public startBgm() {
    const ctx = this.ensureContext();
    if (!ctx || this.bgmPlaying) return;

    this.bgmPlaying = true;
    this.nextNoteTime = ctx.currentTime + 0.06;
    if (this.bgmGain) {
      this.bgmGain.gain.cancelScheduledValues(ctx.currentTime);
      this.bgmGain.gain.setTargetAtTime(0.34, ctx.currentTime, 0.08);
    }

    this.schedulerId = window.setInterval(() => {
      this.scheduleAhead();
    }, 35);
  }

  public pauseBgm() {
    if (!this.bgmPlaying) return;
    this.bgmPlaying = false;
    if (this.schedulerId !== null) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
    if (this.ctx && this.bgmGain) {
      const now = this.ctx.currentTime;
      this.bgmGain.gain.cancelScheduledValues(now);
      this.bgmGain.gain.setTargetAtTime(0.0001, now, 0.06);
    }
  }

  public resetBgmPosition() {
    this.currentStep = 0;
  }

  private scheduleAhead() {
    if (!this.ctx || !this.bgmPlaying) return;
    const lookahead = 0.14;
    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
      this.scheduleStep(this.currentStep, this.nextNoteTime);
      // Slight gentle bossa swing on odd steps
      const swing = this.currentStep % 2 === 0 ? 1.04 : 0.96;
      this.nextNoteTime += this.stepDuration * swing;
      this.currentStep = (this.currentStep + 1) % 64;
    }
  }

  private scheduleStep(step: number, time: number) {
    if (!this.ctx || !this.bgmGain) return;

    // Warm jazz piano chord on every 8 steps (bar start) + soft syncopated comp on step % 8 === 3
    const chordIdx = Math.floor(step / 8) % JAZZ_CHORDS.length;
    const stepInBar = step % 8;

    if (stepInBar === 0) {
      this.triggerPianoChord(JAZZ_CHORDS[chordIdx], time, 1.5, 0.18);
      // Warm upright bass root note
      this.triggerBassNote(JAZZ_CHORDS[chordIdx][0] * 0.5, time, 0.55);
    } else if (stepInBar === 3) {
      this.triggerPianoChord(JAZZ_CHORDS[chordIdx], time, 0.45, 0.1);
    } else if (stepInBar === 4) {
      // Fifth bass bounce
      this.triggerBassNote(JAZZ_CHORDS[chordIdx][2] * 0.5, time, 0.35);
    }

    // Marimba café melody
    const melodyFreq = MARIMBA_PATTERN[step % MARIMBA_PATTERN.length];
    if (melodyFreq) {
      this.triggerMarimbaNote(melodyFreq, time, 0.24);
    }

    // Subtle café brush shaker on eighth notes
    if (step % 2 === 1) {
      this.triggerBrushShaker(time, 0.035);
    } else if (stepInBar === 0) {
      this.triggerBrushShaker(time, 0.055);
    }
  }

  private triggerPianoChord(
    freqs: number[],
    time: number,
    duration: number,
    volume: number
  ) {
    if (!this.ctx || !this.bgmGain) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1350, time);

    const chordGain = this.ctx.createGain();
    chordGain.gain.setValueAtTime(0.0001, time);
    chordGain.gain.linearRampToValueAtTime(volume, time + 0.03);
    chordGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    filter.connect(chordGain);
    chordGain.connect(this.bgmGain);

    for (let i = 0; i < freqs.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = i % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freqs[i], time);
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + duration + 0.05);
    }
  }

  private triggerMarimbaNote(freq: number, time: number, volume: number) {
    if (!this.ctx || !this.bgmGain) return;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    // Wooden mallet 4x overtone click
    const overtone = this.ctx.createOscillator();
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(freq * 3.98, time);

    const mainGain = this.ctx.createGain();
    mainGain.gain.setValueAtTime(0.0001, time);
    mainGain.gain.linearRampToValueAtTime(volume, time + 0.006);
    mainGain.gain.exponentialRampToValueAtTime(0.0008, time + 0.34);

    const overGain = this.ctx.createGain();
    overGain.gain.setValueAtTime(0.0001, time);
    overGain.gain.linearRampToValueAtTime(volume * 0.25, time + 0.003);
    overGain.gain.exponentialRampToValueAtTime(0.0005, time + 0.045);

    osc.connect(mainGain);
    overtone.connect(overGain);
    mainGain.connect(this.bgmGain);
    overGain.connect(this.bgmGain);

    osc.start(time);
    overtone.start(time);
    osc.stop(time + 0.36);
    overtone.stop(time + 0.06);
  }

  private triggerBassNote(freq: number, time: number, duration: number) {
    if (!this.ctx || !this.bgmGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(360, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.2, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGain);

    osc.start(time);
    osc.stop(time + duration + 0.04);
  }

  private triggerBrushShaker(time: number, volume: number) {
    if (!this.ctx || !this.bgmGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(5200, time);
    filter.Q.setValueAtTime(1.8, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0005, time + 0.055);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGain);

    src.start(time);
    src.stop(time + 0.07);
  }

  // --- Gameplay Sound Effects ---

  public playRelease() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    // Gentle string snip + downward whoosh
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.14);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playLand(texture: TextureType, isPerfect: boolean, combo: number) {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    // Soft spongy cake thud
    const thud = ctx.createOscillator();
    thud.type = 'sine';
    const baseFreq = texture === 'jelly' ? 210 : texture === 'fruit' ? 185 : 155;
    thud.frequency.setValueAtTime(baseFreq, now);
    thud.frequency.exponentialRampToValueAtTime(68, now + 0.13);

    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(0.001, now);
    thudGain.gain.linearRampToValueAtTime(0.36, now + 0.008);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    thud.connect(thudGain);
    thudGain.connect(this.sfxGain);
    thud.start(now);
    thud.stop(now + 0.16);

    // Jelly wobble shimmer for passionfruit & lychee jelly layers
    if (texture === 'jelly') {
      const wobble = ctx.createOscillator();
      wobble.type = 'triangle';
      wobble.frequency.setValueAtTime(420, now + 0.01);
      wobble.frequency.linearRampToValueAtTime(510, now + 0.08);
      wobble.frequency.linearRampToValueAtTime(460, now + 0.16);

      const wGain = ctx.createGain();
      wGain.gain.setValueAtTime(0.001, now + 0.01);
      wGain.gain.linearRampToValueAtTime(0.14, now + 0.03);
      wGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      wobble.connect(wGain);
      wGain.connect(this.sfxGain);
      wobble.start(now + 0.01);
      wobble.stop(now + 0.19);
    }

    // Perfect alignment ascending marimba/bell chime
    if (isPerfect) {
      const noteFreq =
        PENTATONIC_NOTES[Math.min(combo - 1, PENTATONIC_NOTES.length - 1)] ??
        PENTATONIC_NOTES[0];

      const chime = ctx.createOscillator();
      chime.type = 'sine';
      chime.frequency.setValueAtTime(noteFreq, now);

      const harmonic = ctx.createOscillator();
      harmonic.type = 'triangle';
      harmonic.frequency.setValueAtTime(noteFreq * 2, now);

      const cGain = ctx.createGain();
      cGain.gain.setValueAtTime(0.001, now);
      cGain.gain.linearRampToValueAtTime(0.32, now + 0.01);
      cGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.45);

      const hGain = ctx.createGain();
      hGain.gain.setValueAtTime(0.001, now);
      hGain.gain.linearRampToValueAtTime(0.12, now + 0.008);
      hGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.25);

      chime.connect(cGain);
      harmonic.connect(hGain);
      cGain.connect(this.sfxGain);
      hGain.connect(this.sfxGain);

      chime.start(now);
      harmonic.start(now);
      chime.stop(now + 0.47);
      harmonic.stop(now + 0.27);
    }
  }

  public playSlice() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    // Crisp pastry-cutter swoosh
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3200, now);
    filter.frequency.exponentialRampToValueAtTime(1100, now + 0.12);
    filter.Q.setValueAtTime(2.5, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.26, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now);
    src.stop(now + 0.14);
  }

  public playWidthRecover() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const notes = [659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const t = now + i * 0.055;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.28);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playShieldBlock() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    // Protective resonant shield chord + upward shimmer
    const freqs = [392.0, 523.25, 783.99];
    freqs.forEach((freq, i) => {
      const t = now + i * 0.035;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.12, t + 0.22);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.24, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.34);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  public playGameOver() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const notes = [440, 392, 329.63, 261.63];
    notes.forEach((freq, i) => {
      const t = now + i * 0.095;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public dispose() {
    this.pauseBgm();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
