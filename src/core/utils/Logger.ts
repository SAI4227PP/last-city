export class Logger {
  private static prefix = '[LAST CITY]';

  public static info(message: string, ...args: any[]): void {
    console.log(`${this.prefix} ℹ️ ${message}`, ...args);
  }

  public static warn(message: string, ...args: any[]): void {
    console.warn(`${this.prefix} ⚠️ ${message}`, ...args);
  }

  public static error(message: string, ...args: any[]): void {
    console.error(`${this.prefix} 🛑 ${message}`, ...args);
  }

  public static debug(message: string, ...args: any[]): void {
    if (import.meta.env.DEV) {
      console.debug(`${this.prefix} 🔍 ${message}`, ...args);
    }
  }
}
