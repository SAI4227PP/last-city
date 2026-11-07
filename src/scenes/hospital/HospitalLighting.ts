import * as THREE from 'three';
import { HOSPITAL_LEVEL_CONFIG, LightDef } from './HospitalLevelConfig';

export class HospitalLighting {
  private scene: THREE.Scene;
  private lightGroup: THREE.Group;
  private ambientLight!: THREE.AmbientLight;
  private dynamicLights: Map<string, { light: THREE.PointLight; def: LightDef }> = new Map();
  private timer: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.lightGroup = new THREE.Group();
    this.lightGroup.name = 'HospitalLighting';
    this.scene.add(this.lightGroup);

    this.setupLighting();
  }

  private setupLighting(): void {
    // 1. Balanced Cold Hospital Ambient Light
    // High enough to prevent tone-mapping crush into total black, low enough to preserve tension
    this.ambientLight = new THREE.AmbientLight(0x42586e, 1.45);
    this.lightGroup.add(this.ambientLight);

    // 2. Instantiate Configured Hospital Lights & Ceiling Fixtures
    const fixtureMat = new THREE.MeshBasicMaterial({ color: 0xebf5ff });
    const casingMat = new THREE.MeshStandardMaterial({ color: 0x1f262e, roughness: 0.6, metalness: 0.4 });

    for (const def of HOSPITAL_LEVEL_CONFIG.lights) {
      const pLight = new THREE.PointLight(
        def.color,
        def.intensity,
        def.distance,
        def.decay ?? 1.3
      );
      pLight.position.copy(def.position);
      if (def.castShadow) {
        pLight.castShadow = true;
        pLight.shadow.bias = -0.002;
        pLight.shadow.mapSize.width = 512;
        pLight.shadow.mapSize.height = 512;
      }
      this.lightGroup.add(pLight);

      if (def.flickers || def.pulse) {
        this.dynamicLights.set(def.id, { light: pLight, def });
      }

      // Add visual ceiling tube fixture for fluorescent lights
      if (def.position.y > 2.8) {
        const fixtureGrp = new THREE.Group();
        fixtureGrp.position.copy(def.position);
        fixtureGrp.position.y += 0.05;

        const casing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.35), casingMat);
        const tube1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.03, 0.06), fixtureMat);
        tube1.position.set(0, -0.04, -0.08);
        const tube2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.03, 0.06), fixtureMat);
        tube2.position.set(0, -0.04, 0.08);

        fixtureGrp.add(casing, tube1, tube2);
        this.lightGroup.add(fixtureGrp);
      }
    }
  }

  public update(dt: number): void {
    this.timer += dt;

    for (const { light, def } of this.dynamicLights.values()) {
      if (def.pulse) {
        // Smooth sine wave pulse for emergency beacons
        const pulseFactor = 0.5 + 0.5 * Math.sin(this.timer * 4.5);
        light.intensity = def.intensity * (0.35 + 0.65 * pulseFactor);
      } else if (def.flickers) {
        // Electrical arc flicker: mostly solid, occasional rapid drop
        const noise = Math.sin(this.timer * 35.0) * Math.cos(this.timer * 17.0);
        if (noise > 0.82) {
          light.intensity = def.intensity * 0.15; // momentary blackout
        } else if (noise > 0.65) {
          light.intensity = def.intensity * 0.55; // sputter
        } else {
          light.intensity = def.intensity * (0.95 + 0.05 * Math.sin(this.timer * 8.0));
        }
      }
    }
  }

  public dispose(): void {
    this.dynamicLights.clear();
    if (this.lightGroup.parent) {
      this.lightGroup.parent.remove(this.lightGroup);
    }
  }
}
