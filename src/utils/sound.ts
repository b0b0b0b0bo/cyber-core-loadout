/**
 * CYBER CORE - Web Audio API Procedural Sound Engine
 * No external audio files needed; generates high quality cyberpunk gothic SFX in real-time.
 */

export type ReloadSfxName = 'release' | 'drop' | 'seat' | 'slide' | 'pull' | 'slap' | 'flick' | 'shell' | 'pump' | 'hiss' | 'cylinder' | 'power';

class SoundController {
  private ctx: AudioContext | null = null;
  private ambientGain: GainNode | null = null;
  private isMuted: boolean = false;
  private ambientOsc: OscillatorNode | null = null;

  private initContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.ambientGain) {
      this.ambientGain.gain.value = muted ? 0 : 0.05;
    }
  }

  public toggleMute(): boolean {
    this.setMute(!this.isMuted);
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  // --- UI SOUNDS ---

  public playUiClick() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // AudioContext safe fail
    }
  }

  public playUiHover() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(2200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(2600, ctx.currentTime + 0.025);

      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.03);
    } catch {
      // safe
    }
  }

  public playScan() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.15);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, ctx.currentTime);
      filter.Q.value = 4;

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch {
      // safe
    }
  }

  // --- WEAPON & COMBAT SOUNDS ---

  public playHandgunShot() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;

      // Punchy transient
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);

      oscGain.gain.setValueAtTime(0.25, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      // Noise crackle
      const bufferSize = ctx.sampleRate * 0.15;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1000;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      osc.start(now);
      noise.start(now);
      osc.stop(now + 0.13);
      noise.stop(now + 0.16);
    } catch {
      // safe
    }
  }

  public playRifleShot() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.09);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // safe
    }
  }

  /** BUBBLAS: soft "bloop" as a bubble leaves the nozzle. */
  public playBubbleShot() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const f = 420 + Math.random() * 260;
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 2.1, now + 0.07);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // safe
    }
  }

  /** BUBBLAS: tiny "pop" when a bubble bursts. */
  public playBubblePop() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1500 + Math.random() * 500, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.035);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // safe
    }
  }

  /** SHR1NKER: rising whine while charging (progress 0..1), called a few times per second. */
  public playBeamCharge(progress: number) {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const f = 140 + progress * 520;
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * 1.12, now + 0.12);
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch {
      // safe
    }
  }

  /** SHR1NKER: low pulse while the beam is firing; thicker beams sound deeper. */
  public playBeamPulse(thickness: number) {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const f = 190 - thickness * 100;
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.7, now + 0.2);
      gain.gain.setValueAtTime(0.07 + thickness * 0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // safe
    }
  }

  public playShotgunBlast() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);

      oscGain.gain.setValueAtTime(0.35, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
    } catch {
      // safe
    }
  }

  public playHeavyLaunch() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.linearRampToValueAtTime(45, now + 0.35);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    } catch {
      // safe
    }
  }

  // --- BLADE ACTIONS & SPECIAL SWEEP ATTACK ---

  public playBladeSlash(step: number = 1) {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;
      const baseFreq = step === 1 ? 1600 : step === 2 ? 1800 : 2200;

      // Metallic high-frequency whoosh
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1600, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.16);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2400, now);
      filter.frequency.exponentialRampToValueAtTime(600, now + 0.16);
      filter.Q.value = 5;

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.19);
    } catch {
      // safe
    }
  }

  /**
   * 近接武器ごとの固有スイング音（居合・大振り・短剣・鎖槍・大鎌・重ハンマー・拳）
   */
  public playMeleeSwing(style: string, step: number = 1) {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;
      const out = ctx.destination;

      const tone = (type: OscillatorType, f0: number, f1: number, dur: number, vol: number, q = 0, bp = 0, delay = 0) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        const t0 = now + delay;
        osc.frequency.setValueAtTime(f0, t0);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        let node: AudioNode = osc;
        if (bp > 0) {
          const f = ctx.createBiquadFilter();
          f.type = 'bandpass';
          f.frequency.setValueAtTime(bp, t0);
          f.frequency.exponentialRampToValueAtTime(Math.max(80, bp * 0.35), t0 + dur);
          f.Q.value = q || 4;
          osc.connect(f);
          node = f;
        }
        node.connect(gain);
        gain.connect(out);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
      };

      const noise = (dur: number, vol: number, freq: number, q = 1, delay = 0, type: BiquadFilterType = 'bandpass') => {
        const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        const g = ctx.createGain();
        const t0 = now + delay;
        g.gain.setValueAtTime(vol, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        src.connect(f);
        f.connect(g);
        g.connect(out);
        src.start(t0);
      };

      switch (style) {
        case 'katana': // 鋭い「シャリン」：高域の金属音 + 風切り
          tone('sawtooth', 3200 + step * 300, 900, 0.1, 0.16, 8, 4200);
          tone('sine', 4800, 2600, 0.22, 0.07, 0, 0, 0.02);
          noise(0.09, 0.12, 6000, 2);
          if (step === 3) tone('square', 180, 60, 0.18, 0.12, 0, 0, 0.1);
          break;
        case 'glaive': // 重い風切り + 低い唸り
          noise(0.32, 0.2, 700, 0.9);
          tone('sawtooth', 420, 120, 0.3, 0.14, 3, 900);
          if (step === 3) tone('square', 120, 40, 0.3, 0.16, 0, 0, 0.18);
          break;
        case 'dagger': // 短く速い「ヒュッ」+ 位相のブリップ
          tone('triangle', 2600, 1200, 0.06, 0.14, 6, 3000);
          noise(0.05, 0.1, 5200, 3);
          tone('sine', 900 + step * 200, 2400, 0.08, 0.06, 0, 0, 0.03);
          break;
        case 'chainspear': // 鎖のジャラジャラ + 射出
          for (let i = 0; i < 5; i++) tone('square', 1500 + Math.random() * 900, 700, 0.03, 0.05, 0, 0, i * 0.035);
          tone('sawtooth', 600, 200, 0.2, 0.12, 4, 1500, 0.05);
          noise(0.18, 0.08, 2400, 1.2, 0.04);
          break;
        case 'scythe': // 空間を裂く低めの吹き上がる音
          tone('sawtooth', 220, 520, 0.2, 0.1, 3, 600);
          tone('sawtooth', 1100, 260, 0.34, 0.1, 5, 1400, 0.06);
          tone('sine', 140, 70, 0.3, 0.1, 0, 0, 0.04);
          noise(0.3, 0.1, 1200, 1.4, 0.04);
          break;
        case 'hammer': // 溜めの軋み → 重い衝撃
          tone('sawtooth', 160, 90, 0.2, 0.08, 2, 400);
          tone('sine', 90, 26, 0.5, 0.45, 0, 0, 0.18);
          noise(0.35, 0.3, 220, 0.8, 0.18, 'lowpass');
          tone('square', 500, 80, 0.12, 0.1, 0, 0, 0.18);
          break;
        case 'gauntlets': // 空気圧パンチ + 電撃のパチッ
          noise(0.08, 0.22, 900, 1.2);
          tone('sine', 220, 70, 0.14, 0.3);
          tone('sawtooth', 2400, 600, 0.08, 0.08, 6, 2800, 0.02);
          if (step >= 3) tone('sine', 110, 40, 0.3, 0.3, 0, 0, 0.04);
          break;
        case 'twinblade': // 二刀の澄んだ風切り + 星屑のきらめき
          tone('triangle', 3000 + step * 250, 1100, 0.09, 0.13, 6, 3600);
          noise(0.08, 0.1, 5400, 2.5);
          tone('sine', 5200, 3000, 0.16, 0.05, 0, 0, 0.03);
          if (step >= 3) {
            tone('sawtooth', 2200, 700, 0.14, 0.1, 4, 3000, 0.1);
            tone('sine', 140, 55, 0.22, 0.2, 0, 0, 0.1);
          }
          break;
        case 'anchor': // 重い風切り + 鎖のじゃらつき → 着水のような低い衝撃
          noise(0.2, 0.18, 700, 0.8);
          tone('square', 1700, 900, 0.06, 0.05, 0, 0, 0.02);
          tone('square', 1400, 800, 0.06, 0.05, 0, 0, 0.07);
          tone('sine', 85, 30, 0.35, step >= 3 ? 0.45 : 0.3, 0, 0, 0.12);
          if (step >= 3) noise(0.3, 0.22, 400, 0.7, 0.14, 'lowpass');
          break;
        case 'chainsaw': // 振り下ろしの風切り → 着地の衝撃
          noise(0.14, 0.16, 900, 1.0);
          tone('sine', 120, 45, 0.16, 0.25, 0, 0, 0.12);
          noise(0.12, 0.14, 3200, 2.5, 0.13);
          break;
        case 'lance': // 圧縮 → 射出
          tone('sine', 80, 40, 0.1, 0.1);
          tone('square', 600, 90, 0.18, 0.22, 0, 0, 0.1);
          noise(0.2, 0.2, 500, 0.8, 0.1, 'lowpass');
          break;
        case 'rapier': // 細い刺突音 + 氷の鈴鳴り
          tone('triangle', 4200, 2200, 0.05, 0.12, 8, 5000);
          noise(0.05, 0.1, 7000, 3);
          tone('sine', 5600 + step * 300, 4800, 0.22, 0.05, 0, 0, 0.03);
          tone('sine', 7800, 7000, 0.16, 0.03, 0, 0, 0.06);
          break;
        case 'whip': // しなる風切り → 先端の破裂音（クラック）+ 放電
          noise(0.18, 0.14, 1200, 0.9);
          tone('sawtooth', 300, 900, 0.16, 0.06, 3, 1200);
          noise(0.03, 0.5, 4500, 1.5, 0.16);
          tone('square', 2600, 800, 0.05, 0.12, 0, 0, 0.16);
          tone('sawtooth', 3000, 900, 0.1, 0.06, 6, 3600, 0.18);
          break;
        case 'disc': // 回転する刃の唸り（ドップラー気味に遠ざかる）
          tone('sawtooth', 900, 1500, 0.25, 0.07, 6, 1800);
          tone('sawtooth', 1500, 600, 0.3, 0.05, 6, 2000, 0.12);
          noise(0.25, 0.08, 3200, 2);
          break;
        default:
          this.playBladeSlash(step);
      }
    } catch {
      // safe
    }
  }

  public playBladeGuard() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;

      // Resonant energy shield clank
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(840, now);
      osc1.frequency.exponentialRampToValueAtTime(420, now + 0.22);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1260, now);
      osc2.frequency.exponentialRampToValueAtTime(630, now + 0.22);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.26);
      osc2.stop(now + 0.26);
    } catch {}
  }

  public playShieldBlock() {
    this.playBladeGuard();
  }

  public playHurt() {
    this.playPlayerHurt();
  }

  public playScrapPickup() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(980, now);
      osc.frequency.exponentialRampToValueAtTime(1480, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch {}
  }

  /**
   * SPECIAL ACTION: SWEEP ATTACK
   * Triggered when left clicking while guarding (Right click hold).
   * Generates a heavy, lunging resonant cleave with metallic slash and cyan sonic blast.
   */
  public playSweepAttack() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;

      // 1. Heavy power dash / low whoosh
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(260, now);
      subOsc.frequency.exponentialRampToValueAtTime(40, now + 0.35);

      subGain.gain.setValueAtTime(0.45, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      subOsc.connect(subGain);
      subGain.connect(ctx.destination);

      // 2. High-speed metallic shearing energy blade
      const slashOsc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const slashGain = ctx.createGain();

      slashOsc.type = 'sawtooth';
      slashOsc.frequency.setValueAtTime(2200, now);
      slashOsc.frequency.exponentialRampToValueAtTime(120, now + 0.28);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3200, now);
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.28);
      filter.Q.value = 6;

      slashGain.gain.setValueAtTime(0.4, now);
      slashGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      slashOsc.connect(filter);
      filter.connect(slashGain);
      slashGain.connect(ctx.destination);

      // 3. Cyber shockwave sonic crackle (cyan energy trail burst)
      const bufferSize = ctx.sampleRate * 0.25;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.08));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.value = 1800;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.3, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      subOsc.start(now);
      slashOsc.start(now);
      noise.start(now);

      subOsc.stop(now + 0.36);
      slashOsc.stop(now + 0.32);
      noise.stop(now + 0.28);
    } catch {
      // safe
    }
  }

  // --- RAVAGER-09 CHAINSAW ---

  private sawNoise: AudioBuffer | null = null;

  /** スターター: エンジンが吹け上がる音（振り下ろし開始 / RIPPER RUSH） */
  public playChainsawRev(overdrive = false) {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;
      const dur = overdrive ? 0.4 : 0.22;
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(55, now);
      osc.frequency.exponentialRampToValueAtTime(overdrive ? 240 : 150, now + dur);
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(600, now);
      lp.frequency.exponentialRampToValueAtTime(2400, now + dur);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(overdrive ? 0.22 : 0.15, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur + 0.05);
      osc.connect(lp);
      lp.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.06);
    } catch {
      // safe
    }
  }

  /**
   * 押し当て中に毎ティック鳴らすエンジン音（連続で鳴ることで唸りになる）。
   * rpm: 0..1 回転数 / hit: 刃が敵を削っているか（金属を削る甲高い音を重ねる）
   */
  public playChainsawTick(rpm: number, hit: boolean) {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;
      const out = ctx.destination;

      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      const f = 80 + 90 * rpm;
      osc.frequency.setValueAtTime(f * 1.06, now);
      osc.frequency.exponentialRampToValueAtTime(f, now + 0.08);
      lp.type = 'lowpass';
      lp.frequency.value = 900 + 1400 * rpm;
      g.gain.setValueAtTime(0.06 + 0.03 * rpm, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(lp);
      lp.connect(g);
      g.connect(out);
      osc.start(now);
      osc.stop(now + 0.11);

      if (hit) {
        if (!this.sawNoise) {
          const len = Math.floor(ctx.sampleRate * 0.08);
          this.sawNoise = ctx.createBuffer(1, len, ctx.sampleRate);
          const d = this.sawNoise.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        }
        const src = ctx.createBufferSource();
        src.buffer = this.sawNoise;
        src.playbackRate.value = 0.85 + Math.random() * 0.3;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2600 + Math.random() * 1600;
        bp.Q.value = 2.5;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.13, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        src.connect(bp);
        bp.connect(ng);
        ng.connect(out);
        src.start(now);
      }
    } catch {
      // safe
    }
  }

  // --- IMPACT & GENERAL COMBAT ---

  public playEnemyHit() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch {
      // safe
    }
  }

  public playEnemyExplode() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;

      // Heavy explosion boom
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(25, now + 0.4);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.42);
    } catch {
      // safe
    }
  }

  public playPlayerHurt() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.linearRampToValueAtTime(60, now + 0.18);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // safe
    }
  }

  public playDash() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.18);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // safe
    }
  }

  public playReload() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;

      // Click 1 (eject)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(1200, now);
      osc1.frequency.exponentialRampToValueAtTime(400, now + 0.05);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.06);

      // Click 2 (insert mag)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(500, now + 0.18);
      osc2.frequency.exponentialRampToValueAtTime(900, now + 0.24);
      gain2.gain.setValueAtTime(0.16, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.26);
    } catch {
      // safe
    }
  }

  /** ARCHON 9 reload, one mechanical sound per keyframe of the magazine swap. */
  public playPistolReloadStep(step: ReloadSfxName) {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;
      const click = (type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t0 = now + delay;
        osc.type = type;
        osc.frequency.setValueAtTime(f0, t0);
        osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.01);
      };
      const noise = (dur: number, vol: number, freq: number, q: number, delay = 0) => {
        const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = freq;
        f.Q.value = q;
        const g = ctx.createGain();
        g.gain.value = vol;
        src.connect(f);
        f.connect(g);
        g.connect(ctx.destination);
        src.start(now + delay);
      };

      switch (step) {
        case 'release': // small spring-loaded button click
          click('square', 2400, 1400, 0.025, 0.08);
          noise(0.03, 0.18, 4200, 3);
          break;
        case 'drop': // mag slipping out of the grip, light metallic rattle
          noise(0.08, 0.16, 2600, 1.5);
          click('triangle', 900, 500, 0.06, 0.07, 0.02);
          break;
        case 'seat': // solid "clack" of the mag locking in + palm thump
          noise(0.05, 0.32, 1800, 2.5);
          click('square', 700, 260, 0.06, 0.16);
          click('sine', 160, 70, 0.09, 0.2, 0.005);
          break;
        case 'slide': // slide slamming home + energy cell re-arming
          noise(0.06, 0.34, 3000, 2);
          click('square', 1100, 300, 0.07, 0.15);
          click('sine', 600, 1800, 0.18, 0.05, 0.05);
          break;
        case 'pull': // charging handle / slide pulled back: rising scrape against the spring
          noise(0.09, 0.22, 3400, 1.2);
          click('sawtooth', 380, 900, 0.08, 0.05);
          break;
        case 'slap': // palm slap on the base plate / receiver
          noise(0.04, 0.4, 900, 1.2);
          click('sine', 140, 60, 0.08, 0.26);
          break;
        case 'flick': // wrist flick / gun spin whoosh
          noise(0.16, 0.12, 1500, 0.7);
          click('sine', 300, 120, 0.14, 0.035);
          break;
        case 'shell': // shotgun shell thumbed into the tube
          noise(0.035, 0.26, 2200, 3);
          click('triangle', 820, 420, 0.04, 0.1, 0.01);
          break;
        case 'pump': // pump racked back and forward
          noise(0.06, 0.32, 1600, 1.6);
          click('square', 520, 200, 0.06, 0.14);
          noise(0.05, 0.36, 2400, 2, 0.09);
          click('square', 900, 320, 0.05, 0.14, 0.09);
          break;
        case 'hiss': // pressure vent of a heavy cell
          noise(0.32, 0.16, 5200, 0.6);
          click('sine', 900, 400, 0.25, 0.03);
          break;
        case 'cylinder': // revolver cylinder swinging out / snapping shut + ratchet
          noise(0.05, 0.28, 2800, 2.4);
          for (let i = 0; i < 4; i++) click('square', 2000, 1200, 0.012, 0.05, 0.03 + i * 0.025);
          break;
        case 'power': // energy weapon powering up after the reload
          click('sine', 220, 1400, 0.32, 0.06);
          click('triangle', 440, 2200, 0.28, 0.035, 0.04);
          break;
      }
    } catch {
      // safe
    }
  }

  /** short electric crackle (tesla sentry / saw grind) */
  public playZap() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * 0.07);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (Math.random() < 0.3 ? 1 : 0.2) * Math.pow(1 - i / len, 2);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 2200;
      const g = ctx.createGain();
      g.gain.value = 0.16;
      src.connect(f);
      f.connect(g);
      g.connect(ctx.destination);
      src.start(now);
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);
      og.gain.setValueAtTime(0.04, now);
      og.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(og);
      og.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch {
      // safe
    }
  }

  /** one burst of the flamethrower roar (called every few ticks while spraying) */
  public playFlameTick() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * 0.16);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900 + Math.random() * 300;
      const g = ctx.createGain();
      g.gain.value = 0.2;
      src.connect(f);
      f.connect(g);
      g.connect(ctx.destination);
      src.start(now);
    } catch {
      // safe
    }
  }

  public playUpgradeSuccess() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.50]; // C Major arpeggio
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const time = now + idx * 0.07;
        gain.gain.setValueAtTime(0.12, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.2);
      });
    } catch {
      // safe
    }
  }

  public playVictory() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;
      const chords = [
        { f: 440, t: 0 },
        { f: 554.37, t: 0.12 },
        { f: 659.25, t: 0.24 },
        { f: 880, t: 0.38 },
        { f: 1108.73, t: 0.52 },
      ];
      chords.forEach(({ f, t }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.18, now + t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + t);
        osc.stop(now + t + 0.5);
      });
    } catch {
      // safe
    }
  }

  public playJump() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(360, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch {
      // safe
    }
  }

  public playAimZoom() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.08);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch {
      // safe
    }
  }

  public playDefeat() {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(45, now + 0.8);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.9);
    } catch {
      // safe
    }
  }

  // --- AMBIENT SYNTH DRONE ---
  public startAmbient() {
    if (this.ambientOsc) return;
    try {
      const ctx = this.initContext();
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(55, ctx.currentTime); // Low A

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, ctx.currentTime);

      gain.gain.setValueAtTime(this.isMuted ? 0 : 0.04, ctx.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      this.ambientOsc = osc;
      this.ambientGain = gain;
    } catch {
      // safe
    }
  }
}

export const sound = new SoundController();
