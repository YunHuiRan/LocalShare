import fs from "fs/promises";
import { mime } from "./mime";
import { logger } from "./logger";

class FileUtils {
  public async exists(filePath: string): Promise<boolean> {
    try {
      logger.debug(`file.exists check exists: ${filePath}`);
      await fs.access(filePath);
      logger.debug(`file.exists exists: ${filePath}`);
      return true;
    } catch {
      logger.debug(`file.exists not exists: ${filePath}`);
      return false;
    }
  }

  public async getVideoFiles(folder: string): Promise<string[]> {
    logger.debug(`file.getVideoFiles read dir: ${folder}`);
    const files: string[] = await fs.readdir(folder);
    const exts = mime.getSupportedExtensions();
    const filtered = files.filter((file) => {
      const lower = file.toLowerCase();
      return exts.some((ext) => lower.endsWith(`.${ext}`));
    });
    logger.info(
      `file.getVideoFiles found ${filtered.length} video files in ${folder}`
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
