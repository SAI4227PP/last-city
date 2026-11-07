import * as THREE from 'three';
import { BaseScene } from '@/scenes/BaseScene';
import { StageId } from '@/shared/types';
import { GameEngine } from '@/core/engine/GameEngine';
import { useGameUIStore } from '@/ui/store/gameUIStore';
import { AudioManager } from '@/core/audio/AudioManager';

export class MainMenuScene extends BaseScene {
  public readonly id: StageId = 'main-menu';
  private cameraAngle: number = 0;
  private buildings: THREE.Group = new THREE.Group();

  constructor(engine: GameEngine) {
    super(engine);
  }

  public async init(): Promise<void> {
    this.scene.background = new THREE.Color(0x06080b);
    this.scene.fog = new THREE.FogExp2(0x06080b, 0.025);

    // Ambient & Directional Moonlight
    const ambientLight = new THREE.AmbientLight(0x1a2634, 1.2);
    const moonLight = new THREE.DirectionalLight(0x5c7c99, 1.8);
    moonLight.position.set(20, 40, -30);
    this.scene.add(ambientLight, moonLight);

    // City Skyline Backdrop (Silhouettes with glowing eerie windows)
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x0f141c, roughness: 0.9 });
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xd69e2e });

    for (let i = 0; i < 40; i++) {
      const w = 4 + Math.random() * 6;
      const h = 15 + Math.random() * 45;
      const d = 4 + Math.random() * 6;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildingMat);

      const rad = 25 + Math.random() * 45;
      const ang = Math.random() * Math.PI * 2;
      mesh.position.set(Math.cos(ang) * rad, h / 2 - 2, Math.sin(ang) * rad);
      this.buildings.add(mesh);

      // Add flickering window lights
      if (Math.random() > 0.4) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.1), windowMat);
        win.position.set(mesh.position.x, mesh.position.y + (Math.random() - 0.5) * (h * 0.5), mesh.position.z + d / 2 + 0.1);
        this.buildings.add(win);
      }
    }
    this.scene.add(this.buildings);

    // Red Emergency Beacon Light in distance
    const beacon = new THREE.PointLight(0xe53e3e, 2.5, 40);
    beacon.position.set(0, 15, -15);
    this.scene.add(beacon);

    // Set UI state
    useGameUIStore.getState().setShowMainMenu(true);
    useGameUIStore.getState().setStage('main-menu');

    AudioManager.getInstance().startAmbience('eerie');
  }

  public update(dt: number): void {
    // Slowly orbit camera around city center
    this.cameraAngle += dt * 0.06;
    const radius = 24;
    const cam = this.engine.cameraManager.camera;
    cam.position.set(Math.cos(this.cameraAngle) * radius, 12, Math.sin(this.cameraAngle) * radius);
    cam.lookAt(0, 4, 0);
  }

  public fixedUpdate(): void {}

  public dispose(): void {
    while (this.scene.children.length > 0) {
      const obj = this.scene.children[0];
      this.scene.remove(obj);
    }
    AudioManager.getInstance().stopAmbience();
  }
}
