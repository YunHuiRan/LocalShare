import type { Request, Response } from "express";
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { VIDEO_FOLDER } from "../config";
import { getMimeType, mime } from "../utils/mime";
import { templateRenderer } from "../utils/template";
import { logger } from "../utils/logger";

export class VideoController {
  /**
   * Base folder where videos are stored
   * @type {string}
   */
  private videoFolder: string;

  /**
   * Create a VideoController
   * @param {string} [videoFolder=VIDEO_FOLDER] - the base folder for videos
   */
  constructor(videoFolder: string = VIDEO_FOLDER) {
    this.videoFolder = videoFolder;
  }

  /**
   * Ensure the target path is inside the base folder (prevent directory traversal)
   * @param {string} base - base folder
   * @param {string} target - target path to validate
   * @returns {boolean}
   */
  static isPathSafe(base: string, target: string): boolean {
    const resolvedBase = path.resolve(base);
    const resolvedTarget = path.resolve(target);
    return resolvedTarget.startsWith(resolvedBase);
  }

  /**
   * Render index page which lists videos and subfolders in the configured video folder.
   * Caches HTML for a short period to reduce filesystem reads.
   * @param {Request} _req
   * @param {Response} res
   * @returns {Promise<void>}
   */
  public async getVideoList(_req: Request, res: Response): Promise<void> {
    logger.debug("【getVideoList】 入口");
    const cacheKey = "__videoListCache";
    const cache: { ts: number; html: string } = (global as any)[cacheKey] || {
      ts: 0,
      html: "",
    };
    if (Date.now() - cache.ts < 5000 && cache.html) {
      logger.info("【getVideoList】 缓存命中，直接返回 HTML");
      res.send(cache.html);
      logger.debug("【getVideoList】 退出（缓存）");
      return;
    }

    try {
      const dirents = await fs.readdir(this.videoFolder, {
        withFileTypes: true,
      });
      const names = dirents.map((d) => d.name);

      const folderItemsHtml = dirents
        .filter((d) => d.isDirectory())
        .map((d) => {
          const name = d.name;
          const url = `/folder/${encodeURIComponent(name)}`;
          return `
          <a href="${url}" class="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4">
            <div class="flex items-center gap-3">
              <i class="fa fa-folder text-3xl text-yellow-500"></i>
              <div class="truncate">
                <div class="font-medium">${name}</div>
                <div class="text-xs text-gray-500 truncate">文件夹</div>
              </div>
            </div>
          </a>
        `;
        })
        .join("");

      const supportedExts = mime.getSupportedExtensions();

      const videoFilesHtml = names
        .filter((file) => {
          const fileExt = path.extname(file).toLowerCase().replace(/^\./, "");
          return supportedExts.includes(fileExt);
        })
        .map((file) => {
          const url = `/video/${encodeURIComponent(file)}`;
          const icon = file.toLowerCase().endsWith(".mp4")
            ? "fa-file-video-o"
            : file.toLowerCase().endsWith(".mkv")
            ? "fa-film"
            : "fa-play-circle";
          return `
          <a href="${url}" class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
            <div class="p-4">
              <i class="fa ${icon} text-3xl text-blue-500 mb-2"></i>
              <h3 class="font-medium truncate">${file}</h3>
            </div>
          </a>
        `;
        })
        .join("");

      const breadcrumb = `<a href="/" class="text-blue-600 hover:underline">Home</a> <span class="text-gray-400">/</span> <span class="text-gray-600">${path.basename(
        this.videoFolder
      )}</span>`;

      logger.debug("【getVideoList】 渲染模板 start");
      const html = await templateRenderer.renderVideoListPage(
        videoFilesHtml,
        this.videoFolder,
        folderItemsHtml,
        breadcrumb
      );
      (global as any)[cacheKey] = { ts: Date.now(), html };
      res.send(html);
      logger.info(
        `【getVideoList】 返回成功，视频项数 ${videoFilesHtml.length}`
      );
      logger.debug("【getVideoList】 退出");
    } catch (err) {
      logger.error("【getVideoList】 失败", err as unknown);
      res.status(500).send("无法读取视频目录");
    }
  }

