import * as THREE from 'three';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  public readonly points: THREE.Points;
  private particles: Particle[] = [];
  private geometry: THREE.BufferGeometry;
  private maxParticles: number;
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;

  constructor(scene: THREE.Scene, maxParticles: number = 800) {
    this.maxParticles = maxParticles;
    this.geometry = new THREE.BufferGeometry();

    this.positions = new Float32Array(maxParticles * 3);
    this.colors = new Float32Array(maxParticles * 3);
    this.sizes = new Float32Array(maxParticles);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    this.points = new THREE.Points(this.geometry, material);
    scene.add(this.points);
  }

  public spawnBloodSplatter(origin: THREE.Vector3, count: number = 20): void {
    const bloodColor = new THREE.Color(0x8a0f0f);
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 3 + 1,
        (Math.random() - 0.5) * 4
      );

      this.particles.push({
        position: origin.clone(),
        velocity: vel,
        color: bloodColor,
        size: Math.random() * 0.18 + 0.08,
        life: 0,
        maxLife: Math.random() * 0.4 + 0.3
      });
    }
  }

  public spawnFireSparks(origin: THREE.Vector3, count: number = 5): void {
    const sparkColor = new THREE.Color(Math.random() > 0.5 ? 0xff6600 : 0xffcc00);
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        Math.random() * 2.5 + 1.2,
        (Math.random() - 0.5) * 1.5
      );

      this.particles.push({
        position: origin.clone(),
        velocity: vel,
        color: sparkColor,
        size: Math.random() * 0.12 + 0.05,
        life: 0,
        maxLife: Math.random() * 0.8 + 0.4
      });
    }
  }

  public update(dt: number): void {
    // Update active particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      // Physics integration (gravity + position)
      p.velocity.y -= 9.8 * dt;
      p.position.addScaledVector(p.velocity, dt);
    }

    // Update geometry buffer
    let idx = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      this.positions[idx * 3] = p.position.x;
      this.positions[idx * 3 + 1] = p.position.y;
      this.positions[idx * 3 + 2] = p.position.z;

      this.colors[idx * 3] = p.color.r;
      this.colors[idx * 3 + 1] = p.color.g;
      this.colors[idx * 3 + 2] = p.color.b;

      // Shrink size as life approaches max
      const lifeRatio = 1 - p.life / p.maxLife;
      this.sizes[idx] = p.size * lifeRatio;
      idx++;
    }

    // Clear unused slots
    for (let i = idx; i < this.maxParticles; i++) {
      this.positions[i * 3] = 0;
      this.positions[i * 3 + 1] = -9999;
      this.positions[i * 3 + 2] = 0;
      this.sizes[i] = 0;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
  }

  public dispose(): void {
    this.geometry.dispose();
    if (Array.isArray(this.points.material)) {
      this.points.material.forEach((m) => m.dispose());
    } else {
      this.points.material.dispose();
    }
    this.particles = [];
  }
}
