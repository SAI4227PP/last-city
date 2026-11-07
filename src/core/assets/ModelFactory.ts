import * as THREE from 'three';
import { WeaponType, ZombieVariantType } from '@/shared/types';
import { ZOMBIE_CONFIGS } from '@/data/zombies';
import { TextureGenerator } from './TextureGenerator';

export interface PlayerModelParts {
  root: THREE.Group;
  body: THREE.Group; // Pelvis / Lower Body node
  spine: THREE.Group; // Articulated spine
  chest: THREE.Group; // Articulated upper torso
  head: THREE.Mesh;   // Head mesh
  headGroup: THREE.Group; // Head articulation node
  leftArm: THREE.Group; // Shoulder joint
  leftElbow: THREE.Group; // Elbow joint
  leftHand: THREE.Group; // Hand/wrist joint
  rightArm: THREE.Group; // Right shoulder joint
  rightElbow: THREE.Group; // Right elbow joint
  rightHand: THREE.Group; // Right hand joint
  weaponSocket: THREE.Group; // Attached weapon socket
  leftLeg: THREE.Group; // Left hip joint
  leftKnee: THREE.Group; // Left knee joint
  rightLeg: THREE.Group; // Right hip joint
  rightKnee: THREE.Group; // Right knee joint
  flashlight: THREE.SpotLight;
}

export interface ZombieModelParts {
  root: THREE.Group;
  body: THREE.Group;
  spine: THREE.Group;
  chest: THREE.Group;
  head: THREE.Mesh;
  headGroup: THREE.Group;
  jaw?: THREE.Group;
  leftArm: THREE.Group;
  leftElbow: THREE.Group;
  rightArm: THREE.Group;
  rightElbow: THREE.Group;
  leftLeg: THREE.Group;
  leftKnee: THREE.Group;
  rightLeg: THREE.Group;
  rightKnee: THREE.Group;
  eyeLights: THREE.PointLight[];
  acidLight?: THREE.PointLight;
  viralLight?: THREE.PointLight;
  mutatedPart?: THREE.Object3D;
}

export class ModelFactory {
  private static materials: Map<string, THREE.Material> = new Map();
  private static geometries: Map<string, THREE.BufferGeometry> = new Map();

  private static getMaterial<T extends THREE.Material>(key: string, factory: () => T): T {
    if (!this.materials.has(key)) {
      const mat = factory();
      mat.userData.isShared = true;
      this.materials.set(key, mat);
    }
    return this.materials.get(key) as T;
  }

  private static getGeometry<T extends THREE.BufferGeometry>(key: string, factory: () => T): T {
    if (!this.geometries.has(key)) {
      const geo = factory();
      geo.userData.isShared = true;
      this.geometries.set(key, geo);
    }
    return this.geometries.get(key) as T;
  }

  public static clearCache(): void {
    this.materials.forEach((mat) => mat.dispose());
    this.materials.clear();
    this.geometries.forEach((geo) => geo.dispose());
    this.geometries.clear();
  }

  // =========================================================================
  // 1. SURVIVOR PLAYER CHARACTER (ANATOMICALLY PROPORTIONED & ARTICULATED)
  // =========================================================================
  public static createPlayerModel(): PlayerModelParts {
    const root = new THREE.Group();
    root.name = 'PlayerSurvivor';

    // PBR Textures
    const skinTex = TextureGenerator.createSurvivorSkin();
    const skinNormal = TextureGenerator.createSkinNormalMap();
    const faceTex = TextureGenerator.createSurvivorFace();
    const jacketTex = TextureGenerator.createTacticalJacket();
    const pantsTex = TextureGenerator.createCargoPants();
    const bootsTex = TextureGenerator.createCombatBoots();
    const packTex = TextureGenerator.createTacticalBackpack();

    // PBR Materials
    const skinMat = this.getMaterial('pbr_survivor_skin', () => new THREE.MeshStandardMaterial({
      map: skinTex,
      normalMap: skinNormal,
      roughness: 0.6,
      metalness: 0.05
    }));

    const faceMat = this.getMaterial('pbr_survivor_face', () => new THREE.MeshStandardMaterial({
      map: faceTex,
      normalMap: skinNormal,
      roughness: 0.55,
      metalness: 0.05
    }));

    const hairMat = this.getMaterial('pbr_survivor_hair', () => new THREE.MeshStandardMaterial({
      color: 0x221711,
      roughness: 0.85
    }));

    const jacketMat = this.getMaterial('pbr_survivor_jacket', () => new THREE.MeshStandardMaterial({
      map: jacketTex,
      roughness: 0.75,
      metalness: 0.1
    }));

    const vestMat = this.getMaterial('pbr_survivor_vest', () => new THREE.MeshStandardMaterial({
      color: 0x1f271e,
      roughness: 0.7,
      metalness: 0.2
    }));

    const pantsMat = this.getMaterial('pbr_survivor_pants', () => new THREE.MeshStandardMaterial({
      map: pantsTex,
      roughness: 0.8,
      metalness: 0.05
    }));

    const bootsMat = this.getMaterial('pbr_survivor_boots', () => new THREE.MeshStandardMaterial({
      map: bootsTex,
      roughness: 0.5,
      metalness: 0.2
    }));

    const gearMat = this.getMaterial('pbr_survivor_gear', () => new THREE.MeshStandardMaterial({
      color: 0x181818,
      roughness: 0.6,
      metalness: 0.6
    }));

    const packMat = this.getMaterial('pbr_survivor_pack', () => new THREE.MeshStandardMaterial({
      map: packTex,
      roughness: 0.85
    }));

    // 1. Pelvis / Hips (Root body node at y = 0.95m)
    const body = new THREE.Group();
    body.name = 'Pelvis';
    body.position.y = 0.95;
    root.add(body);

    const pelvisGeo = this.getGeometry('geo_player_pelvis', () => new THREE.BoxGeometry(0.34, 0.18, 0.22));
    const pelvisMesh = new THREE.Mesh(pelvisGeo, pantsMat);
    pelvisMesh.castShadow = true;
    body.add(pelvisMesh);

    // Tactical Belt with brass buckle & ammo pouch
    const beltGeo = this.getGeometry('geo_player_belt', () => new THREE.BoxGeometry(0.36, 0.06, 0.24));
    const beltMesh = new THREE.Mesh(beltGeo, gearMat);
    beltMesh.position.y = 0.06;
    body.add(beltMesh);

    const holsterGeo = this.getGeometry('geo_player_holster', () => new THREE.BoxGeometry(0.08, 0.18, 0.12));
    const holsterMesh = new THREE.Mesh(holsterGeo, gearMat);
    holsterMesh.position.set(0.20, -0.06, 0.02);
    holsterMesh.rotation.z = -0.1;
    body.add(holsterMesh);

    // 2. Spine (Articulation node for torso flex)
    const spine = new THREE.Group();
    spine.name = 'Spine';
    spine.position.y = 0.12;
    body.add(spine);

    const abdomenGeo = this.getGeometry('geo_player_abdomen', () => new THREE.BoxGeometry(0.32, 0.18, 0.20));
    const abdomenMesh = new THREE.Mesh(abdomenGeo, jacketMat);
    abdomenMesh.position.y = 0.08;
    abdomenMesh.castShadow = true;
    spine.add(abdomenMesh);

    // 3. Chest / Upper Torso (Articulation node for spine twist & aim)
    const chest = new THREE.Group();
    chest.name = 'Chest';
    chest.position.y = 0.20;
    spine.add(chest);

    const chestGeo = this.getGeometry('geo_player_chest', () => new THREE.BoxGeometry(0.44, 0.30, 0.24));
    const chestMesh = new THREE.Mesh(chestGeo, jacketMat);
    chestMesh.position.y = 0.15;
    chestMesh.castShadow = true;
    chest.add(chestMesh);

    // Tactical Vest Plates (Front & Back ballistic protection)
    const vestGeo = this.getGeometry('geo_player_vest', () => new THREE.BoxGeometry(0.42, 0.28, 0.26));
    const vestMesh = new THREE.Mesh(vestGeo, vestMat);
    vestMesh.position.y = 0.15;
    vestMesh.castShadow = true;
    chest.add(vestMesh);

    // Front Magazine Pouches on Vest
    const pouchGeo = this.getGeometry('geo_player_pouches', () => new THREE.BoxGeometry(0.24, 0.12, 0.06));
    const pouchMesh = new THREE.Mesh(pouchGeo, gearMat);
    pouchMesh.position.set(0, 0.12, 0.15);
    chest.add(pouchMesh);

    // Radio with antenna on shoulder strap
    const radioGeo = this.getGeometry('geo_player_radio', () => new THREE.BoxGeometry(0.06, 0.12, 0.04));
    const radioMesh = new THREE.Mesh(radioGeo, gearMat);
    radioMesh.position.set(-0.16, 0.22, 0.14);
    chest.add(radioMesh);

    const antennaGeo = this.getGeometry('geo_player_antenna', () => new THREE.CylinderGeometry(0.005, 0.005, 0.16));
    const antennaMesh = new THREE.Mesh(antennaGeo, gearMat);
    antennaMesh.position.set(-0.16, 0.34, 0.14);
    chest.add(antennaMesh);

    // Tactical Backpack on back with strapped bedroll
    const packGeo = this.getGeometry('geo_player_backpack', () => new THREE.BoxGeometry(0.36, 0.42, 0.18));
    const packMesh = new THREE.Mesh(packGeo, packMat);
    packMesh.position.set(0, 0.14, -0.21);
    packMesh.castShadow = true;
    chest.add(packMesh);

    const bedrollGeo = this.getGeometry('geo_player_bedroll', () => {
      const geo = new THREE.CylinderGeometry(0.08, 0.08, 0.38, 8);
      geo.rotateZ(Math.PI / 2);
      return geo;
    });
    const bedrollMesh = new THREE.Mesh(bedrollGeo, gearMat);
    bedrollMesh.position.set(0, 0.38, -0.21);
    chest.add(bedrollMesh);

    // 4. Head Group (Neck + Cranium + Face + Hair)
    const headGroup = new THREE.Group();
    headGroup.name = 'HeadGroup';
    headGroup.position.set(0, 0.32, 0);
    chest.add(headGroup);

    // Anatomical neck
    const neckGeo = this.getGeometry('geo_player_neck', () => new THREE.CylinderGeometry(0.08, 0.09, 0.10, 8));
    const neckMesh = new THREE.Mesh(neckGeo, skinMat);
    neckMesh.position.y = 0.05;
    headGroup.add(neckMesh);

    // Cranium & Jaw structure
    const headGeo = this.getGeometry('geo_player_cranium', () => new THREE.BoxGeometry(0.22, 0.24, 0.22));
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 0.20, 0);
    head.castShadow = true;
    headGroup.add(head);

