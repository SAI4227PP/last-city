import { createStore } from 'zustand/vanilla';
import { StageId, VitalStats, InventoryItem, CraftingRecipe } from '@/shared/types';

export interface GameUIState {
  currentStage: StageId;
  isPaused: boolean;
  showMainMenu: boolean;
  showPauseMenu: boolean;
  showInventory: boolean;
  showSettings: boolean;
  showGameOver: boolean;
  gameOverReason: string;

  // Loading Screen
  loadingScreen: {
    visible: boolean;
    title: string;
    progress: number;
    statusText: string;
  };

  // Performance & Diagnostics
  graphicsProfile: 'auto' | 'low' | 'medium' | 'high';
  fps: number;
  showDiagnostics: boolean;
  diagnosticsText: string;

  // HUD elements
  stageBanner: { visible: boolean; stageNum: string; stageTitle: string };
  interactionPrompt: { visible: boolean; text: string; key: string };
  subtitles: { visible: boolean; speaker: string; text: string };
  crosshairHit: boolean;
  crosshairHeadshot: boolean;

  // Mission
  activeMission: {
    title: string;
    objective: string;
    counter?: string;
  };

  // Vitals & Weaponry
  vitals: VitalStats;
  weapon: {
    name: string;
    currentAmmo: number;
    reserveAmmo: number;
    isRanged: boolean;
  };

  // Inventory & Crafting
  inventoryTab: 'inventory' | 'crafting';
  inventoryItems: InventoryItem[];
  selectedItem: InventoryItem | null;
  craftingRecipes: CraftingRecipe[];

  // Actions
  setStage: (stage: StageId) => void;
  setPaused: (paused: boolean) => void;
  setShowMainMenu: (show: boolean) => void;
  setShowPauseMenu: (show: boolean) => void;
  setShowInventory: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setShowGameOver: (show: boolean, reason?: string) => void;
  setLoadingScreen: (loading: { visible?: boolean; title?: string; progress?: number; statusText?: string }) => void;
  setGraphicsProfile: (profile: 'auto' | 'low' | 'medium' | 'high') => void;
  setFps: (fps: number) => void;
  setShowDiagnostics: (show: boolean) => void;
  setDiagnosticsText: (text: string) => void;
  setStageBanner: (stageNum: string, stageTitle: string, durationMs?: number) => void;
  setInteractionPrompt: (prompt: { visible: boolean; text: string; key: string }) => void;
  setSubtitles: (subtitles: { visible: boolean; speaker: string; text: string }) => void;
  setCrosshairHit: (hit: boolean, isHeadshot?: boolean) => void;
  setActiveMission: (mission: { title: string; objective: string; counter?: string }) => void;
  setVitals: (vitals: VitalStats) => void;
  setWeapon: (weapon: { name: string; currentAmmo: number; reserveAmmo: number; isRanged: boolean }) => void;
  setInventoryTab: (tab: 'inventory' | 'crafting') => void;
  setInventoryItems: (items: InventoryItem[]) => void;
  setSelectedItem: (item: InventoryItem | null) => void;
  setCraftingRecipes: (recipes: CraftingRecipe[]) => void;
}

export const gameUIStore = createStore<GameUIState>((set) => ({
  currentStage: 'main-menu',
  isPaused: false,
  showMainMenu: true,
  showPauseMenu: false,
  showInventory: false,
  showSettings: false,
  showGameOver: false,
  gameOverReason: 'You succumbed to the infection.',

  loadingScreen: {
    visible: false,
    title: 'LOADING STAGE',
    progress: 0,
    statusText: 'Preparing district...'
  },

  graphicsProfile: 'auto',
  fps: 60,
  showDiagnostics: false,
  diagnosticsText: '',

  stageBanner: { visible: false, stageNum: '', stageTitle: '' },
  interactionPrompt: { visible: false, text: '', key: 'E' },
  subtitles: { visible: false, speaker: '', text: '' },
  crosshairHit: false,
  crosshairHeadshot: false,

  activeMission: {
    title: 'AWAKENING',
    objective: 'Survey your surroundings'
  },

  vitals: {
    health: 100,
    maxHealth: 100,
    stamina: 100,
    maxStamina: 100,
    hunger: 100,
    thirst: 100
  },

  weapon: {
    name: 'Combat Knife',
    currentAmmo: 0,
    reserveAmmo: 0,
    isRanged: false
  },

  inventoryTab: 'inventory',
  inventoryItems: [],
  selectedItem: null,
  craftingRecipes: [],

  setStage: (stage) => set({ currentStage: stage }),
  setPaused: (isPaused) => set({ isPaused }),
  setShowMainMenu: (showMainMenu) => set({ showMainMenu }),
  setShowPauseMenu: (showPauseMenu) => set({ showPauseMenu }),
  setShowInventory: (showInventory) => set({ showInventory }),
  setShowSettings: (showSettings) => set({ showSettings }),
  setShowGameOver: (showGameOver, reason) => set({ showGameOver, gameOverReason: reason || 'You succumbed to the infection.' }),

  setLoadingScreen: ({ visible, title, progress, statusText }) =>
    set((state) => ({
      loadingScreen: {
        visible: visible ?? state.loadingScreen.visible,
        title: title ?? state.loadingScreen.title,
        progress: progress ?? state.loadingScreen.progress,
        statusText: statusText ?? state.loadingScreen.statusText
      }
    })),

  setGraphicsProfile: (profile) => set({ graphicsProfile: profile }),
  setFps: (fps) => set({ fps }),
  setShowDiagnostics: (showDiagnostics) => set({ showDiagnostics }),
  setDiagnosticsText: (diagnosticsText) => set({ diagnosticsText }),

  setStageBanner: (stageNum, stageTitle, durationMs = 3500) => {
    set({ stageBanner: { visible: true, stageNum, stageTitle } });
    setTimeout(() => {
      set((state) => ({
        stageBanner: { ...state.stageBanner, visible: false }
      }));
    }, durationMs);
  },

  setInteractionPrompt: (interactionPrompt) => set({ interactionPrompt }),
  setSubtitles: (subtitles) => set({ subtitles }),
  setCrosshairHit: (crosshairHit, isHeadshot = false) => {
    set({ crosshairHit, crosshairHeadshot: isHeadshot });
    if (crosshairHit) {
      setTimeout(() => set({ crosshairHit: false, crosshairHeadshot: false }), 120);
    }
  },
  setActiveMission: (activeMission) => set({ activeMission }),
  setVitals: (vitals) => set({ vitals }),
  setWeapon: (weapon) => set({ weapon }),
  setInventoryTab: (inventoryTab) => set({ inventoryTab }),
  setInventoryItems: (inventoryItems) => set({ inventoryItems }),
  setSelectedItem: (selectedItem) => set({ selectedItem }),
  setCraftingRecipes: (craftingRecipes) => set({ craftingRecipes })
}));

export const useGameUIStore = gameUIStore;
