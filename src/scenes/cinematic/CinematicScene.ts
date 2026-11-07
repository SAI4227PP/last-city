import * as THREE from 'three';
import { BaseScene } from '@/scenes/BaseScene';
import { StageId } from '@/shared/types';
import { GameEngine } from '@/core/engine/GameEngine';
import { useGameUIStore } from '@/ui/store/gameUIStore';
import { AudioManager } from '@/core/audio/AudioManager';
import { SaveManager } from '@/persistence/SaveManager';

interface CinematicAct {
  startTime: number;
  endTime: number;
  speaker: string;
  subtitle: string;
  camStart: THREE.Vector3;
  camEnd: THREE.Vector3;
  lookAt: THREE.Vector3;
  sfx?: string;
}

export class CinematicScene extends BaseScene {
  public readonly id: StageId = 'cinematic';
  private elapsedTime: number = 0;
  private isSkipped: boolean = false;
  private emergencyLight!: THREE.PointLight;

  private acts: CinematicAct[] = [
    {
      startTime: 0,
      endTime: 10,
      speaker: 'METRO NEWS 7',
      subtitle: 'VERIDIA CENTER — Reports of an unprecedented biological pathogen emerging downtown. Citizens are urged to remain indoors.',
      camStart: new THREE.Vector3(0, 30, 60),
      camEnd: new THREE.Vector3(0, 15, 30),
      lookAt: new THREE.Vector3(0, 5, 0),
      sfx: 'siren'
    },
    {
      startTime: 10,
      endTime: 20,
      speaker: 'ST. JUDE EMERGENCY DISPATCH',
      subtitle: 'CODE BLACK. ICU breached! Patients are displaying extreme rabies-like aggression... We need immediate law enforcement support!',
      camStart: new THREE.Vector3(-15, 6, 20),
      camEnd: new THREE.Vector3(0, 3, 12),
      lookAt: new THREE.Vector3(0, 1.5, 0),
      sfx: 'zombie_attack'
    },
    {
      startTime: 20,
      endTime: 30,
      speaker: 'NATIONAL GUARD COMMAND',
      subtitle: 'Operation Iron Wall has collapsed. Sector 4 containment line is overrun. Evacuate all personnel. May God help us all.',
      camStart: new THREE.Vector3(25, 12, 10),
      camEnd: new THREE.Vector3(10, 4, -5),
      lookAt: new THREE.Vector3(0, 2, 0),
      sfx: 'gunshot_rifle'
    },
    {
      startTime: 30,
      endTime: 40,
      speaker: 'NARRATOR',
      subtitle: 'THIRTY DAYS LATER... The city went silent. The living vanished. And you just opened your eyes.',
      camStart: new THREE.Vector3(0, 1.8, 4),
      camEnd: new THREE.Vector3(0, 1.2, 1),
      lookAt: new THREE.Vector3(0, 1.0, 0),
      sfx: 'heartbeat'
    }
  ];

  constructor(engine: GameEngine) {
    super(engine);
  }

  public async init(): Promise<void> {
    this.elapsedTime = 0;
    this.isSkipped = false;

    this.scene.background = new THREE.Color(0x05070a);
    this.scene.fog = new THREE.FogExp2(0x05070a, 0.035);

    // City street geometry for the cinematic backdrop
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x11161d, roughness: 0.95 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), groundMat);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    // Derelict hospital facade
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x222a35, roughness: 0.8 });
    const hospital = new THREE.Mesh(new THREE.BoxGeometry(24, 18, 8), wallMat);
    hospital.position.set(0, 9, -15);
    this.scene.add(hospital);

    // St. Jude Emergency Sign
    const signMat = new THREE.MeshBasicMaterial({ color: 0xe53e3e });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(8, 1.5, 0.2), signMat);
    sign.position.set(0, 8, -10.9);
    this.scene.add(sign);

    // Flashing emergency lights
    this.emergencyLight = new THREE.PointLight(0xe53e3e, 3, 30);
    this.emergencyLight.position.set(0, 4, -8);
    this.scene.add(this.emergencyLight);

    // Ambient light
    const amb = new THREE.AmbientLight(0x0d141e, 1.5);
    this.scene.add(amb);

    AudioManager.getInstance().startAmbience('city');

    // Setup skip listener on Escape key
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'Space') {
        window.removeEventListener('keydown', onKey);
        this.skipCinematic();
      }
    };
    window.addEventListener('keydown', onKey);
  }

  public skipCinematic(): void {
    if (this.isSkipped) return;
    this.isSkipped = true;

    // Persist cinematic completion to IndexedDB
    SaveManager.getInstance().loadGame().then(() => {
      SaveManager.getInstance().saveGame({
        version: 1,
        timestamp: Date.now(),
        stage: 'hospital',
        cinematicCompleted: true,
        playerPosition: [0, 1.2, 0],
        playerRotation: 0,
        vitals: { health: 100, maxHealth: 100, stamina: 100, maxStamina: 100, hunger: 90, thirst: 85 },
        inventory: [],
        equippedWeapon: 'knife',
        weapons: {
          knife: { unlocked: true, currentAmmo: 0, reserveAmmo: 0 },
          bat: { unlocked: false, currentAmmo: 0, reserveAmmo: 0 },
          pistol: { unlocked: false, currentAmmo: 12, reserveAmmo: 24 },
          shotgun: { unlocked: false, currentAmmo: 6, reserveAmmo: 18 },
          rifle: { unlocked: false, currentAmmo: 30, reserveAmmo: 60 }
        },
        completedMissions: [],
        safehouseUnlocked: false,
        gameTimeMinutes: 0
      });
    });

    // Clear subtitles and transition directly to Stage 2: Hospital Outbreak
    useGameUIStore.getState().setSubtitles({ visible: false, speaker: '', text: '' });
    this.engine.sceneManager.loadScene('hospital');
  }

  public update(dt: number): void {
    if (this.isSkipped) return;

    this.elapsedTime += dt;

    // Check if cinematic has concluded (40 seconds)
    if (this.elapsedTime >= 40) {
      this.skipCinematic();
      return;
    }

    // Emergency beacon pulse
    this.emergencyLight.intensity = Math.sin(this.elapsedTime * 6) > 0 ? 3.5 : 0.5;

    // Evaluate current act
    const act = this.acts.find((a) => this.elapsedTime >= a.startTime && this.elapsedTime < a.endTime);
    if (act) {
      useGameUIStore.getState().setSubtitles({
        visible: true,
        speaker: act.speaker,
        text: act.subtitle
      });

      const actProgress = (this.elapsedTime - act.startTime) / (act.endTime - act.startTime);
      const cam = this.engine.cameraManager.camera;
      cam.position.lerpVectors(act.camStart, act.camEnd, actProgress);
      cam.lookAt(act.lookAt);
    }
  }

  public fixedUpdate(): void {}

  public dispose(): void {
    while (this.scene.children.length > 0) {
      const obj = this.scene.children[0];
      this.scene.remove(obj);
    }
    useGameUIStore.getState().setSubtitles({ visible: false, speaker: '', text: '' });
  }
}
