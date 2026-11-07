import { GameApplication } from '@/app/GameApplication';
import { Logger } from '@/core/utils/Logger';

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const app = GameApplication.getInstance();
    await app.start();
  } catch (err) {
    Logger.error('Fatal initialization error:', err);
  }
});
