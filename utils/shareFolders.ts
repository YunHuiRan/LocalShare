import fs from "fs";
import path from "path";
import { pickFolder } from "./folderPicker";
import { logger } from "./logger";

/**
 * 判断给定路径是否存在且为目录
 * @param {string} targetPath - 待检查的路径
 * @returns {boolean} 是目录返回 true，否则返回 false
 */
function isDirectory(targetPath: string): boolean {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch (e) {
    return false;
  }
}

/**
 * 解析命令行参数中指定的共享目录
 *
 * 打包成 exe 后（`process.pkg` 为真）`process.argv` 中没有脚本路径，
 * 因此从第 1 个参数开始解析；直接用 node/tsx 运行时从第 2 个参数开始。
 * 只有真实存在且为目录的参数才会被采用。
 *
 * @returns {string[]} 命令行中指定的目录绝对路径列表
 */
function getFolderArgs(): string[] {
  const isPackaged: boolean = Boolean((process as any).pkg);
  const rawArgs: string[] = isPackaged
    ? process.argv.slice(1)
    : process.argv.slice(2);

  return rawArgs
    .filter((arg) => Boolean(arg) && !arg.startsWith("-"))
    .map((arg) => path.resolve(arg))
    .filter((arg) => isDirectory(arg));
}

/**
 * 解析环境变量 `SHARE_DIR` / `SHARE_DIRS` 中指定的共享目录（多个目录用 `;` 分隔）
 * @returns {string[]} 环境变量中指定的目录绝对路径列表
 */
function getEnvFolders(): string[] {
  const raw: string = process.env.SHARE_DIR || process.env.SHARE_DIRS || "";
  if (!raw.trim()) return [];

  return raw
    .split(";")
    .map((item) => item.trim())
    .filter((item) => Boolean(item))
    .map((item) => path.resolve(item))
    .filter((item) => isDirectory(item));
}

/**
 * 解析本次运行实际要共享的目录
 *
 * 优先级：
 * 1. 命令行参数指定的目录（如 `LocalShare.exe "D:\电影"`）
 * 2. 环境变量 `SHARE_DIR` / `SHARE_DIRS` 指定的目录
 * 3. 弹出“选择文件夹”窗口让用户选择
 * 4. 以上都没有时返回空数组，表示使用配置文件 `config.ts` 中的默认目录
 *
 * @returns {string[]|null} 共享目录列表；空数组表示使用默认配置；
 *                          返回 null 表示用户在文件夹选择窗口中点了“取消”
 */
export function resolveSharedFolders(): string[] | null {
  const argFolders = getFolderArgs();
  if (argFolders.length > 0) {
    logger.info(`使用命令行参数指定的共享目录: ${JSON.stringify(argFolders)}`);
    return argFolders;
  }

  const envFolders = getEnvFolders();
  if (envFolders.length > 0) {
    logger.info(`使用环境变量指定的共享目录: ${JSON.stringify(envFolders)}`);
    return envFolders;
  }

  // 自动化脚本或调试时可通过 NO_PICKER=1 跳过弹窗，直接使用默认目录
  if (process.env.NO_PICKER === "1") {
    logger.info("NO_PICKER=1，跳过文件夹选择窗口，使用配置文件中的默认目录");
    return [];
  }

  logger.info("正在打开文件夹选择窗口，请选择要共享的文件夹……");
  const picked = pickFolder("请选择要共享的文件夹");
  if (picked) {
    logger.info(`已选择共享目录: ${picked}`);
    return [picked];
  }

  logger.warn("未选择任何共享文件夹");
  return null;
}
