type Mood = 'menu' | 'lobby' | 'game' | 'danger' | 'result';
type Wave = OscillatorType;

const NOTES = {
  C3: 130.81, F3: 174.61, G3: 196, Ab3: 207.65, A3: 220, Bb3: 233.08,
  C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23,
  G4: 392, Ab4: 415.3, A4: 440, Bb4: 466.16, C5: 523.25, D5: 587.33,
  E5: 659.25, G5: 783.99,
};

class PixelAudioSystem {
  private context: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmTimer = 0;
  private bgmStep = 0;
  private bgmIntroPlayed = false;
  private mood: Mood = 'menu';
  private muted = localStorage.getItem('intalk-muted') === 'true';
  private musicVolume = this.savedVolume('intalk-bgm-volume', 0.8);
  private effectsVolume = this.savedVolume('intalk-sfx-volume', 0.85);

  private savedVolume(key: string, fallback: number) {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    const value = Number(stored);
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
  }

  unlock() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.context = new AudioContextClass();
      this.musicGain = this.context.createGain();
      this.sfxGain = this.context.createGain();
      this.musicGain.connect(this.context.destination);
      this.sfxGain.connect(this.context.destination);
      this.applyVolume();
      this.startBgm();
    }
    const playIntro = () => {
      if (this.bgmIntroPlayed || this.muted) return;
      this.bgmIntroPlayed = true;
      [NOTES.C4, NOTES.E4, NOTES.G4].forEach((note, index) => this.musicTone(note, 0.28, 0.16 - index * 0.025, index === 1 ? 'triangle' : 'square'));
    };
    if (this.context.state === 'suspended') void this.context.resume().then(playIntro);
    else playIntro();
  }

  isMuted() { return this.muted; }

  getSettings() {
    return { muted: this.muted, musicVolume: this.musicVolume, effectsVolume: this.effectsVolume };
  }

  setMusicVolume(value: number) {
    this.musicVolume = Math.min(1, Math.max(0, value));
    localStorage.setItem('intalk-bgm-volume', String(this.musicVolume));
    this.applyVolume();
  }

  setEffectsVolume(value: number) {
    this.effectsVolume = Math.min(1, Math.max(0, value));
    localStorage.setItem('intalk-sfx-volume', String(this.effectsVolume));
    this.applyVolume();
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('intalk-muted', String(this.muted));
    this.applyVolume();
    if (!this.muted) { this.unlock(); this.uiConfirm(); }
    return this.muted;
  }

  setMood(mood: Mood) {
    if (this.mood === mood) return;
    this.mood = mood;
    this.bgmStep = 0;
  }

  private applyVolume() {
    if (!this.context || !this.musicGain || !this.sfxGain) return;
    const now = this.context.currentTime;
    this.musicGain.gain.setTargetAtTime(this.muted ? 0 : 0.25 * this.musicVolume, now, 0.025);
    this.sfxGain.gain.setTargetAtTime(this.muted ? 0 : 0.5 * this.effectsVolume, now, 0.015);
  }

  private tone(frequency: number, duration = 0.08, delay = 0, volume = 0.12, wave: Wave = 'square', endFrequency?: number) {
    if (!this.context || !this.sfxGain || this.muted) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.sfxGain);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  private musicTone(frequency: number, duration: number, volume: number, wave: Wave = 'square') {
    if (!this.context || !this.musicGain || this.muted) return;
    const start = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.musicGain);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  private startBgm() {
    if (this.bgmTimer) return;
    const menu: Array<number | null> = [
      NOTES.C4, null, NOTES.E4, null, NOTES.G4, null, NOTES.E4, null,
      NOTES.A3, null, NOTES.E4, null, NOTES.G4, null, NOTES.D4, null,
    ];
    const game: Array<number | null> = [
      NOTES.C4, NOTES.Eb4, NOTES.G4, NOTES.C5, NOTES.Bb4, NOTES.G4, NOTES.Eb4, NOTES.F4,
      NOTES.C4, NOTES.Eb4, NOTES.Ab4, NOTES.G4, NOTES.F4, NOTES.Eb4, NOTES.Bb3, NOTES.G4,
    ];
    const result: Array<number | null> = [NOTES.C4, NOTES.E4, NOTES.G4, NOTES.C5, NOTES.G4, NOTES.E5, NOTES.D5, NOTES.G4];
    this.bgmTimer = window.setInterval(() => {
      if (document.hidden || !this.context || this.context.state !== 'running') return;
      const isGame = this.mood === 'game' || this.mood === 'danger';
      const melody = this.mood === 'result' ? result : isGame ? game : menu;
      const note = melody[this.bgmStep % melody.length];
      if (note) this.musicTone(note * (this.mood === 'danger' && this.bgmStep % 2 ? 2 : 1), isGame ? 0.14 : 0.24, this.mood === 'danger' ? 0.16 : isGame ? 0.12 : 0.105, isGame ? 'square' : 'triangle');
      if (isGame && this.bgmStep % 2 === 0) {
        const gameBass = [NOTES.C3, NOTES.C3, NOTES.Ab3, NOTES.Bb3];
        this.musicTone(gameBass[Math.floor(this.bgmStep / 4) % gameBass.length], 0.16, 0.13, 'sawtooth');
      } else if (!isGame && this.bgmStep % 8 === 0) {
        this.musicTone(this.bgmStep % 16 ? NOTES.G3 : NOTES.C3, 0.38, 0.08, 'sine');
      }
      if (isGame && this.bgmStep % 4 === 2) this.musicTone(NOTES.F3, 0.055, 0.07, 'square');
      if (this.mood === 'danger') this.musicTone(90, 0.04, 0.075, 'square');
      this.bgmStep += 1;
    }, 210);
  }

  uiHover() { this.tone(740, 0.025, 0, 0.045); }
  uiClick() { this.tone(420, 0.035, 0, 0.08); this.tone(620, 0.045, 0.028, 0.06); }
  uiConfirm() { this.tone(523, 0.05, 0, 0.08); this.tone(784, 0.08, 0.045, 0.07); }
  countdown(final = false) { this.tone(final ? 440 : 240, 0.09, 0, 0.1); }
  start() { [523, 659, 784, 1046].forEach((note, index) => this.tone(note, 0.12, index * 0.055, 0.09)); }
  correct(combo = 0) {
    const lift = Math.min(combo, 10) * 18;
    this.tone(660 + lift, 0.06, 0, 0.1);
    this.tone(880 + lift, 0.09, 0.055, 0.075);
    if (combo >= 5) this.tone(1320, 0.08, 0.11, 0.06, 'triangle');
  }
  wrong() { this.tone(180, 0.16, 0, 0.12, 'sawtooth', 85); }
  submit() { this.tone(260, 0.045, 0, 0.08); this.tone(390, 0.07, 0.04, 0.08); }
  timeout() { [220, 185, 145].forEach((note, index) => this.tone(note, 0.18, index * 0.12, 0.1, 'sawtooth')); }
  matchFound() { [392, 523, 659, 784].forEach((note, index) => this.tone(note, 0.11, index * 0.075, 0.085)); }
  result(success: boolean) {
    const notes = success ? [523, 659, 784, 1046] : [330, 277, 220, 165];
    notes.forEach((note, index) => this.tone(note, 0.2, index * 0.12, 0.1, success ? 'square' : 'triangle'));
  }
}

export const audioSystem = new PixelAudioSystem();
