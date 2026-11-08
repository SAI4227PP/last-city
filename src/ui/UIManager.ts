import * as THREE from 'three';
import { useGameUIStore } from '@/ui/store/gameUIStore';
import { GameEngine } from '@/core/engine/GameEngine';
import { AudioManager } from '@/core/audio/AudioManager';
import { SaveManager } from '@/persistence/SaveManager';
import { PerformanceManager } from '@/core/performance/PerformanceManager';
import { EventBus } from '@/core/events/EventBus';

export class UIManager {
  private root: HTMLElement;
  private engine: GameEngine;
  private unsubscribeStore: () => void;

  constructor(root: HTMLElement, engine: GameEngine) {
    this.root = root;
    this.engine = engine;
    this.renderInitialDOM();
    this.bindEvents();

    // Subscribe to Zustand store changes for UI updates
    this.unsubscribeStore = useGameUIStore.subscribe((state) => {
      this.updateUI(state);
    });
  }

  private renderInitialDOM(): void {
    this.root.innerHTML = `
      <!-- STAGE LOADING SCREEN -->
      <div id="loading-screen" class="loading-overlay" style="display: none;">
        <div class="loading-content">
          <div id="loading-stage-title" class="loading-title">LOADING SECTOR</div>
          <div class="loading-bar-bg">
            <div id="loading-bar-fill" class="loading-bar-fill" style="width: 0%;"></div>
          </div>
          <div id="loading-status-text" class="loading-status">Streaming assets...</div>
        </div>
      </div>

      <!-- PERFORMANCE DIAGNOSTICS HUD BADGE -->
      <div id="perf-diagnostics" class="perf-diagnostics-badge" style="display: none;">
        <span id="diagnostics-text">FPS: 60 | FT: 16.6ms | DC: 80</span>
      </div>

      <!-- REAL-TIME FPS BADGE -->
      <div id="hud-fps" class="perf-diagnostics-badge" style="display: block; top: 12px; right: 12px; left: auto; font-size: 13px; font-weight: 800; color: #48bb78; background: rgba(13, 17, 23, 0.85); padding: 4px 10px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.15);">
        <span id="fps-counter-val">60 FPS</span>
      </div>

      <!-- CINEMATIC OVERLAY -->
      <div id="cinematic-screen" class="cinematic-overlay" style="display: none;">
        <div class="cinematic-letterbox"></div>
        <div class="cinematic-controls">
          <button id="btn-skip-intro" class="skip-intro-btn interactive">
            <span>SKIP INTRO [ESC]</span>
          </button>
        </div>
        <div class="cinematic-letterbox"></div>
      </div>

      <!-- MAIN MENU SCREEN -->
      <div id="main-menu-screen" class="modal-backdrop interactive" style="display: none;">
        <div class="main-menu-container">
          <h1 class="game-logo">LAST CITY</h1>
          <div class="game-sublogo">SURVIVAL HORROR RPG</div>
          <div class="menu-nav">
            <button id="btn-new-game" class="menu-btn primary">NEW SURVIVAL EXPEDITION</button>
            <button id="btn-continue" class="menu-btn" style="display: none;">CONTINUE LAST CHECKPOINT</button>
            <button id="btn-stage-select" class="menu-btn">STAGE SELECT</button>
            <button id="btn-open-settings" class="menu-btn">SETTINGS & PERFORMANCE</button>
          </div>
        </div>
      </div>

      <!-- STAGE SELECT MODAL -->
      <div id="stage-select-modal" class="modal-backdrop interactive" style="display: none;">
        <div class="inventory-modal" style="max-width: 500px;">
          <div class="modal-header">
            <h3>SELECT CHAPTER / STAGE</h3>
            <button id="btn-close-stages" class="menu-btn" style="width: auto; padding: 4px 12px;">✕</button>
          </div>
          <div style="padding: 20px; display: flex; flex-direction: column; gap: 10px;">
            <button class="menu-btn stage-jump-btn" data-stage="cinematic">PROLOGUE: THE OUTBREAK</button>
            <button class="menu-btn stage-jump-btn" data-stage="hospital">STAGE 1: ST. JUDE HOSPITAL</button>
            <button class="menu-btn stage-jump-btn" data-stage="city-escape">STAGE 2: VERIDIA CITY ESCAPE</button>
            <button class="menu-btn stage-jump-btn" data-stage="open-survival">STAGE 3: OPEN WORLD SURVIVAL</button>
          </div>
        </div>
      </div>

      <!-- IN-GAME HUD -->
      <div id="game-hud" class="hud-container" style="display: none;">
        <div id="crosshair" class="crosshair"></div>

        <!-- DAMAGE & HEALTH VIGNETTES -->
        <div id="damage-vignette" class="damage-vignette"></div>
        <div id="low-health-vignette" class="low-health-vignette"></div>
        <div id="damage-numbers-container" class="damage-numbers-container"></div>

        <!-- TARGET ENEMY HEALTH & BLOOD BAR (Top Center) -->
        <div id="enemy-target-hud" class="enemy-target-hud" style="display: none;">
          <div class="enemy-target-header">
            <span id="enemy-target-name" class="enemy-target-name">🧟 INFECTED SHAMBLER</span>
            <span id="enemy-target-blood-text" class="enemy-target-blood-text">BLOOD: 100 / 100</span>
          </div>
          <div class="enemy-target-bar-bg">
            <div id="enemy-target-bar-fill" class="enemy-target-bar-fill" style="width: 100%;"></div>
          </div>
        </div>

        <!-- Top HUD -->
        <div class="top-hud">
          <div style="display: flex; align-items: center; gap: 12px;">
            <button id="btn-hud-controls" class="menu-btn interactive" style="width: auto; padding: 5px 12px; font-size: 11px; margin: 0; background: rgba(13,17,23,0.85); border: 1px solid rgba(255,255,255,0.25); cursor: pointer;">❓ CONTROLS [H]</button>
            <div class="mission-tracker">
              <div id="hud-mission-title" class="mission-title">AWAKENING</div>
              <div id="hud-mission-objective" class="objective-text">Survey your surroundings</div>
            </div>
          </div>
          <div id="hud-stage-badge" class="stage-badge">ST. JUDE HOSPITAL</div>
        </div>

        <!-- Stage Banner Notification -->
        <div id="stage-banner" class="stage-banner" style="display: none;">
          <div id="banner-stage-num" class="banner-stage-num">STAGE 1</div>
          <div id="banner-stage-title" class="banner-stage-title">HOSPITAL OUTBREAK</div>
        </div>

        <!-- Interaction Prompt -->
        <div id="interaction-prompt" class="interaction-prompt" style="display: none;">
          <span class="key-badge">E</span>
          <span id="interaction-text" class="interaction-text">Search Cabinet</span>
        </div>

        <!-- Subtitles -->
        <div id="subtitle-box" class="subtitle-overlay" style="display: none;">
          <div id="subtitle-speaker" class="subtitle-speaker">SPEAKER</div>
          <div id="subtitle-body" class="subtitle-body">Text...</div>
        </div>

        <!-- Bottom HUD: Vitals & Weapon Info -->
        <div class="bottom-hud">
          <!-- Vitals Panel -->
          <div class="vitals-panel">
            <div class="vital-row">
              <span class="vital-label">HEALTH</span>
              <div class="vital-bar-bg"><div id="bar-health" class="vital-bar-fill fill-health" style="width: 100%;"></div></div>
              <span id="num-health" class="vital-numeric">100</span>
            </div>
            <div class="vital-row">
              <span class="vital-label">STAMINA</span>
              <div class="vital-bar-bg"><div id="bar-stamina" class="vital-bar-fill fill-stamina" style="width: 100%;"></div></div>
              <span id="num-stamina" class="vital-numeric">100</span>
            </div>
            <div class="vital-row">
              <span class="vital-label">HUNGER</span>
              <div class="vital-bar-bg"><div id="bar-hunger" class="vital-bar-fill fill-hunger" style="width: 100%;"></div></div>
              <span id="num-hunger" class="vital-numeric">100</span>
            </div>
            <div class="vital-row">
              <span class="vital-label">THIRST</span>
              <div class="vital-bar-bg"><div id="bar-thirst" class="vital-bar-fill fill-thirst" style="width: 100%;"></div></div>
              <span id="num-thirst" class="vital-numeric">100</span>
            </div>
          </div>

          <!-- Quick Weapon Slots Bar -->
          <div id="weapon-slots-bar" class="weapon-slots-bar"></div>

          <!-- Weapon Panel -->
          <div class="weapon-panel">
            <div class="weapon-info">
              <div id="weapon-name" class="weapon-name">Combat Knife</div>
              <div id="weapon-ammo-display" class="weapon-ammo">-- / --</div>
            </div>
            <div id="weapon-icon-display" style="font-size: 26px;">🗡️</div>
          </div>
        </div>

        <!-- Mobile Touch Controls -->
        <div class="mobile-controls">
          <div id="touch-stick-zone" class="touch-stick-zone">
            <div id="touch-stick-thumb" class="touch-stick-thumb"></div>
          </div>
          <div class="touch-actions-zone">
            <button id="btn-touch-attack" class="touch-btn">ATTACK</button>
            <button id="btn-touch-sprint" class="touch-btn">SPRINT</button>
            <button id="btn-touch-interact" class="touch-btn">ACTION</button>
            <button id="btn-touch-inv" class="touch-btn">BAG</button>
          </div>
        </div>
      </div>

      <!-- INVENTORY & CRAFTING MODAL -->
      <div id="inventory-modal" class="modal-backdrop interactive" style="display: none;">
        <div class="inventory-modal">
          <div class="modal-header">
            <div class="modal-tabs">
              <button id="tab-inventory" class="tab-btn active">INVENTORY</button>
              <button id="tab-crafting" class="tab-btn">CRAFTING</button>
            </div>
            <button id="btn-close-inventory" class="menu-btn" style="width: auto; padding: 4px 14px;">✕ CLOSE [TAB]</button>
          </div>

          <!-- Inventory Tab Content -->
          <div id="tab-content-inv" class="inventory-body">
            <div id="items-grid" class="items-grid"></div>
            <div class="item-details-panel">
              <div>
                <h4 id="detail-title" class="details-title">SELECT AN ITEM</h4>
                <p id="detail-desc" class="details-desc">Click any inventory slot to view statistics and consumable actions.</p>
              </div>
              <div class="details-actions">
                <button id="btn-use-item" class="menu-btn primary" style="display: none;">USE / CONSUME</button>
                <button id="btn-equip-item" class="menu-btn" style="display: none;">EQUIP WEAPON</button>
              </div>
            </div>
          </div>

          <!-- Crafting Tab Content -->
          <div id="tab-content-craft" class="inventory-body" style="display: none;">
            <div id="recipes-list" class="recipes-list" style="grid-column: span 2;"></div>
          </div>
        </div>
      </div>

      <!-- PAUSE MENU -->
      <div id="pause-screen" class="modal-backdrop interactive" style="display: none;">
        <div class="main-menu-container">
          <h2 style="font-size: 32px; letter-spacing: 3px; margin-bottom: 24px;">GAME PAUSED</h2>
          <div class="menu-nav">
            <button id="btn-resume" class="menu-btn primary">RESUME EXPEDITION</button>
            <button id="btn-manual-save" class="menu-btn">SAVE PROGRESSION</button>
            <button id="btn-pause-controls" class="menu-btn">CONTROLS & SHORTCUTS</button>
            <button id="btn-pause-settings" class="menu-btn">SETTINGS & PERFORMANCE</button>
            <button id="btn-quit-menu" class="menu-btn">RETURN TO MAIN MENU</button>
          </div>
        </div>
      </div>

      <!-- CONTROLS & SHORTCUTS MODAL -->
      <div id="controls-modal" class="modal-backdrop interactive" style="display: none;">
        <div class="inventory-modal" style="max-width: 580px; padding: 24px;">
          <div class="modal-header">
            <h3>GAMEPLAY CONTROLS & SHORTCUTS</h3>
            <button id="btn-close-controls" class="menu-btn" style="width: auto; padding: 4px 14px;">✕ CLOSE</button>
          </div>
          <div style="padding: 16px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
            <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px;">
              <strong style="color: #ecc94b;">MOVEMENT</strong><br/>
              <span style="color: #a0aec0;">W / A / S / D</span> : Move character<br/>
              <span style="color: #a0aec0;">Left Shift</span> : Sprint<br/>
              <span style="color: #a0aec0;">Space</span> : Jump<br/>
              <span style="color: #a0aec0;">C / Ctrl</span> : Crouch
            </div>
            <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px;">
              <strong style="color: #ecc94b;">COMBAT & WEAPONS</strong><br/>
              <span style="color: #a0aec0;">Left Mouse</span> : Attack / Fire<br/>
              <span style="color: #a0aec0;">Right Mouse</span> : Aim weapon<br/>
              <span style="color: #a0aec0;">R</span> : Reload gun<br/>
              <span style="color: #a0aec0;">1 - 5</span> : Quick switch weapon
            </div>
            <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px;">
              <strong style="color: #ecc94b;">INTERACTION</strong><br/>
              <span style="color: #a0aec0;">E</span> : Search containers / doors<br/>
              <span style="color: #a0aec0;">Tab</span> : Open Inventory / Crafting
            </div>
            <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px;">
              <strong style="color: #ecc94b;">SYSTEM & SHORTCUTS</strong><br/>
              <span style="color: #a0aec0;">Esc</span> : Pause menu / Options<br/>
              <span style="color: #a0aec0;">H</span> : View Controls Guide<br/>
              <span style="color: #a0aec0;">Click Canvas</span> : Lock mouse
            </div>
          </div>
          <button id="btn-controls-ok" class="menu-btn primary" style="margin-top: 10px;">GOT IT</button>
        </div>
      </div>

      <!-- SETTINGS MODAL -->
      <div id="settings-modal" class="modal-backdrop interactive" style="display: none;">
        <div class="inventory-modal" style="max-width: 540px; padding: 24px; max-height: 88vh; overflow-y: auto;">
          <h3 style="margin-bottom: 16px;">GRAPHICS & PERFORMANCE</h3>

          <!-- Graphics Profile Preset -->
          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 12px; font-weight: 700; color: var(--color-text-secondary); margin-bottom: 6px;">GRAPHICS PRESET</label>
            <div class="profile-pill-group">
              <button class="profile-pill active" data-profile="auto">AUTO (ADAPTIVE)</button>
              <button class="profile-pill" data-profile="low">LOW</button>
              <button class="profile-pill" data-profile="medium">MEDIUM</button>
              <button class="profile-pill" data-profile="high">HIGH</button>
            </div>
          </div>

          <!-- Advanced Performance Tweaks -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
            <div>
              <label style="display: block; font-size: 12px; font-weight: 700; color: var(--color-text-secondary); margin-bottom: 6px;">SHADOWS</label>
              <select id="select-shadows" class="menu-btn" style="width: 100%; padding: 6px 10px; font-size: 13px; text-align: left;">
                <option value="off">Off (Intel / Low-end)</option>
                <option value="low">Low (1024² PCF)</option>
                <option value="high">High (2048² PCFSoft)</option>
              </select>
            </div>
            <div>
              <label style="display: block; font-size: 12px; font-weight: 700; color: var(--color-text-secondary); margin-bottom: 6px;">PARTICLES</label>
              <select id="select-particles" class="menu-btn" style="width: 100%; padding: 6px 10px; font-size: 13px; text-align: left;">
                <option value="low">Low (35% density)</option>
                <option value="medium">Medium (70% density)</option>
                <option value="high">High (100% density)</option>
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
            <div>
              <label style="display: block; font-size: 12px; font-weight: 700; color: var(--color-text-secondary); margin-bottom: 6px;">ENVIRONMENT DETAIL</label>
              <select id="select-env-detail" class="menu-btn" style="width: 100%; padding: 6px 10px; font-size: 13px; text-align: left;">
                <option value="low">Low (Reduced foliage/props)</option>
                <option value="high">High (Full world props)</option>
              </select>
            </div>
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label style="font-size: 12px; font-weight: 700; color: var(--color-text-secondary);">RENDER SCALE</label>
                <span id="label-render-scale" style="font-size: 12px; color: var(--color-accent-amber); font-family: var(--font-mono);">85%</span>
              </div>
              <input type="range" id="slider-render-scale" min="0.6" max="1.0" step="0.05" value="0.85" style="width: 100%;" />
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--color-text-primary); cursor: pointer;">
              <input type="checkbox" id="check-fps" checked />
              <span>SHOW REAL-TIME FPS COUNTER</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--color-text-primary); cursor: pointer;">
              <input type="checkbox" id="check-diagnostics" />
              <span>SHOW PERFORMANCE DIAGNOSTICS OVERLAY</span>
            </label>
          </div>

          <h3 style="margin-bottom: 14px;">AUDIO VOLUMES</h3>
          <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
            <div>
              <label style="display: block; font-size: 12px; color: var(--color-text-secondary); margin-bottom: 4px;">MASTER VOLUME</label>
              <input type="range" id="slider-master" min="0" max="1" step="0.05" value="0.8" style="width: 100%;" />
            </div>
            <div>
              <label style="display: block; font-size: 12px; color: var(--color-text-secondary); margin-bottom: 4px;">SFX VOLUME</label>
              <input type="range" id="slider-sfx" min="0" max="1" step="0.05" value="0.8" style="width: 100%;" />
            </div>
            <div>
              <label style="display: block; font-size: 12px; color: var(--color-text-secondary); margin-bottom: 4px;">MUSIC VOLUME</label>
              <input type="range" id="slider-music" min="0" max="1" step="0.05" value="0.6" style="width: 100%;" />
            </div>
          </div>
          <button id="btn-close-settings" class="menu-btn primary">SAVE & CLOSE</button>
        </div>
      </div>

      <!-- GAME OVER SCREEN -->
      <div id="game-over-screen" class="modal-backdrop interactive" style="display: none;">
        <div class="main-menu-container">
          <h1 style="font-size: 48px; color: var(--color-accent-red); letter-spacing: 4px; margin-bottom: 10px;">YOU DIED</h1>
          <p id="game-over-reason" style="color: var(--color-text-secondary); margin-bottom: 30px;">You succumbed to the infection.</p>
          <div class="menu-nav">
            <button id="btn-restart-stage" class="menu-btn primary">RESTART CURRENT STAGE</button>
            <button id="btn-gameover-menu" class="menu-btn">RETURN TO MAIN MENU</button>
          </div>
        </div>
      </div>
    `;

    // Check if previous save exists to display "Continue" button
    SaveManager.getInstance().hasSave().then((has) => {
      const btnContinue = document.getElementById('btn-continue');
      if (btnContinue && has) {
        btnContinue.style.display = 'block';
      }
    });
  }