    // Detailed Front Face Plane
    const facePlaneGeo = this.getGeometry('geo_player_face_plane', () => new THREE.PlaneGeometry(0.20, 0.22));
    const faceMesh = new THREE.Mesh(facePlaneGeo, faceMat);
    faceMesh.position.set(0, 0.20, 0.112);
    headGroup.add(faceMesh);

    // Hair Volume
    const hairGeo = this.getGeometry('geo_player_hair', () => new THREE.BoxGeometry(0.23, 0.10, 0.24));
    const hairMesh = new THREE.Mesh(hairGeo, hairMat);
    hairMesh.position.set(0, 0.30, -0.01);
    hairMesh.castShadow = true;
    headGroup.add(hairMesh);

    // Ears
    const earGeo = this.getGeometry('geo_player_ear', () => new THREE.BoxGeometry(0.03, 0.06, 0.04));
    const leftEar = new THREE.Mesh(earGeo, skinMat);
    leftEar.position.set(-0.115, 0.20, 0);
    const rightEar = new THREE.Mesh(earGeo, skinMat);
    rightEar.position.set(0.115, 0.20, 0);
    headGroup.add(leftEar, rightEar);

    // Chest-mounted tactical flashlight
    const torchGeo = this.getGeometry('geo_player_torch', () => {
      const geo = new THREE.CylinderGeometry(0.03, 0.04, 0.14, 8);
      geo.rotateX(Math.PI / 2);
      return geo;
    });
    const torchMesh = new THREE.Mesh(torchGeo, gearMat);
    torchMesh.position.set(0.14, 0.24, 0.16);
    chest.add(torchMesh);

    const flashlight = new THREE.SpotLight(0xfff5e6, 3.2, 35, Math.PI / 5, 0.35, 1.2);
    flashlight.position.set(0.14, 0.24, 0.22);
    flashlight.castShadow = true;
    flashlight.shadow.mapSize.width = 1024;
    flashlight.shadow.mapSize.height = 1024;
    chest.add(flashlight);

    // 5. Left Arm (Shoulder -> Bicep -> Elbow -> Forearm -> Wrist -> Hand)
    const leftArm = new THREE.Group();
    leftArm.name = 'LeftArm_Shoulder';
    leftArm.position.set(-0.28, 0.22, 0);
    chest.add(leftArm);

    const shoulderGeo = this.getGeometry('geo_player_shoulder', () => new THREE.SphereGeometry(0.08, 6, 6));
    const leftShoulderMesh = new THREE.Mesh(shoulderGeo, jacketMat);
    leftArm.add(leftShoulderMesh);

    const upperArmGeo = this.getGeometry('geo_player_upperarm', () => {
      const geo = new THREE.CylinderGeometry(0.065, 0.055, 0.26, 6);
      geo.translate(0, -0.13, 0);
      return geo;
    });
    const leftUpperArmMesh = new THREE.Mesh(upperArmGeo, jacketMat);
    leftUpperArmMesh.castShadow = true;
    leftArm.add(leftUpperArmMesh);

    // Left Elbow Hinge
    const leftElbow = new THREE.Group();
    leftElbow.name = 'LeftArm_Elbow';
    leftElbow.position.set(0, -0.26, 0);
    leftArm.add(leftElbow);

