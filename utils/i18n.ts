/**
 * 控制台文案国际化
 *
 * 程序启动时检测系统语言，决定控制台输出中文还是英文：
 * - 检测结果以 `zh` 开头（zh、zh-CN、zh-TW……）→ 输出中文；
 * - 其他语言（en-US、ja-JP、de-DE……）→ 输出英文。
 *
 * 检测优先级：
 * 1. 环境变量 `LOCALSHARE_LANG`（显式指定，便于测试或强制切换，如 `set LOCALSHARE_LANG=en`）
 * 2. 环境变量 `LC_ALL` / `LC_MESSAGES` / `LANG` / `LANGUAGE`（Linux / macOS 上常见）
 * 3. `Intl.DateTimeFormat().resolvedOptions().locale`（Windows 上取自系统区域设置）
 * 4. 全部无法判定时保持中文，与历史行为一致
 */

/**
 * 控制台支持的语言
 * @typedef {'zh' | 'en'} Language
 */
export type Language = "zh" | "en";

/**
 * 把各种语言标记（zh-CN、zh_CN.UTF-8、en-US……）归一化为支持的语言
 *
 * @param {string} tag - 语言标记
 * @returns {Language|null} 归一化结果；无法识别时返回 null
 */
function normalizeLanguage(tag: string): Language | null {
  const value = String(tag || "").trim().toLowerCase();
  if (!value) return null;
  // POSIX / C 表示未指定语言
  if (value === "posix" || value === "c") return null;

  // zh_CN.UTF-8、zh-CN、zh-Hans-CN…… 取主语言子标签
  const primary = value.split(/[._@-]/)[0];
  if (primary === "zh") return "zh";
  // 其它形如 en / ja / de / fr 的语言统一回落到英文
  if (/^[a-z]{2,3}$/.test(primary)) return "en";
  return null;
}

/**
 * 依次读取语言相关环境变量，返回第一个可识别的语言
 *
 * @returns {Language|null} 环境变量中指定的语言；无法识别时返回 null
 */
function languageFromEnv(): Language | null {
  const candidates: (string | undefined)[] = [
    process.env.LOCALSHARE_LANG,
    process.env.LOCALSHARE_LANGUAGE,
    process.env.LC_ALL,
    process.env.LC_MESSAGES,
    process.env.LANG,
    process.env.LANGUAGE,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeLanguage(String(candidate || ""));
    if (normalized) return normalized;
  }
  return null;
}

/**
 * 通过 ICU 默认区域判断系统语言（Windows 上取自系统区域设置）
 *
 * @returns {Language|null} 系统语言；无法识别时返回 null
 */
function languageFromIntl(): Language | null {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return normalizeLanguage(locale);
  } catch (e) {
    return null;
  }
}

/**
 * 本次运行控制台输出使用的语言
 * @type {Language}
 */
export const language: Language =
  languageFromEnv() || languageFromIntl() || "zh";

/**
 * 根据当前语言在中文与英文文案之间选择
 *
 * @param {string} zh - 中文文案
 * @param {string} en - 英文文案
 * @returns {string} 当前语言对应的文案
 */
export function t(zh: string, en: string): string {
  return language === "en" ? en : zh;
}
