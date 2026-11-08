import * as THREE from 'three';
import { HOSPITAL_LEVEL_CONFIG, LightDef } from './HospitalLevelConfig';

export class HospitalLighting {
  private scene: THREE.Scene;
  private lightGroup: THREE.Group;
  private ambientLight!: THREE.AmbientLight;
  private dynamicLights: Map<string, { light: THREE.PointLight; def: LightDef }> = new Map();
  private rotatingBeacons: THREE.Group[] = [];
  private timer: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.lightGroup = new THREE.Group();
    this.lightGroup.name = 'HospitalLighting';
    this.scene.add(this.lightGroup);

    this.setupLighting();
  }

  private setupLighting(): void {
    // 1. Environmental & Ambient Fill Lighting:
    // Realistic clinical ceiling bounce (crisp cool white) and floor bounce
    const hemiLight = new THREE.HemisphereLight(0xecf4fb, 0x485868, 1.6);
    this.lightGroup.add(hemiLight);

    // Complementary omni ambient light ensuring zero pitch-black shadow voids
    this.ambientLight = new THREE.AmbientLight(0xd6e5f0, 1.25);
    this.lightGroup.add(this.ambientLight);

    // 2. Materials for light fixtures
    const fixtureMat = new THREE.MeshBasicMaterial({ color: 0xebf5ff });
    const casingMat = new THREE.MeshStandardMaterial({ color: 0x1f262e, roughness: 0.6, metalness: 0.4 });
    const beaconRedDomeMat = new THREE.MeshStandardMaterial({
      color: 0xff1111,
      emissive: 0xaa0000,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85
    });
    const exitSignMat = new THREE.MeshBasicMaterial({ color: 0x10b981 }); // Brilliant Emergency Green

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

      // Add visual emergency red beacon fixtures
      if (def.pulse && (def.color === 0xff1e1e || def.color === 0xef4444)) {
        const beaconGrp = new THREE.Group();
        beaconGrp.position.copy(def.position);

        const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.1, 10), casingMat);
        const domeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 10), beaconRedDomeMat);
        domeMesh.position.y = 0.12;

        beaconGrp.add(baseMesh, domeMesh);
        this.lightGroup.add(beaconGrp);
        this.rotatingBeacons.push(beaconGrp);
      }
      // Add illuminated EXIT sign box
      else if (def.id === 'light_exit_sign') {
        const exitBox = new THREE.Group();
        exitBox.position.copy(def.position);
        exitBox.position.y += 0.15;

        const boxHousing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 0.15), casingMat);
        const greenFace = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.27), exitSignMat);
        greenFace.position.z = -0.08;
        greenFace.rotation.y = Math.PI;

        exitBox.add(boxHousing, greenFace);
        this.lightGroup.add(exitBox);
      }
      // Add visual ceiling tube fixture for fluorescent lights
      else if (def.position.y > 2.8) {
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

    // Rotate emergency warning beacons
    for (const beacon of this.rotatingBeacons) {
      beacon.rotation.y += dt * 4.5;
    }

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
    this.rotatingBeacons = [];
    if (this.lightGroup.parent) {
      this.lightGroup.parent.remove(this.lightGroup);
    }
  }
}