    const forearmGeo = this.getGeometry('geo_player_forearm', () => {
      const geo = new THREE.CylinderGeometry(0.055, 0.045, 0.24, 6);
      geo.translate(0, -0.12, 0);
      return geo;
    });
    const leftForearmMesh = new THREE.Mesh(forearmGeo, skinMat);
    leftForearmMesh.castShadow = true;
    leftElbow.add(leftForearmMesh);

    // Tactical Wristwatch on Left Arm
    const watchGeo = this.getGeometry('geo_player_watch', () => new THREE.CylinderGeometry(0.058, 0.058, 0.05, 8));
    const watchMesh = new THREE.Mesh(watchGeo, gearMat);
    watchMesh.position.set(0, -0.18, 0);
    leftElbow.add(watchMesh);

    // Left Hand with articulated palm & fingers
    const leftHand = new THREE.Group();
    leftHand.name = 'LeftArm_Hand';
    leftHand.position.set(0, -0.24, 0);
    leftElbow.add(leftHand);

    const handGeo = this.getGeometry('geo_player_hand', () => new THREE.BoxGeometry(0.07, 0.09, 0.04));
    const leftHandMesh = new THREE.Mesh(handGeo, skinMat);
    leftHandMesh.position.set(0, -0.04, 0);
    leftHand.add(leftHandMesh);

    // 6. Right Arm (Shoulder -> UpperArm -> Elbow -> Forearm -> Wrist -> Hand + WeaponSocket)
    const rightArm = new THREE.Group();
    rightArm.name = 'RightArm_Shoulder';
    rightArm.position.set(0.28, 0.22, 0);
    chest.add(rightArm);

    const rightShoulderMesh = new THREE.Mesh(shoulderGeo, jacketMat);
    rightArm.add(rightShoulderMesh);

    const rightUpperArmMesh = new THREE.Mesh(upperArmGeo, jacketMat);
    rightUpperArmMesh.castShadow = true;
    rightArm.add(rightUpperArmMesh);

    // Right Elbow Hinge
    const rightElbow = new THREE.Group();
    rightElbow.name = 'RightArm_Elbow';
    rightElbow.position.set(0, -0.26, 0);
    rightArm.add(rightElbow);

    const rightForearmMesh = new THREE.Mesh(forearmGeo, skinMat);
    rightForearmMesh.castShadow = true;
    rightElbow.add(rightForearmMesh);

    // Right Hand
    const rightHand = new THREE.Group();
    rightHand.name = 'RightArm_Hand';
    rightHand.position.set(0, -0.24, 0);
    rightElbow.add(rightHand);

    const rightHandMesh = new THREE.Mesh(handGeo, skinMat);
    rightHandMesh.position.set(0, -0.04, 0);
    rightHand.add(rightHandMesh);

    // Weapon Socket in Right Hand Grip
    const weaponSocket = new THREE.Group();
    weaponSocket.name = 'WeaponSocket';
    weaponSocket.position.set(0, -0.05, 0.04);
    rightHand.add(weaponSocket);

    // 7. Left Leg (Hip -> Thigh -> Knee -> Calf -> Ankle -> Combat Boot)
    const leftLeg = new THREE.Group();
    leftLeg.name = 'LeftLeg_Hip';
    leftLeg.position.set(-0.14, 0, 0);
    body.add(leftLeg);

    const thighGeo = this.getGeometry('geo_player_thigh', () => {
      const geo = new THREE.CylinderGeometry(0.09, 0.075, 0.42, 6);
      geo.translate(0, -0.21, 0);
      return geo;
    });
    const leftThighMesh = new THREE.Mesh(thighGeo, pantsMat);
    leftThighMesh.castShadow = true;
    leftLeg.add(leftThighMesh);

    // Left Knee Hinge
    const leftKnee = new THREE.Group();
    leftKnee.name = 'LeftLeg_Knee';
    leftKnee.position.set(0, -0.42, 0);
    leftLeg.add(leftKnee);

    // Protective Kneepad
    const kneepadGeo = this.getGeometry('geo_player_kneepad', () => new THREE.BoxGeometry(0.12, 0.12, 0.06));
    const leftKneepad = new THREE.Mesh(kneepadGeo, gearMat);
    leftKneepad.position.set(0, 0, 0.06);
    leftKnee.add(leftKneepad);

    const calfGeo = this.getGeometry('geo_player_calf', () => {
      const geo = new THREE.CylinderGeometry(0.075, 0.065, 0.38, 6);
      geo.translate(0, -0.19, 0);
      return geo;
    });
    const leftCalfMesh = new THREE.Mesh(calfGeo, pantsMat);
    leftCalfMesh.castShadow = true;
    leftKnee.add(leftCalfMesh);

    // Left Combat Boot
    const bootGeo = this.getGeometry('geo_player_boot', () => {
      const geo = new THREE.BoxGeometry(0.13, 0.14, 0.24);
      geo.translate(0, -0.07, 0.04);
      return geo;
    });
    const leftBootMesh = new THREE.Mesh(bootGeo, bootsMat);
    leftBootMesh.position.set(0, -0.38, 0);
    leftBootMesh.castShadow = true;
    leftKnee.add(leftBootMesh);

    // 8. Right Leg (Hip -> Thigh -> Knee -> Calf -> Ankle -> Combat Boot)
    const rightLeg = new THREE.Group();
    rightLeg.name = 'RightLeg_Hip';
    rightLeg.position.set(0.14, 0, 0);
    body.add(rightLeg);

    const rightThighMesh = new THREE.Mesh(thighGeo, pantsMat);
    rightThighMesh.castShadow = true;
    rightLeg.add(rightThighMesh);

    // Right Knee Hinge
    const rightKnee = new THREE.Group();
    rightKnee.name = 'RightLeg_Knee';
    rightKnee.position.set(0, -0.42, 0);
    rightLeg.add(rightKnee);

    const rightKneepad = new THREE.Mesh(kneepadGeo, gearMat);
    rightKneepad.position.set(0, 0, 0.06);
    rightKnee.add(rightKneepad);

    const rightCalfMesh = new THREE.Mesh(calfGeo, pantsMat);
    rightCalfMesh.castShadow = true;
    rightKnee.add(rightCalfMesh);

    const rightBootMesh = new THREE.Mesh(bootGeo, bootsMat);
    rightBootMesh.position.set(0, -0.38, 0);
    rightBootMesh.castShadow = true;
    rightKnee.add(rightBootMesh);

