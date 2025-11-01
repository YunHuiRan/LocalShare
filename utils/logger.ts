/**
 * 日志级别类型定义
 * @typedef {'debug' | 'info' | 'warn' | 'error'} LogLevel
 */
type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * 日志级别顺序映射
 * @type {Record<LogLevel, number>}
 */
const LevelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * 将日志级别转换为中文标签
 * @param {LogLevel} level - 日志级别
 * @returns {string} 对应的中文标签
 */
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

/**
 * 日志记录器类
 * 提供统一的日志记录功能，支持不同级别和前缀
 */
export class Logger {
  /**
   * 日志前缀
   * @private
   * @type {string|undefined}
   */
  private prefix?: string;
  
  /**
   * 日志级别
   * @private
   * @type {LogLevel}
   */
  private level: LogLevel;

  /**
   * 创建一个新的日志记录器实例
   * @param {string} [prefix] - 日志前缀
   * @param {LogLevel} [level] - 日志级别，默认从环境变量 LOG_LEVEL 获取，如果未设置则为 "info"
   */
  constructor(prefix?: string, level?: LogLevel) {
    this.prefix = prefix;
    const env = (process.env.LOG_LEVEL || "").toLowerCase() as LogLevel | "";
    this.level = level || env || "info";
  }

  /**
   * 获取当前时间的 ISO 字符串格式
   * @private
   * @returns {string} 当前时间的 ISO 字符串
   */
  private timestamp(): string {
    return new Date().toISOString();
  }

  /**
   * 判断是否应该记录指定级别的日志
   * @private
   * @param {LogLevel} level - 要判断的日志级别
   * @returns {boolean} 如果应该记录返回 true，否则返回 false
   */
  private shouldLog(level: LogLevel): boolean {
    return LevelOrder[level] >= LevelOrder[this.level];
  }

  /**
   * 格式化日志消息
   * @private
   * @param {LogLevel} level - 日志级别
   * @param {string|string[]} message - 日志消息，可以是字符串或字符串数组
   * @returns {string} 格式化后的日志消息
   */
  private format(level: LogLevel, message: string | string[]): string {
    const msg = Array.isArray(message) ? message.join(" ") : message;
    const prefix = this.prefix ? `${this.prefix} ` : "";
    return `${this.timestamp()} [${levelLabel(level)}] ${prefix}${msg}`;
  }

  /**
   * 记录调试级别日志
   * @param {string|string[]} message - 日志消息
   */
  public debug(message: string | string[]): void {
    if (!this.shouldLog("debug")) return;
    console.debug(this.format("debug", message));
  }

  /**
   * 记录信息级别日志
   * @param {string|string[]} message - 日志消息
   */
  public info(message: string | string[]): void {
    if (!this.shouldLog("info")) return;
    console.log(this.format("info", message));
  }

  /**
   * 记录警告级别日志
   * @param {string|string[]} message - 日志消息
   */
  public warn(message: string | string[]): void {
    if (!this.shouldLog("warn")) return;
    console.warn(this.format("warn", message));
  }

  /**
   * 记录错误级别日志
   * @param {string|string[]|unknown} message - 日志消息
   * @param {...unknown} args - 额外的参数
   */
  public error(message: string | string[] | unknown, ...args: unknown[]): void {
    if (!this.shouldLog("error")) return;
    const msg = Array.isArray(message) ? message.join(" ") : String(message);
    console.error(this.format("error", msg), ...args);
  }
}

/**
 * 默认日志记录器实例
 * @type {Logger}
 */
export const logger = new Logger(
  undefined,
  (process.env.LOG_LEVEL as LogLevel) || "debug"
);