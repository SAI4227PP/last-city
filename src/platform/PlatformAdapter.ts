export interface IPlatformAdapter {
  init(): Promise<void>;
  gameplayStart(): void;
  gameplayStop(): void;
  happyTime(): void;
  showAd(type: 'midgame' | 'rewarded'): Promise<boolean>;
  isCrazyGamesEnvironment(): boolean;
}

export class PlatformAdapter implements IPlatformAdapter {
  private crazyGamesSdk: any = null;

  public async init(): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).CrazyGames) {
      try {
        this.crazyGamesSdk = (window as any).CrazyGames.SDK;
        if (this.crazyGamesSdk) {
          await this.crazyGamesSdk.init();
          console.log('[Platform] CrazyGames SDK initialized successfully.');
        }
      } catch (err) {
        console.warn('[Platform] CrazyGames SDK init error:', err);
      }
    } else {
      console.log('[Platform] Running in standard Web Browser environment.');
    }
  }

  public isCrazyGamesEnvironment(): boolean {
    return this.crazyGamesSdk !== null;
  }

  public gameplayStart(): void {
    if (this.crazyGamesSdk?.game?.gameplayStart) {
      this.crazyGamesSdk.game.gameplayStart();
    }
  }

  public gameplayStop(): void {
    if (this.crazyGamesSdk?.game?.gameplayStop) {
      this.crazyGamesSdk.game.gameplayStop();
    }
  }

  public happyTime(): void {
    if (this.crazyGamesSdk?.game?.happytime) {
      this.crazyGamesSdk.game.happytime();
    }
  }

  public async showAd(type: 'midgame' | 'rewarded'): Promise<boolean> {
    if (this.crazyGamesSdk?.ad?.requestAd) {
      return new Promise<boolean>((resolve) => {
        this.crazyGamesSdk.ad.requestAd(type, {
          adStarted: () => {
            console.log(`[Platform] ${type} ad started`);
          },
          adFinished: () => {
            console.log(`[Platform] ${type} ad finished`);
            resolve(true);
          },
          adError: (error: any) => {
            console.warn(`[Platform] ${type} ad error:`, error);
            resolve(false);
          }
        });
      });
    }
    // In standalone browser, bypass gracefully
    return true;
  }
}
