import fs from "fs/promises";

/**
 * 检查路径是否存在
 * @param path 要检查的路径
 * @returns 如果存在返回 true，否则 false
 */
export async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取视频目录下的媒体文件（简单后缀过滤）
 * @param folder 视频目录
 * @returns 文件名字符串数组
 */
export async function getVideoFiles(folder: string): Promise<string[]> {
  const files: string[] = await fs.readdir(folder);
  return files.filter(
    (file: string) =>
      file.toLowerCase().endsWith(".mp4") || file.toLowerCase().endsWith(".mkv")
  );
}
