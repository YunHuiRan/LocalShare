type LogLevel = "debug" | "info" | "warn" | "error";

const LevelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function levelLabel(level: LogLevel): string {
  switch (level) {
    case "debug":
      return "调试";
    case "info":
      return "信息";
    case "warn":
      return "警告";
    case "error":
      return "错误";
  }
}

export class Logger {
  private prefix?: string;
  private level: LogLevel;

  constructor(prefix?: string, level?: LogLevel) {
    this.prefix = prefix;
    const env = (process.env.LOG_LEVEL || "").toLowerCase() as LogLevel | "";
    this.level = level || env || "info";
  }

  private timestamp(): string {
    return new Date().toISOString();
  }

  private shouldLog(level: LogLevel): boolean {
    return LevelOrder[level] >= LevelOrder[this.level];
  }

  private format(level: LogLevel, message: string | string[]): string {
    const msg = Array.isArray(message) ? message.join(" ") : message;
    const prefix = this.prefix ? `${this.prefix} ` : "";
    return `${this.timestamp()} [${levelLabel(level)}] ${prefix}${msg}`;
  }

  public debug(message: string | string[]): void {
    if (!this.shouldLog("debug")) return;
    console.debug(this.format("debug", message));
  }

  public info(message: string | string[]): void {
    if (!this.shouldLog("info")) return;
    console.log(this.format("info", message));
  }

  public warn(message: string | string[]): void {
    if (!this.shouldLog("warn")) return;
    console.warn(this.format("warn", message));
  }

  public error(message: string | string[] | unknown, ...args: unknown[]): void {
    if (!this.shouldLog("error")) return;
    const msg = Array.isArray(message) ? message.join(" ") : String(message);
    console.error(this.format("error", msg), ...args);
  }
}

export const logger = new Logger(
  undefined,
  (process.env.LOG_LEVEL as LogLevel) || "debug"
);
