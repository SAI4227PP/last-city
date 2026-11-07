import { AudioManager } from '@/core/audio/AudioManager';
import { EventBus } from '@/core/events/EventBus';

export class HospitalAudio {
  private audioManager: AudioManager;
  private sfxUnsubscribe?: () => void;

  constructor() {
    this.audioManager = AudioManager.getInstance();
    this.audioManager.startAmbience('hospital');

    // Listen to global SFX bus requests
    this.sfxUnsubscribe = EventBus.getInstance().on('audio:play_sfx', ({ sound, volume }) => {
      this.playSound(sound, volume);
    });
  }

  public playSound(sound: string, volume: number = 1.0): void {
    this.audioManager.playSound(sound, volume);
  }

  public dispose(): void {
    if (this.sfxUnsubscribe) {
      this.sfxUnsubscribe();
    }
    this.audioManager.stopAmbience();
  }
}
