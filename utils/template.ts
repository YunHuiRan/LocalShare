import fs from "fs/promises";
import path from "path";
import { logger } from "./logger";

const baseDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();

class TemplateRenderer {
  /**
   * Path to template file
   * @type {string}
   */
  private templatePath: string;
  /**
   * Cached template content
   * @type {string | null}
   */
  private cachedTemplate: string | null = null;

  /**
   * Create a TemplateRenderer
   * @param {string} [templatePath] - optional custom template path
   */
  constructor(templatePath?: string) {
    this.templatePath =
      templatePath || path.join(baseDir, "../views/videoList.html");
  }

  /**
   * Load the template from candidate locations and cache it.
   * @returns {Promise<string>} resolved template content
   */
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

  /**
   * Render the video list page by replacing placeholders in the template.
   * @param {string} videoItems - HTML string for video items
   * @param {string} folderPath - current folder path (displayed in template)
   * @param {string} folderItems - HTML string for folder items
   * @param {string} breadcrumb - breadcrumb HTML
   * @returns {Promise<string>} rendered HTML
   */
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

  /**
   * Render a comic reader page. The template should include placeholders
   * {{imagesJson}} and {{title}}.
   * @param {string} imagesJson - JSON string of image URLs
   * @param {string} title - page title
   */
  public async renderComicPage(imagesJson: string, title: string, startIndex = 0): Promise<string> {
    // try to load comic template from common locations
    const candidates = [
      path.join(__dirname, "../views/comic.html"),
      path.join(process.cwd(), "views", "comic.html"),
      path.join(process.cwd(), "dist", "views", "comic.html"),
    ];

    for (const p of candidates) {
      try {
        logger.info(`【模板】 尝试加载漫画模板: ${p}`);
        let content = await fs.readFile(p, "utf-8");
  // escape JSON string to safely embed inside double quotes
  const escaped = imagesJson.replace(/\\/g, "\\\\").replace(/\"/g, "\\\"");
  content = content.replace("{{imagesJson}}", escaped);
  content = content.replace("{{startIndex}}", String(Number(startIndex) || 0));
        content = content.replace("{{title}}", title);
        return content;
      } catch (e) {
        logger.debug(`【模板】 未在路径找到漫画模板: ${p}`);
      }
    }

    const err = new Error(`comic template not found in candidates: ${candidates.join(",")}`);
    logger.error("【模板】 漫画模板加载失败", err);
    throw err;
  }
}

/**
 * Shared template renderer instance
 * @type {TemplateRenderer}
 */
export const templateRenderer = new TemplateRenderer();

/**
 * TemplateRenderer constructor (default export)
 */
export default TemplateRenderer;
