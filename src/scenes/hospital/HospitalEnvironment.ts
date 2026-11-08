import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { PhysicsWorld } from '@/core/physics/PhysicsWorld';
import { Logger } from '@/core/utils/Logger';
import { HOSPITAL_LEVEL_CONFIG, WallSegment, PropDef } from './HospitalLevelConfig';

export class HospitalEnvironment {
  private scene: THREE.Scene;
  private physicsWorld: PhysicsWorld;
  private environmentGroup: THREE.Group;
  private colliders: any[] = [];
  private loader: GLTFLoader = new GLTFLoader();

  // Shared Materials
  private wallMat!: THREE.MeshStandardMaterial;
  private floorMat!: THREE.MeshStandardMaterial;
  private ceilingMat!: THREE.MeshStandardMaterial;
  private tileTileMat!: THREE.MeshStandardMaterial;
  private metalMat!: THREE.MeshStandardMaterial;
  private darkMetalMat!: THREE.MeshStandardMaterial;
  private chromeMat!: THREE.MeshStandardMaterial;
  private glassMat!: THREE.MeshStandardMaterial;
  private fabricMat!: THREE.MeshStandardMaterial;
  private curtainMat!: THREE.MeshStandardMaterial;
  private windowFrameMat!: THREE.MeshStandardMaterial;
  private windowGlassMat!: THREE.MeshStandardMaterial;
  private tankMat!: THREE.MeshStandardMaterial;
  private crateMat!: THREE.MeshStandardMaterial;
  private redPlasticMat!: THREE.MeshStandardMaterial;
  private screenEcgMat!: THREE.MeshBasicMaterial;
  private screenCctvMat!: THREE.MeshBasicMaterial;
  private signMat!: THREE.MeshStandardMaterial;

  // Real GLB Assets
  private bedGlbModel: THREE.Object3D | null = null;
  private bedPlaceholders: THREE.Group[] = [];

  constructor(scene: THREE.Scene, physicsWorld: PhysicsWorld) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.environmentGroup = new THREE.Group();
    this.environmentGroup.name = 'HospitalEnvironment';
    this.scene.add(this.environmentGroup);

