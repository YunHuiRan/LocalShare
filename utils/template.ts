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
