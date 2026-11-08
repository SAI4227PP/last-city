import * as THREE from 'three';
import { Logger } from '@/core/utils/Logger';
import { EventBus } from '@/core/events/EventBus';

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  crouch: boolean;
  jump: boolean;
  interact: boolean;
  reload: boolean;
  inventory: boolean;
  attack: boolean;
  aim: boolean;
  pause: boolean;

  // Analog movement (-1 to +1)
  moveAxis: THREE.Vector2;
  // Mouse look delta
  lookDelta: THREE.Vector2;
}

export class InputManager {
  private state: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    crouch: false,
    jump: false,
    interact: false,
    reload: false,
    inventory: false,
    attack: false,
    aim: false,
    pause: false,
    moveAxis: new THREE.Vector2(0, 0),
    lookDelta: new THREE.Vector2(0, 0)
  };

  private isPointerLocked: boolean = false;
  private targetElement: HTMLElement;
  public mouseSensitivity: number = 0.0022;

  // Callbacks for single-press actions
  public onInteractPressed?: () => void;
  public onInventoryPressed?: () => void;
  public onPausePressed?: () => void;
  public onReloadPressed?: () => void;
  public onWeaponSlotPressed?: (slot: number) => void;
  public onControlsPressed?: () => void;

  constructor(targetElement: HTMLElement) {
    this.targetElement = targetElement;
    this.bindEvents();
    Logger.info('InputManager initialized.');
  }

  public getState(): InputState {
    return this.state;
  }

  public getPointerLocked(): boolean {
    return this.isPointerLocked;
  }

  public requestPointerLock(): void {
    if (!this.isPointerLocked) {
      this.targetElement.requestPointerLock?.();
    }
  }

  public exitPointerLock(): void {
    if (this.isPointerLocked && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  public resetFrameDeltas(): void {
    this.state.lookDelta.set(0, 0);
  }

  // Mobile virtual joystick input bridge
  public setVirtualMoveAxis(x: number, y: number): void {
    this.state.moveAxis.set(x, y);
    this.state.forward = y < -0.2;
    this.state.backward = y > 0.2;
    this.state.left = x < -0.2;
    this.state.right = x > 0.2;
  }

  public setVirtualLookDelta(dx: number, dy: number): void {
    this.state.lookDelta.x += dx * this.mouseSensitivity;
    this.state.lookDelta.y += dy * this.mouseSensitivity;
  }

  public triggerAction(action: 'attack' | 'sprint' | 'jump' | 'crouch' | 'interact' | 'reload' | 'inventory', active: boolean): void {
    (this.state as any)[action] = active;
    if (active) {
      if (action === 'interact') this.onInteractPressed?.();
      if (action === 'reload') this.onReloadPressed?.();
      if (action === 'inventory') this.onInventoryPressed?.();
    }
  }

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.targetElement;
      if (!this.isPointerLocked) {
        this.resetFrameDeltas();
        this.state.attack = false;
        this.state.aim = false;
      }
    });

    // Mobile touch look handling on canvas
    let lastTouchX = 0;
    let lastTouchY = 0;
    let isTouchingLook = false;

    this.targetElement.addEventListener('touchstart', (e) => {
      // Touch look if touching right half of screen
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.clientX > window.innerWidth * 0.4) {
          lastTouchX = touch.clientX;
          lastTouchY = touch.clientY;
          isTouchingLook = true;
          break;
        }
      }
    }, { passive: true });

    this.targetElement.addEventListener('touchmove', (e) => {
      if (!isTouchingLook) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.clientX > window.innerWidth * 0.4) {
          const dx = touch.clientX - lastTouchX;
          const dy = touch.clientY - lastTouchY;
          lastTouchX = touch.clientX;
          lastTouchY = touch.clientY;
          this.setVirtualLookDelta(dx * 1.5, dy * 1.5);
          break;
        }
      }
    }, { passive: true });

    this.targetElement.addEventListener('touchend', () => {
      isTouchingLook = false;
    }, { passive: true });
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.repeat) return;

    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.state.forward = true;
        this.updateKeyboardAxis();
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.state.backward = true;
        this.updateKeyboardAxis();
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.state.left = true;
        this.updateKeyboardAxis();
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.state.right = true;
        this.updateKeyboardAxis();
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.state.sprint = true;
        break;
      case 'KeyC':
      case 'ControlLeft':
      case 'ControlRight':
        this.state.crouch = !this.state.crouch; // Toggle crouch
        break;
      case 'Space':
        this.state.jump = true;
        break;
      case 'Digit1':
      case 'Numpad1':
        this.onWeaponSlotPressed?.(1);
        EventBus.getInstance().emit('weapon:select_slot', { slot: 1 });
        break;
      case 'Digit2':
      case 'Numpad2':
        this.onWeaponSlotPressed?.(2);
        EventBus.getInstance().emit('weapon:select_slot', { slot: 2 });
        break;
      case 'Digit3':
      case 'Numpad3':
        this.onWeaponSlotPressed?.(3);
        EventBus.getInstance().emit('weapon:select_slot', { slot: 3 });
        break;
      case 'Digit4':
      case 'Numpad4':
        this.onWeaponSlotPressed?.(4);
        EventBus.getInstance().emit('weapon:select_slot', { slot: 4 });
        break;
      case 'Digit5':
      case 'Numpad5':
        this.onWeaponSlotPressed?.(5);
        EventBus.getInstance().emit('weapon:select_slot', { slot: 5 });
        break;
      case 'Digit6':
      case 'Numpad6':
        this.onWeaponSlotPressed?.(6);
        EventBus.getInstance().emit('weapon:select_slot', { slot: 6 });
        break;
      case 'KeyE':
        this.state.interact = true;
        this.onInteractPressed?.();
        break;
      case 'KeyR':
        this.state.reload = true;
        this.onReloadPressed?.();
        EventBus.getInstance().emit('weapon:reload_request');
        break;
      case 'KeyH':
        this.onControlsPressed?.();
        break;
      case 'Tab':
        e.preventDefault();
        this.state.inventory = !this.state.inventory;
        this.onInventoryPressed?.();
        break;
      case 'Escape':
        this.onPausePressed?.();
        break;
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.state.forward = false;
        this.updateKeyboardAxis();
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.state.backward = false;
        this.updateKeyboardAxis();
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.state.left = false;
        this.updateKeyboardAxis();
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.state.right = false;
        this.updateKeyboardAxis();
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.state.sprint = false;
        break;
      case 'Space':
        this.state.jump = false;
        break;
      case 'KeyE':
        this.state.interact = false;
        break;
      case 'KeyR':
        this.state.reload = false;
        break;
    }
  }

  private updateKeyboardAxis(): void {
    let x = 0;
    let y = 0;
    if (this.state.forward) y -= 1;
    if (this.state.backward) y += 1;
    if (this.state.left) x -= 1;
    if (this.state.right) x += 1;

    const len = Math.sqrt(x * x + y * y);
    if (len > 0) {
      x /= len;
      y /= len;
    }
    this.state.moveAxis.set(x, y);
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.isPointerLocked) {
      this.state.lookDelta.x += e.movementX * this.mouseSensitivity;
      this.state.lookDelta.y += e.movementY * this.mouseSensitivity;
    }
  }

  private onMouseDown(e: MouseEvent): void {
    const isTargetCanvas = e.target === this.targetElement;
    if (!isTargetCanvas) {
      return;
    }

    if (e.button === 0) {
      if (this.isPointerLocked) {
        this.state.attack = true;
      } else {
        // First click on game canvas requests pointer lock without firing weapon
        this.requestPointerLock();
      }
    } else if (e.button === 2) {
      if (this.isPointerLocked) {
        this.state.aim = true;
      }
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      this.state.attack = false;
    } else if (e.button === 2) {
      this.state.aim = false;
    }
  }

  public dispose(): void {
    // Clean up all window listeners if needed
    this.exitPointerLock();
    Logger.info('InputManager disposed.');
  }
}
