// 日志工具函数
export class Logger {
  private static isDevelopment = process.env.NODE_ENV === 'development';

  static log(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(message, ...args);
    }
  }

  static error(message: string, error?: any): void {
    if (this.isDevelopment) {
      console.error(message, error);
    }
  }

  static warn(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.warn(message, ...args);
    }
  }
}

