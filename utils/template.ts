import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedTemplate: string | null = null;

/**
 * 从文件系统加载模板，首次加载后缓存至内存
 * 以减少每次请求的磁盘 I/O
 */
async function loadTemplate(): Promise<string> {
  if (cachedTemplate !== null) {
    console.log("【模板】 使用缓存模板");
    return cachedTemplate;
  }

  const templatePath: string = path.join(__dirname, "../views/videoList.html");
  console.log(`【模板】 从磁盘加载模板: ${templatePath}`);
  cachedTemplate = await fs.readFile(templatePath, "utf-8");
  console.log("【模板】 模板已加载并缓存");
  return cachedTemplate;
}

/**
 * 渲染视频列表页面 HTML
 * @param videoItems 已生成的 HTML 列表项字符串
 * @param folderPath 当前视频目录路径（用于显示）
 * @returns 渲染后的完整 HTML 字符串
 */
export async function renderVideoListPage(
  videoItems: string,
  folderPath: string
): Promise<string> {
  let html: string = await loadTemplate();

  html = html.replace("{{videoItems}}", videoItems);
  html = html.replace("{{folderPath}}", folderPath);

  return html;
}