  private bindEvents(): void {
    // Skip intro button
    document.getElementById('btn-skip-intro')?.addEventListener('click', () => {
      const current = this.engine.sceneManager.getCurrentScene();
      if (current && current.id === 'cinematic') {
        (current as any).skipCinematic();
      }
    });

    // New Game -> Cinematic Stage
    document.getElementById('btn-new-game')?.addEventListener('click', () => {
      AudioManager.getInstance().playSound('pickup');
      this.engine.sceneManager.loadScene('cinematic');
    });

    // Continue Game -> Load saved stage or Open Survival
    document.getElementById('btn-continue')?.addEventListener('click', async () => {
      AudioManager.getInstance().playSound('pickup');
      const save = await SaveManager.getInstance().loadGame();
      if (save) {
        this.engine.sceneManager.loadScene(save.stage);
      } else {
        this.engine.sceneManager.loadScene('hospital');
      }
    });

    // Stage Select dialog
    document.getElementById('btn-stage-select')?.addEventListener('click', () => {
      const modal = document.getElementById('stage-select-modal');
      if (modal) modal.style.display = 'flex';
    });

    document.getElementById('btn-close-stages')?.addEventListener('click', () => {
      const modal = document.getElementById('stage-select-modal');
      if (modal) modal.style.display = 'none';
    });

    document.querySelectorAll('.stage-jump-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const stage = (e.currentTarget as HTMLElement).getAttribute('data-stage');
        if (stage) {
          const modal = document.getElementById('stage-select-modal');
          if (modal) modal.style.display = 'none';
          this.engine.sceneManager.loadScene(stage as any);
        }
      });
    });

    // Pause menu triggers
    this.engine.inputManager.onPausePressed = () => {
      const state = useGameUIStore.getState();
      if (state.currentStage === 'main-menu' || state.currentStage === 'cinematic') return;
      const nextPaused = !state.isPaused;
      useGameUIStore.getState().setPaused(nextPaused);
      useGameUIStore.getState().setShowPauseMenu(nextPaused);
      if (nextPaused) {
        this.engine.inputManager.exitPointerLock();
      } else {
        this.engine.inputManager.requestPointerLock();
      }
    };

    document.getElementById('btn-resume')?.addEventListener('click', () => {
      useGameUIStore.getState().setPaused(false);
      useGameUIStore.getState().setShowPauseMenu(false);
      this.engine.inputManager.requestPointerLock();
    });

    document.getElementById('btn-manual-save')?.addEventListener('click', () => {
      const current = this.engine.sceneManager.getCurrentScene();
      if (current && (current as any).saveGameState) {
        (current as any).saveGameState();
        EventBus.getInstance().emit('subtitle:show', {
          speaker: 'SYSTEM',
          text: 'Game checkpoint saved successfully to IndexedDB.',
          durationMs: 3000
        });
      }
    });

    document.getElementById('btn-quit-menu')?.addEventListener('click', () => {
      useGameUIStore.getState().setPaused(false);
      useGameUIStore.getState().setShowPauseMenu(false);
      this.engine.inputManager.exitPointerLock();
      this.engine.sceneManager.loadScene('main-menu');
    });

    // Inventory toggle via Tab key or bag button
    this.engine.inputManager.onInventoryPressed = () => {
      const state = useGameUIStore.getState();
      if (state.currentStage === 'main-menu' || state.currentStage === 'cinematic') return;
      const nextInv = !state.showInventory;
      useGameUIStore.getState().setShowInventory(nextInv);
      if (nextInv) {
        this.engine.inputManager.exitPointerLock();
        this.renderInventoryGrid();
      } else {
        this.engine.inputManager.requestPointerLock();
      }
    };

    document.getElementById('btn-close-inventory')?.addEventListener('click', () => {
      useGameUIStore.getState().setShowInventory(false);
      this.engine.inputManager.requestPointerLock();
    });

    // Inventory / Crafting tab switching
    document.getElementById('tab-inventory')?.addEventListener('click', () => {
      useGameUIStore.getState().setInventoryTab('inventory');
      document.getElementById('tab-inventory')?.classList.add('active');
      document.getElementById('tab-crafting')?.classList.remove('active');
      document.getElementById('tab-content-inv')!.style.display = 'grid';
      document.getElementById('tab-content-craft')!.style.display = 'none';
      this.renderInventoryGrid();
    });

    document.getElementById('tab-crafting')?.addEventListener('click', () => {
      useGameUIStore.getState().setInventoryTab('crafting');
      document.getElementById('tab-crafting')?.classList.add('active');
      document.getElementById('tab-inventory')?.classList.remove('active');
      document.getElementById('tab-content-inv')!.style.display = 'none';
      document.getElementById('tab-content-craft')!.style.display = 'grid';
      this.renderCraftingList();
    });

    // Item Action: Consume
    document.getElementById('btn-use-item')?.addEventListener('click', () => {
      const selected = useGameUIStore.getState().selectedItem;
      if (!selected) return;

      const current = this.engine.sceneManager.getCurrentScene() as any;
      if (current && current.inventoryManager && current.survivalSystem) {
        if (selected.healAmount) {
          current.survivalSystem.heal(selected.healAmount);
          AudioManager.getInstance().playSound('pickup');
        }
        if (selected.hungerAmount) {
          current.survivalSystem.consumeFood(selected.hungerAmount);
          AudioManager.getInstance().playSound('pickup');
        }
        if (selected.thirstAmount) {
          current.survivalSystem.consumeWater(selected.thirstAmount);
          AudioManager.getInstance().playSound('pickup');
        }
        current.inventoryManager.removeItem(selected.id, 1);
        useGameUIStore.getState().setSelectedItem(null);
        this.renderInventoryGrid();
      }
    });

    // Item Action: Equip
    document.getElementById('btn-equip-item')?.addEventListener('click', () => {
      const selected = useGameUIStore.getState().selectedItem;
      if (!selected || !selected.weaponType) return;

      const current = this.engine.sceneManager.getCurrentScene() as any;
      if (current && current.combatManager) {
        current.combatManager.equipWeapon(selected.weaponType);
        AudioManager.getInstance().playSound('reload');
        this.renderInventoryGrid();
      }
    });

    // Settings Modal
    const syncSettingsModalUI = () => {
      const perf = PerformanceManager.getInstance();
      const cfg = perf.getConfig();
      const audio = AudioManager.getInstance().getSettings();

      // Update profile pills
      document.querySelectorAll('.profile-pill').forEach((p) => {
        const prof = p.getAttribute('data-profile');
        if (prof === perf.activeProfile) p.classList.add('active');
        else p.classList.remove('active');
      });

      // Update dropdowns & sliders
      const selectShadows = document.getElementById('select-shadows') as HTMLSelectElement | null;
      if (selectShadows) selectShadows.value = cfg.shadowQuality;

      const selectParticles = document.getElementById('select-particles') as HTMLSelectElement | null;
      if (selectParticles) selectParticles.value = cfg.particleQuality;

      const selectEnv = document.getElementById('select-env-detail') as HTMLSelectElement | null;
      if (selectEnv) selectEnv.value = cfg.environmentalDetail;

      const sliderScale = document.getElementById('slider-render-scale') as HTMLInputElement | null;
      const labelScale = document.getElementById('label-render-scale');
      if (sliderScale && labelScale) {
        sliderScale.value = cfg.renderScale.toString();
        labelScale.textContent = `${Math.round(cfg.renderScale * 100)}%`;
      }

      const checkFps = document.getElementById('check-fps') as HTMLInputElement | null;
      if (checkFps) checkFps.checked = cfg.showFps;

      const checkDiag = document.getElementById('check-diagnostics') as HTMLInputElement | null;
      if (checkDiag) checkDiag.checked = cfg.showDiagnostics;

      const sMaster = document.getElementById('slider-master') as HTMLInputElement | null;
      if (sMaster) sMaster.value = audio.masterVolume.toString();
      const sSfx = document.getElementById('slider-sfx') as HTMLInputElement | null;
      if (sSfx) sSfx.value = audio.sfxVolume.toString();
      const sMusic = document.getElementById('slider-music') as HTMLInputElement | null;
      if (sMusic) sMusic.value = audio.musicVolume.toString();
    };

    document.getElementById('btn-open-settings')?.addEventListener('click', () => {
      syncSettingsModalUI();
      document.getElementById('settings-modal')!.style.display = 'flex';
    });
    document.getElementById('btn-pause-settings')?.addEventListener('click', () => {
      syncSettingsModalUI();
      document.getElementById('settings-modal')!.style.display = 'flex';
    });
    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      document.getElementById('settings-modal')!.style.display = 'none';
    });

    // Graphics Profile Selector
    document.querySelectorAll('.profile-pill').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const profile = target.getAttribute('data-profile') as any;
        if (profile) {
          PerformanceManager.getInstance().setProfile(profile);
          document.querySelectorAll('.profile-pill').forEach((p) => p.classList.remove('active'));
          target.classList.add('active');
          syncSettingsModalUI();
        }
      });
    });

    // Granular Graphics Controls
    document.getElementById('select-shadows')?.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value as any;
      PerformanceManager.getInstance().setShadowQuality(val);
    });

    document.getElementById('select-particles')?.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value as any;
      PerformanceManager.getInstance().setParticleQuality(val);
    });

    document.getElementById('select-env-detail')?.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value as any;
      PerformanceManager.getInstance().setEnvironmentalDetail(val);
    });

    document.getElementById('slider-render-scale')?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      const label = document.getElementById('label-render-scale');
      if (label) label.textContent = `${Math.round(val * 100)}%`;
      PerformanceManager.getInstance().setRenderScale(val);
    });

    // Checkboxes
    document.getElementById('check-fps')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      PerformanceManager.getInstance().setShowFps(checked);
      const fpsEl = document.getElementById('hud-fps');
      if (fpsEl) fpsEl.style.display = checked ? 'block' : 'none';
    });

    document.getElementById('check-diagnostics')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      PerformanceManager.getInstance().setShowDiagnostics(checked);
    });

    // Audio Sliders
    document.getElementById('slider-master')?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      AudioManager.getInstance().setSettings({ masterVolume: val });
    });
    document.getElementById('slider-sfx')?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      AudioManager.getInstance().setSettings({ sfxVolume: val });
    });
    document.getElementById('slider-music')?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      AudioManager.getInstance().setSettings({ musicVolume: val });
    });

    // Game Over restarts
    document.getElementById('btn-restart-stage')?.addEventListener('click', () => {
      useGameUIStore.getState().setShowGameOver(false);
      const stage = useGameUIStore.getState().currentStage;
      this.engine.sceneManager.loadScene(stage);
    });

    document.getElementById('btn-gameover-menu')?.addEventListener('click', () => {
      useGameUIStore.getState().setShowGameOver(false);
      this.engine.inputManager.exitPointerLock();
      this.engine.sceneManager.loadScene('main-menu');
    });

    // Mobile Virtual Touch Joystick
    this.setupMobileJoystick();

    // Controls modal
    const openControls = () => {
      document.getElementById('controls-modal')!.style.display = 'flex';
      this.engine.inputManager.exitPointerLock();
    };

    const closeControls = () => {
      document.getElementById('controls-modal')!.style.display = 'none';
      const state = useGameUIStore.getState();
      if (!state.isPaused && !state.showInventory && !state.showSettings) {
        this.engine.inputManager.requestPointerLock();
      }
    };

    document.getElementById('btn-hud-controls')?.addEventListener('click', openControls);
    document.getElementById('btn-pause-controls')?.addEventListener('click', openControls);
    document.getElementById('btn-close-controls')?.addEventListener('click', closeControls);
    document.getElementById('btn-controls-ok')?.addEventListener('click', closeControls);

    this.engine.inputManager.onControlsPressed = () => {
      const modal = document.getElementById('controls-modal');
      if (modal && modal.style.display === 'flex') {
        closeControls();
      } else {
        openControls();
      }
    };

    // Blood and damage feedback
    EventBus.getInstance().on('player:damage', () => {
      const vignette = document.getElementById('damage-vignette');
      if (vignette) {
        vignette.style.opacity = '0.9';
        setTimeout(() => {
          vignette.style.opacity = '0';
        }, 280);
      }
    });

    // Floating damage numbers and enemy target blood bar on zombie hits
    let enemyTargetHideTimeout: any = null;

    EventBus.getInstance().on('combat:damage_number', (data: {
      amount: number;
      position: [number, number, number];
      isHeadshot: boolean;
      hitLocation?: string;
      armorReduced?: number;
      remainingHealth?: number;
      maxHealth?: number;
      targetName?: string;
    }) => {
      // 1. Update Top-Center Enemy Target Blood HUD
      const targetHud = document.getElementById('enemy-target-hud');
      const targetName = document.getElementById('enemy-target-name');
      const bloodText = document.getElementById('enemy-target-blood-text');
      const bloodFill = document.getElementById('enemy-target-bar-fill');

      if (targetHud && data.remainingHealth !== undefined && data.maxHealth) {
        targetHud.style.display = 'flex';
        if (targetName) targetName.innerText = `🧟 ${(data.targetName || 'ZOMBIE').toUpperCase()}`;
        if (bloodText) bloodText.innerText = `BLOOD: ${Math.round(data.remainingHealth)} / ${data.maxHealth}`;
        if (bloodFill) {
          const pct = Math.max(0, Math.min(100, (data.remainingHealth / data.maxHealth) * 100));
          bloodFill.style.width = `${pct}%`;
        }

        clearTimeout(enemyTargetHideTimeout);
        enemyTargetHideTimeout = setTimeout(() => {
          if (targetHud) targetHud.style.display = 'none';
        }, 4000);
      }

      // 2. Floating Damage Numbers on Screen
      const container = document.getElementById('damage-numbers-container');
      const camera = this.engine.cameraManager.camera;
      if (!container || !camera) return;

      const pos = new THREE.Vector3(data.position[0], data.position[1] + 0.35, data.position[2]);
      pos.project(camera);

      // Only display if in front of camera
      if (pos.z >= -1.0 && pos.z <= 1.0) {
        const jitterX = (Math.random() - 0.5) * 40;
        const x = (pos.x * 0.5 + 0.5) * window.innerWidth + jitterX;
        const y = (-(pos.y * 0.5) + 0.5) * window.innerHeight;

        const el = document.createElement('div');
        el.className = `floating-damage-number ${data.isHeadshot ? 'headshot' : ''}`;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.innerText = data.isHeadshot ? `💥 CRIT -${data.amount}` : `-${data.amount}`;
        container.appendChild(el);

        setTimeout(() => {
          if (el.parentNode === container) {
            container.removeChild(el);
          }
        }, 850);
      }
    });
  }

  private setupMobileJoystick(): void {
    const stickZone = document.getElementById('touch-stick-zone');
    const stickThumb = document.getElementById('touch-stick-thumb');
    if (!stickZone || !stickThumb) return;

    let touchId: number | null = null;
    let centerX = 0;
    let centerY = 0;
    const maxRadius = 45;

    stickZone.addEventListener('touchstart', (e) => {
      if (touchId === null) {
        const touch = e.changedTouches[0];
        touchId = touch.identifier;
        const rect = stickZone.getBoundingClientRect();
        centerX = rect.left + rect.width / 2;
        centerY = rect.top + rect.height / 2;
      }
    }, { passive: false });

    stickZone.addEventListener('touchmove', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touchId) {
          const dx = touch.clientX - centerX;
          const dy = touch.clientY - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const clampedDist = Math.min(dist, maxRadius);
          const angle = Math.atan2(dy, dx);

          const thumbX = Math.cos(angle) * clampedDist;
          const thumbY = Math.sin(angle) * clampedDist;

          stickThumb.style.transform = `translate(${thumbX}px, ${thumbY}px)`;
          this.engine.inputManager.setVirtualMoveAxis(thumbX / maxRadius, thumbY / maxRadius);
          break;
        }
      }
    }, { passive: false });

    const resetStick = () => {
      touchId = null;
      stickThumb.style.transform = 'translate(0px, 0px)';
      this.engine.inputManager.setVirtualMoveAxis(0, 0);
    };

    stickZone.addEventListener('touchend', resetStick, { passive: true });
    stickZone.addEventListener('touchcancel', resetStick, { passive: true });

    // Touch Action Buttons with touch-action prevention
    const bindTouchAction = (id: string, action: any) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.engine.inputManager.triggerAction(action, true);
      }, { passive: false });
      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.engine.inputManager.triggerAction(action, false);
      }, { passive: false });
    };

    bindTouchAction('btn-touch-attack', 'attack');
    bindTouchAction('btn-touch-sprint', 'sprint');
    bindTouchAction('btn-touch-interact', 'interact');
    bindTouchAction('btn-touch-inv', 'inventory');
  }

  private updateUI(state: ReturnType<typeof useGameUIStore.getState>): void {
    // Stage Screens Visibility
    const isCinematic = state.currentStage === 'cinematic';
    const isMainMenu = state.currentStage === 'main-menu';
    const isGameplay = !isCinematic && !isMainMenu;

    document.getElementById('cinematic-screen')!.style.display = isCinematic ? 'flex' : 'none';
    document.getElementById('main-menu-screen')!.style.display = isMainMenu ? 'flex' : 'none';
    document.getElementById('game-hud')!.style.display = isGameplay ? 'flex' : 'none';

    // Loading Screen
    const loadingScreenEl = document.getElementById('loading-screen');
    if (loadingScreenEl) {
      loadingScreenEl.style.display = state.loadingScreen.visible ? 'flex' : 'none';
      document.getElementById('loading-stage-title')!.innerText = state.loadingScreen.title;
      document.getElementById('loading-bar-fill')!.style.width = `${state.loadingScreen.progress}%`;
      document.getElementById('loading-status-text')!.innerText = state.loadingScreen.statusText;
    }

    // Performance Diagnostics Badge
    const diagEl = document.getElementById('perf-diagnostics');
    if (diagEl) {
      diagEl.style.display = state.showDiagnostics ? 'block' : 'none';
      if (state.showDiagnostics) {
        document.getElementById('diagnostics-text')!.innerText = state.diagnosticsText || `FPS: ${state.fps}`;
      }
    }

    // Real-Time FPS Badge
    const fpsVal = document.getElementById('fps-counter-val');
    if (fpsVal) {
      fpsVal.innerText = `${state.fps} FPS`;
      fpsVal.style.color = state.fps >= 50 ? '#48bb78' : state.fps >= 28 ? '#ecc94b' : '#f56565';
    }

    // Pause & Inventory Modals
    document.getElementById('pause-screen')!.style.display = state.showPauseMenu ? 'flex' : 'none';
    document.getElementById('inventory-modal')!.style.display = state.showInventory ? 'flex' : 'none';
    document.getElementById('game-over-screen')!.style.display = state.showGameOver ? 'flex' : 'none';

    if (state.showGameOver) {
      document.getElementById('game-over-reason')!.innerText = state.gameOverReason;
    }

    if (isGameplay) {
      // Low health pulsing vignette
      const lowHealthEl = document.getElementById('low-health-vignette');
      if (lowHealthEl) {
        lowHealthEl.style.opacity = state.vitals.health <= 25 ? '1' : '0';
      }

      // Quick Weapon Slots Bar
      const slotsBar = document.getElementById('weapon-slots-bar');
      if (slotsBar && state.weapon.slots) {
        slotsBar.innerHTML = state.weapon.slots.map((slot) => `
          <div class="weapon-slot-card ${slot.isEquipped ? 'active' : ''} ${!slot.isUnlocked ? 'locked' : ''}" data-slot="${slot.slot}">
            <span class="weapon-slot-num">${slot.slot}</span>
            <span class="weapon-slot-icon">${slot.icon}</span>
            <span class="weapon-slot-ammo">${slot.isUnlocked ? slot.ammoText : '🔒'}</span>
            ${slot.isEquipped && state.weapon.isReloading ? '<span class="weapon-slot-reload">RELOAD</span>' : ''}
          </div>
        `).join('');

        slotsBar.querySelectorAll('.weapon-slot-card').forEach((card) => {
          card.addEventListener('click', (e) => {
            e.stopPropagation();
            const slotNum = parseInt((e.currentTarget as HTMLElement).getAttribute('data-slot') || '0', 10);
            if (slotNum > 0) {
              EventBus.getInstance().emit('weapon:select_slot', { slot: slotNum });
            }
          });
        });
      }

      // Vitals Bars
      document.getElementById('bar-health')!.style.width = `${state.vitals.health}%`;
      document.getElementById('num-health')!.innerText = `${Math.round(state.vitals.health)}`;

      document.getElementById('bar-stamina')!.style.width = `${state.vitals.stamina}%`;
      document.getElementById('num-stamina')!.innerText = `${Math.round(state.vitals.stamina)}`;

      document.getElementById('bar-hunger')!.style.width = `${state.vitals.hunger}%`;
      document.getElementById('num-hunger')!.innerText = `${Math.round(state.vitals.hunger)}`;

      document.getElementById('bar-thirst')!.style.width = `${state.vitals.thirst}%`;
      document.getElementById('num-thirst')!.innerText = `${Math.round(state.vitals.thirst)}`;

      // Weapon Info
      document.getElementById('weapon-name')!.innerText = state.weapon.name;
      const ammoDisplay = document.getElementById('weapon-ammo-display');
      if (ammoDisplay) {
        if (state.weapon.isReloading) {
          ammoDisplay.innerText = 'RELOADING...';
          ammoDisplay.style.color = '#f6ad55';
        } else {
          ammoDisplay.innerText = state.weapon.isRanged
            ? `${state.weapon.currentAmmo} / ${state.weapon.reserveAmmo}`
            : 'READY';
          ammoDisplay.style.color = 'var(--color-accent-amber)';
        }
      }

      const iconMap: Record<string, string> = {
        knife: '🗡️',
        pistol: '🔫',
        shotgun: '💥',
        rifle: '🎯',
        bat: '🏏'
      };
      const iconDisplay = document.getElementById('weapon-icon-display');
      if (iconDisplay && state.weapon.id) {
        iconDisplay.innerText = iconMap[state.weapon.id] || '🗡️';
      }

      // Mission tracker
      document.getElementById('hud-mission-title')!.innerText = state.activeMission.title;
      document.getElementById('hud-mission-objective')!.innerText = state.activeMission.objective;

      // Stage Badge
      const stageLabels: Record<string, string> = {
        hospital: 'STAGE 1: ST. JUDE HOSPITAL',
        'city-escape': 'STAGE 2: VERIDIA CITY ESCAPE',
        'open-survival': 'STAGE 3: OPEN SURVIVAL DISTRICT'
      };
      document.getElementById('hud-stage-badge')!.innerText = stageLabels[state.currentStage] || 'VERIDIA';

      // Crosshair hit indicator
      const crosshair = document.getElementById('crosshair');
      if (crosshair) {
        if (state.crosshairHit) {
          crosshair.classList.add('hit-target');
        } else {
          crosshair.classList.remove('hit-target');
        }
      }

      // Interaction Prompt
      const promptEl = document.getElementById('interaction-prompt');
      if (promptEl) {
        promptEl.style.display = state.interactionPrompt.visible ? 'flex' : 'none';
        document.getElementById('interaction-text')!.innerText = state.interactionPrompt.text;
      }

      // Stage Banner
      const bannerEl = document.getElementById('stage-banner');
      if (bannerEl) {
        bannerEl.style.display = state.stageBanner.visible ? 'block' : 'none';
        document.getElementById('banner-stage-num')!.innerText = state.stageBanner.stageNum;
        document.getElementById('banner-stage-title')!.innerText = state.stageBanner.stageTitle;
      }
    }

    // Subtitles (Cinematic or Gameplay)
    const subBox = document.getElementById('subtitle-box');
    if (subBox) {
      subBox.style.display = state.subtitles.visible ? 'block' : 'none';
      document.getElementById('subtitle-speaker')!.innerText = state.subtitles.speaker;
      document.getElementById('subtitle-body')!.innerText = state.subtitles.text;
    }
  }

  private renderInventoryGrid(): void {
    const grid = document.getElementById('items-grid');
    if (!grid) return;

    const items = useGameUIStore.getState().inventoryItems;
    const selected = useGameUIStore.getState().selectedItem;

    grid.innerHTML = '';
    const totalSlots = 16;

    for (let i = 0; i < totalSlots; i++) {
      const item = items[i];
      const slot = document.createElement('div');
      slot.className = `item-slot ${item ? '' : 'empty'} ${selected?.id === item?.id ? 'selected' : ''}`;

      if (item) {
        slot.innerHTML = `
          <div class="item-icon">${item.icon}</div>
          <div class="item-name-tag">${item.name}</div>
          ${item.count > 1 ? `<span class="item-count-tag">x${item.count}</span>` : ''}
        `;
        slot.addEventListener('click', () => {
          useGameUIStore.getState().setSelectedItem(item);
          this.updateItemDetails(item);
          this.renderInventoryGrid();
        });
      } else {
        slot.innerHTML = `<span style="font-size: 16px; opacity: 0.15;">+</span>`;
      }
      grid.appendChild(slot);
    }

    if (selected) {
      this.updateItemDetails(selected);
    }
  }

  private updateItemDetails(item: any): void {
    document.getElementById('detail-title')!.innerText = item.name;
    document.getElementById('detail-desc')!.innerText = item.description;

    const btnUse = document.getElementById('btn-use-item')!;
    const btnEquip = document.getElementById('btn-equip-item')!;

    btnUse.style.display = item.usable ? 'block' : 'none';
    btnEquip.style.display = item.weaponType ? 'block' : 'none';
  }

  private renderCraftingList(): void {
    const list = document.getElementById('recipes-list');
    if (!list) return;

    const recipes = useGameUIStore.getState().craftingRecipes;
    const currentScene = this.engine.sceneManager.getCurrentScene() as any;

    list.innerHTML = '';
    for (const recipe of recipes) {
      const canCraft = currentScene?.craftingManager?.canCraft(recipe.id) ?? false;
      const reqsText = recipe.ingredients.map((ing: any) => `${ing.itemId} x${ing.count}`).join(', ');

      const card = document.createElement('div');
      card.className = 'recipe-card';
      card.innerHTML = `
        <div class="recipe-info">
          <h4>${recipe.name}</h4>
          <div class="recipe-reqs">Requires: ${reqsText}</div>
          <div style="font-size: 11px; color: var(--color-text-secondary); margin-top: 2px;">${recipe.description}</div>
        </div>
        <button class="menu-btn primary craft-action-btn" data-recipe="${recipe.id}" style="width: auto; padding: 8px 18px;" ${canCraft ? '' : 'disabled'}>
          ${canCraft ? 'CRAFT' : 'MISSING PARTS'}
        </button>
      `;

      card.querySelector('.craft-action-btn')?.addEventListener('click', () => {
        if (currentScene?.craftingManager?.craft(recipe.id)) {
          this.renderCraftingList();
        }
      });

      list.appendChild(card);
    }
  }

  public dispose(): void {
    this.unsubscribeStore();
  }
}
