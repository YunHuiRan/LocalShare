import fs from "fs/promises";
import path from "path";
import { logger } from "./logger";
import { localizeTemplate, t } from "./i18n";

const baseDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();

/**
 * 模板渲染器类
 * 负责渲染各种页面模板
 *
 * Renders the page templates shipped in `views/`.
 */
class TemplateRenderer {
  private templatePath: string;
  
  private cachedTemplate: string | null = null;

  /**
   * 创建模板渲染器实例
   *
   * Creates a renderer; the template path defaults to
   * `views/baseTemplate.html` next to this file.
   */
  constructor(templatePath?: string) {
    this.templatePath =
      templatePath || path.join(baseDir, "../views/baseTemplate.html");
  }

  /**
   * 加载模板文件内容，首次读取后缓存，后续直接返回缓存
   *
   * Loads the template content, reading it once and reusing the cache afterwards.
   */
  private async loadTemplate(): Promise<string> {
    if (this.cachedTemplate !== null) {
      logger.debug(
        t("【模板】 使用缓存模板", "[template] using cached template")
      );
      return this.cachedTemplate;
    }

    const candidates = [
      path.join(__dirname, "../views/baseTemplate.html"),
      path.join(process.cwd(), "views", "baseTemplate.html"),
      path.join(process.cwd(), "dist", "views", "baseTemplate.html"),
    ];

    for (const p of candidates) {
      try {
        logger.info(
          t(`【模板】 尝试加载模板: ${p}`, `[template] trying file: ${p}`)
        );
        const content = await fs.readFile(p, "utf-8");
        this.cachedTemplate = content;
        logger.info(
          t(
            `【模板】 已加载模板并缓存: ${p}`,
            `[template] loaded and cached: ${p}`
          )
        );
        return content;
      } catch (e) {
        logger.debug(
          t(`【模板】 未在路径找到模板: ${p}`, `[template] not found at: ${p}`)
        );
      }
    }

    const err = new Error(
      `template not found in candidates: ${candidates.join(",")}`
    );
    logger.error(t("【模板】 加载失败", "[template] failed to load"), err);
    throw err;
  }

  /**
   * 渲染视频列表页面
   *
   * Renders the video list page.
   *
   * @param videoItems - 视频项 HTML 内容 / HTML of the video entries
   * @param folderItems - 文件夹项 HTML 内容 / HTML of the folder entries
   * @param breadcrumb - 面包屑导航 HTML 内容 / HTML of the breadcrumb
   * @returns 渲染后的完整 HTML 页面 / The complete rendered HTML page
   */
  public async renderVideoListPage(
    videoItems: string,
    folderPath: string,
    folderItems: string,
    breadcrumb: string
  ): Promise<string> {
    // 先本地化模板（{{t:中文|English}} 标记 + <html lang>），再替换业务占位符
    // Localize the template ({{t:中文|English}} tokens + <html lang>) before the
    // business placeholders are substituted
    let html: string = localizeTemplate(await this.loadTemplate());

    html = html.replace("{{videoItems}}", videoItems);
    html = html.replace("{{folderPath}}", folderPath);
    html = html.replace("{{folderItems}}", folderItems);
    html = html.replace("{{breadcrumb}}", breadcrumb);

    return html;
  }

  /**
   * 渲染漫画页面
   *
   * Renders the comic viewer page.
   *
   * @param imagesJson - 图片 URL 数组的 JSON 字符串 / JSON string of the image URLs
   * @param startIndex - 起始图片索引 / Index of the image to open first
   * @returns 渲染后的完整 HTML 页面 / The complete rendered HTML page
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
        logger.info(
          t(
            `【模板】 尝试加载漫画模板: ${p}`,
            `[template] trying comic template: ${p}`
          )
        );
        let content = localizeTemplate(await fs.readFile(p, "utf-8"));
        const escaped = imagesJson.replace(/\\/g, "\\\\").replace(/\"/g, '\\"');
        content = content.replace("{{imagesJson}}", escaped);
        content = content.replace(
          "{{startIndex}}",
          String(Number(startIndex) || 0)
        );
        content = content.replace("{{title}}", title);
        return content;
      } catch (e) {
        logger.debug(
          t(
            `【模板】 未在路径找到漫画模板: ${p}`,
            `[template] comic template not found at: ${p}`
          )
        );
      }
    }

    const err = new Error(
      `comic template not found in candidates: ${candidates.join(",")}`
    );
    logger.error(
      t("【模板】 漫画模板加载失败", "[template] failed to load comic template"),
      err
    );
    throw err;
  }

  /**
   * 渲染音频播放页面
   *
   * Renders the audio player page.
   *
   * @param audioJson - 音频 URL 数组的 JSON 字符串 / JSON string of the audio URLs
   * @param startIndex - 起始音频索引 / Index of the track to play first
   * @returns 渲染后的完整 HTML 页面 / The complete rendered HTML page
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
        logger.info(
          t(
            `【模板】 尝试加载音频模板: ${p}`,
            `[template] trying audio template: ${p}`
          )
        );
        let content = localizeTemplate(await fs.readFile(p, "utf-8"));
        const escaped = audioJson.replace(/\\/g, "\\\\").replace(/\"/g, '\\"');
        content = content.replace("{{audioJson}}", escaped);
        content = content.replace(
          "{{startIndex}}",
          String(Number(startIndex) || 0)
        );
        content = content.replace("{{title}}", title);
        return content;
      } catch (e) {
        logger.debug(
          t(
            `【模板】 未在路径找到音频模板: ${p}`,
            `[template] audio template not found at: ${p}`
          )
        );
      }
    }

    const err = new Error(
      `audio template not found in candidates: ${candidates.join(",")}`
    );
    logger.error(
      t("【模板】 音频模板加载失败", "[template] failed to load audio template"),
      err
    );
    throw err;
  }

  /**
   * 渲染视频播放器页面
   *
   * Renders the video player page.
   *
   * @returns 渲染后的 HTML 页面 / The rendered HTML page
   */
  public async renderVideoPlayer(videoSrc: string, title: string): Promise<string> {
    const candidates = [
      path.join(__dirname, "../views/video.html"),
      path.join(process.cwd(), "views", "video.html"),
      path.join(process.cwd(), "dist", "views", "video.html"),
    ];

    for (const p of candidates) {
      try {
        logger.info(
          t(
            `【模板】 尝试加载视频模板: ${p}`,
            `[template] trying video template: ${p}`
          )
        );
        let content = localizeTemplate(await fs.readFile(p, "utf-8"));
        content = content.replace("{{videoSrc}}", videoSrc);
        content = content.replace("{{title}}", title);
        return content;
      } catch (e) {
        logger.debug(
          t(
            `【模板】 未在路径找到视频模板: ${p}`,
            `[template] video template not found at: ${p}`
          )
        );
      }
    }

    const err = new Error(
      `video template not found in candidates: ${candidates.join(",")}`
    );
    logger.error(
      t("【模板】 视频模板加载失败", "[template] failed to load video template"),
      err
    );
    throw err;
  }
}

export const templateRenderer = new TemplateRenderer();

export default TemplateRenderer;