    this.initMaterials();
  }

  private initMaterials(): void {
    // Wall material: Realistic bright clinical off-white hospital drywall with subtle sage tone
    this.wallMat = new THREE.MeshStandardMaterial({
      color: 0xc8d5de,
      roughness: 0.72,
      metalness: 0.04
    });

    // Floor material: Scuffed clinical hospital vinyl / linoleum tile (soft reflective sheen)
    this.floorMat = new THREE.MeshStandardMaterial({
      color: 0x7a8b98,
      roughness: 0.35,
      metalness: 0.12
    });

    // Ward tile floor: Slightly lighter clinical teal-gray surgical tile
    this.tileTileMat = new THREE.MeshStandardMaterial({
      color: 0x728896,
      roughness: 0.28,
      metalness: 0.14
    });

    // Ceiling material: Clean off-white acoustic drop-ceiling tiles
    this.ceilingMat = new THREE.MeshStandardMaterial({
      color: 0xa8b4bd,
      roughness: 0.85,
      metalness: 0.02
    });

    // Prop materials
    this.metalMat = new THREE.MeshStandardMaterial({
      color: 0x9cb0c0,
      metalness: 0.75,
      roughness: 0.3
    });

    this.darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x3a434d,
      metalness: 0.65,
      roughness: 0.4
    });

    this.chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe0e8f0,
      metalness: 0.95,
      roughness: 0.12
    });

    this.glassMat = new THREE.MeshStandardMaterial({
      color: 0x77a6ba,
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
      metalness: 0.85
    });

    this.fabricMat = new THREE.MeshStandardMaterial({
      color: 0xedf2f7,
      roughness: 0.8
    });

    this.redPlasticMat = new THREE.MeshStandardMaterial({
      color: 0xee2222,
      roughness: 0.35,
      metalness: 0.1
    });

    this.screenEcgMat = new THREE.MeshBasicMaterial({
      color: 0x38ef7d
    });

    this.screenCctvMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8
    });

    this.signMat = new THREE.MeshStandardMaterial({
      color: 0x1d4163,
      roughness: 0.4,
      metalness: 0.2
    });

    this.curtainMat = new THREE.MeshStandardMaterial({
      color: 0x4f828a, // Hospital clinical teal fabric
      roughness: 0.75,
      metalness: 0.05,
      side: THREE.DoubleSide
    });

    this.windowFrameMat = new THREE.MeshStandardMaterial({
      color: 0x3b4754,
      roughness: 0.6,
      metalness: 0.65
    });

    this.windowGlassMat = new THREE.MeshStandardMaterial({
      color: 0x447699,
      roughness: 0.15,
      metalness: 0.8,
      transparent: true,
      opacity: 0.6
    });

    this.tankMat = new THREE.MeshStandardMaterial({
      color: 0x30694e, // Medical green oxygen cylinder
      roughness: 0.35,
      metalness: 0.5
    });

    this.crateMat = new THREE.MeshStandardMaterial({
      color: 0x5d7080,
      roughness: 0.55,
      metalness: 0.25
    });
  }

  public buildLevel(): void {
    this.buildFloorsAndCeilings();
    this.buildWalls();
    this.buildProps();

    // Asynchronously load real 3D GLB assets
    this.loadCorridorGlb();
    this.loadBedGlb();
  }

  private loadCorridorGlb(): void {
    const url = '/assets/hospital/02_Rooms/Hospital_Corridor/hospital_corridor.glb';
    this.loader.load(
      url,
      (gltf) => {
        // Instance the modular corridor along the central corridor:
        // Corridor extends from Z: 5 to Z: 62 (width 6m, height 3.6m)
        const segmentZPositions = [17.5, 30.5, 43.5, 56.5];
        for (const z of segmentZPositions) {
          const inst = SkeletonUtils.clone(gltf.scene);
          inst.position.set(0, 0, z);
          inst.traverse((child: any) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          this.environmentGroup.add(inst);
        }
        Logger.info('HospitalEnvironment: Successfully loaded and instanced modular corridor GLB.');
      },
      undefined,
      (err) => {
        Logger.warn(`HospitalEnvironment: Corridor GLB not loaded (${err}). Using built-in modular architecture.`);
      }
    );
  }

  private loadBedGlb(): void {
    const url = '/assets/hospital/03_Props/Hospital_Beds/hospital_bed/base_basic_shaded.glb';
    this.loader.load(
      url,
      (gltf) => {
        this.bedGlbModel = gltf.scene;
        this.bedGlbModel.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        // Upgrade existing procedural bed placeholders with real 3D model
        for (const placeholder of this.bedPlaceholders) {
          const isOverturned = placeholder.userData.isOverturned;
          const clone = SkeletonUtils.clone(this.bedGlbModel);
          clone.scale.setScalar(1.35);
          while (placeholder.children.length > 0) {
            placeholder.remove(placeholder.children[0]);
          }
          if (isOverturned) {
            clone.rotation.z = Math.PI / 2.3;
            clone.rotation.x = 0.2;
            clone.position.y = 0.45;
          }
          placeholder.add(clone);
        }
        Logger.info('HospitalEnvironment: Successfully upgraded hospital beds with real 3D GLB model.');
      },
      undefined,
      (err) => {
        Logger.warn(`HospitalEnvironment: Bed GLB not loaded (${err}). Using detailed procedural bed model.`);
      }
    );
  }

  private buildFloorsAndCeilings(): void {
    const floorConfigs = [
      // Room 104
      { pos: new THREE.Vector3(0, 0, 0), size: new THREE.Vector2(9, 10), mat: this.floorMat },
      // Central Corridor
      { pos: new THREE.Vector3(0, 0, 33.5), size: new THREE.Vector2(6, 57), mat: this.floorMat },
      // West Patient Rooms (101, 102)
      { pos: new THREE.Vector3(-7.5, 0, 17), size: new THREE.Vector2(9, 24), mat: this.tileTileMat },
      // Nurse Station & Reception
      { pos: new THREE.Vector3(8.0, 0, 21), size: new THREE.Vector2(10, 14), mat: this.floorMat },
      // Emergency Trauma Ward
      { pos: new THREE.Vector3(9.0, 0, 38), size: new THREE.Vector2(12, 16), mat: this.tileTileMat },
      // Pharmacy
      { pos: new THREE.Vector3(-8.5, 0, 39), size: new THREE.Vector2(11, 14), mat: this.tileTileMat },
      // Security Room
      { pos: new THREE.Vector3(8.0, 0, 53), size: new THREE.Vector2(10, 10), mat: this.floorMat },
      // Staircase junction
      { pos: new THREE.Vector3(-8.0, 0, 53), size: new THREE.Vector2(10, 10), mat: this.floorMat },
      // Exit Foyer
      { pos: new THREE.Vector3(0, 0, 61), size: new THREE.Vector2(7, 6), mat: this.floorMat }
    ];

    for (const f of floorConfigs) {
      // Floor plane
      const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(f.size.x, f.size.y), f.mat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.set(f.pos.x, 0, f.pos.z);
      floorMesh.receiveShadow = true;
      this.environmentGroup.add(floorMesh);

      // Floor physics box
      const col = this.physicsWorld.createStaticBox(
        new THREE.Vector3(f.pos.x, -0.5, f.pos.z),
        new THREE.Vector3(f.size.x / 2, 0.5, f.size.y / 2)
      );
      this.colliders.push(col);

      // Ceiling plane
      const ceilMesh = new THREE.Mesh(new THREE.PlaneGeometry(f.size.x, f.size.y), this.ceilingMat);
      ceilMesh.rotation.x = Math.PI / 2;
      ceilMesh.position.set(f.pos.x, 3.6, f.pos.z);
      this.environmentGroup.add(ceilMesh);
    }
  }

  private buildWalls(): void {
    const walls: WallSegment[] = [
      // ==========================================
      // Room 104 Enclosure
      // ==========================================
      { position: new THREE.Vector3(-4.5, 1.8, 0), halfExtents: new THREE.Vector3(0.15, 1.8, 5) },
      { position: new THREE.Vector3(4.5, 1.8, 0), halfExtents: new THREE.Vector3(0.15, 1.8, 5) },
      { position: new THREE.Vector3(0, 1.8, -5), halfExtents: new THREE.Vector3(4.5, 1.8, 0.15) },
      // Room 104 Doorway leading into corridor (doorway at X: -1.2 to 1.2)
      { position: new THREE.Vector3(-2.85, 1.8, 5), halfExtents: new THREE.Vector3(1.65, 1.8, 0.15) },
      { position: new THREE.Vector3(2.85, 1.8, 5), halfExtents: new THREE.Vector3(1.65, 1.8, 0.15) },
      { position: new THREE.Vector3(0, 3.1, 5), halfExtents: new THREE.Vector3(1.2, 0.5, 0.15) }, // Header above door

      // ==========================================
      // West Patient Rooms Wing (X: -12 to -3)
      // ==========================================
      { position: new THREE.Vector3(-12, 1.8, 17), halfExtents: new THREE.Vector3(0.15, 1.8, 12) }, // Outer West wall
      { position: new THREE.Vector3(-7.5, 1.8, 5), halfExtents: new THREE.Vector3(4.5, 1.8, 0.15) }, // South wall
      { position: new THREE.Vector3(-7.5, 1.8, 16.5), halfExtents: new THREE.Vector3(4.5, 1.8, 0.15) }, // Divider 101/102
      { position: new THREE.Vector3(-7.5, 1.8, 28), halfExtents: new THREE.Vector3(4.5, 1.8, 0.15) }, // North wall 102
      // Corridor Divider West (Z: 5 to 28 with doorways to rooms 101 and 102)
      { position: new THREE.Vector3(-3.0, 1.8, 7.5), halfExtents: new THREE.Vector3(0.15, 1.8, 2.5) },
      { position: new THREE.Vector3(-3.0, 3.1, 11), halfExtents: new THREE.Vector3(0.15, 0.5, 1.0) }, // Door 101 header
      { position: new THREE.Vector3(-3.0, 1.8, 15.5), halfExtents: new THREE.Vector3(0.15, 1.8, 3.5) },
      { position: new THREE.Vector3(-3.0, 3.1, 20), halfExtents: new THREE.Vector3(0.15, 0.5, 1.0) }, // Door 102 header
      { position: new THREE.Vector3(-3.0, 1.8, 25), halfExtents: new THREE.Vector3(0.15, 1.8, 4.0) },

      // ==========================================
      // East Nurse Station & Reception (X: 3 to 13, Z: 14 to 28)
      // ==========================================
      { position: new THREE.Vector3(13, 1.8, 21), halfExtents: new THREE.Vector3(0.15, 1.8, 7) }, // Outer East wall
      { position: new THREE.Vector3(8, 1.8, 14), halfExtents: new THREE.Vector3(5.0, 1.8, 0.15) }, // South wall
      { position: new THREE.Vector3(8, 1.8, 28), halfExtents: new THREE.Vector3(5.0, 1.8, 0.15) }, // North wall
      // Corridor Divider East (Z: 5 to 14 is solid corridor wall; Z: 18 to 24 is open reception counter)
      { position: new THREE.Vector3(3.0, 1.8, 9.5), halfExtents: new THREE.Vector3(0.15, 1.8, 4.5) },
      { position: new THREE.Vector3(3.0, 1.8, 16), halfExtents: new THREE.Vector3(0.15, 1.8, 2.0) },
      { position: new THREE.Vector3(3.0, 3.1, 21), halfExtents: new THREE.Vector3(0.15, 0.5, 3.0) }, // Arched open header over counter
      { position: new THREE.Vector3(3.0, 1.8, 26), halfExtents: new THREE.Vector3(0.15, 1.8, 2.0) },

      // ==========================================
      // Emergency Trauma Ward (X: 3 to 15, Z: 30 to 46)
      // ==========================================
      { position: new THREE.Vector3(15, 1.8, 38), halfExtents: new THREE.Vector3(0.15, 1.8, 8) }, // Outer East wall
      { position: new THREE.Vector3(9, 1.8, 30), halfExtents: new THREE.Vector3(6.0, 1.8, 0.15) }, // South wall
      { position: new THREE.Vector3(9, 1.8, 46), halfExtents: new THREE.Vector3(6.0, 1.8, 0.15) }, // North wall
      // Corridor Divider to Ward with double door opening at Z: 34
      { position: new THREE.Vector3(3.0, 1.8, 31), halfExtents: new THREE.Vector3(0.15, 1.8, 1.0) },
      { position: new THREE.Vector3(3.0, 3.1, 34), halfExtents: new THREE.Vector3(0.15, 0.5, 2.0) }, // Ward double door header
      { position: new THREE.Vector3(3.0, 1.8, 41), halfExtents: new THREE.Vector3(0.15, 1.8, 5.0) },

      // ==========================================
      // Hospital Pharmacy (X: -14 to -3, Z: 32 to 46)
      // ==========================================
      { position: new THREE.Vector3(-14, 1.8, 39), halfExtents: new THREE.Vector3(0.15, 1.8, 7) }, // Outer West wall
      { position: new THREE.Vector3(-8.5, 1.8, 32), halfExtents: new THREE.Vector3(5.5, 1.8, 0.15) }, // South wall
      { position: new THREE.Vector3(-8.5, 1.8, 46), halfExtents: new THREE.Vector3(5.5, 1.8, 0.15) }, // North wall
      // Corridor Divider with door opening at Z: 38
      { position: new THREE.Vector3(-3.0, 1.8, 34.5), halfExtents: new THREE.Vector3(0.15, 1.8, 2.5) },
      { position: new THREE.Vector3(-3.0, 3.1, 38), halfExtents: new THREE.Vector3(0.15, 0.5, 1.0) }, // Pharmacy door header
      { position: new THREE.Vector3(-3.0, 1.8, 42), halfExtents: new THREE.Vector3(0.15, 1.8, 3.0) },

      // ==========================================
      // Security Command Office (X: 3 to 13, Z: 48 to 58)
      // ==========================================
      { position: new THREE.Vector3(13, 1.8, 53), halfExtents: new THREE.Vector3(0.15, 1.8, 5) }, // Outer East wall
      { position: new THREE.Vector3(8, 1.8, 48), halfExtents: new THREE.Vector3(5.0, 1.8, 0.15) }, // South wall
      { position: new THREE.Vector3(8, 1.8, 58), halfExtents: new THREE.Vector3(5.0, 1.8, 0.15) }, // North wall
      // Corridor Divider with door opening at Z: 52
      { position: new THREE.Vector3(3.0, 1.8, 49.5), halfExtents: new THREE.Vector3(0.15, 1.8, 1.5) },
      { position: new THREE.Vector3(3.0, 3.1, 52), halfExtents: new THREE.Vector3(0.15, 0.5, 1.0) }, // Door header
      { position: new THREE.Vector3(3.0, 1.8, 55), halfExtents: new THREE.Vector3(0.15, 1.8, 2.0) },

      // ==========================================
      // Staircase Blockade Wing (X: -13 to -3, Z: 48 to 58)
      // ==========================================
      { position: new THREE.Vector3(-13, 1.8, 53), halfExtents: new THREE.Vector3(0.15, 1.8, 5) },
      { position: new THREE.Vector3(-8, 1.8, 48), halfExtents: new THREE.Vector3(5.0, 1.8, 0.15) },
      { position: new THREE.Vector3(-8, 1.8, 58), halfExtents: new THREE.Vector3(5.0, 1.8, 0.15) },
      { position: new THREE.Vector3(-3.0, 1.8, 53), halfExtents: new THREE.Vector3(0.15, 1.8, 5) },

      // ==========================================
      // Exit Corridor Funnel & Emergency Fire Exit (Z: 58 to 62)
      // ==========================================
      { position: new THREE.Vector3(-3.0, 1.8, 60), halfExtents: new THREE.Vector3(0.15, 1.8, 2.0) },
      { position: new THREE.Vector3(3.0, 1.8, 60), halfExtents: new THREE.Vector3(0.15, 1.8, 2.0) },
      // Fire Exit Wall with double door opening at Z: 62 (X: -1.6 to 1.6)
      { position: new THREE.Vector3(-2.3, 1.8, 62), halfExtents: new THREE.Vector3(0.7, 1.8, 0.15) },
      { position: new THREE.Vector3(2.3, 1.8, 62), halfExtents: new THREE.Vector3(0.7, 1.8, 0.15) },
      { position: new THREE.Vector3(0, 3.1, 62), halfExtents: new THREE.Vector3(1.6, 0.5, 0.15) }
    ];

    for (const w of walls) {
      const geo = new THREE.BoxGeometry(w.halfExtents.x * 2, w.halfExtents.y * 2, w.halfExtents.z * 2);
      const mesh = new THREE.Mesh(geo, this.wallMat);
      mesh.position.copy(w.position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.environmentGroup.add(mesh);

      const col = this.physicsWorld.createStaticBox(w.position, w.halfExtents);
      this.colliders.push(col);
    }
  }

  private buildProps(): void {
    for (const p of HOSPITAL_LEVEL_CONFIG.props) {
      const propGroup = this.instantiateProp(p);
      if (propGroup) {
        propGroup.position.copy(p.position);
        if (p.rotationY) propGroup.rotation.y = p.rotationY;
        if (p.scale) propGroup.scale.setScalar(p.scale);
        this.environmentGroup.add(propGroup);
      }
    }
  }

  private instantiateProp(p: PropDef): THREE.Group | null {
    switch (p.type) {
      case 'bed':
        return this.createHospitalBed();
      case 'bed_overturned':
        return this.createOverturnedBed();
      case 'iv_stand':
        return this.createIVStand();
      case 'wheelchair':
        return this.createWheelchair();
      case 'med_monitor':
        return this.createMedicalMonitor();
      case 'cabinet':
        return this.createMedicalCabinet();
      case 'reception_desk':
        return this.createReceptionDesk();
      case 'security_console':
        return this.createSecurityConsole();
      case 'pharmacy_shelf':
        return this.createPharmacyShelf();
      case 'filing_cabinet':
        return this.createFilingCabinet();
      case 'crash_cart':
        return this.createCrashCart();
      case 'stretcher':
        return this.createStretcher();
      case 'debris':
        return this.createDebrisPile();
      case 'blood_splatter':
        return this.createBloodSplatter();
      case 'wall_sign':
        return this.createWallSign(p.signText ?? 'HOSPITAL WING');
      case 'curtain':
        return this.createCurtain();
      case 'window':
        return this.createWindow();
      case 'nightstand':
        return this.createNightstand();
      case 'oxygen_tank':
        return this.createOxygenTank();
      case 'medicine_crate':
        return this.createMedicineCrate();
      case 'cctv_wall_monitor':
        return this.createCctvWallMonitor();
      default:
        return null;
    }
  }

  // =========================================================================
  // Detailed Procedural Prop Generators & GLB Integrators
  // =========================================================================

  private createHospitalBed(): THREE.Group {
    const grp = new THREE.Group();
    grp.userData.isBed = true;
    grp.userData.isOverturned = false;
    this.bedPlaceholders.push(grp);

    if (this.bedGlbModel) {
      const clone = SkeletonUtils.clone(this.bedGlbModel);
      clone.scale.setScalar(1.35);
      grp.add(clone);
      return grp;
    }

    // Steel Tubular Frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 2.2), this.metalMat);
    frame.position.y = 0.35;
    frame.castShadow = true;

    // Headboard & Footboard
    const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.65, 0.08), this.metalMat);
    headboard.position.set(0, 0.65, -1.06);
    headboard.castShadow = true;

    const footboard = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 0.08), this.metalMat);
    footboard.position.set(0, 0.55, 1.06);
    footboard.castShadow = true;

    // Mattress & Pillow
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 2.1), this.fabricMat);
    mattress.position.y = 0.55;
    mattress.castShadow = true;

    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.38), this.fabricMat);
    pillow.position.set(0, 0.7, -0.75);

    // Side guard rails
    const railL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 1.2), this.chromeMat);
    railL.position.set(-0.58, 0.65, 0);
    const railR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 1.2), this.chromeMat);
    railR.position.set(0.58, 0.65, 0);

    grp.add(frame, headboard, footboard, mattress, pillow, railL, railR);
    return grp;
  }

  private createOverturnedBed(): THREE.Group {
    const grp = new THREE.Group();
    grp.userData.isBed = true;
    grp.userData.isOverturned = true;
    this.bedPlaceholders.push(grp);

    if (this.bedGlbModel) {
      const clone = SkeletonUtils.clone(this.bedGlbModel);
      clone.scale.setScalar(1.35);
      clone.rotation.z = Math.PI / 2.3;
      clone.rotation.x = 0.2;
      clone.position.y = 0.45;
      grp.add(clone);
      return grp;
    }

    // Overturned procedural bed
    const bed = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 2.2), this.metalMat);
    frame.position.y = 0.35;
    frame.castShadow = true;

    const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.65, 0.08), this.metalMat);
    headboard.position.set(0, 0.65, -1.06);

    const footboard = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 0.08), this.metalMat);
    footboard.position.set(0, 0.55, 1.06);

    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 2.1), this.fabricMat);
    mattress.position.y = 0.55;

    bed.add(frame, headboard, footboard, mattress);
    bed.rotation.z = Math.PI / 2.3;
    bed.rotation.x = 0.2;
    bed.position.y = 0.45;

    grp.add(bed);
    return grp;
  }

  private createCurtain(): THREE.Group {
    const grp = new THREE.Group();

    // Ceiling chrome track rod
    const track = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.04, 0.04), this.chromeMat);
    track.position.y = 3.35;

    // Hanging curtain sheets with slight folds
    const sheetCount = 5;
    const width = 0.55;
    for (let i = 0; i < sheetCount; i++) {
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(width, 2.7), this.curtainMat);
      sheet.position.set((i - 2) * (width * 0.95), 1.95, (i % 2 === 0 ? 0.04 : -0.04));
      sheet.rotation.y = (i % 2 === 0 ? 0.15 : -0.15);
      sheet.castShadow = true;
      sheet.receiveShadow = true;
      grp.add(sheet);
    }

    grp.add(track);
    return grp;
  }

  private createWindow(): THREE.Group {
    const grp = new THREE.Group();

    // Outer window frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 0.12), this.windowFrameMat);
    frame.castShadow = true;

    // Security grill / bars
    const barGeo = new THREE.CylinderGeometry(0.016, 0.016, 1.45, 6);
    for (let x = -0.9; x <= 0.9; x += 0.3) {
      const bar = new THREE.Mesh(barGeo, this.darkMetalMat);
      bar.position.set(x, 0, 0.02);
      grp.add(bar);
    }

    // Frosted reinforced glass
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.45), this.windowGlassMat);
    glass.position.z = -0.01;

    // Exterior night backdrop with subtle cold dark ambient plane
    const extBackdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.8),
      new THREE.MeshBasicMaterial({ color: 0x050d18 })
    );
    extBackdrop.position.z = -0.1;

    grp.add(frame, glass, extBackdrop);
    return grp;
  }

  private createNightstand(): THREE.Group {
    const grp = new THREE.Group();

    // Nightstand body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.5), this.metalMat);
    body.position.y = 0.325;
    body.castShadow = true;

    // Top drawer handle
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.03), this.chromeMat);
    handle.position.set(0, 0.48, 0.26);

    // Bedside water pitcher
    const carafe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.18, 8), this.glassMat);
    carafe.position.set(0.12, 0.74, 0.05);

    grp.add(body, handle, carafe);
    return grp;
  }

  private createOxygenTank(): THREE.Group {
    const grp = new THREE.Group();

    // Main pressurized cylinder
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.25, 12), this.tankMat);
    cyl.position.y = 0.65;
    cyl.castShadow = true;

    // Top dome
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), this.tankMat);
    dome.position.y = 1.275;

    // Brass regulator valve & gauge
    const valve = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.08), this.metalMat);
    valve.position.y = 1.45;

    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 8), this.chromeMat);
    gauge.rotation.x = Math.PI / 2;
    gauge.position.set(0.06, 1.45, 0.04);

    grp.add(cyl, dome, valve, gauge);
    return grp;
  }

  private createMedicineCrate(): THREE.Group {
    const grp = new THREE.Group();

    // Reinforced polymer / metal crate
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.45, 0.6), this.crateMat);
    box.position.y = 0.225;
    box.castShadow = true;

    // Corner braces
    const cornerMat = this.darkMetalMat;
    const corner1 = new THREE.Mesh(new THREE.BoxGeometry(0.87, 0.06, 0.62), cornerMat);
    corner1.position.y = 0.225;

    // Red medical cross on top
    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.01, 0.06), this.redPlasticMat);
    cross1.position.set(0, 0.455, 0);
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.01, 0.24), this.redPlasticMat);
    cross2.position.set(0, 0.455, 0);

    grp.add(box, corner1, cross1, cross2);
    return grp;
  }

  private createCctvWallMonitor(): THREE.Group {
    const grp = new THREE.Group();

    // 2x2 Array of surveillance monitors
    const frameMat = this.darkMetalMat;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const x = (col - 0.5) * 0.55;
        const y = (row - 0.5) * 0.42;

        const casing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.38, 0.15), frameMat);
        casing.position.set(x, y, 0);

        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.32), this.screenCctvMat);
        screen.position.set(x, y, 0.08);

        grp.add(casing, screen);
      }
    }

    return grp;
  }

  private createIVStand(): THREE.Group {
    const grp = new THREE.Group();

    // Chrome upright pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.9, 8), this.chromeMat);
    pole.position.y = 0.95;
    pole.castShadow = true;

    // 4-star caster base
    const base1 = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.03, 0.06), this.darkMetalMat);
    base1.position.y = 0.04;
    const base2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.48), this.darkMetalMat);
    base2.position.y = 0.04;

    // Top loop hooks
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.04), this.chromeMat);
    hook.position.set(0, 1.88, 0);

    // Saline infusion bag (semi-transparent glass/plastic)
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.06), this.glassMat);
    bag.position.set(0.12, 1.72, 0);

    grp.add(pole, base1, base2, hook, bag);
    return grp;
  }

  private createWheelchair(): THREE.Group {
    const grp = new THREE.Group();

    // Large main drive wheels
    const wheelGeo = new THREE.TorusGeometry(0.32, 0.018, 8, 20);
    const wheelL = new THREE.Mesh(wheelGeo, this.chromeMat);
    wheelL.position.set(-0.34, 0.34, 0);
    wheelL.rotation.y = Math.PI / 2;
    wheelL.castShadow = true;

    const wheelR = new THREE.Mesh(wheelGeo, this.chromeMat);
    wheelR.position.set(0.34, 0.34, 0);
    wheelR.rotation.y = Math.PI / 2;
    wheelR.castShadow = true;

    // Seat and padded backrest
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.48), this.darkMetalMat);
    seat.position.set(0, 0.42, 0);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.48, 0.04), this.darkMetalMat);
    back.position.set(0, 0.68, -0.24);

    // Armrests and push handles
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.42), this.chromeMat);
    armL.position.set(-0.3, 0.54, 0);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.42), this.chromeMat);
    armR.position.set(0.3, 0.54, 0);

    const handleL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.16), this.darkMetalMat);
    handleL.position.set(-0.25, 0.92, -0.32);
    const handleR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.16), this.darkMetalMat);
    handleR.position.set(0.25, 0.92, -0.32);

    // Footrests
    const footrest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.02, 0.2), this.chromeMat);
    footrest.position.set(0, 0.12, 0.32);

    grp.add(wheelL, wheelR, seat, back, armL, armR, handleL, handleR, footrest);
    return grp;
  }

  private createMedicalMonitor(): THREE.Group {
    const grp = new THREE.Group();

    // Curved monitor housing
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.32, 0.22), this.metalMat);
    box.castShadow = true;

    // Glowing vital signs screen
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.24), this.screenEcgMat);
    screen.position.set(0, 0, 0.115);

    // Articulated wall mount bracket
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.4), this.darkMetalMat);
    arm.position.set(0, 0, -0.28);

    grp.add(box, screen, arm);
    return grp;
  }

  private createMedicalCabinet(): THREE.Group {
    const grp = new THREE.Group();

    const box = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.9, 0.28), this.metalMat);
    box.position.y = 0.45;
    box.castShadow = true;

    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.02), this.redPlasticMat);
    crossH.position.set(0, 0.45, 0.145);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.02), this.redPlasticMat);
    crossV.position.set(0, 0.45, 0.145);

    grp.add(box, crossH, crossV);
    return grp;
  }

  private createReceptionDesk(): THREE.Group {
    const grp = new THREE.Group();

    // Main U-shaped or curved reception counter
    const counterMat = new THREE.MeshStandardMaterial({ color: 0x5a6c7d, roughness: 0.45, metalness: 0.2 });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.15, 1.4), counterMat);
    desk.position.y = 0.575;
    desk.castShadow = true;
    desk.receiveShadow = true;

    // Raised privacy partition
    const partition = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.35, 0.08), this.metalMat);
    partition.position.set(0, 1.325, 0.65);

    // Desk PC monitors
    for (let i = -1.2; i <= 1.2; i += 2.4) {
      const pc = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.36, 0.06), this.darkMetalMat);
      pc.position.set(i, 1.35, 0.1);
      const pcScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), this.screenCctvMat);
      pcScreen.position.set(i, 1.35, 0.135);
      pcScreen.rotation.y = Math.PI;
      grp.add(pc, pcScreen);
    }

    grp.add(desk, partition);
    return grp;
  }

  private createSecurityConsole(): THREE.Group {
    const grp = new THREE.Group();

    // Industrial metal surveillance console table
    const table = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.85, 1.1), this.darkMetalMat);
    table.position.y = 0.425;
    table.castShadow = true;

    // Bank of 3 CCTV monitors
    for (let i = -0.9; i <= 0.9; i += 0.9) {
      const mon = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.48, 0.18), this.metalMat);
      mon.position.set(i, 1.15, -0.2);
      mon.castShadow = true;

      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.4), this.screenCctvMat);
      screen.position.set(i, 1.15, -0.105);

      grp.add(mon, screen);
    }

    // Keyboard & keycard tray
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.03, 0.18), this.darkMetalMat);
    kb.position.set(0, 0.87, 0.2);
    grp.add(table, kb);
    return grp;
  }

  private createPharmacyShelf(): THREE.Group {
    const grp = new THREE.Group();

    // Steel framework
    const shelfGeo = new THREE.BoxGeometry(2.4, 2.2, 0.6);
    const frame = new THREE.Mesh(shelfGeo, this.darkMetalMat);
    frame.position.y = 1.1;
    frame.castShadow = true;

    // Shelving tier dividers filled with medicine crates
    for (let y = 0.45; y <= 1.85; y += 0.45) {
      const tier = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.04, 0.58), this.metalMat);
      tier.position.y = y;
      grp.add(tier);

      // Medicine bottles & boxes
      for (let x = -0.9; x <= 0.9; x += 0.45) {
        const bottle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.12), this.fabricMat);
        bottle.position.set(x + (Math.random() - 0.5) * 0.05, y + 0.1, (Math.random() - 0.5) * 0.15);
        grp.add(bottle);
      }
    }

    grp.add(frame);
    return grp;
  }

  private createFilingCabinet(): THREE.Group {
    const grp = new THREE.Group();
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.35, 0.65), this.darkMetalMat);
    cab.position.y = 0.675;
    cab.castShadow = true;

    // 4 drawer seams
    for (let i = 0; i < 4; i++) {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.03), this.chromeMat);
      handle.position.set(0, 0.25 + i * 0.32, 0.34);
      grp.add(handle);
    }

    grp.add(cab);
    return grp;
  }

  private createCrashCart(): THREE.Group {
    const grp = new THREE.Group();

    // Red emergency mobile crash cart
    const cart = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.9, 0.55), this.redPlasticMat);
    cart.position.y = 0.52;
    cart.castShadow = true;

    // Top defibrillator unit
    const defib = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.3), this.darkMetalMat);
    defib.position.set(0, 1.08, 0);

    // Oxygen tank cylinder
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.65, 8), this.chromeMat);
    tank.position.set(0.42, 0.5, 0);

    grp.add(cart, defib, tank);
    return grp;
  }

  private createStretcher(): THREE.Group {
    const grp = new THREE.Group();

    const gurney = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.45, 2.0), this.chromeMat);
    gurney.position.y = 0.45;
    gurney.castShadow = true;

    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 1.95), this.fabricMat);
    pad.position.y = 0.72;

    grp.add(gurney, pad);
    return grp;
  }

  private createDebrisPile(): THREE.Group {
    const grp = new THREE.Group();

    // Scattered papers, overturned trash bin, broken concrete chunk
    const chunk1 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.35), this.wallMat);
    chunk1.position.set(0.1, 0.09, 0);
    chunk1.rotation.y = 0.3;

    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.45, 8), this.darkMetalMat);
    bin.position.set(-0.25, 0.12, 0.15);
    bin.rotation.z = Math.PI / 2;

    grp.add(chunk1, bin);
    return grp;
  }

  private createBloodSplatter(): THREE.Group {
    const grp = new THREE.Group();
    const bloodMat = new THREE.MeshStandardMaterial({
      color: 0x4a0505,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.92
    });

    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.65, 8), bloodMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.01;

    grp.add(pool);
    return grp;
  }

  private createWallSign(text: string): THREE.Group {
    const grp = new THREE.Group();
    grp.userData.signText = text;

    const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 0.04), this.signMat);
    board.castShadow = true;

    // Green / white illuminated badge
    const badgeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const badge = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 0.05), badgeMat);

    grp.add(board, badge);
    return grp;
  }

  public dispose(): void {
    this.bedPlaceholders = [];
    this.bedGlbModel = null;
    for (const c of this.colliders) {
      if (c && c.body) {
        this.physicsWorld.removeRigidBody(c.body);
      }
    }
    this.colliders = [];

    if (this.environmentGroup.parent) {
      this.environmentGroup.parent.remove(this.environmentGroup);
    }
  }
}
