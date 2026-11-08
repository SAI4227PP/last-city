import * as THREE from 'three';
import { PerformanceManager } from '@/core/performance/PerformanceManager';

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
      size: 0.22,
      map: ParticleSystem.createCircleTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    this.points = new THREE.Points(this.geometry, material);
    scene.add(this.points);
  }

  private static createCircleTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.55, 'rgba(255, 255, 255, 0.85)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
    }
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  public spawnBloodSplatter(
    origin: THREE.Vector3,
    count: number = 20,
    normalDir?: THREE.Vector3,
    isHeadshot: boolean = false
  ): void {
    const scale = PerformanceManager.getInstance().getConfig().particleScale;
    const finalCount = Math.max(3, Math.round(count * (isHeadshot ? 1.6 : 1.0) * scale));

    for (let i = 0; i < finalCount; i++) {
      if (this.particles.length >= this.maxParticles) break;

      // Arterial blood colors: deep visceral crimson to bright arterial red
      const shade = Math.random();
      const bloodColor = shade > 0.6
        ? new THREE.Color(0xd61818) // Vibrant arterial crimson
        : shade > 0.25
        ? new THREE.Color(0x990c0c) // Deep crimson
        : new THREE.Color(0x610505); // Dark venous clot

      // Directional velocity with cone dispersion
      const vel = new THREE.Vector3();
      if (normalDir) {
        vel.copy(normalDir).multiplyScalar(Math.random() * 3.5 + 1.5);
        vel.x += (Math.random() - 0.5) * 2.5;
        vel.y += Math.random() * 2.8 + (isHeadshot ? 1.8 : 0.6);
        vel.z += (Math.random() - 0.5) * 2.5;
      } else {
        vel.set(
          (Math.random() - 0.5) * 4,
          Math.random() * (isHeadshot ? 4.5 : 3.0) + 1.2,
          (Math.random() - 0.5) * 4
        );
      }

      this.particles.push({
        position: origin.clone(),
        velocity: vel,
        color: bloodColor,
        size: (Math.random() * 0.22 + 0.1) * (isHeadshot ? 1.4 : 1.0),
        life: 0,
        maxLife: Math.random() * 0.45 + 0.35
      });
    }
  }

  public spawnImpactSparks(origin: THREE.Vector3, normalDir?: THREE.Vector3, count: number = 8): void {
    const scale = PerformanceManager.getInstance().getConfig().particleScale;
    const finalCount = Math.max(2, Math.round(count * scale));
    const sparkColor = new THREE.Color(0xffaa33);

    for (let i = 0; i < finalCount; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const vel = new THREE.Vector3();
      if (normalDir) {
        vel.copy(normalDir).multiplyScalar(Math.random() * 3.0 + 1.0);
        vel.x += (Math.random() - 0.5) * 2.0;
        vel.y += Math.random() * 2.0 + 0.5;
        vel.z += (Math.random() - 0.5) * 2.0;
      } else {
        vel.set(
          (Math.random() - 0.5) * 3,
          Math.random() * 3 + 1,
          (Math.random() - 0.5) * 3
        );
      }

      this.particles.push({
        position: origin.clone(),
        velocity: vel,
        color: sparkColor,
        size: Math.random() * 0.12 + 0.05,
        life: 0,
        maxLife: Math.random() * 0.35 + 0.2
      });
    }
  }

  public spawnFireSparks(origin: THREE.Vector3, count: number = 5): void {
    const scale = PerformanceManager.getInstance().getConfig().particleScale;
    const finalCount = Math.max(1, Math.round(count * scale));
    const sparkColor = new THREE.Color(Math.random() > 0.5 ? 0xff6600 : 0xffcc00);
    for (let i = 0; i < finalCount; i++) {
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
    if (this.points.parent) {
      this.points.parent.remove(this.points);
    }
    this.geometry.dispose();
    if (Array.isArray(this.points.material)) {
      this.points.material.forEach((m) => m.dispose());
    } else {
      this.points.material.dispose();
    }
    this.particles = [];
  }
}