  /**
   * Stream a video file. Respects Range header for partial content.
   * @param {Request} req
   * @param {Response} res
   * @returns {Promise<void>}
   */
  public async streamVideo(req: Request, res: Response): Promise<void> {
    logger.debug("【streamVideo】 入口");
    try {
      const rawFilename =
        (req.params as any).filename || (req.params as any)[0];
      const filename = decodeURIComponent(String(rawFilename || ""));
      logger.info(`【streamVideo】 请求文件 ${filename}`);
      const videoPath = path.join(this.videoFolder, filename);

      if (!VideoController.isPathSafe(this.videoFolder, videoPath)) {
        logger.warn(`【streamVideo】 路径越界: ${videoPath}`);
        res.status(403).send("禁止访问");
        return;
      }

      await fs.access(videoPath);
      const stat = await fs.stat(videoPath);
      const fileSize = stat.size;
      logger.debug(`【streamVideo】 文件存在，大小 ${fileSize}`);
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        logger.info(
          `【streamVideo】 Range 请求 start=${start} end=${end} chunk=${chunkSize}`
        );
        const file = createReadStream(videoPath, { start, end });
        const head = {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": getMimeType(filename),
        } as Record<string, string | number>;

        res.writeHead(206, head as any);
        file.once("open", () => logger.debug("【streamVideo】 分段流已打开"));
        file.once("close", () => logger.debug("【streamVideo】 分段流已关闭"));
        file.pipe(res);
      } else {
        logger.info("【streamVideo】 完整流请求");
        const head = {
          "Content-Length": fileSize,
          "Content-Type": getMimeType(filename),
        } as Record<string, string | number>;

        res.writeHead(200, head as any);
        const full = createReadStream(videoPath);
        full.once("open", () => logger.debug("【streamVideo】 完整流已打开"));
        full.once("close", () => logger.debug("【streamVideo】 完整流已关闭"));
        full.pipe(res);
      }
      logger.debug("【streamVideo】 退出");
    } catch (err) {
      logger.error("【streamVideo】 失败", err as unknown);
      res.status(404).send("视频文件未找到");
    }
  }

  /**
   * List contents of a subfolder inside the video folder.
   * @param {Request} req
   * @param {Response} res
   * @returns {Promise<void>}
   */
  public async getFolderList(req: Request, res: Response): Promise<void> {
    logger.debug("【getFolderList】 入口");
    try {
      const rawPath = (req.params as any).path || (req.params as any)[0] || "";
      const subPath = decodeURIComponent(String(rawPath || ""));
      const targetPath = path.join(this.videoFolder, subPath);

      if (!VideoController.isPathSafe(this.videoFolder, targetPath)) {
        res.status(403).send("禁止访问");
        return;
      }

      const dirents = await fs.readdir(targetPath, { withFileTypes: true });
      logger.info(
        `【getFolderList】 列出目录 ${targetPath}，项数 ${dirents.length}`
      );

      const folderItemsHtml = dirents
        .filter((d) => d.isDirectory())
        .map((d) => {
          const name = d.name;
          const next = path.posix.join(subPath, name).replace(/\\/g, "/");
          const url = `/folder/${encodeURIComponent(next)}`;
          return `
          <a href="${url}" class="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4">
            <div class="flex items-center gap-3">
              <i class="fa fa-folder text-3xl text-yellow-500"></i>
              <div class="truncate">
                <div class="font-medium">${name}</div>
                <div class="text-xs text-gray-500 truncate">文件夹</div>
              </div>
            </div>
          </a>
        `;
        })
        .join("");

      const videoFilesHtml = dirents
        .filter((d) => d.isFile())
        .map((d) => d.name)
        .filter((file) => {
          const fileExt = path.extname(file).toLowerCase().replace(/^\./, "");
          return mime.getSupportedExtensions().includes(fileExt);
        })
        .map((file) => {
          const rel = path.posix.join(subPath, file).replace(/\\/g, "/");
          const url = `/video/${encodeURIComponent(rel)}`;
          const icon = file.toLowerCase().endsWith(".mp4")
            ? "fa-file-video-o"
            : file.toLowerCase().endsWith(".mkv")
            ? "fa-film"
            : "fa-play-circle";
          return `
            <a href="${url}" class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div class="p-4">
                <i class="fa ${icon} text-3xl text-blue-500 mb-2"></i>
                <h3 class="font-medium truncate">${file}</h3>
              </div>
            </a>
          `;
        })
        .join("");

      const parts = subPath ? subPath.split(/[\\/]+/) : [];
      let breadcrumb = `<a href="/" class="text-blue-600 hover:underline">Home</a>`;
      let acc = "";
      for (let i = 0; i < parts.length; i++) {
        acc = acc ? path.posix.join(acc, parts[i]) : parts[i];
        breadcrumb += ` <span class="text-gray-400">/</span> <a href="/folder/${encodeURIComponent(
          acc
        )}" class="text-blue-600 hover:underline">${parts[i]}</a>`;
      }

      const html = await templateRenderer.renderVideoListPage(
        videoFilesHtml,
        targetPath,
        folderItemsHtml,
        breadcrumb
      );
      res.send(html);
      logger.info(`【getFolderList】 返回成功，项数 ${videoFilesHtml.length}`);
      logger.debug("【getFolderList】 退出");
    } catch (err) {
      logger.error("【getFolderList】 失败", err as unknown);
      res.status(500).send("无法读取目录");
    }
  }
}

/**
 * Singleton controller instance
 * @type {VideoController}
 */
export const videoController = new VideoController();
