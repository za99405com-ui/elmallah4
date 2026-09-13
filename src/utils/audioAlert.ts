/**
 * Web Audio API based POS Sound Alert for New Orders
 * Runs natively in all browsers with zero external audio assets.
 */

class SoundAlertManager {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    try {
      const stored = localStorage.getItem('almallah_sound_muted');
      if (stored === 'true') {
        this.isMuted = true;
      }
    } catch {
      this.isMuted = false;
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public isSoundEnabled(): boolean {
    return !this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    try {
      localStorage.setItem('almallah_sound_muted', muted ? 'true' : 'false');
    } catch {
      // ignore
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public toggleSound(): boolean {
    this.setMuted(!this.isMuted);
    return !this.isMuted;
  }

  public init() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    } catch {
      // ignore
    }
  }

  public testSound() {
    this.playNewOrderAlert();
  }

  /**
   * Play a distinct 3-tone chime for newly incoming seafood orders
   */
  public playNewOrderAlert() {
    if (this.isMuted) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      // Note 1: E5 (659.25 Hz)
      this.playTone(659.25, now, 0.18, 0.35);
      // Note 2: G#5 (830.61 Hz)
      this.playTone(830.61, now + 0.15, 0.22, 0.4);
      // Note 3: B5 (987.77 Hz) - Bright finish
      this.playTone(987.77, now + 0.32, 0.45, 0.45);
      // Note 4: E6 (1318.51 Hz) - High chime
      this.playTone(1318.51, now + 0.5, 0.6, 0.3);
    } catch (err) {
      console.warn('Audio playback not permitted or supported yet:', err);
    }
  }

  private playTone(freq: number, startTime: number, duration: number, peakGain: number) {
    if (!this.audioCtx) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }
}

export const soundAlert = new SoundAlertManager();