    return {
      root,
      body,
      spine,
      chest,
      head,
      headGroup,
      leftArm,
      leftElbow,
      leftHand,
      rightArm,
      rightElbow,
      rightHand,
      weaponSocket,
      leftLeg,
      leftKnee,
      rightLeg,
      rightKnee,
      flashlight
    };
  }

  // =========================================================================
  // 2. FIVE DISTINCT HIGH-DETAIL ZOMBIE TYPOLOGIES
  // =========================================================================
  public static createZombieModel(variant: ZombieVariantType): ZombieModelParts {
    const config = ZOMBIE_CONFIGS[variant];
    const root = new THREE.Group();
    root.name = `Zombie_${variant}`;
    root.scale.set(config.scale[0], config.scale[1], config.scale[2]);

    const eyeLights: THREE.PointLight[] = [];

    // Pelvis root
    const body = new THREE.Group();
    body.name = 'Zombie_Pelvis';
    body.position.y = 0.95;
    root.add(body);

    const spine = new THREE.Group();
    spine.name = 'Zombie_Spine';
    spine.position.y = 0.12;
    body.add(spine);

    const chest = new THREE.Group();
    chest.name = 'Zombie_Chest';
    chest.position.y = 0.20;
    spine.add(chest);

    const headGroup = new THREE.Group();
    headGroup.name = 'Zombie_HeadGroup';
    headGroup.position.set(0, 0.32, 0);
    chest.add(headGroup);

    const leftArm = new THREE.Group();
    leftArm.name = 'Zombie_LeftArm';
    chest.add(leftArm);

    const leftElbow = new THREE.Group();
    leftArm.add(leftElbow);

    const rightArm = new THREE.Group();
    rightArm.name = 'Zombie_RightArm';
    chest.add(rightArm);

    const rightElbow = new THREE.Group();
    rightArm.add(rightElbow);

    const leftLeg = new THREE.Group();
    leftLeg.name = 'Zombie_LeftLeg';
    body.add(leftLeg);

    const leftKnee = new THREE.Group();
    leftLeg.add(leftKnee);

    const rightLeg = new THREE.Group();
    rightLeg.name = 'Zombie_RightLeg';
    body.add(rightLeg);

    const rightKnee = new THREE.Group();
    rightLeg.add(rightKnee);

    // Variant-specific PBR Textures & Geometries
    switch (variant) {
      // ---------------------------------------------------------------------
      // VARIANT 1: INFECTED SHAMBLER (Decayed flesh, torn ribs, crooked jaw)
      // ---------------------------------------------------------------------
      case 'walker': {
        const fleshTex = TextureGenerator.createShamblerFlesh();
        const faceTex = TextureGenerator.createShamblerFace();
        const fleshMat = this.getMaterial('pbr_shambler_flesh', () => new THREE.MeshStandardMaterial({
          map: fleshTex,
          roughness: 0.85,
          color: 0x8a9484
        }));
        const faceMat = this.getMaterial('pbr_shambler_face', () => new THREE.MeshStandardMaterial({
          map: faceTex,
          roughness: 0.8
        }));
        const ragMat = this.getMaterial('pbr_shambler_rag', () => new THREE.MeshStandardMaterial({
          color: 0x2b3329,
          roughness: 0.95
        }));

        // Hunched thoracic spine
        spine.rotation.x = 0.15;
        spine.rotation.z = -0.08;

        // Torn Torso with exposed ribs
        const torsoGeo = this.getGeometry('geo_shambler_torso', () => new THREE.BoxGeometry(0.42, 0.32, 0.22));
        const torsoMesh = new THREE.Mesh(torsoGeo, ragMat);
        torsoMesh.position.y = 0.16;
        torsoMesh.castShadow = true;
        chest.add(torsoMesh);

        // Exposed rotting ribs on chest
        const ribGeo = this.getGeometry('geo_shambler_ribs', () => new THREE.BoxGeometry(0.18, 0.22, 0.05));
        const ribMesh = new THREE.Mesh(ribGeo, fleshMat);
        ribMesh.position.set(0.08, 0.16, 0.11);
        chest.add(ribMesh);

        // Deformed Head with drooping jaw
        const craniumGeo = this.getGeometry('geo_shambler_head', () => new THREE.BoxGeometry(0.22, 0.24, 0.22));
        const head = new THREE.Mesh(craniumGeo, fleshMat);
        head.position.set(0, 0.18, 0);
        head.castShadow = true;
        headGroup.add(head);

        const facePlane = new THREE.Mesh(this.getGeometry('geo_shambler_face_plane', () => new THREE.PlaneGeometry(0.20, 0.22)), faceMat);
        facePlane.position.set(0, 0.18, 0.112);
        headGroup.add(facePlane);

        // Drooping unhinged lower jaw
        const jawGeo = this.getGeometry('geo_shambler_jaw', () => new THREE.BoxGeometry(0.16, 0.08, 0.12));
        const jaw = new THREE.Group();
        jaw.position.set(0, 0.08, 0.06);
        jaw.rotation.x = 0.25; // Drooping open
        const jawMesh = new THREE.Mesh(jawGeo, fleshMat);
        jaw.add(jawMesh);
        headGroup.add(jaw);

        // Arms (Withered, reaching out with clawed fingers)
        leftArm.position.set(-0.28, 0.20, 0);
        leftArm.rotation.x = -Math.PI / 3.5;
        const armGeo = this.getGeometry('geo_shambler_arm', () => {
          const g = new THREE.CylinderGeometry(0.05, 0.04, 0.26, 6);
          g.translate(0, -0.13, 0);
          return g;
        });
        leftArm.add(new THREE.Mesh(armGeo, fleshMat));

        leftElbow.position.set(0, -0.26, 0);
        leftElbow.rotation.x = -0.4;
        leftElbow.add(new THREE.Mesh(armGeo, fleshMat));

        rightArm.position.set(0.28, 0.20, 0);
        rightArm.rotation.x = -Math.PI / 4;
        rightArm.add(new THREE.Mesh(armGeo, fleshMat));

        rightElbow.position.set(0, -0.26, 0);
        rightElbow.rotation.x = -0.3;
        rightElbow.add(new THREE.Mesh(armGeo, fleshMat));

        // Dragging asymmetric legs
        const legGeo = this.getGeometry('geo_shambler_leg', () => {
          const g = new THREE.CylinderGeometry(0.08, 0.06, 0.40, 6);
          g.translate(0, -0.20, 0);
          return g;
        });

        leftLeg.position.set(-0.14, 0, 0);
        leftLeg.add(new THREE.Mesh(legGeo, ragMat));
        leftKnee.position.set(0, -0.40, 0);
        leftKnee.add(new THREE.Mesh(legGeo, ragMat));

        rightLeg.position.set(0.14, 0, 0);
        rightLeg.rotation.z = -0.12; // Dragging limb outward
        rightLeg.add(new THREE.Mesh(legGeo, ragMat));
        rightKnee.position.set(0, -0.40, 0);
        rightKnee.rotation.x = 0.15;
        rightKnee.add(new THREE.Mesh(legGeo, fleshMat)); // Exposed rotten shin

        return { root, body, spine, chest, head, headGroup, jaw, leftArm, leftElbow, rightArm, rightElbow, leftLeg, leftKnee, rightLeg, rightKnee, eyeLights };
      }

      // ---------------------------------------------------------------------
      // VARIANT 2: FERAL RUNNER (Lean predatory crouch, sinewy tendons, claws)
      // ---------------------------------------------------------------------
      case 'runner': {
        const fleshTex = TextureGenerator.createRunnerFlesh();
        const fleshMat = this.getMaterial('pbr_runner_flesh', () => new THREE.MeshStandardMaterial({
          map: fleshTex,
          color: 0x9e4738,
          roughness: 0.65
        }));
        const ragMat = this.getMaterial('pbr_runner_rag', () => new THREE.MeshStandardMaterial({
          color: 0x1f1614,
          roughness: 0.9
        }));

        // Aggressive forward lean (25 degrees)
        body.position.y = 0.85;
        spine.rotation.x = 0.45;

        const torsoGeo = this.getGeometry('geo_runner_torso', () => new THREE.BoxGeometry(0.36, 0.32, 0.18));
        const torsoMesh = new THREE.Mesh(torsoGeo, ragMat);
        torsoMesh.position.y = 0.16;
        chest.add(torsoMesh);

        // Predatory neck angle and snarling fanged head
        headGroup.position.set(0, 0.28, 0.10);
        headGroup.rotation.x = -0.25; // Snapping head forward

        const headGeo = this.getGeometry('geo_runner_head', () => new THREE.BoxGeometry(0.19, 0.20, 0.24));
        const head = new THREE.Mesh(headGeo, fleshMat);
        head.position.set(0, 0.14, 0);
        headGroup.add(head);

        // Glowing predatory red eye light
        const eyeLight = new THREE.PointLight(0xff3300, 1.4, 4);
        eyeLight.position.set(0, 0.14, 0.14);
        headGroup.add(eyeLight);
        eyeLights.push(eyeLight);

        // Snarling elongated fangs
        const fangGeo = this.getGeometry('geo_runner_fangs', () => new THREE.ConeGeometry(0.015, 0.05, 4));
        const f1 = new THREE.Mesh(fangGeo, this.getMaterial('fang_mat', () => new THREE.MeshStandardMaterial({ color: 0xedd6af })));
        f1.position.set(-0.04, 0.04, 0.12);
        f1.rotation.x = Math.PI;
        const f2 = f1.clone();
        f2.position.x = 0.04;
        headGroup.add(f1, f2);

        // Long sinewy arms with sharp talons
        const armGeo = this.getGeometry('geo_runner_arm', () => {
          const g = new THREE.CylinderGeometry(0.045, 0.035, 0.30, 6);
          g.translate(0, -0.15, 0);
          return g;
        });
        const clawGeo = this.getGeometry('geo_runner_claws', () => new THREE.BoxGeometry(0.08, 0.14, 0.02));

        leftArm.position.set(-0.24, 0.18, 0);
        leftArm.rotation.x = 0.2; // Backswing ready to pounce
        leftArm.add(new THREE.Mesh(armGeo, fleshMat));
        leftElbow.position.set(0, -0.30, 0);
        leftElbow.rotation.x = -0.8;
        leftElbow.add(new THREE.Mesh(armGeo, fleshMat));
        const leftClaws = new THREE.Mesh(clawGeo, fleshMat);
        leftClaws.position.set(0, -0.32, 0);
        leftElbow.add(leftClaws);

        rightArm.position.set(0.24, 0.18, 0);
        rightArm.rotation.x = -0.4;
        rightArm.add(new THREE.Mesh(armGeo, fleshMat));
        rightElbow.position.set(0, -0.30, 0);
        rightElbow.rotation.x = -0.8;
        rightElbow.add(new THREE.Mesh(armGeo, fleshMat));
        const rightClaws = new THREE.Mesh(clawGeo, fleshMat);
        rightClaws.position.set(0, -0.32, 0);
        rightElbow.add(rightClaws);

        // Sprinter legs (high knees, arched feet)
        const thighGeo = this.getGeometry('geo_runner_thigh', () => {
          const g = new THREE.CylinderGeometry(0.08, 0.06, 0.38, 6);
          g.translate(0, -0.19, 0);
          return g;
        });
        leftLeg.position.set(-0.12, 0, 0);
        leftLeg.rotation.x = -0.3;
        leftLeg.add(new THREE.Mesh(thighGeo, ragMat));
        leftKnee.position.set(0, -0.38, 0);
        leftKnee.rotation.x = 0.6; // Deep knee spring
        leftKnee.add(new THREE.Mesh(thighGeo, fleshMat));

        rightLeg.position.set(0.12, 0, 0);
        rightLeg.rotation.x = 0.2;
        rightLeg.add(new THREE.Mesh(thighGeo, ragMat));
        rightKnee.position.set(0, -0.38, 0);
        rightKnee.rotation.x = 0.5;
        rightKnee.add(new THREE.Mesh(thighGeo, fleshMat));

        return { root, body, spine, chest, head, headGroup, leftArm, leftElbow, rightArm, rightElbow, leftLeg, leftKnee, rightLeg, rightKnee, eyeLights };
      }

      // ---------------------------------------------------------------------
      // VARIANT 3: ARMORED BRUTE (Massive SWAT armor, bulked muscles, helmet)
      // ---------------------------------------------------------------------
      case 'brute': {
        const fleshTex = TextureGenerator.createBruteFlesh();
        const armorTex = TextureGenerator.createRiotArmor();
        const fleshMat = this.getMaterial('pbr_brute_flesh', () => new THREE.MeshStandardMaterial({
          map: fleshTex,
          color: 0x484c50,
          roughness: 0.8
        }));
        const armorMat = this.getMaterial('pbr_brute_armor', () => new THREE.MeshStandardMaterial({
          map: armorTex,
          metalness: 0.5,
          roughness: 0.5
        }));

        body.position.y = 1.05;

        // Massive hulking chest (1.6x width)
        const torsoGeo = this.getGeometry('geo_brute_torso', () => new THREE.BoxGeometry(0.68, 0.44, 0.38));
        const torsoMesh = new THREE.Mesh(torsoGeo, armorMat);
        torsoMesh.position.y = 0.22;
        torsoMesh.castShadow = true;
        chest.add(torsoMesh);

        // Heavy shoulder pauldrons
        const pauldronGeo = this.getGeometry('geo_brute_pauldron', () => new THREE.BoxGeometry(0.24, 0.16, 0.26));
        const pL = new THREE.Mesh(pauldronGeo, armorMat);
        pL.position.set(-0.40, 0.30, 0);
        const pR = new THREE.Mesh(pauldronGeo, armorMat);
        pR.position.set(0.40, 0.30, 0);
        chest.add(pL, pR);

        // Armored Helmet on Head
        const headGeo = this.getGeometry('geo_brute_head', () => new THREE.BoxGeometry(0.28, 0.28, 0.30));
        const head = new THREE.Mesh(headGeo, armorMat);
        head.position.set(0, 0.18, 0);
        head.castShadow = true;
        headGroup.add(head);

        // Cracked Visor with intense internal red glow
        const visorGeo = this.getGeometry('geo_brute_visor', () => new THREE.BoxGeometry(0.24, 0.08, 0.04));
        const visorMat = this.getMaterial('brute_visor_mat', () => new THREE.MeshBasicMaterial({ color: 0xff1100 }));
        const visorMesh = new THREE.Mesh(visorGeo, visorMat);
        visorMesh.position.set(0, 0.18, 0.16);
        headGroup.add(visorMesh);

        const eyeLight = new THREE.PointLight(0xff1100, 1.8, 5);
        eyeLight.position.set(0, 0.18, 0.22);
        headGroup.add(eyeLight);
        eyeLights.push(eyeLight);

        // Tree-trunk gorilla arms
        const armGeo = this.getGeometry('geo_brute_arm', () => {
          const g = new THREE.CylinderGeometry(0.12, 0.10, 0.34, 6);
          g.translate(0, -0.17, 0);
          return g;
        });
        const gauntletGeo = this.getGeometry('geo_brute_gauntlet', () => new THREE.BoxGeometry(0.16, 0.22, 0.16));

        leftArm.position.set(-0.44, 0.22, 0);
        leftArm.rotation.x = -Math.PI / 4;
        leftArm.add(new THREE.Mesh(armGeo, fleshMat));
        leftElbow.position.set(0, -0.34, 0);
        leftElbow.add(new THREE.Mesh(armGeo, fleshMat));
        const gL = new THREE.Mesh(gauntletGeo, armorMat);
        gL.position.set(0, -0.20, 0);
        leftElbow.add(gL);

        rightArm.position.set(0.44, 0.22, 0);
        rightArm.rotation.x = -Math.PI / 4;
        rightArm.add(new THREE.Mesh(armGeo, fleshMat));
        rightElbow.position.set(0, -0.34, 0);
        rightElbow.add(new THREE.Mesh(armGeo, fleshMat));
        const gR = new THREE.Mesh(gauntletGeo, armorMat);
        gR.position.set(0, -0.20, 0);
        rightElbow.add(gR);

        // Massive thick legs with steel armored boots
        const thighGeo = this.getGeometry('geo_brute_thigh', () => {
          const g = new THREE.CylinderGeometry(0.14, 0.12, 0.44, 6);
          g.translate(0, -0.22, 0);
          return g;
        });
        leftLeg.position.set(-0.20, 0, 0);
        leftLeg.add(new THREE.Mesh(thighGeo, armorMat));
        leftKnee.position.set(0, -0.44, 0);
        leftKnee.add(new THREE.Mesh(thighGeo, armorMat));

        rightLeg.position.set(0.20, 0, 0);
        rightLeg.add(new THREE.Mesh(thighGeo, armorMat));
        rightKnee.position.set(0, -0.44, 0);
        rightKnee.add(new THREE.Mesh(thighGeo, armorMat));

        return { root, body, spine, chest, head, headGroup, leftArm, leftElbow, rightArm, rightElbow, leftLeg, leftKnee, rightLeg, rightKnee, eyeLights };
      }

      // ---------------------------------------------------------------------
      // VARIANT 4: TOXIC SPITTER (Acid throat sac, dorsal boil cluster, yellow-green)
      // ---------------------------------------------------------------------
      case 'spitter': {
        const fleshTex = TextureGenerator.createSpitterFlesh();
        const fleshMat = this.getMaterial('pbr_spitter_flesh', () => new THREE.MeshStandardMaterial({
          map: fleshTex,
          color: 0x768541,
          roughness: 0.6
        }));
        const acidGlowMat = this.getMaterial('spitter_acid_glow', () => new THREE.MeshBasicMaterial({
          color: 0x98ff00
        }));

        spine.rotation.x = 0.25;

        const torsoGeo = this.getGeometry('geo_spitter_torso', () => new THREE.BoxGeometry(0.38, 0.34, 0.26));
        const torsoMesh = new THREE.Mesh(torsoGeo, fleshMat);
        torsoMesh.position.y = 0.17;
        chest.add(torsoMesh);

        // Dorsal boil cluster on upper back
        const boilsGeo = this.getGeometry('geo_spitter_boils', () => new THREE.SphereGeometry(0.14, 8, 8));
        const boilMesh = new THREE.Mesh(boilsGeo, acidGlowMat);
        boilMesh.position.set(0, 0.24, -0.16);
        chest.add(boilMesh);

        // Distended luminous acid throat reservoir
        const throatGeo = this.getGeometry('geo_spitter_throat', () => new THREE.SphereGeometry(0.10, 8, 8));
        const throatMesh = new THREE.Mesh(throatGeo, acidGlowMat);
        throatMesh.position.set(0, 0.10, 0.14);
        chest.add(throatMesh);

        // Head with wide unhinging jaw
        const headGeo = this.getGeometry('geo_spitter_head', () => new THREE.BoxGeometry(0.20, 0.22, 0.24));
        const head = new THREE.Mesh(headGeo, fleshMat);
        head.position.set(0, 0.16, 0);
        headGroup.add(head);

        const jaw = new THREE.Group();
        jaw.position.set(0, 0.08, 0.08);
        const jawGeo = this.getGeometry('geo_spitter_jaw', () => new THREE.BoxGeometry(0.18, 0.08, 0.16));
        const jawMesh = new THREE.Mesh(jawGeo, acidGlowMat);
        jaw.add(jawMesh);
        headGroup.add(jaw);

        // Glowing toxic green light from mouth/throat
        const toxicLight = new THREE.PointLight(0x98ff00, 2.2, 5);
        toxicLight.position.set(0, 0.12, 0.20);
        headGroup.add(toxicLight);
        eyeLights.push(toxicLight);

        // Slender acidic arms
        const armGeo = this.getGeometry('geo_spitter_arm', () => {
          const g = new THREE.CylinderGeometry(0.04, 0.03, 0.28, 6);
          g.translate(0, -0.14, 0);
          return g;
        });

        leftArm.position.set(-0.24, 0.20, 0);
        leftArm.rotation.x = -Math.PI / 4;
        leftArm.add(new THREE.Mesh(armGeo, fleshMat));
        leftElbow.position.set(0, -0.28, 0);
        leftElbow.rotation.x = -0.3;
        leftElbow.add(new THREE.Mesh(armGeo, fleshMat));

        rightArm.position.set(0.24, 0.20, 0);
        rightArm.rotation.x = -Math.PI / 4;
        rightArm.add(new THREE.Mesh(armGeo, fleshMat));
        rightElbow.position.set(0, -0.28, 0);
        rightElbow.rotation.x = -0.3;
        rightElbow.add(new THREE.Mesh(armGeo, fleshMat));

        const legGeo = this.getGeometry('geo_spitter_leg', () => {
          const g = new THREE.CylinderGeometry(0.07, 0.05, 0.38, 6);
          g.translate(0, -0.19, 0);
          return g;
        });
        leftLeg.position.set(-0.13, 0, 0);
        leftLeg.add(new THREE.Mesh(legGeo, fleshMat));
        leftKnee.position.set(0, -0.38, 0);
        leftKnee.add(new THREE.Mesh(legGeo, fleshMat));

        rightLeg.position.set(0.13, 0, 0);
        rightLeg.add(new THREE.Mesh(legGeo, fleshMat));
        rightKnee.position.set(0, -0.38, 0);
        rightKnee.add(new THREE.Mesh(legGeo, fleshMat));

        return { root, body, spine, chest, head, headGroup, jaw, leftArm, leftElbow, rightArm, rightElbow, leftLeg, leftKnee, rightLeg, rightKnee, eyeLights, acidLight: toxicLight };
      }

      // ---------------------------------------------------------------------
      // VARIANT 5: PATIENT ZERO ABOMINATION (Colossal Boss, mutated scythe arm, pulsating viral core)
      // ---------------------------------------------------------------------
      case 'boss': {
        const fleshTex = TextureGenerator.createBossAbominationFlesh();
        const fleshMat = this.getMaterial('pbr_boss_flesh', () => new THREE.MeshStandardMaterial({
          map: fleshTex,
          color: 0x3d1c3a,
          roughness: 0.7
        }));
        const viralCoreMat = this.getMaterial('boss_viral_core', () => new THREE.MeshBasicMaterial({
          color: 0xff0044
        }));
        const boneMat = this.getMaterial('boss_bone_spike', () => new THREE.MeshStandardMaterial({
          color: 0xe2d6c1,
          roughness: 0.4,
          metalness: 0.2
        }));

        body.position.y = 1.25;

        // Massive mutated torso (2x scale)
        const torsoGeo = this.getGeometry('geo_boss_torso', () => new THREE.BoxGeometry(0.85, 0.55, 0.46));
        const torsoMesh = new THREE.Mesh(torsoGeo, fleshMat);
        torsoMesh.position.y = 0.27;
        torsoMesh.castShadow = true;
        chest.add(torsoMesh);

        // Pulsating Exposed Viral Core / Heart on Chest
        const coreGeo = this.getGeometry('geo_boss_core', () => new THREE.SphereGeometry(0.18, 12, 12));
        const coreMesh = new THREE.Mesh(coreGeo, viralCoreMat);
        coreMesh.position.set(-0.06, 0.28, 0.24);
        chest.add(coreMesh);

        const bossHeartLight = new THREE.PointLight(0xff0044, 3.5, 12);
        bossHeartLight.position.set(-0.06, 0.28, 0.35);
        chest.add(bossHeartLight);
        eyeLights.push(bossHeartLight);

        // Spinal Bone Crests erupting from back
        for (let i = 0; i < 4; i++) {
          const spikeGeo = this.getGeometry(`geo_boss_spike_${i}`, () => new THREE.ConeGeometry(0.04, 0.35, 4));
          const spike = new THREE.Mesh(spikeGeo, boneMat);
          spike.position.set(0, 0.15 + i * 0.10, -0.26);
          spike.rotation.x = -Math.PI / 3;
          chest.add(spike);
        }

        // Demonic Cranium with multiple eye clusters
        const headGeo = this.getGeometry('geo_boss_head', () => new THREE.BoxGeometry(0.34, 0.36, 0.36));
        const head = new THREE.Mesh(headGeo, fleshMat);
        head.position.set(0, 0.24, 0.06);
        head.castShadow = true;
        headGroup.add(head);

        const bossEyeLight = new THREE.PointLight(0xff0000, 2.5, 8);
        bossEyeLight.position.set(0, 0.24, 0.30);
        headGroup.add(bossEyeLight);
        eyeLights.push(bossEyeLight);

        // MUTATED ASYMMETRICAL LEFT ARM: Colossal Chitinous Scythe Blade!
        leftArm.position.set(-0.55, 0.26, 0);
        leftArm.rotation.x = -Math.PI / 3;
        const giantBicepGeo = this.getGeometry('geo_boss_bicep', () => new THREE.CylinderGeometry(0.18, 0.15, 0.44, 8));
        const giantBicep = new THREE.Mesh(giantBicepGeo, fleshMat);
        giantBicep.position.y = -0.22;
        leftArm.add(giantBicep);

        leftElbow.position.set(0, -0.44, 0);
        leftElbow.rotation.x = -0.5;

        // Massive Scythe Blade (2.0m curved weaponized appendage)
        const scytheBladeGeo = this.getGeometry('geo_boss_scythe', () => {
          const g = new THREE.BoxGeometry(0.12, 1.4, 0.35);
          g.translate(0, -0.7, 0.1);
          return g;
        });
        const scytheMesh = new THREE.Mesh(scytheBladeGeo, boneMat);
        scytheMesh.castShadow = true;
        leftElbow.add(scytheMesh);

        // Right Arm (Heavily muscled crushing claw)
        rightArm.position.set(0.50, 0.26, 0);
        rightArm.rotation.x = -Math.PI / 4;
        const rightBicepGeo = this.getGeometry('geo_boss_rbicep', () => new THREE.CylinderGeometry(0.14, 0.12, 0.38, 8));
        rightArm.add(new THREE.Mesh(rightBicepGeo, fleshMat));

        rightElbow.position.set(0, -0.38, 0);
        rightElbow.rotation.x = -0.4;
        rightElbow.add(new THREE.Mesh(rightBicepGeo, fleshMat));

        // Colossal legs with clawed hooves
        const bossThighGeo = this.getGeometry('geo_boss_thigh', () => {
          const g = new THREE.CylinderGeometry(0.18, 0.15, 0.54, 8);
          g.translate(0, -0.27, 0);
          return g;
        });
        leftLeg.position.set(-0.25, 0, 0);
        leftLeg.add(new THREE.Mesh(bossThighGeo, fleshMat));
        leftKnee.position.set(0, -0.54, 0);
        leftKnee.add(new THREE.Mesh(bossThighGeo, fleshMat));

        rightLeg.position.set(0.25, 0, 0);
        rightLeg.add(new THREE.Mesh(bossThighGeo, fleshMat));
        rightKnee.position.set(0, -0.54, 0);
        rightKnee.add(new THREE.Mesh(bossThighGeo, fleshMat));

        return { root, body, spine, chest, head, headGroup, leftArm, leftElbow, rightArm, rightElbow, leftLeg, leftKnee, rightLeg, rightKnee, eyeLights, viralLight: bossHeartLight, mutatedPart: scytheMesh };
      }
    }
  }

  // =========================================================================
  // 3. WEAPONS (HIGH-FIDELITY PBR FIREARMS & MELEE)
  // =========================================================================
  public static createWeaponMesh(type: WeaponType): THREE.Group {
    const group = new THREE.Group();
    group.name = `Weapon_${type}`;

    const gunMetalMat = this.getMaterial('pbr_gun_metal', () => new THREE.MeshStandardMaterial({
      color: 0x16181b,
      metalness: 0.92,
      roughness: 0.28
    }));
    const gripPolymerMat = this.getMaterial('pbr_gun_polymer', () => new THREE.MeshStandardMaterial({
      color: 0x222428,
      roughness: 0.75
    }));
    const woodStockMat = this.getMaterial('pbr_gun_wood', () => new THREE.MeshStandardMaterial({
      color: 0x4a2c17,
      roughness: 0.65
    }));
    const bladeSteelMat = this.getMaterial('pbr_gun_blade', () => new THREE.MeshStandardMaterial({
      color: 0xd4d8de,
      metalness: 0.96,
      roughness: 0.15
    }));

    switch (type) {
      case 'knife': {
        // Combat Bowie Knife with finger guard & serrated spine
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.13, 0.04), gripPolymerMat);
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.015, 0.08), gunMetalMat);
        guard.position.y = 0.07;
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.24, 0.05), bladeSteelMat);
        blade.position.set(0, 0.19, 0.01);
        group.add(handle, guard, blade);
        break;
      }
      case 'bat': {
        // Baseball bat with leather-wrapped handle & barbed wire wraps
        const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.022, 0.85, 10), woodStockMat);
        bat.position.y = 0.32;
        bat.castShadow = true;
        const gripTape = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.023, 0.22, 10), gripPolymerMat);
        gripTape.position.y = 0.02;
        group.add(bat, gripTape);
        break;
      }
      case 'pistol': {
        // Tactical 9mm Semi-Automatic Pistol with textured grip & slide serrations
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.13, 0.05), gripPolymerMat);
        grip.rotation.x = -0.22;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.16), gripPolymerMat);
        frame.position.set(0, 0.07, 0.02);
        const slide = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.045, 0.22), gunMetalMat);
        slide.position.set(0, 0.11, 0.03);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8), gunMetalMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.11, 0.14);
        group.add(grip, frame, slide, barrel);
        break;
      }
      case 'shotgun': {
        // 12-Gauge Tactical Pump Shotgun
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.11, 0.30), woodStockMat);
        stock.position.z = -0.16;
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.24), gunMetalMat);
        receiver.position.set(0, 0.02, 0.08);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.65, 8), gunMetalMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.05, 0.42);
        const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.55, 8), gunMetalMat);
        magTube.rotation.x = Math.PI / 2;
        magTube.position.set(0, 0.01, 0.37);
        const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.18, 8), gripPolymerMat);
        pump.rotation.x = Math.PI / 2;
        pump.position.set(0, 0.01, 0.32);
        group.add(stock, receiver, barrel, magTube, pump);
        break;
      }
      case 'rifle': {
        // Assault Battle Rifle with curved magazine & flash hider
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.11, 0.34), gunMetalMat);
        receiver.position.set(0, 0.03, 0.05);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.26), gripPolymerMat);
        stock.position.set(0, 0, -0.22);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.52, 8), gunMetalMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.05, 0.44);
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.18, 0.09), gunMetalMat);
        mag.position.set(0, -0.10, 0.10);
        mag.rotation.x = -0.28;
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.18, 8), gunMetalMat);
        scope.rotation.x = Math.PI / 2;
        scope.position.set(0, 0.12, 0.05);
        group.add(receiver, stock, barrel, mag, scope);
        break;
      }
    }

    group.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        c.castShadow = true;
      }
    });

    return group;
  }

  // =========================================================================
  // 4. PROPS & VEHICLES
  // =========================================================================
  public static createHospitalBed(): THREE.Group {
    const group = new THREE.Group();
    const frameMat = this.getMaterial('bed_frame_mat', () => new THREE.MeshStandardMaterial({ color: 0x88929b, metalness: 0.7, roughness: 0.3 }));
    const matMat = this.getMaterial('bed_mat_mat', () => new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.9 }));

    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 2.2), frameMat);
    frame.position.y = 0.35;
    frame.castShadow = true;
    frame.receiveShadow = true;

    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 2.1), matMat);
    mattress.position.y = 0.55;
    mattress.castShadow = true;

    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.4), matMat);
    pillow.position.set(0, 0.7, -0.75);

    const ivStand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8), frameMat);
    ivStand.position.set(0.7, 0.9, -0.8);
    ivStand.castShadow = true;

    group.add(frame, mattress, pillow, ivStand);
    return group;
  }

  public static createMedicalCabinet(): THREE.Group {
    const group = new THREE.Group();
    const cabinetMat = this.getMaterial('cabinet_mat', () => new THREE.MeshStandardMaterial({ color: 0xe0e6ed, roughness: 0.4, metalness: 0.5 }));
    const crossMat = this.getMaterial('cross_mat', () => new THREE.MeshBasicMaterial({ color: 0xdd2222 }));

    const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.25), cabinetMat);
    box.position.y = 0.4;
    box.castShadow = true;

    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.02), crossMat);
    crossH.position.set(0, 0.4, 0.13);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.02), crossMat);
    crossV.position.set(0, 0.4, 0.13);

    group.add(box, crossH, crossV);
    return group;
  }

  public static createPoliceCar(): THREE.Group {
    const group = new THREE.Group();
    const bodyMat = this.getMaterial('police_body_mat', () => new THREE.MeshStandardMaterial({ color: 0x0a101d, roughness: 0.3, metalness: 0.7 }));
    const whiteMat = this.getMaterial('police_white_mat', () => new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.4 }));
    const glassMat = this.getMaterial('police_glass_mat', () => new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.9 }));
    const wheelMat = this.getMaterial('police_wheel_mat', () => new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }));

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.65, 4.4), bodyMat);
    chassis.position.y = 0.55;
    chassis.castShadow = true;

    const doorL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 1.6), whiteMat);
    doorL.position.set(-1.06, 0.58, 0);
    const doorR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 1.6), whiteMat);
    doorR.position.set(1.06, 0.58, 0);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.2), glassMat);
    cabin.position.set(0, 1.05, -0.2);
    cabin.castShadow = true;

    const sirenRed = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.12), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    sirenRed.position.set(-0.25, 1.36, -0.2);
    const sirenBlue = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.12), new THREE.MeshBasicMaterial({ color: 0x0044ff }));
    sirenBlue.position.set(0.25, 1.36, -0.2);

    const sirenLight = new THREE.PointLight(0x0066ff, 1.5, 12);
    sirenLight.position.set(0, 1.5, -0.2);

    const wheelGeo = this.getGeometry('police_wheel_geo', () => {
      const geo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 10);
      geo.rotateZ(Math.PI / 2);
      return geo;
    });

    const wFL = new THREE.Mesh(wheelGeo, wheelMat);
    wFL.position.set(-1.05, 0.38, 1.3);
    const wFR = new THREE.Mesh(wheelGeo, wheelMat);
    wFR.position.set(1.05, 0.38, 1.3);
    const wBL = new THREE.Mesh(wheelGeo, wheelMat);
    wBL.position.set(-1.05, 0.38, -1.3);
    const wBR = new THREE.Mesh(wheelGeo, wheelMat);
    wBR.position.set(1.05, 0.38, -1.3);

    group.add(chassis, doorL, doorR, cabin, sirenRed, sirenBlue, sirenLight, wFL, wFR, wBL, wBR);
    return group;
  }

  public static createConcreteBarricade(): THREE.Group {
    const group = new THREE.Group();
    const concreteMat = this.getMaterial('barricade_concrete', () => new THREE.MeshStandardMaterial({
      color: 0x6e7175,
      roughness: 0.95,
      metalness: 0.05
    }));

    const barrier = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.0, 0.6), concreteMat);
    barrier.position.y = 0.5;
    barrier.castShadow = true;
    barrier.receiveShadow = true;

    const stripeMat = this.getMaterial('hazard_stripe', () => new THREE.MeshBasicMaterial({ color: 0xd69e2e }));
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.2, 0.62), stripeMat);
    stripe.position.y = 0.5;

    group.add(barrier, stripe);
    return group;
  }

  public static createLootCrate(): THREE.Group {
    const group = new THREE.Group();
    const woodMat = this.getMaterial('crate_wood', () => new THREE.MeshStandardMaterial({ color: 0x5a4128, roughness: 0.85 }));
    const metalMat = this.getMaterial('crate_metal', () => new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 }));

    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), woodMat);
    box.position.y = 0.3;
    box.castShadow = true;

    const straps = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.72), metalMat);
    straps.position.y = 0.3;

    group.add(box, straps);
    return group;
  }
}
