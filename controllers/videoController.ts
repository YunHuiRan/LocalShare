import type { Request, Response } from "express";
import fs from "fs/promises";
import { createReadStream, type Dirent } from "fs";
import path from "path";
import { VIDEO_FOLDER, VIDEO_FOLDERS } from "../config";
import { getMimeType, mime } from "../utils/mime";
import { templateRenderer } from "../utils/template";
import { logger } from "../utils/logger";

/**
 * 视频控制器类
 * 负责处理所有与视频相关的请求
 */
export class VideoController {
  /**
   * 视频文件夹路径
   * @private
   * @type {string}
   */
  private videoFolder: string;
  private videoFolders: string[];

  /**
   * 创建一个新的视频控制器实例
   * @param {string} videoFolder - 视频文件夹路径，默认为配置中的 VIDEO_FOLDER
   */
  constructor(videoFolders: string[] = [VIDEO_FOLDER]) {
    this.videoFolders = videoFolders;
    this.videoFolder = videoFolders[0];
  }

  /**
   * 在运行时更新共享的根目录
   *
   * 供程序启动时通过“选择文件夹”窗口动态指定目录后调用；
   * 传入空数组时保持不变。
   *
   * @param {string[]} videoFolders - 新的共享根目录列表
   */
  public setVideoFolders(videoFolders: string[]): void {
    if (!Array.isArray(videoFolders) || videoFolders.length === 0) return;
    this.videoFolders = videoFolders;
    this.videoFolder = videoFolders[0];
    logger.info(
      `【setVideoFolders】 共享目录已更新: ${JSON.stringify(videoFolders)}`
    );
  }

  private getRootName(folderPath: string): string {
    return path.basename(folderPath) || folderPath;
  }

  /**
   * 解析请求中的子路径，支持以根目录名称作为前缀的多根映射。
   * 如果只配置了一个根，会把整个子路径当作相对路径处理。
   * 返回 null 表示找不到对应的根（多根模式下提供了未知的前缀）
   */
  private resolveBaseAndRel(subPath: string): { base: string; relPath: string } | null {
    const clean = String(subPath || "").replace(/^\/+|\/+$/g, "");
    if (!clean) return { base: this.videoFolders[0], relPath: "" };
    const parts = clean.split(/[\\/]+/);
    const first = parts[0];
    const match = this.videoFolders.find((f) => this.getRootName(f) === first);
    if (match) {
      const rel = parts.slice(1).join(path.sep);
      return { base: match, relPath: rel };
    }
    if (this.videoFolders.length === 1) {
      return { base: this.videoFolders[0], relPath: clean };
    }
    return null;
  }

  /**
   * 异步解析：先按根名匹配，若未匹配则尝试在每个根下查找该相对路径（向后兼容旧链接）
   */
  private async asyncResolveBaseAndRel(subPath: string): Promise<{ base: string; relPath: string } | null> {
    const clean = String(subPath || "").replace(/^\/+|\/+$/g, "");
    const direct = this.resolveBaseAndRel(clean);
    if (direct) return direct;

    // 未按根名匹配且配置了多个根：尝试在每个根下查找该相对路径是否存在
    for (const root of this.videoFolders) {
      try {
        const candidate = path.join(root, clean);
        // 如果存在该路径（文件或目录），则认为该 root 是匹配的基准
        await fs.stat(candidate);
        return { base: root, relPath: clean };
      } catch (e) {
        // 不存在则继续
      }
    }

    return null;
  }

