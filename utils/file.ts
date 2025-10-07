import fs from "fs/promises";
import { mime } from "./mime";
import { logger } from "./logger";

class FileUtils {
  /**
   * 检查路径是否存在
   */
  public async exists(filePath: string): Promise<boolean> {
    try {
      logger.debug(`【file.exists】 检查路径是否存在: ${filePath}`);
      await fs.access(filePath);
      logger.debug(`【file.exists】 存在: ${filePath}`);
      return true;
    } catch {
      logger.debug(`【file.exists】 不存在: ${filePath}`);
      return false;
    }
  }

  /**
   * 返回指定目录下受支持的视频文件名数组（不包含路径）
   */
  public async getVideoFiles(folder: string): Promise<string[]> {
    logger.debug(`【file.getVideoFiles】 读取目录: ${folder}`);
    const files: string[] = await fs.readdir(folder);
    const exts = mime.getSupportedExtensions();
    const filtered = files.filter((file) => {
      const lower = file.toLowerCase();
      return exts.some((ext) => lower.endsWith(`.${ext}`));
    });
    logger.info(
      `【file.getVideoFiles】 在 ${folder} 发现视频文件 ${filtered.length} 个`
    );
    return filtered;
  }
}

export const fileUtils = new FileUtils();

export async function exists(filePath: string): Promise<boolean> {
  return fileUtils.exists(filePath);
}

export async function getVideoFiles(folder: string): Promise<string[]> {
  return fileUtils.getVideoFiles(folder);
}
