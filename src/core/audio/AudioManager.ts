import { AudioSettings } from '@/shared/types';
import { Logger } from '@/core/utils/Logger';

export class AudioManager {
  private static instance: AudioManager | null = null;
  private audioCtx: AudioContext | null = null;
  private settings: AudioSettings = {
    masterVolume: 0.8,
    musicVolume: 0.6,
    sfxVolume: 0.8,
    muted: false
  };

  private ambientOsc: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private isAmbiencePlaying: boolean = false;

  private constructor() {}

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public init(): void {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
        Logger.info('Web Audio Context created.');
      }
    }
  }

  public resumeContext(): void {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public suspendContext(): void {
    if (this.audioCtx && this.audioCtx.state === 'running') {
      this.audioCtx.suspend();
    }
  }

  public setSettings(settings: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...settings };
    if (this.ambientGain && this.audioCtx) {
      const vol = this.settings.muted ? 0 : this.settings.masterVolume * this.settings.musicVolume * 0.15;
      this.ambientGain.gain.setValueAtTime(vol, this.audioCtx.currentTime);
    }
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  // Procedural Sound Effects
  public playSound(sound: string, volumeScale: number = 1.0): void {
    if (this.settings.muted || !this.audioCtx) return;
    this.resumeContext();

    const t = this.audioCtx.currentTime;
    const finalVolume = this.settings.masterVolume * this.settings.sfxVolume * volumeScale;

    switch (sound) {
      case 'gunshot_pistol':
        this.synthesizeGunshot(t, finalVolume, 0.15, 450, 40);
        break;
      case 'gunshot_shotgun':
        this.synthesizeGunshot(t, finalVolume * 1.3, 0.35, 280, 25);
        break;
      case 'gunshot_rifle':
        this.synthesizeGunshot(t, finalVolume * 0.9, 0.12, 600, 50);
        break;
      case 'reload':
        this.synthesizeClick(t, finalVolume * 0.7, 800, 0.05);
        setTimeout(() => {
          if (this.audioCtx) this.synthesizeClick(this.audioCtx.currentTime, finalVolume * 0.8, 1200, 0.06);
        }, 250);
        break;
      case 'melee_swing':
        this.synthesizeWhoosh(t, finalVolume * 0.6);
        break;
      case 'melee_hit':
        this.synthesizeThud(t, finalVolume);
        break;
      case 'zombie_groan':
        this.synthesizeZombieGroan(t, finalVolume * 0.7);
        break;
      case 'zombie_attack':
        this.synthesizeZombieScreech(t, finalVolume * 0.9);
        break;
      case 'zombie_death':
        this.synthesizeZombieGroan(t, finalVolume * 0.8, true);
        break;
      case 'footstep':
        this.synthesizeFootstep(t, finalVolume * 0.25);
        break;
      case 'pickup':
        this.synthesizePickup(t, finalVolume * 0.7);
        break;
      case 'heartbeat':
        this.synthesizeHeartbeat(t, finalVolume);
        break;
      case 'door_open':
        this.synthesizeDoor(t, finalVolume * 0.7);
        break;
      case 'siren':
        this.synthesizeSiren(t, finalVolume * 0.5);
        break;
      default:
        this.synthesizeClick(t, finalVolume * 0.5, 600, 0.04);
        break;
    }
  }

  public startAmbience(type: 'hospital' | 'city' | 'eerie'): void {
    if (!this.audioCtx || this.isAmbiencePlaying) return;
    this.resumeContext();

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const filter = this.audioCtx.createBiquadFilter();

      osc.type = type === 'hospital' ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(type === 'hospital' ? 55 : 42, this.audioCtx.currentTime); // Low sub drone

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(type === 'hospital' ? 220 : 180, this.audioCtx.currentTime);

      const targetVol = this.settings.muted ? 0 : this.settings.masterVolume * this.settings.musicVolume * 0.12;
      gain.gain.setValueAtTime(targetVol, this.audioCtx.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      this.ambientOsc = osc;
      this.ambientGain = gain;
      this.isAmbiencePlaying = true;
    } catch (e) {
      Logger.warn('Ambience audio start ignored:', e);
    }
  }

  public stopAmbience(): void {
    if (this.ambientOsc) {
      try {
        this.ambientOsc.stop();
        this.ambientOsc.disconnect();
      } catch (_) {}
      this.ambientOsc = null;
      this.ambientGain = null;
      this.isAmbiencePlaying = false;
    }
  }

  // Procedural Sound Synthesizers
  private synthesizeGunshot(t: number, vol: number, dur: number, startFreq: number, endFreq: number): void {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  private synthesizeWhoosh(t: number, vol: number): void {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.linearRampToValueAtTime(260, t + 0.08);
    osc.frequency.linearRampToValueAtTime(90, t + 0.18);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  private synthesizeThud(t: number, vol: number): void {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.15);

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  private synthesizeZombieGroan(t: number, vol: number, isDeath: boolean = false): void {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sawtooth';
    const dur = isDeath ? 0.8 : 0.6;
    osc.frequency.setValueAtTime(isDeath ? 90 : 75, t);
    osc.frequency.exponentialRampToValueAtTime(isDeath ? 35 : 50, t + dur);

    gain.gain.setValueAtTime(vol * 0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  private synthesizeZombieScreech(t: number, vol: number): void {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.linearRampToValueAtTime(240, t + 0.15);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.4);

    gain.gain.setValueAtTime(vol * 0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  private synthesizeFootstep(t: number, vol: number): void {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.05);

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  private synthesizePickup(t: number, vol: number): void {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, t); // C5
    osc.frequency.setValueAtTime(659.25, t + 0.08); // E5
    osc.frequency.setValueAtTime(783.99, t + 0.16); // G5

    gain.gain.setValueAtTime(vol * 0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  private synthesizeHeartbeat(t: number, vol: number): void {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(55, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.12);

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  private synthesizeDoor(t: number, vol: number): void {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.linearRampToValueAtTime(60, t + 0.4);

    gain.gain.setValueAtTime(vol * 0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  private synthesizeSiren(t: number, vol: number): void {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.linearRampToValueAtTime(900, t + 0.5);
    osc.frequency.linearRampToValueAtTime(600, t + 1.0);

    gain.gain.setValueAtTime(vol * 0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(t);
    osc.stop(t + 1.2);
  }

  private synthesizeClick(t: number, vol: number, freq: number, dur: number): void {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }
}
