/**
 * Allowed log levels
 * @typedef {'debug'|'info'|'warn'|'error'} LogLevel
 */

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
  /** Optional prefix for each log line */
  private prefix?: string;
  /** Current minimum level to log */
  private level: LogLevel;

  /**
   * Create a Logger
   * @param {string} [prefix]
   * @param {LogLevel} [level]
   */
  constructor(prefix?: string, level?: LogLevel) {
    this.prefix = prefix;
    const env = (process.env.LOG_LEVEL || "").toLowerCase() as LogLevel | "";
    this.level = level || env || "info";
  }

  /**
   * Current ISO timestamp string
   * @returns {string}
   */
  private timestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Decide if a message at `level` should be logged
   * @param {LogLevel} level
   * @returns {boolean}
   */
  private shouldLog(level: LogLevel): boolean {
    return LevelOrder[level] >= LevelOrder[this.level];
  }

  /**
   * Format message with timestamp and prefix
   * @param {LogLevel} level
   * @param {string | string[]} message
   * @returns {string}
   */
  private format(level: LogLevel, message: string | string[]): string {
    const msg = Array.isArray(message) ? message.join(" ") : message;
    const prefix = this.prefix ? `${this.prefix} ` : "";
    return `${this.timestamp()} [${levelLabel(level)}] ${prefix}${msg}`;
  }

  /**
   * Log debug message
   * @param {string | string[]} message
   */
  public debug(message: string | string[]): void {
    if (!this.shouldLog("debug")) return;
    console.debug(this.format("debug", message));
  }

  /**
   * Log info message
   * @param {string | string[]} message
   */
  public info(message: string | string[]): void {
    if (!this.shouldLog("info")) return;
    console.log(this.format("info", message));
  }

  /**
   * Log warning
   * @param {string | string[]} message
   */
  public warn(message: string | string[]): void {
    if (!this.shouldLog("warn")) return;
    console.warn(this.format("warn", message));
  }

  /**
   * Log error
   * @param {string | string[] | unknown} message
   * @param {...unknown} args
   */
  public error(message: string | string[] | unknown, ...args: unknown[]): void {
    if (!this.shouldLog("error")) return;
    const msg = Array.isArray(message) ? message.join(" ") : String(message);
    console.error(this.format("error", msg), ...args);
  }
}

/**
 * Default logger instance
 * @type {Logger}
 */
export const logger = new Logger(
  undefined,
  (process.env.LOG_LEVEL as LogLevel) || "debug"
);
