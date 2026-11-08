import { GameEventPayloads } from './EventTypes';

type EventCallback<T> = (payload: T) => void;

export class EventBus {
  private static instance: EventBus | null = null;
  private listeners: Map<keyof GameEventPayloads, Set<EventCallback<any>>> = new Map();

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public on<K extends keyof GameEventPayloads>(
    event: K,
    callback: EventCallback<GameEventPayloads[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(callback);

    // Return unsubscription callback
    return () => {
      set.delete(callback);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  public off<K extends keyof GameEventPayloads>(
    event: K,
    callback: EventCallback<GameEventPayloads[K]>
  ): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public emit<K extends keyof GameEventPayloads>(
    event: K,
    payload?: GameEventPayloads[K]
  ): void {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(payload);
        } catch (err) {
          console.error(`Error in event handler for "${String(event)}":`, err);
        }
      });
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}
