export interface GameConfig {
  title: string;
  version: string;
  debug: boolean;
  physics: {
    gravity: number;
    fixedTimestep: number;
  };
  graphics: {
    shadows: boolean;
    pixelRatioMax: number;
    toneMappingExposure: number;
  };
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  title: 'LAST CITY',
  version: '1.0.0',
  debug: import.meta.env.DEV,
  physics: {
    gravity: -9.81,
    fixedTimestep: 1 / 60
  },
  graphics: {
    shadows: true,
    pixelRatioMax: 2.0,
    toneMappingExposure: 1.45
  }
};
