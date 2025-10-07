import fs from "fs/promises";
import path from "path";
import { logger } from "./logger";

const baseDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();

class TemplateRenderer {
  private templatePath: string;
  private cachedTemplate: string | null = null;

  constructor(templatePath?: string) {
    this.templatePath =
      templatePath || path.join(baseDir, "../views/videoList.html");
  }

  private async loadTemplate(): Promise<string> {
    if (this.cachedTemplate !== null) {
      logger.debug("【模板】 使用缓存模板");
      return this.cachedTemplate;
    }

    const candidates = [
      path.join(__dirname, "../views/videoList.html"),
      path.join(process.cwd(), "views", "videoList.html"),
      path.join(process.cwd(), "dist", "views", "videoList.html"),
    ];

    for (const p of candidates) {
      try {
        logger.info(`【模板】 尝试加载模板: ${p}`);
        const content = await fs.readFile(p, "utf-8");
        this.cachedTemplate = content;
        logger.info(`【模板】 已加载模板并缓存: ${p}`);
        return content;
      } catch (e) {
        logger.debug(`【模板】 未在路径找到模板: ${p}`);
      }
    }

    const err = new Error(
      `template not found in candidates: ${candidates.join(",")}`
    );
    logger.error("【模板】 加载失败", err);
    throw err;
  }

  public async renderVideoListPage(
    videoItems: string,
    folderPath: string,
    folderItems: string,
    breadcrumb: string
  ): Promise<string> {
    let html: string = await this.loadTemplate();

    html = html.replace("{{videoItems}}", videoItems);
    html = html.replace("{{folderPath}}", folderPath);
    html = html.replace("{{folderItems}}", folderItems);
    html = html.replace("{{breadcrumb}}", breadcrumb);

    return html;
  }
}

export const templateRenderer = new TemplateRenderer();
export default TemplateRenderer;
