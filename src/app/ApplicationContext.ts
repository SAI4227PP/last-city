import { GameEngine } from '@/core/engine/GameEngine';
import { UIManager } from '@/ui/UIManager';
import { AudioManager } from '@/core/audio/AudioManager';
import { SaveManager } from '@/persistence/SaveManager';
import { PlatformAdapter } from '@/platform/PlatformAdapter';
import { EventBus } from '@/core/events/EventBus';

export interface ApplicationContext {
  engine: GameEngine;
  ui: UIManager;
  audio: AudioManager;
  save: SaveManager;
  platform: PlatformAdapter;
  eventBus: EventBus;
}