  /**
   * 为 Content-Disposition 生成安全的头值，使用 RFC5987 对非 ASCII 字符编码
   * @private
   * @param {string} filename
   * @returns {string}
   */
  private makeContentDisposition(filename: string): string {
    if (!filename) return "inline";
    // 移除可能导致 header 错误的控制字符和引号
    const sanitized = filename.replace(/\r|\n|\"|\\/g, "_");
    // 生成 ASCII 回退名（替换非可打印 ASCII）
    const fallback = sanitized.replace(/[^\x20-\x7E]/g, "_");
    // RFC5987 编码 (UTF-8 percent-encoding)
    const encoded = encodeURIComponent(sanitized).replace(/'/g, "%27");
    return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
  }

  /**
   * 自然排序函数，用于对字符串进行自然排序（考虑数字）
   * @private
   * @param {string} a - 第一个比较字符串
   * @param {string} b - 第二个比较字符串
   * @returns {number} 比较结果：负数表示 a < b，0 表示相等，正数表示 a > b
   */
  private naturalSort(a: string, b: string): number {
    return a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }

  /**
   * 获取文件/目录的创建时间（毫秒时间戳）
   * 优先使用 birthtime（创建时间）；部分文件系统不支持时会返回 0，
   * 此时回退到 mtime（修改时间）。
   * @private
   * @param {string} targetPath - 文件或目录的完整路径
   * @returns {Promise<number>} 创建时间（毫秒时间戳），读取失败返回 0
   */
  private async getCreationTimeMs(targetPath: string): Promise<number> {
    try {
      const st = await fs.stat(targetPath);
      if (st.birthtimeMs && st.birthtimeMs > 0) return st.birthtimeMs;
      if (st.mtimeMs && st.mtimeMs > 0) return st.mtimeMs;
    } catch (e) {
      // 忽略无法读取的项，按时间为 0 处理
    }
    return 0;
  }

  /**
   * 按创建时间从新到旧排序名称数组（创建时间相同则按名称自然排序）
   * @private
   * @param {string} baseDir - 名称所在目录
   * @param {string[]} names - 待排序的名称数组
   * @returns {Promise<string[]>} 排序后的新数组（不修改入参）
   */
  private async sortByCreationDesc(
    baseDir: string,
    names: string[]
  ): Promise<string[]> {
    const withTime = await Promise.all(
      names.map(async (name) => ({
        name,
        time: await this.getCreationTimeMs(path.join(baseDir, name)),
      }))
    );
    withTime.sort((a, b) => {
      if (b.time !== a.time) return b.time - a.time;
      return this.naturalSort(a.name, b.name);
    });
    return withTime.map((item) => item.name);
  }

  /**
   * 按创建时间从新到旧排序目录项（Dirent）数组（创建时间相同则按名称自然排序）
   * @private
   * @param {string} baseDir - 目录项所在目录
   * @param {Dirent[]} dirents - 待排序的目录项数组
   * @returns {Promise<Dirent[]>} 排序后的新数组（不修改入参）
   */
  private async sortDirentsByCreationDesc(
    baseDir: string,
    dirents: Dirent[]
  ): Promise<Dirent[]> {
    const withTime = await Promise.all(
      dirents.map(async (dirent) => ({
        dirent,
        time: await this.getCreationTimeMs(path.join(baseDir, dirent.name)),
      }))
    );
    withTime.sort((a, b) => {
      if (b.time !== a.time) return b.time - a.time;
      return this.naturalSort(a.dirent.name, b.dirent.name);
    });
    return withTime.map((item) => item.dirent);
  }

  /**
   * 检查目标路径是否在基础路径范围内，防止路径遍历攻击
   * @static
   * @param {string} base - 基础路径
   * @param {string} target - 目标路径
   * @returns {boolean} 如果目标路径在基础路径内返回 true，否则返回 false
   */
  static isPathSafe(base: string, target: string): boolean {
    const resolvedBase = path.resolve(base);
    const resolvedTarget = path.resolve(target);
    return resolvedTarget.startsWith(resolvedBase);
  }

  /**
   * 获取视频列表页面
   * @param {Request} _req - Express 请求对象
   * @param {Response} res - Express 响应对象
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
      // 如果配置了多个根，则首页显示各根目录作为独立文件夹
      if (this.videoFolders && this.videoFolders.length > 1) {
        const folderItemsArr = this.videoFolders.map((f) => {
          const name = this.getRootName(f);
          const url = `/folder/${encodeURIComponent(name)}`;
          return `
          <a href="${url}" class="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4">
            <div class="flex items-center gap-3">
              <i class="fa fa-folder text-3xl text-yellow-500"></i>
              <div class="truncate">
                <div class="font-medium">${name}</div>
                <div class="text-xs text-gray-500 truncate">根目录 · ${f}</div>
              </div>
            </div>
          </a>
        `;
        });

        const folderItemsHtml = folderItemsArr.join("");
        const html = await templateRenderer.renderVideoListPage("", "根目录", folderItemsHtml, `<a href=\"/\" class=\"text-blue-600 hover:underline\">Home</a>`);
        res.send(html);
        logger.debug("【getVideoList】 退出（多根首页）");
        return;
      }

      const dirents = await fs.readdir(this.videoFolder, {
        withFileTypes: true,
      });
      const names = dirents.map((d) => d.name);

      const folderDirs = await this.sortDirentsByCreationDesc(
        this.videoFolder,
        dirents.filter((d) => d.isDirectory())
      );
      const imageExts = mime.getImageExtensions();
      const ignoreExts = new Set([
        "torrent",
        "nfo",
        "txt",
        "url",
        "sfv",
        "db",
        "ds_store",
      ]);
      const folderItemsArr = await Promise.all(
        folderDirs.map(async (d) => {
          const name = d.name;
          const subPath = path.join(this.videoFolder, name);
          try {
            const subDirents = await fs.readdir(subPath, {
              withFileTypes: true,
            });
            const files = subDirents
              .filter((s) => s.isFile())
              .map((s) => s.name)
              .filter((fn) => {
                if (!fn) return false;
                if (fn.startsWith(".")) return false;
                const ext = path.extname(fn).toLowerCase().replace(/^\./, "");
                if (!ext) return false;
                if (ignoreExts.has(ext)) return false;
                return true;
              });
            const hasFiles = files.length > 0;
            files.sort((x, y) => this.naturalSort(x, y));
            const allImages =
              hasFiles &&
              files.every((f) =>
                imageExts.includes(
                  path.extname(f).toLowerCase().replace(/^\./, "")
                )
              );

            if (allImages) {
              const first = files[0];
              const rel = path.posix.join(name, first).replace(/\\/g, "/");
              const thumb = `/video/${encodeURIComponent(rel)}`;
              const url = `/folder/${encodeURIComponent(name)}`;
              return `
          <a href="${url}" class="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-0 overflow-hidden">
            <div class="w-full h-40 bg-black flex items-center justify-center overflow-hidden">
              <img src="${thumb}" alt="${name}" class="object-contain w-full h-full" />
            </div>
            <div class="p-3">
              <div class="font-medium truncate">${name}</div>
              <div class="text-xs text-gray-500 truncate">漫画 · ${files.length} 页</div>
            </div>
          </a>
        `;
            }
          } catch (e) {}

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
      );

      let folderItemsHtml = folderItemsArr.join("");

      const supportedExts = mime.getSupportedExtensions();

      const sortedNames = await this.sortByCreationDesc(
        this.videoFolder,
        names
      );

      let videoFilesHtml = sortedNames
        .filter((file) => {
          const fileExt = path.extname(file).toLowerCase().replace(/^\./, "");
          return supportedExts.includes(fileExt);
        })
        .map((file) => {
          const fileExt = path.extname(file).toLowerCase().replace(/^\./, "");
          const isImage = mime.isImageExtension(fileExt);
          const isAudio = mime.isAudioExtension(fileExt);
          const url = isImage
            ? `/comic/${encodeURIComponent(file)}`
            : isAudio
            ? `/audio/${encodeURIComponent(file)}`
            : `/watch/${encodeURIComponent(file)}`;
          if (isImage) {
            const thumb = `/video/${encodeURIComponent(file)}`;
            return `
          <a href="${url}" class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
            <div class="w-full h-40 bg-black flex items-center justify-center overflow-hidden">
              <img src="${thumb}" alt="${file}" class="object-contain w-full h-full" />
            </div>
            <div class="p-4">
              <h3 class="font-medium truncate">${file}</h3>
            </div>
          </a>
        `;
          } else {
            const icon = isAudio
              ? "fa-music"
              : file.toLowerCase().endsWith(".mp4")
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
          }
        })
        .join("");

      if (videoFilesHtml.trim() === "" && folderItemsHtml.trim() !== "") {
        const moved = folderItemsHtml;
        folderItemsHtml = "";
        videoFilesHtml = moved;
      }

      const breadcrumb = `<a href="/" class="text-blue-600 hover:underline">Home</a> <span class="text-gray-400">/</span> <span class="text-gray-600">${path.basename(
        this.videoFolder
      )}</span>`;

      logger.debug("【getVideoList】 渲染模板 start");
      const html = await templateRenderer.renderVideoListPage(
        (global as any).__videoFilesFallback || videoFilesHtml,
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
   * 流式传输视频文件
   * 支持范围请求和完整的文件流传输
   * @param {Request} req - Express 请求对象
   * @param {Response} res - Express 响应对象
   * @returns {Promise<void>}
   */
  public async streamVideo(req: Request, res: Response): Promise<void> {
    logger.debug("【streamVideo】 入口");
    try {
      const rawFilename =
        (req.params as any).filename || (req.params as any)[0];
      const filename = decodeURIComponent(String(rawFilename || ""));
      logger.info(`【streamVideo】 请求文件 ${filename}`);
      const resolved = await this.asyncResolveBaseAndRel(filename);
      if (!resolved) {
        logger.warn(`【streamVideo】 未知根或路径: ${filename}`);
        res.status(404).send("视频文件未找到");
        return;
      }
      const videoPath = path.join(resolved.base, resolved.relPath);

      if (!VideoController.isPathSafe(resolved.base, videoPath)) {
        logger.warn(`【streamVideo】 路径越界: ${videoPath}`);
        res.status(403).send("禁止访问");
        return;
      }

      await fs.access(videoPath);
      const stat = await fs.stat(videoPath);
      const fileSize = stat.size;
      logger.debug(`【streamVideo】 文件存在，大小 ${fileSize}`);
      const range = req.headers.range;
      const mimeType = getMimeType(filename);
      const etag = `W/"${stat.size}-${stat.mtimeMs}"`;
      const lastModified = stat.mtime.toUTCString();
      const isImage = String(mimeType).startsWith("image/");
      const cacheControl = isImage
        ? "public, max-age=86400"
        : "public, max-age=60";

      if (!range) {
        const ifNoneMatch =
          (req.headers["if-none-match"] as string) || undefined;
        const ifModifiedSince =
          (req.headers["if-modified-since"] as string) || undefined;

        if (ifNoneMatch === etag) {
          logger.info(
            `【streamVideo】 条件命中 If-None-Match，返回 304 ${filename}`
          );
          res.writeHead(304, {
            ETag: etag,
            "Last-Modified": lastModified,
            "Cache-Control": cacheControl,
          } as any);
          res.end();
          return;
        }

        if (ifModifiedSince) {
          const imsTime = new Date(ifModifiedSince).getTime();
          if (!isNaN(imsTime) && imsTime >= stat.mtime.getTime()) {
            logger.info(
              `【streamVideo】 条件命中 If-Modified-Since，返回 304 ${filename}`
            );
            res.writeHead(304, {
              ETag: etag,
              "Last-Modified": lastModified,
              "Cache-Control": cacheControl,
            } as any);
            res.end();
            return;
          }
        }
      }

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        logger.info(
          `【streamVideo】 Range 请求 start=${start} end=${end} chunk=${chunkSize}`
        );
        const file = createReadStream(videoPath, { start, end });
        const contentDisposition = this.makeContentDisposition(
          path.basename(videoPath)
        );
        const head = {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": mimeType,
          ETag: etag,
          "Last-Modified": lastModified,
          "Cache-Control": cacheControl,
          "Content-Disposition": contentDisposition,
        } as Record<string, string | number>;

        res.writeHead(206, head as any);
        file.once("open", () => logger.debug("【streamVideo】 分段流已打开"));
        file.once("close", () => logger.debug("【streamVideo】 分段流已关闭"));
        file.pipe(res);
      } else {
        logger.info("【streamVideo】 完整流请求");
        const contentDisposition = this.makeContentDisposition(
          path.basename(videoPath)
        );
        const head = {
          "Content-Length": fileSize,
          "Content-Type": mimeType,
          "Accept-Ranges": "bytes",
          ETag: etag,
          "Last-Modified": lastModified,
          "Cache-Control": cacheControl,
          "Content-Disposition": contentDisposition,
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
   * 播放页面（嵌入 <video> 的播放器）
   * 如果目标是目录或图片/音频，会重定向到对应的页面
   */
  public async watch(req: Request, res: Response): Promise<void> {
    logger.debug("【watch】 入口");
    try {
      const rawFilename = (req.params as any).filename || (req.params as any)[0];
      const filename = decodeURIComponent(String(rawFilename || ""));
      logger.info(`【watch】 请求文件 ${filename}`);
      const resolved = await this.asyncResolveBaseAndRel(filename);
      if (!resolved) {
        logger.warn(`【watch】 未知根或路径: ${filename}`);
        res.status(404).send("资源未找到");
        return;
      }
      const videoPath = path.join(resolved.base, resolved.relPath);

      if (!VideoController.isPathSafe(resolved.base, videoPath)) {
        logger.warn(`【watch】 路径越界: ${videoPath}`);
        res.status(403).send("禁止访问");
        return;
      }

      const stat = await fs.stat(videoPath);
      if (stat.isDirectory()) {
        res.redirect(`/folder/${encodeURIComponent(filename)}`);
        return;
      }

      const ext = path.extname(videoPath).toLowerCase().replace(/^\./, "");
      if (mime.isImageExtension(ext)) {
        res.redirect(`/comic/${encodeURIComponent(filename)}`);
        return;
      }
      if (mime.isAudioExtension(ext)) {
        res.redirect(`/audio/${encodeURIComponent(filename)}`);
        return;
      }

      const videoSrc = `/video/${encodeURIComponent(filename)}`;
      const title = path.basename(videoPath);
      const html = await templateRenderer.renderVideoPlayer(videoSrc, title);
      res.send(html);
      logger.info(`【watch】 返回播放器页面 ${filename}`);
    } catch (err) {
      logger.error("【watch】 失败", err as unknown);
      res.status(404).send("资源未找到");
    }
  }

  /**
   * 获取文件夹内容列表
   * @param {Request} req - Express 请求对象
   * @param {Response} res - Express 响应对象
   * @returns {Promise<void>}
   */
  public async getFolderList(req: Request, res: Response): Promise<void> {
    logger.debug("【getFolderList】 入口");
    try {
      const rawPath = (req.params as any).path || (req.params as any)[0] || "";
      const subPath = decodeURIComponent(String(rawPath || ""));
      const resolved = await this.asyncResolveBaseAndRel(subPath);
      if (!resolved) {
        res.status(404).send("未找到目录");
        return;
      }
      const targetPath = path.join(resolved.base, resolved.relPath);

      if (!VideoController.isPathSafe(resolved.base, targetPath)) {
        res.status(403).send("禁止访问");
        return;
      }

      const dirents = await fs.readdir(targetPath, { withFileTypes: true });
      logger.info(
        `【getFolderList】 列出目录 ${targetPath}，项数 ${dirents.length}`
      );

      const folderDirs = await this.sortDirentsByCreationDesc(
        targetPath,
        dirents.filter((d) => d.isDirectory())
      );
      const imageExts = mime.getImageExtensions();
      const ignoreExts = new Set([
        "torrent",
        "nfo",
        "txt",
        "url",
        "sfv",
        "db",
        "ds_store",
      ]);
      const folderItemsArr = await Promise.all(
        folderDirs.map(async (d) => {
          const name = d.name;
          const next = path.posix.join(subPath, name).replace(/\\/g, "/");
          const url = `/folder/${encodeURIComponent(next)}`;
          try {
            const childPath = path.join(targetPath, name);
            const subDirents = await fs.readdir(childPath, {
              withFileTypes: true,
            });
            const files = subDirents
              .filter((s) => s.isFile())
              .map((s) => s.name)
              .filter((fn) => {
                if (!fn) return false;
                if (fn.startsWith(".")) return false;
                const ext = path.extname(fn).toLowerCase().replace(/^\./, "");
                if (!ext) return false;
                if (ignoreExts.has(ext)) return false;
                return true;
              });
            const hasFiles = files.length > 0;
            const allImages =
              hasFiles &&
              files.every((f) =>
                imageExts.includes(
                  path.extname(f).toLowerCase().replace(/^\./, "")
                )
              );
            if (allImages) {
              const first = files.sort()[0];
              const rel = path.posix.join(next, first).replace(/\\/g, "/");
              const thumb = `/video/${encodeURIComponent(rel)}`;
              return `
          <a href="${url}" class="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-0 overflow-hidden">
            <div class="w-full h-40 bg-black flex items-center justify-center overflow-hidden">
                <img src="${thumb}" alt="${name}" class="object-contain w-full h-full" />
            </div>
            <div class="p-3">
              <div class="font-medium truncate">${name}</div>
              <div class="text-xs text-gray-500 truncate">漫画 · ${files.length} 页</div>
            </div>
          </a>
        `;
            }
          } catch (e) {}
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
      );

      let folderItemsHtml = folderItemsArr.join("");

      const fileNames = dirents
        .filter((d) => d.isFile())
        .map((d) => d.name)
        .filter((file) => {
          const fileExt = path.extname(file).toLowerCase().replace(/^\./, "");
          return mime.getSupportedExtensions().includes(fileExt);
        });
      const sortedFileNames = await this.sortByCreationDesc(
        targetPath,
        fileNames
      );

      let videoFilesHtml = sortedFileNames
        .map((file) => {
          const rel = path.posix.join(subPath, file).replace(/\\/g, "/");
          const fileExt = path.extname(file).toLowerCase().replace(/^\./, "");
          const isImage = mime.isImageExtension(fileExt);
          const isAudio = mime.isAudioExtension(fileExt);
          const url = isImage
            ? `/comic/${encodeURIComponent(rel)}`
            : isAudio
            ? `/audio/${encodeURIComponent(rel)}`
            : `/watch/${encodeURIComponent(rel)}`;
          if (isImage) {
            const thumb = `/video/${encodeURIComponent(rel)}`;
            return `
            <a href="${url}" class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div class="w-full h-28 bg-black flex items-center justify-center overflow-hidden">
                <img src="${thumb}" alt="${file}" class="object-contain w-full h-full" />
              </div>
              <div class="p-4">
                <h3 class="font-medium truncate">${file}</h3>
              </div>
            </a>
          `;
          } else {
            const icon = isAudio
              ? "fa-music"
              : file.toLowerCase().endsWith(".mp4")
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
          }
        })
        .join("");

      if (videoFilesHtml.trim() === "" && folderItemsHtml.trim() !== "") {
        const moved = folderItemsHtml;
        folderItemsHtml = "";
        videoFilesHtml = moved;
      }

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

  /**
   * 漫画查看器页面
   * @param {Request} req - Express 请求对象
   * @param {Response} res - Express 响应对象
   * @returns {Promise<void>}
   */
  public async comicViewer(req: Request, res: Response): Promise<void> {
    logger.debug("【comicViewer】 入口");
    try {
      const rawPath = (req.params as any).path || (req.params as any)[0] || "";
      const subPath = decodeURIComponent(String(rawPath || ""));
      const resolved = await this.asyncResolveBaseAndRel(subPath);
      if (!resolved) {
        res.status(404).send("资源未找到");
        return;
      }
      const targetPath = path.join(resolved.base, resolved.relPath);

      if (!VideoController.isPathSafe(resolved.base, targetPath)) {
        res.status(403).send("禁止访问");
        return;
      }

      const stat = await fs.stat(targetPath);
      let images: string[] = [];
      let title = "漫画阅读";
      let startIndex = 0;

      if (stat.isDirectory()) {
        const dirents = await fs.readdir(targetPath, { withFileTypes: true });
        const imgNames = dirents
          .filter((d) => d.isFile())
          .map((d) => d.name)
          .filter((file) => {
            const ext = path.extname(file).toLowerCase().replace(/^\./, "");
            return mime.getImageExtensions().includes(ext);
          });
        const imgs = await this.sortByCreationDesc(targetPath, imgNames);

        images = imgs.map((f) => {
          const rel = path.posix.join(subPath, f).replace(/\\/g, "/");
          return `/video/${encodeURIComponent(rel)}`;
        });
        title = path.basename(targetPath);
        startIndex = 0;
      } else if (stat.isFile()) {
        const fileExt = path
          .extname(targetPath)
          .toLowerCase()
          .replace(/^\./, "");
        if (!mime.isImageExtension(fileExt)) {
          res.redirect(`/video/${encodeURIComponent(subPath)}`);
          return;
        }

        const parent = path.dirname(targetPath);
        const dirents = await fs.readdir(parent, { withFileTypes: true });
        const imgNames = dirents
          .filter((d) => d.isFile())
          .map((d) => d.name)
          .filter((file) => {
            const ext = path.extname(file).toLowerCase().replace(/^\./, "");
            return mime.getImageExtensions().includes(ext);
          });
        const imgs = await this.sortByCreationDesc(parent, imgNames);

        const fileName = path.basename(targetPath);
        const relBase = path.posix
          .join(path.relative(resolved.base, parent))
          .replace(/\\/g, "/");
        const urls = imgs.map((f) => {
          const rel = relBase
            ? path.posix.join(relBase, f).replace(/\\/g, "/")
            : f;
          return `/video/${encodeURIComponent(rel)}`;
        });

        const startIndex = imgs.indexOf(fileName);
        images = urls;
        title = fileName;
      }

      if (!images || images.length === 0) {
        res.status(404).send("未找到图片");
        return;
      }

      const html = await templateRenderer.renderComicPage(
        JSON.stringify(images),
        title,
        startIndex
      );
      res.send(html);
      logger.info(`【comicViewer】 返回漫画页面，图片数 ${images.length}`);
    } catch (err) {
      logger.error("【comicViewer】 失败", err as unknown);
      res.status(404).send("漫画资源未找到");
    }
  }

  /**
   * 音频播放器页面
   * @param {Request} req - Express 请求对象
   * @param {Response} res - Express 响应对象
   * @returns {Promise<void>}
   */
  public async audioPlayer(req: Request, res: Response): Promise<void> {
    logger.debug("【audioPlayer】 入口");
    try {
      const rawPath = (req.params as any).path || (req.params as any)[0] || "";
      const subPath = decodeURIComponent(String(rawPath || ""));
      const resolved = await this.asyncResolveBaseAndRel(subPath);
      if (!resolved) {
        res.status(404).send("音频资源未找到");
        return;
      }
      const targetPath = path.join(resolved.base, resolved.relPath);

      if (!VideoController.isPathSafe(resolved.base, targetPath)) {
        res.status(403).send("禁止访问");
        return;
      }

      const stat = await fs.stat(targetPath);
      let audios: string[] = [];
      let title = "音频播放";
      let startIndex = 0;

      if (stat.isDirectory()) {
        const dirents = await fs.readdir(targetPath, { withFileTypes: true });
        const audioExts = mime.getAudioExtensions();
        const itemNames = dirents
          .filter((d) => d.isFile())
          .map((d) => d.name)
          .filter((file) =>
            audioExts.includes(
              path.extname(file).toLowerCase().replace(/^\./, "")
            )
          );
        const items = await this.sortByCreationDesc(targetPath, itemNames);

        audios = items.map((f) => {
          const rel = path.posix.join(subPath, f).replace(/\\/g, "/");
          return `/video/${encodeURIComponent(rel)}`;
        });
        title = path.basename(targetPath);
        startIndex = 0;
      } else if (stat.isFile()) {
        const fileExt = path
          .extname(targetPath)
          .toLowerCase()
          .replace(/^\./, "");
        if (!mime.isAudioExtension(fileExt)) {
          res.redirect(`/video/${encodeURIComponent(subPath)}`);
          return;
        }

        const parent = path.dirname(targetPath);
        const dirents = await fs.readdir(parent, { withFileTypes: true });
        const audioExts = mime.getAudioExtensions();
        const itemNames = dirents
          .filter((d) => d.isFile())
          .map((d) => d.name)
          .filter((file) =>
            audioExts.includes(
              path.extname(file).toLowerCase().replace(/^\./, "")
            )
          );
        const items = await this.sortByCreationDesc(parent, itemNames);

        const fileName = path.basename(targetPath);
        const relBase = path.posix
          .join(path.relative(resolved.base, parent))
          .replace(/\\/g, "/");
        const urls = items.map((f) => {
          const rel = relBase
            ? path.posix.join(relBase, f).replace(/\\/g, "/")
            : f;
          return `/video/${encodeURIComponent(rel)}`;
        });

        const idx = items.indexOf(fileName);
        startIndex = idx >= 0 ? idx : 0;
        audios = urls;
        title = fileName;
      }

      if (!audios || audios.length === 0) {
        res.status(404).send("未找到音频文件");
        return;
      }

      const html = await templateRenderer.renderAudioPage(
        JSON.stringify(audios),
        title,
        startIndex
      );
      res.send(html);
      logger.info(`【audioPlayer】 返回音频页面，音频数 ${audios.length}`);
    } catch (err) {
      logger.error("【audioPlayer】 失败", err as unknown);
      res.status(404).send("音频资源未找到");
    }
  }
}

/**
 * 视频控制器实例
 * @type {VideoController}
 */
export const videoController = new VideoController(VIDEO_FOLDERS);