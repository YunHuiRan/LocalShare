import { t } from "./i18n";

type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * 日志级别顺序映射，数值越大越严重，用于比较输出阈值
 *
 * Log-level order: a larger number is more severe and is compared against the
 * configured threshold.
 */
const LevelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * 将日志级别转换为当前语言的标签（`[信息]` / `[INFO]`）
 *
 * Maps a log level to its label in the current language (`[信息]` / `[INFO]`).
 */
function levelLabel(level: LogLevel): string {
  switch (level) {
    case "debug":
      return t("调试", "DEBUG");
    case "info":
      return t("信息", "INFO");
    case "warn":
      return t("警告", "WARN");
    case "error":
      return t("错误", "ERROR");
  }
}

/**
 * 日志记录器类
 * 提供统一的日志记录功能，支持不同级别和前缀
 *
 * Logger with a configurable level and an optional prefix.
 */
export class Logger {
  private prefix?: string;

  private level: LogLevel;

  /**
   * 创建一个新的日志记录器实例
   *
   * Creates a logger instance; the level comes from the argument, then from the
   * `LOG_LEVEL` environment variable, and finally defaults to "info".
   */
  constructor(prefix?: string, level?: LogLevel) {
    this.prefix = prefix;
    const env = (process.env.LOG_LEVEL || "").toLowerCase() as LogLevel | "";
    this.level = level || env || "info";
  }

  private timestamp(): string {
    return new Date().toISOString();
  }

  /**
   * 判断是否应该记录指定级别的日志（级别数值达到当前阈值才输出）
   *
   * Whether a message of the given level passes the configured threshold.
   */
  private shouldLog(level: LogLevel): boolean {
    return LevelOrder[level] >= LevelOrder[this.level];
  }

  /**
   * 格式化日志消息，最终形如 `时间戳 [级别] 前缀消息`
   *
   * Formats a log line as `<ISO timestamp> [LEVEL] <prefix><message>`.
   */
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