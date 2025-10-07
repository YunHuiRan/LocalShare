import fs from "fs/promises";
import { mime } from "./mime";

class FileUtils {
  public async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
  public async getVideoFiles(folder: string): Promise<string[]> {
    const files: string[] = await fs.readdir(folder);
    const exts = mime.getSupportedExtensions();
    return files.filter((file: string) => {
      const lower = file.toLowerCase();
      return exts.some((ext) => lower.endsWith(`.${ext}`));
    });
  }
}

export const fileUtils = new FileUtils();

export async function exists(path: string): Promise<boolean> {
  return fileUtils.exists(path);
}

export async function getVideoFiles(folder: string): Promise<string[]> {
  return fileUtils.getVideoFiles(folder);
}
