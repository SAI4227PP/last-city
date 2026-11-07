import { openDB, IDBPDatabase } from 'idb';
import { PlayerSaveData, AudioSettings, GraphicsSettings } from '@/shared/types';
import { Logger } from '@/core/utils/Logger';

const DB_NAME = 'LastCityDB';
const DB_VERSION = 1;
const SAVE_SLOT_KEY = 'save_slot_main';
const SETTINGS_KEY = 'user_settings';

export interface AppSettings {
  audio: AudioSettings;
  graphics: GraphicsSettings;
  mouseSensitivity: number;
}

export class SaveManager {
  private static instance: SaveManager | null = null;
  private dbPromise: Promise<IDBPDatabase> | null = null;
  private isIndexedDBAvailable: boolean;
  private memorySaves: Map<string, any> = new Map();
  private memorySettings: Map<string, any> = new Map();

  private constructor() {
    this.isIndexedDBAvailable = typeof indexedDB !== 'undefined';

    if (this.isIndexedDBAvailable) {
      try {
        this.dbPromise = openDB(DB_NAME, DB_VERSION, {
          upgrade(db) {
            if (!db.objectStoreNames.contains('saves')) {
              db.createObjectStore('saves');
            }
            if (!db.objectStoreNames.contains('settings')) {
              db.createObjectStore('settings');
            }
          }
        });
      } catch (err) {
        Logger.warn('IndexedDB initialization failed, falling back to in-memory store:', err);
        this.isIndexedDBAvailable = false;
      }
    } else {
      Logger.info('IndexedDB not supported in current environment; using in-memory store.');
    }
  }

  public static getInstance(): SaveManager {
    if (!SaveManager.instance) {
      SaveManager.instance = new SaveManager();
    }
    return SaveManager.instance;
  }

  public async saveGame(data: PlayerSaveData): Promise<boolean> {
    if (!this.isIndexedDBAvailable || !this.dbPromise) {
      this.memorySaves.set(SAVE_SLOT_KEY, JSON.parse(JSON.stringify(data)));
      Logger.info(`Game state saved in-memory for stage "${data.stage}".`);
      return true;
    }

    try {
      const db = await this.dbPromise;
      await db.put('saves', data, SAVE_SLOT_KEY);
      Logger.info(`Game state saved successfully at stage "${data.stage}".`);
      return true;
    } catch (err) {
      Logger.error('Failed to save game to IndexedDB:', err);
      return false;
    }
  }

  public async loadGame(): Promise<PlayerSaveData | null> {
    if (!this.isIndexedDBAvailable || !this.dbPromise) {
      const mem = this.memorySaves.get(SAVE_SLOT_KEY);
      return mem ? JSON.parse(JSON.stringify(mem)) : null;
    }

    try {
      const db = await this.dbPromise;
      const data = await db.get('saves', SAVE_SLOT_KEY);
      if (data) {
        Logger.info(`Save game loaded for stage "${data.stage}".`);
        return data as PlayerSaveData;
      }
      return null;
    } catch (err) {
      Logger.error('Failed to load save from IndexedDB:', err);
      return null;
    }
  }

  public async hasSave(): Promise<boolean> {
    if (!this.isIndexedDBAvailable || !this.dbPromise) {
      return this.memorySaves.has(SAVE_SLOT_KEY);
    }

    try {
      const db = await this.dbPromise;
      const data = await db.get('saves', SAVE_SLOT_KEY);
      return !!data;
    } catch {
      return false;
    }
  }

  public async deleteSave(): Promise<void> {
    if (!this.isIndexedDBAvailable || !this.dbPromise) {
      this.memorySaves.delete(SAVE_SLOT_KEY);
      Logger.info('In-memory save deleted.');
      return;
    }

    try {
      const db = await this.dbPromise;
      await db.delete('saves', SAVE_SLOT_KEY);
      Logger.info('Save game deleted.');
    } catch (err) {
      Logger.error('Failed to delete save:', err);
    }
  }

  public async saveSettings(settings: AppSettings): Promise<void> {
    if (!this.isIndexedDBAvailable || !this.dbPromise) {
      this.memorySettings.set(SETTINGS_KEY, JSON.parse(JSON.stringify(settings)));
      return;
    }

    try {
      const db = await this.dbPromise;
      await db.put('settings', settings, SETTINGS_KEY);
    } catch (err) {
      Logger.warn('Failed to persist user settings:', err);
    }
  }

  public async loadSettings(): Promise<AppSettings | null> {
    if (!this.isIndexedDBAvailable || !this.dbPromise) {
      const mem = this.memorySettings.get(SETTINGS_KEY);
      return mem ? JSON.parse(JSON.stringify(mem)) : null;
    }

    try {
      const db = await this.dbPromise;
      const settings = await db.get('settings', SETTINGS_KEY);
      return settings || null;
    } catch (err) {
      Logger.warn('Failed to load user settings:', err);
      return null;
    }
  }
}
