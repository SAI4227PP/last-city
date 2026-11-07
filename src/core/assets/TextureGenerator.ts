import * as THREE from 'three';

export class TextureGenerator {
  private static textureCache: Map<string, THREE.CanvasTexture> = new Map();

  private static isCanvasSupported(): boolean {
    if (typeof document === 'undefined') return false;
    try {
      const c = document.createElement('canvas');
      return !!c.getContext && !!c.getContext('2d');
    } catch {
      return false;
    }
  }

  private static getCached(key: string, generator: () => HTMLCanvasElement): THREE.CanvasTexture {
    if (this.textureCache.has(key)) {
      return this.textureCache.get(key)!;
    }

    if (!this.isCanvasSupported()) {
      // In headless test environments where 2D canvas context is missing, create a 1x1 fallback canvas
      const canvas = (typeof document !== 'undefined' ? document.createElement('canvas') : { width: 1, height: 1 }) as HTMLCanvasElement;
      const tex = new THREE.CanvasTexture(canvas);
      tex.userData.isShared = true;
      this.textureCache.set(key, tex);
      return tex;
    }

    const canvas = generator();
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.userData.isShared = true;

    this.textureCache.set(key, texture);
    return texture;
  }

  // 1. Survivor Skin Texture (Natural Dermal Tones, Pores, Dirt & Stubble)
  public static createSurvivorSkin(): THREE.CanvasTexture {
    return this.getCached('survivor_skin', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;

      // Base skin tone (weathered warm caucasian/tan)
      ctx.fillStyle = '#c99374';
      ctx.fillRect(0, 0, 512, 512);

      // Micro dermal noise / pores
      const imgData = ctx.getImageData(0, 0, 512, 512);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 22;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));         // R
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise * 0.8)); // G
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise * 0.6)); // B
      }
      ctx.putImageData(imgData, 0, 0);

      // Weathered grime, cheek blush, and grit
      ctx.fillStyle = 'rgba(70, 35, 20, 0.15)';
      for (let i = 0; i < 60; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const rad = Math.random() * 18 + 4;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      }

      // Small scar detail
      ctx.strokeStyle = 'rgba(160, 60, 50, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(180, 220);
      ctx.lineTo(240, 270);
      ctx.stroke();

      return canvas;
    });
  }

  // 2. Survivor Skin Normal Map (Pores, muscle creases, scars)
  public static createSkinNormalMap(): THREE.CanvasTexture {
    return this.getCached('skin_normal', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;

      // Neutral normal map base: RGB(128, 128, 255)
      ctx.fillStyle = '#8080ff';
      ctx.fillRect(0, 0, 256, 256);

      const imgData = ctx.getImageData(0, 0, 256, 256);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const nx = (Math.random() - 0.5) * 16;
        const ny = (Math.random() - 0.5) * 16;
        data[i] = Math.max(0, Math.min(255, 128 + nx));
        data[i + 1] = Math.max(0, Math.min(255, 128 + ny));
        data[i + 2] = 255;
      }
      ctx.putImageData(imgData, 0, 0);

      return canvas;
    });
  }

  // 3. Survivor Face Texture (Eyebrows, Eyes, Lips, Stubble, Grime)
  public static createSurvivorFace(): THREE.CanvasTexture {
    return this.getCached('survivor_face', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;

      // Base skin
      ctx.fillStyle = '#c48f70';
      ctx.fillRect(0, 0, 512, 512);

      // Forehead / temples subtle shade
      const grad = ctx.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0, 'rgba(80, 45, 30, 0.15)');
      grad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(1, 'rgba(40, 25, 20, 0.25)'); // 5 o'clock shadow
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      // Stubble grit on lower face
      ctx.fillStyle = 'rgba(35, 25, 20, 0.35)';
      for (let i = 0; i < 400; i++) {
        const x = 120 + Math.random() * 272;
        const y = 300 + Math.random() * 180;
        ctx.fillRect(x, y, 2, 2);
      }

      // Eyebrows
      ctx.fillStyle = '#2b1d14';
      // Left brow
      ctx.beginPath();
      ctx.ellipse(170, 180, 45, 12, -0.1, 0, Math.PI * 2);
      ctx.fill();
      // Right brow
      ctx.beginPath();
      ctx.ellipse(342, 180, 45, 12, 0.1, 0, Math.PI * 2);
      ctx.fill();

      // Eyes (Left & Right)
      const drawEye = (cx: number, cy: number) => {
        // Sclera (eyeball white with slight red veins)
        ctx.fillStyle = '#e8e5e0';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 28, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(150, 40, 30, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Iris (Intense hazel-green)
        ctx.fillStyle = '#4a5d3f';
        ctx.beginPath();
        ctx.arc(cx, cy, 12, 0, Math.PI * 2);
        ctx.fill();

        // Pupil
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();

        // Specular highlight
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx - 3, cy - 3, 3, 0, Math.PI * 2);
        ctx.fill();

        // Eyelid crease
        ctx.strokeStyle = '#3a2216';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy - 4, 30, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      };

      drawEye(170, 215);
      drawEye(342, 215);

      // Nose bridge and nostrils
      ctx.strokeStyle = 'rgba(70, 35, 20, 0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(256, 195);
      ctx.lineTo(252, 280);
      ctx.lineTo(240, 295);
      ctx.lineTo(272, 295);
      ctx.stroke();

      ctx.fillStyle = '#2a1510';
      ctx.beginPath();
      ctx.arc(244, 298, 4, 0, Math.PI * 2);
      ctx.arc(268, 298, 4, 0, Math.PI * 2);
      ctx.fill();

      // Lips
      ctx.fillStyle = '#9e5e54';
      ctx.beginPath();
      ctx.ellipse(256, 360, 42, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#54261e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(216, 360);
      ctx.lineTo(296, 360);
      ctx.stroke();

      return canvas;
    });
  }

  // 4. Tactical Survivor Jacket Texture (Ripstop Grid, Pockets, Zippers, Dirt)
  public static createTacticalJacket(): THREE.CanvasTexture {
    return this.getCached('tactical_jacket', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;

      // Deep military olive drab / weathered canvas
      ctx.fillStyle = '#2d382c';
      ctx.fillRect(0, 0, 512, 512);

      // Ripstop crosshatch pattern
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x < 512; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
      }
      for (let y = 0; y < 512; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
      }

      // Reinforcement patches (shoulders/elbows)
      ctx.fillStyle = '#222b21';
      ctx.fillRect(40, 40, 160, 120);
      ctx.fillRect(312, 40, 160, 120);

      // Tactical chest pockets
      ctx.strokeStyle = '#182018';
      ctx.lineWidth = 3;
      ctx.fillStyle = '#263025';
      ctx.strokeRect(60, 220, 140, 140);
      ctx.fillRect(60, 220, 140, 140);
      ctx.strokeRect(312, 220, 140, 140);
      ctx.fillRect(312, 220, 140, 140);

      // Pocket button flap
      ctx.fillStyle = '#1c241b';
      ctx.fillRect(55, 210, 150, 30);
      ctx.fillRect(307, 210, 150, 30);

      // Heavy center metal zipper
      ctx.strokeStyle = '#6e776d';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(256, 0);
      ctx.lineTo(256, 512);
      ctx.stroke();

      ctx.strokeStyle = '#222222';
      ctx.lineWidth = 2;
      for (let y = 0; y < 512; y += 8) {
        ctx.beginPath();
        ctx.moveTo(252, y);
        ctx.lineTo(260, y);
        ctx.stroke();
      }

      // Dirt and blood stains
      ctx.fillStyle = 'rgba(20, 14, 10, 0.35)';
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        ctx.beginPath();
        ctx.arc(x, y, Math.random() * 24 + 6, 0, Math.PI * 2);
        ctx.fill();
      }

      return canvas;
    });
  }

  // 5. Cargo Pants Texture (Charcoal heavy fabric, seams, cargo pocket flaps)
  public static createCargoPants(): THREE.CanvasTexture {
    return this.getCached('cargo_pants', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;

      // Charcoal gray combat weave
      ctx.fillStyle = '#1b1f24';
      ctx.fillRect(0, 0, 512, 512);

      // Fine fabric grain
      const imgData = ctx.getImageData(0, 0, 512, 512);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const n = (Math.random() - 0.5) * 14;
        data[i] = Math.max(0, Math.min(255, data[i] + n));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
      }
      ctx.putImageData(imgData, 0, 0);

      // Seam stitching
      ctx.strokeStyle = '#0e1215';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(128, 0);
      ctx.lineTo(128, 512);
      ctx.moveTo(384, 0);
      ctx.lineTo(384, 512);
      ctx.stroke();

      // Reinforced Knee Pad Graphic
      ctx.fillStyle = '#101317';
      ctx.strokeStyle = '#2b333c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(80, 260, 100, 120, 18);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.roundRect(332, 260, 100, 120, 18);
      ctx.fill();
      ctx.stroke();

      // Cargo pocket flaps
      ctx.fillStyle = '#15191e';
      ctx.fillRect(70, 120, 120, 70);
      ctx.fillRect(322, 120, 120, 70);

      return canvas;
    });
  }

  // 6. Combat Leather Boots Texture (Deep black/brown leather, tread, brass eyelets, laces)
  public static createCombatBoots(): THREE.CanvasTexture {
    return this.getCached('combat_boots', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#161311';
      ctx.fillRect(0, 0, 256, 256);

      // Leather grain highlights
      ctx.strokeStyle = '#28231f';
      ctx.lineWidth = 1;
      for (let i = 0; i < 80; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * 256, Math.random() * 256, Math.random() * 30 + 10, 0, Math.PI * 0.5);
        ctx.stroke();
      }

      // Metal lace eyelets
      ctx.fillStyle = '#c5a059';
      for (let y = 40; y < 220; y += 30) {
        ctx.beginPath();
        ctx.arc(80, y, 4, 0, Math.PI * 2);
        ctx.arc(176, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Crossed laces
      ctx.strokeStyle = '#382f28';
      ctx.lineWidth = 3;
      for (let y = 40; y < 190; y += 30) {
        ctx.beginPath();
        ctx.moveTo(80, y);
        ctx.lineTo(176, y + 30);
        ctx.moveTo(176, y);
        ctx.lineTo(80, y + 30);
        ctx.stroke();
      }

      return canvas;
    });
  }

  // 7. Tactical Backpack Texture (Cordura weave, nylon webbing straps, metal D-rings, sleeping bag)
  public static createTacticalBackpack(): THREE.CanvasTexture {
    return this.getCached('tactical_backpack', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;

      // Coyote brown / weathered ranger green
      ctx.fillStyle = '#3a3328';
      ctx.fillRect(0, 0, 512, 512);

      // MOLLE Webbing Horizontal Straps
      ctx.fillStyle = '#27221b';
      for (let y = 140; y < 440; y += 45) {
        ctx.fillRect(40, y, 432, 22);
        // Vertical stitch lines
        ctx.strokeStyle = '#15120e';
        ctx.lineWidth = 3;
        for (let x = 60; x < 460; x += 55) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 22);
          ctx.stroke();
        }
      }

      // Rolled sleeping bag / bedroll at top
      ctx.fillStyle = '#212d22';
      ctx.fillRect(30, 20, 452, 90);
      ctx.strokeStyle = '#141c14';
      ctx.lineWidth = 4;
      ctx.strokeRect(30, 20, 452, 90);

      // Bedroll tie-down straps
      ctx.fillStyle = '#15120e';
      ctx.fillRect(120, 10, 25, 110);
      ctx.fillRect(367, 10, 25, 110);

      return canvas;
    });
  }

  // =========================================================================
  // ZOMBIE PBR TEXTURES (5 DISTINCT HIGH-DETAIL VARIETIES)
  // =========================================================================

  // A. Infected Shambler Flesh (Sickly gray-green, exposed rot, dark necrotic veins, blood splatters)
  public static createShamblerFlesh(): THREE.CanvasTexture {
    return this.getCached('shambler_flesh', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;

      // Sickly cadaverous pale green-gray
      ctx.fillStyle = '#616c5b';
      ctx.fillRect(0, 0, 512, 512);

      // Necrotic black veins
      ctx.strokeStyle = '#232b21';
      ctx.lineWidth = 2;
      for (let i = 0; i < 15; i++) {
        let vx = Math.random() * 512;
        let vy = Math.random() * 512;
        ctx.beginPath();
        ctx.moveTo(vx, vy);
        for (let s = 0; s < 6; s++) {
          vx += (Math.random() - 0.5) * 60;
          vy += Math.random() * 50;
          ctx.lineTo(vx, vy);
        }
        ctx.stroke();
      }

      // Exposed red muscle & rotting tissue patches
      ctx.fillStyle = '#661a1a';
      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        ctx.ellipse(Math.random() * 512, Math.random() * 512, Math.random() * 40 + 15, Math.random() * 25 + 10, Math.random(), 0, Math.PI * 2);
        ctx.fill();
      }

      // Dried blood spatter
      ctx.fillStyle = 'rgba(74, 12, 12, 0.7)';
      for (let i = 0; i < 120; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * 512, Math.random() * 512, Math.random() * 6 + 1, 0, Math.PI * 2);
        ctx.fill();
      }

      return canvas;
    });
  }

  // Shambler Face (Hollow dark eye sockets, snarling rotting mouth, decayed nose)
  public static createShamblerFace(): THREE.CanvasTexture {
    return this.getCached('shambler_face', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#5c6757';
      ctx.fillRect(0, 0, 512, 512);

      // Sunken dark eye sockets
      ctx.fillStyle = '#1b221a';
      ctx.beginPath();
      ctx.ellipse(170, 200, 40, 32, 0, 0, Math.PI * 2);
      ctx.ellipse(342, 200, 40, 32, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dead milky cataract eyes with pinprick red glow
      ctx.fillStyle = '#d2ded0';
      ctx.beginPath();
      ctx.arc(170, 200, 14, 0, Math.PI * 2);
      ctx.arc(342, 200, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ff2200';
      ctx.beginPath();
      ctx.arc(170, 200, 4, 0, Math.PI * 2);
      ctx.arc(342, 200, 4, 0, Math.PI * 2);
      ctx.fill();

      // Gaping decayed jaw with exposed broken teeth
      ctx.fillStyle = '#1c0909';
      ctx.beginPath();
      ctx.ellipse(256, 360, 75, 45, 0, 0, Math.PI * 2);
      ctx.fill();

      // Jagged teeth
      ctx.fillStyle = '#d8cb9a';
      for (let x = 200; x <= 312; x += 14) {
        // Upper teeth
        ctx.beginPath();
        ctx.moveTo(x, 335);
        ctx.lineTo(x + 5, 350);
        ctx.lineTo(x + 10, 335);
        ctx.fill();
        // Lower teeth
        ctx.beginPath();
        ctx.moveTo(x + 2, 385);
        ctx.lineTo(x + 7, 370);
        ctx.lineTo(x + 12, 385);
        ctx.fill();
      }

      // Blood dripping from mouth
      ctx.fillStyle = '#5c1010';
      ctx.beginPath();
      ctx.moveTo(210, 385);
      ctx.lineTo(215, 470);
      ctx.lineTo(225, 385);
      ctx.moveTo(270, 385);
      ctx.lineTo(276, 490);
      ctx.lineTo(285, 385);
      ctx.fill();

      return canvas;
    });
  }

  // B. Feral Runner Flesh (Emaciated reddish-purple skin, taut sinewy tendons, claw scratch gouges)
  public static createRunnerFlesh(): THREE.CanvasTexture {
    return this.getCached('runner_flesh', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;

      // Crimson-tinted feverish flesh
      ctx.fillStyle = '#7a423b';
      ctx.fillRect(0, 0, 512, 512);

      // Taut fibrous muscle striations
      ctx.strokeStyle = '#4a1e19';
      ctx.lineWidth = 2;
      for (let y = 0; y < 512; y += 12) {
        ctx.beginPath();
        ctx.moveTo(0, y + (Math.random() - 0.5) * 8);
        ctx.lineTo(512, y + (Math.random() - 0.5) * 8);
        ctx.stroke();
      }

      // Bloody claw scratch gouges
      ctx.strokeStyle = '#2b0704';
      ctx.lineWidth = 4;
      for (let i = 0; i < 8; i++) {
        const startX = Math.random() * 400;
        const startY = Math.random() * 400;
        for (let c = 0; c < 3; c++) {
          ctx.beginPath();
          ctx.moveTo(startX + c * 10, startY);
          ctx.lineTo(startX + c * 10 + 60, startY + 80);
          ctx.stroke();
        }
      }

      return canvas;
    });
  }

  // C. Armored Brute Flesh & Plating (Hypertrophied ash-gray skin, cracked ceramic riot armor)
  public static createBruteFlesh(): THREE.CanvasTexture {
    return this.getCached('brute_flesh', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;

      // Chitinous calloused gray-black hide
      ctx.fillStyle = '#424548';
      ctx.fillRect(0, 0, 512, 512);

      // Chitin / bone plate scales
      ctx.strokeStyle = '#26282a';
      ctx.lineWidth = 3;
      for (let x = 0; x < 512; x += 40) {
        for (let y = 0; y < 512; y += 40) {
          ctx.strokeRect(x, y, 35, 35);
        }
      }

      // Bullet ricochet dents and metal fractures
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      for (let i = 0; i < 20; i++) {
        const cx = Math.random() * 512;
        const cy = Math.random() * 512;
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      return canvas;
    });
  }

  // Riot Armor for Brute Torso
  public static createRiotArmor(): THREE.CanvasTexture {
    return this.getCached('brute_riot_armor', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#1a1f26';
      ctx.fillRect(0, 0, 512, 512);

      // Heavy ceramic plate seams
      ctx.strokeStyle = '#323b47';
      ctx.lineWidth = 6;
      ctx.strokeRect(40, 40, 432, 432);
      ctx.strokeRect(100, 100, 312, 312);

      // Faded stencil: "POLICE"
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = 'bold 54px Arial Black, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 256, 270);

      // Massive claw tear across chest plate
      ctx.strokeStyle = '#5a1212';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(80, 160);
      ctx.lineTo(430, 380);
      ctx.stroke();

      return canvas;
    });
  }

  // D. Toxic Spitter Flesh (Bile-yellow with luminescent toxic green pustules & acid glands)
  public static createSpitterFlesh(): THREE.CanvasTexture {
    return this.getCached('spitter_flesh', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;

      // Diseased jaundiced yellow-green
      ctx.fillStyle = '#65733d';
      ctx.fillRect(0, 0, 512, 512);

      // Glowing acid boils / pustules
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const rad = Math.random() * 20 + 6;

        const radGrad = ctx.createRadialGradient(x, y, 2, x, y, rad);
        radGrad.addColorStop(0, '#98ff00'); // Radiant acid center
        radGrad.addColorStop(0.6, '#568f0a');
        radGrad.addColorStop(1, '#2c4708');
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      }

      // Acid dripping streaks
      ctx.fillStyle = 'rgba(152, 255, 0, 0.5)';
      for (let i = 0; i < 20; i++) {
        const sx = Math.random() * 512;
        const sy = Math.random() * 300;
        ctx.fillRect(sx, sy, 5, Math.random() * 90 + 30);
      }

      return canvas;
    });
  }

  // E. Patient Zero Abomination (Massive mutating viral flesh, glowing tendrils & pulsating core)
  public static createBossAbominationFlesh(): THREE.CanvasTexture {
    return this.getCached('abomination_flesh', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;

      // Deep corrupted purple-black flesh
      ctx.fillStyle = '#2b152d';
      ctx.fillRect(0, 0, 512, 512);

      // Pulsating crimson & purple viral web
      ctx.strokeStyle = '#c5163d';
      ctx.lineWidth = 4;
      for (let i = 0; i < 25; i++) {
        let x = Math.random() * 512;
        let y = Math.random() * 512;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let s = 0; s < 5; s++) {
          x += (Math.random() - 0.5) * 80;
          y += (Math.random() - 0.5) * 80;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Mutated organic eyes clustering across flesh
      for (let i = 0; i < 18; i++) {
        const ex = Math.random() * 512;
        const ey = Math.random() * 512;
        ctx.fillStyle = '#ff3300';
        ctx.beginPath();
        ctx.arc(ex, ey, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - 2, ey - 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      return canvas;
    });
  }
}
