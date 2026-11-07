import { WeaponType, WeaponStats } from '@/shared/types';

export const WEAPON_DEFINITIONS: Record<WeaponType, WeaponStats> = {
  knife: {
    id: 'knife',
    name: 'Tactical Knife',
    isRanged: false,
    damage: 25,
    fireRate: 2.2,
    range: 2.0,
    maxAmmo: 0,
    currentAmmo: 0,
    reserveAmmo: 0,
    reloadTime: 0,
    recoil: 0
  },
  bat: {
    id: 'bat',
    name: 'Baseball Bat',
    isRanged: false,
    damage: 40,
    fireRate: 1.4,
    range: 2.4,
    maxAmmo: 0,
    currentAmmo: 0,
    reserveAmmo: 0,
    reloadTime: 0,
    recoil: 0
  },
  pistol: {
    id: 'pistol',
    name: '9mm Service Pistol',
    isRanged: true,
    damage: 35,
    fireRate: 3.5,
    range: 45,
    maxAmmo: 12,
    currentAmmo: 12,
    reserveAmmo: 24,
    reloadTime: 1.6,
    recoil: 0.05
  },
  shotgun: {
    id: 'shotgun',
    name: 'Pump-Action Shotgun',
    isRanged: true,
    damage: 90,
    fireRate: 1.1,
    range: 22,
    maxAmmo: 6,
    currentAmmo: 6,
    reserveAmmo: 18,
    reloadTime: 2.4,
    recoil: 0.12
  },
  rifle: {
    id: 'rifle',
    name: 'Assault Rifle M4',
    isRanged: true,
    damage: 42,
    fireRate: 8.0,
    range: 65,
    maxAmmo: 30,
    currentAmmo: 30,
    reserveAmmo: 60,
    reloadTime: 2.0,
    recoil: 0.04
  }
};
