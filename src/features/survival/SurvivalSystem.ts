import { VitalStats } from '@/shared/types';
import { EventBus } from '@/core/events/EventBus';
import { useGameUIStore } from '@/ui/store/gameUIStore';

export class SurvivalSystem {
  private vitals: VitalStats = {
    health: 100,
    maxHealth: 100,
    stamina: 100,
    maxStamina: 100,
    hunger: 100,
    thirst: 100
  };

  private eventBus: EventBus;
  private heartbeatTimer: number = 0;
  private damageCooldownTimer: number = 0;

  constructor() {
    this.eventBus = EventBus.getInstance();
    this.syncToStore();
  }

  public getVitals(): VitalStats {
    return { ...this.vitals };
  }

  public setVitals(vitals: Partial<VitalStats>): void {
    this.vitals = { ...this.vitals, ...vitals };
    this.clampVitals();
    this.syncToStore();
  }

  public damage(amount: number, source: string = 'unknown', checkCooldown: boolean = false): void {
    if (this.vitals.health <= 0) return;
    if (checkCooldown && this.damageCooldownTimer > 0) return;

    if (checkCooldown) {
      this.damageCooldownTimer = 0.12; // 120ms brief frame-safety invulnerability window
    }

    this.vitals.health = Math.max(0, this.vitals.health - amount);
    this.eventBus.emit('player:damage', { amount, source });
    this.eventBus.emit('audio:play_sfx', { sound: 'melee_hit', volume: 1.0 });
    this.eventBus.emit('audio:play_sfx', { sound: 'heartbeat', volume: 0.9 });
    this.syncToStore();

    if (this.vitals.health <= 0) {
      this.eventBus.emit('player:death', undefined);
      useGameUIStore.getState().setShowGameOver(true, `Killed by ${source}`);
    }
  }

  public heal(amount: number): void {
    this.vitals.health = Math.min(this.vitals.maxHealth, this.vitals.health + amount);
    this.eventBus.emit('player:heal', { amount });
    this.syncToStore();
  }

  public consumeFood(hungerRestore: number): void {
    this.vitals.hunger = Math.min(100, this.vitals.hunger + hungerRestore);
    this.syncToStore();
  }

  public consumeWater(thirstRestore: number): void {
    this.vitals.thirst = Math.min(100, this.vitals.thirst + thirstRestore);
    this.syncToStore();
  }

  public useStamina(amount: number): boolean {
    if (this.vitals.stamina >= amount) {
      this.vitals.stamina = Math.max(0, this.vitals.stamina - amount);
      this.syncToStore();
      return true;
    }
    return false;
  }

  public hasStamina(amount: number): boolean {
    return this.vitals.stamina >= amount;
  }

  public update(dt: number, isSprinting: boolean): void {
    // Stamina drain or recovery
    if (isSprinting) {
      this.vitals.stamina = Math.max(0, this.vitals.stamina - 18 * dt);
    } else {
      this.vitals.stamina = Math.min(this.vitals.maxStamina, this.vitals.stamina + 22 * dt);
    }

    // Hunger and Thirst decay over time
    // 1 hunger point every ~8 seconds; 1 thirst point every ~5 seconds
    this.vitals.hunger = Math.max(0, this.vitals.hunger - 0.12 * dt);
    this.vitals.thirst = Math.max(0, this.vitals.thirst - 0.20 * dt);

    // Starvation / Dehydration penalties
    if (this.vitals.hunger <= 0 || this.vitals.thirst <= 0) {
      this.damage(1.5 * dt, 'Dehydration/Starvation', true);
    }

    this.damageCooldownTimer = Math.max(0, this.damageCooldownTimer - dt);

    // Low health heartbeat audio trigger
    if (this.vitals.health > 0 && this.vitals.health < 30) {
      this.heartbeatTimer += dt;
      if (this.heartbeatTimer >= 1.1) {
        this.heartbeatTimer = 0;
        this.eventBus.emit('audio:play_sfx', { sound: 'heartbeat', volume: 0.8 });
      }
    }

    this.syncToStore();
  }

  private clampVitals(): void {
    this.vitals.health = Math.max(0, Math.min(this.vitals.maxHealth, this.vitals.health));
    this.vitals.stamina = Math.max(0, Math.min(this.vitals.maxStamina, this.vitals.stamina));
    this.vitals.hunger = Math.max(0, Math.min(100, this.vitals.hunger));
    this.vitals.thirst = Math.max(0, Math.min(100, this.vitals.thirst));
  }

  private syncToStore(): void {
    useGameUIStore.getState().setVitals({ ...this.vitals });
    this.eventBus.emit('player:vitals_updated', { ...this.vitals });
  }
}
