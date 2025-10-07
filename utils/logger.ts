export class Logger {
  prefix?: string;

  constructor(prefix?: string) {
    this.prefix = prefix;
  }

  log(message: string | string[]) {
    const msg = Array.isArray(message) ? message.join(" ") : message;
    if (this.prefix) {
      console.log(`${this.prefix} ${msg}`);
    } else {
      console.log(msg);
    }
  }

  info(message: string | string[]) {
    this.log(message);
  }

  error(message: string | string[] | unknown, ...args: unknown[]) {
    const msg = Array.isArray(message) ? message.join(" ") : String(message);
    if (this.prefix) {
      console.error(`${this.prefix} ${msg}`, ...args);
    } else {
      console.error(msg, ...args);
    }
  }
}

// 默认导出一个全局 logger 实例，方便直接使用
export const logger = new Logger();
