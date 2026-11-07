import * as THREE from 'three';
import { WeaponType, ZombieVariantType } from '@/shared/types';
import { ZOMBIE_CONFIGS } from '@/data/zombies';

export class ModelFactory {
  // Procedural Noise/Grunge Canvas Texture
  public static createNoiseTexture(colorA: string, colorB: string, size: number = 256): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = colorA;
    ctx.fillRect(0, 0, size, size);

    // Splatter noise
    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 2 + 0.5;
      ctx.fillStyle = colorB;
      ctx.globalAlpha = Math.random() * 0.4;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // 1. Player Character Mesh Hierarchy
  public static createPlayerModel(): {
    root: THREE.Group;
    body: THREE.Group;
    head: THREE.Mesh;
    leftArm: THREE.Group;
    rightArm: THREE.Group;
    leftLeg: THREE.Group;
    rightLeg: THREE.Group;
    weaponSocket: THREE.Group;
  } {
    const root = new THREE.Group();
    root.name = 'PlayerModel';

    const jacketMat = new THREE.MeshStandardMaterial({
      color: 0x2b382d, // Tactical olive drab
      roughness: 0.8,
      metalness: 0.1
    });

    const pantsMat = new THREE.MeshStandardMaterial({
      color: 0x1f232b, // Dark charcoal
      roughness: 0.9,
      metalness: 0.05
    });

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xd9a584,
      roughness: 0.6
    });

    const bootsMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.5
    });

    // Body/Torso
    const body = new THREE.Group();
    body.position.y = 1.0;
    root.add(body);

    const torsoGeo = new THREE.BoxGeometry(0.48, 0.65, 0.28);
    const torsoMesh = new THREE.Mesh(torsoGeo, jacketMat);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    torsoMesh.position.y = 0.32;
    body.add(torsoMesh);

    // Tactical Backpack
    const packGeo = new THREE.BoxGeometry(0.36, 0.45, 0.16);
    const packMat = new THREE.MeshStandardMaterial({ color: 0x1e281f, roughness: 0.9 });
    const packMesh = new THREE.Mesh(packGeo, packMat);
    packMesh.position.set(0, 0.35, -0.2);
    packMesh.castShadow = true;
    body.add(packMesh);

    // Head
    const headGeo = new THREE.BoxGeometry(0.24, 0.28, 0.24);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 0.78, 0);
    head.castShadow = true;
    body.add(head);

    // Flashlight mounted on torso
    const torchGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.14);
    const torchMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });
    const torchMesh = new THREE.Mesh(torchGeo, torchMat);
    torchMesh.rotation.x = Math.PI / 2;
    torchMesh.position.set(0.18, 0.48, 0.16);
    body.add(torchMesh);

    // Left Arm (pivot at shoulder)
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.32, 0.58, 0);
    const armGeo = new THREE.BoxGeometry(0.12, 0.55, 0.14);
    armGeo.translate(0, -0.25, 0);
    const leftArmMesh = new THREE.Mesh(armGeo, jacketMat);
    leftArmMesh.castShadow = true;
    leftArm.add(leftArmMesh);
    body.add(leftArm);

    // Right Arm (pivot at shoulder)
    const rightArm = new THREE.Group();
    rightArm.position.set(0.32, 0.58, 0);
    const rightArmMesh = new THREE.Mesh(armGeo, jacketMat);
    rightArmMesh.castShadow = true;
    rightArm.add(rightArmMesh);
    body.add(rightArm);

    // Weapon Socket in right hand
    const weaponSocket = new THREE.Group();
    weaponSocket.position.set(0, -0.52, 0.08);
    rightArm.add(weaponSocket);

    // Left Leg
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.14, 1.0, 0);
    const legGeo = new THREE.BoxGeometry(0.16, 0.9, 0.18);
    legGeo.translate(0, -0.45, 0);
    const leftLegMesh = new THREE.Mesh(legGeo, pantsMat);
    leftLegMesh.castShadow = true;
    leftLeg.add(leftLegMesh);

    // Boot
    const bootGeo = new THREE.BoxGeometry(0.17, 0.16, 0.26);
    const leftBoot = new THREE.Mesh(bootGeo, bootsMat);
    leftBoot.position.set(0, -0.85, 0.04);
    leftBoot.castShadow = true;
    leftLeg.add(leftBoot);
    root.add(leftLeg);

    // Right Leg
    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.14, 1.0, 0);
    const rightLegMesh = new THREE.Mesh(legGeo, pantsMat);
    rightLegMesh.castShadow = true;
    rightLeg.add(rightLegMesh);

    const rightBoot = new THREE.Mesh(bootGeo, bootsMat);
    rightBoot.position.set(0, -0.85, 0.04);
    rightBoot.castShadow = true;
    rightLeg.add(rightBoot);
    root.add(rightLeg);

    return { root, body, head, leftArm, rightArm, leftLeg, rightLeg, weaponSocket };
  }

  // 2. Zombie Model Hierarchy with 5 Variant Configurations
  public static createZombieModel(variant: ZombieVariantType): {
    root: THREE.Group;
    body: THREE.Group;
    head: THREE.Mesh;
    leftArm: THREE.Group;
    rightArm: THREE.Group;
    leftLeg: THREE.Group;
    rightLeg: THREE.Group;
    eyeLights: THREE.PointLight[];
  } {
    const config = ZOMBIE_CONFIGS[variant];
    const root = new THREE.Group();
    root.name = `Zombie_${variant}`;
    root.scale.set(config.scale[0], config.scale[1], config.scale[2]);

    const fleshMat = new THREE.MeshStandardMaterial({
      color: config.tintColor,
      roughness: 0.85,
      metalness: 0.15
    });

    const clothMat = new THREE.MeshStandardMaterial({
      color: variant === 'walker' ? 0x2d3a33 : 0x202428,
      roughness: 0.95
    });

    const body = new THREE.Group();
    body.position.y = 1.0;
    root.add(body);

    const torsoGeo = new THREE.BoxGeometry(0.5, 0.65, 0.3);
    const torsoMesh = new THREE.Mesh(torsoGeo, clothMat);
    torsoMesh.castShadow = true;
    torsoMesh.position.y = 0.32;
    body.add(torsoMesh);

    // Zombie Head
    const headGeo = new THREE.BoxGeometry(0.26, 0.28, 0.26);
    const head = new THREE.Mesh(headGeo, fleshMat);
    head.position.set(0, 0.78, 0);
    head.castShadow = true;
    body.add(head);

    // Glowing Menacing Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
    const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.05), eyeMat);
    leftEye.position.set(-0.06, 0.82, 0.14);
    body.add(leftEye);

    const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.05), eyeMat);
    rightEye.position.set(0.06, 0.82, 0.14);
    body.add(rightEye);

    const eyeLights: THREE.PointLight[] = [];
    if (variant === 'boss' || variant === 'runner') {
      const eyeLight = new THREE.PointLight(0xff2200, 1.2, 3);
      eyeLight.position.set(0, 0.82, 0.2);
      body.add(eyeLight);
      eyeLights.push(eyeLight);
    }

    // Extended aggressive arms
    const armGeo = new THREE.BoxGeometry(0.13, 0.58, 0.14);
    armGeo.translate(0, -0.26, 0);

    const leftArm = new THREE.Group();
    leftArm.position.set(-0.33, 0.58, 0);
    // Reach arms forward aggressively
    leftArm.rotation.x = -Math.PI / 4;
    const leftArmMesh = new THREE.Mesh(armGeo, fleshMat);
    leftArmMesh.castShadow = true;
    leftArm.add(leftArmMesh);
    body.add(leftArm);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.33, 0.58, 0);
    rightArm.rotation.x = -Math.PI / 3;
    const rightArmMesh = new THREE.Mesh(armGeo, fleshMat);
    rightArmMesh.castShadow = true;
    rightArm.add(rightArmMesh);
    body.add(rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.16, 0.9, 0.18);
    legGeo.translate(0, -0.45, 0);

    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.14, 1.0, 0);
    const leftLegMesh = new THREE.Mesh(legGeo, clothMat);
    leftLegMesh.castShadow = true;
    leftLeg.add(leftLegMesh);
    root.add(leftLeg);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.14, 1.0, 0);
    const rightLegMesh = new THREE.Mesh(legGeo, clothMat);
    rightLegMesh.castShadow = true;
    rightLeg.add(rightLegMesh);
    root.add(rightLeg);

    return { root, body, head, leftArm, rightArm, leftLeg, rightLeg, eyeLights };
  }

  // 3. Weapon Meshes
  public static createWeaponMesh(type: WeaponType): THREE.Group {
    const group = new THREE.Group();
    group.name = `Weapon_${type}`;

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1f2326, metalness: 0.9, roughness: 0.25 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.8 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.95, roughness: 0.1 });

    switch (type) {
      case 'knife': {
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.04), woodMat);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.05), bladeMat);
        blade.position.y = 0.16;
        blade.position.z = 0.01;
        group.add(handle, blade);
        break;
      }
      case 'bat': {
        const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.025, 0.8, 8), woodMat);
        bat.position.y = 0.3;
        bat.castShadow = true;
        group.add(bat);
        break;
      }
      case 'pistol': {
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.05), metalMat);
        grip.rotation.x = -0.2;
        const slide = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.22), metalMat);
        slide.position.set(0, 0.08, 0.04);
        group.add(grip, slide);
        break;
      }
      case 'shotgun': {
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.25), woodMat);
        stock.position.z = -0.15;
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.65, 8), metalMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.05, 0.28);
        const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8), woodMat);
        pump.rotation.x = Math.PI / 2;
        pump.position.set(0, 0.02, 0.22);
        group.add(stock, barrel, pump);
        break;
      }
      case 'rifle': {
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.35), metalMat);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), metalMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.04, 0.38);
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.16, 0.08), metalMat);
        mag.position.set(0, -0.1, 0.06);
        mag.rotation.x = -0.3;
        group.add(receiver, barrel, mag);
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

  // 4. Props: Hospital Bed, Medical Cabinet, Police Car, Loot Crate, Barricade
  public static createHospitalBed(): THREE.Group {
    const group = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x88929b, metalness: 0.7, roughness: 0.3 });
    const matMat = new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.9 });

    // Bed frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 2.2), frameMat);
    frame.position.y = 0.35;
    frame.castShadow = true;
    frame.receiveShadow = true;

    // Mattress
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 2.1), matMat);
    mattress.position.y = 0.55;
    mattress.castShadow = true;

    // Pillow
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.4), matMat);
    pillow.position.set(0, 0.7, -0.75);

    // IV Stand
    const ivStand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8), frameMat);
    ivStand.position.set(0.7, 0.9, -0.8);
    ivStand.castShadow = true;

    group.add(frame, mattress, pillow, ivStand);
    return group;
  }

  public static createMedicalCabinet(): THREE.Group {
    const group = new THREE.Group();
    const cabinetMat = new THREE.MeshStandardMaterial({ color: 0xe0e6ed, roughness: 0.4, metalness: 0.5 });
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xdd2222 });

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
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0a101d, roughness: 0.3, metalness: 0.7 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.4 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.9 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });

    // Chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.65, 4.4), bodyMat);
    chassis.position.y = 0.55;
    chassis.castShadow = true;

    // White door panel
    const doorL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 1.6), whiteMat);
    doorL.position.set(-1.06, 0.58, 0);
    const doorR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 1.6), whiteMat);
    doorR.position.set(1.06, 0.58, 0);

    // Cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.2), glassMat);
    cabin.position.set(0, 1.05, -0.2);
    cabin.castShadow = true;

    // Siren Bar (Blue and Red)
    const sirenRed = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.12), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    sirenRed.position.set(-0.25, 1.36, -0.2);
    const sirenBlue = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.12), new THREE.MeshBasicMaterial({ color: 0x0044ff }));
    sirenBlue.position.set(0.25, 1.36, -0.2);

    // Flashing siren light
    const sirenLight = new THREE.PointLight(0x0066ff, 1.5, 12);
    sirenLight.position.set(0, 1.5, -0.2);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 12);
    wheelGeo.rotateZ(Math.PI / 2);
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
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x6e7175,
      roughness: 0.95,
      metalness: 0.05
    });

    const barrier = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.0, 0.6), concreteMat);
    barrier.position.y = 0.5;
    barrier.castShadow = true;
    barrier.receiveShadow = true;

    // Yellow hazard stripes
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xd69e2e });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.2, 0.62), stripeMat);
    stripe.position.y = 0.5;

    group.add(barrier, stripe);
    return group;
  }

  public static createLootCrate(): THREE.Group {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a4128, roughness: 0.85 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 });

    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), woodMat);
    box.position.y = 0.3;
    box.castShadow = true;

    const straps = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.72), metalMat);
    straps.position.y = 0.3;

    group.add(box, straps);
    return group;
  }
}
