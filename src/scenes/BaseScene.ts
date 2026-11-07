import * as THREE from 'three';
import { StageId } from '@/shared/types';
import { GameEngine } from '@/core/engine/GameEngine';

export abstract class BaseScene {
  public abstract readonly id: StageId;
  public readonly scene: THREE.Scene;
  protected engine: GameEngine;

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.scene = new THREE.Scene();
  }

  public abstract init(): Promise<void>;
  public abstract update(dt: number, totalTime: number): void;
  public abstract fixedUpdate(fixedDelta: number): void;
  public abstract dispose(): void;
}
