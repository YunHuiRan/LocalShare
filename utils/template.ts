import fs from "fs/promises";
import path from "path";
import { logger } from "./logger";

const baseDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();

/**
 * 模板渲染器类
 * 负责渲染各种页面模板
 */
class TemplateRenderer {
  /**
   * 模板文件路径
   * @private
   * @type {string}
   */
  private templatePath: string;
  
  /**
   * 缓存的模板内容
   * @private
   * @type {string|null}
   */
  private cachedTemplate: string | null = null;

  /**
   * 创建模板渲染器实例
   * @param {string} [templatePath] - 模板文件路径
   */
  constructor(templatePath?: string) {
    this.templatePath =
      templatePath || path.join(baseDir, "../views/baseTemplate.html");
  }

  /**
   * 加载模板文件内容
   * @private
   * @returns {Promise<string>} 模板文件内容
   */
  private async loadTemplate(): Promise<string> {
    if (this.cachedTemplate !== null) {
      logger.debug("【模板】 使用缓存模板");
      return this.cachedTemplate;
    }

    const candidates = [
      path.join(__dirname, "../views/baseTemplate.html"),
      path.join(process.cwd(), "views", "baseTemplate.html"),
      path.join(process.cwd(), "dist", "views", "baseTemplate.html"),
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
   * 渲染视频列表页面
   * @param {string} videoItems - 视频项 HTML 内容
   * @param {string} folderPath - 文件夹路径
   * @param {string} folderItems - 文件夹项 HTML 内容
   * @param {string} breadcrumb - 面包屑导航 HTML 内容
   * @returns {Promise<string>} 渲染后的完整 HTML 页面
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
   * 渲染漫画页面
   * @param {string} imagesJson - 图片 URL 数组的 JSON 字符串
   * @param {string} title - 页面标题
   * @param {number} startIndex - 起始图片索引
   * @returns {Promise<string>} 渲染后的完整 HTML 页面
   */
  public async renderComicPage(
    imagesJson: string,
    title: string,
    startIndex = 0
  ): Promise<string> {
    const candidates = [
      path.join(__dirname, "../views/comic.html"),
      path.join(process.cwd(), "views", "comic.html"),
      path.join(process.cwd(), "dist", "views", "comic.html"),
    ];

    for (const p of candidates) {
      try {
        logger.info(`【模板】 尝试加载漫画模板: ${p}`);
        let content = await fs.readFile(p, "utf-8");
        const escaped = imagesJson.replace(/\\/g, "\\\\").replace(/\"/g, '\\"');
        content = content.replace("{{imagesJson}}", escaped);
        content = content.replace(
          "{{startIndex}}",
          String(Number(startIndex) || 0)
        );
        content = content.replace("{{title}}", title);
        return content;
      } catch (e) {
        logger.debug(`【模板】 未在路径找到漫画模板: ${p}`);
      }
    }

    const err = new Error(
      `comic template not found in candidates: ${candidates.join(",")}`
    );
    logger.error("【模板】 漫画模板加载失败", err);
    throw err;
  }

  /**
   * 渲染音频播放页面
   * @param {string} audioJson - 音频 URL 数组的 JSON 字符串
   * @param {string} title - 页面标题
   * @param {number} startIndex - 起始音频索引
   * @returns {Promise<string>} 渲染后的完整 HTML 页面
   */
  public async renderAudioPage(
    audioJson: string,
    title: string,
    startIndex = 0
  ): Promise<string> {
    const candidates = [
      path.join(__dirname, "../views/audio.html"),
      path.join(process.cwd(), "views", "audio.html"),
      path.join(process.cwd(), "dist", "views", "audio.html"),
    ];

    for (const p of candidates) {
      try {
        logger.info(`【模板】 尝试加载音频模板: ${p}`);
        let content = await fs.readFile(p, "utf-8");
        const escaped = audioJson.replace(/\\/g, "\\\\").replace(/\"/g, '\\"');
        content = content.replace("{{audioJson}}", escaped);
        content = content.replace(
          "{{startIndex}}",
          String(Number(startIndex) || 0)
        );
        content = content.replace("{{title}}", title);
        return content;
      } catch (e) {
        logger.debug(`【模板】 未在路径找到音频模板: ${p}`);
      }
    }

    const err = new Error(
      `audio template not found in candidates: ${candidates.join(",")}`
    );
    logger.error("【模板】 音频模板加载失败", err);
    throw err;
  }
}

/**
 * 模板渲染器实例
 * @type {TemplateRenderer}
 */
export const templateRenderer = new TemplateRenderer();

export default TemplateRenderer;