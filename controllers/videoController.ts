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
   * Natural sort comparator (numeric-aware, case-insensitive)
   */
  private naturalSort(a: string, b: string): number {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
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

      // Build folder items HTML. If a folder contains files and ALL files are images,
      // treat it as a comic folder and show the first image as a thumbnail.
  const folderDirs = dirents.filter((d) => d.isDirectory());
      const imageExts = mime.getImageExtensions();
      // extensions to ignore when determining if folder is a comic
      const ignoreExts = new Set(["torrent", "nfo", "txt", "url", "sfv", "db", "ds_store"]);
      const folderItemsArr = await Promise.all(
        folderDirs.map(async (d) => {
          const name = d.name;
          const subPath = path.join(this.videoFolder, name);
          try {
            const subDirents = await fs.readdir(subPath, { withFileTypes: true });
            // collect files and filter out hidden and ignored extensions
            const files = subDirents
              .filter((s) => s.isFile())
              .map((s) => s.name)
              .filter((fn) => {
                if (!fn) return false;
                if (fn.startsWith('.')) return false; // ignore hidden files like .torrent or .DS_Store
                const ext = path.extname(fn).toLowerCase().replace(/^\./, "");
                if (!ext) return false;
                if (ignoreExts.has(ext)) return false;
                return true;
              });
            const hasFiles = files.length > 0;
            // sort files naturally for consistent ordering
            files.sort((x, y) => this.naturalSort(x, y));
            const allImages = hasFiles && files.every((f) => imageExts.includes(path.extname(f).toLowerCase().replace(/^\./, "")));

            if (allImages) {
              // show thumbnail using first image (after natural sort)
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
          } catch (e) {
            // ignore read errors and fall back to default folder view
          }

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

      // ensure consistent natural ordering for files
      names.sort((a, b) => this.naturalSort(a, b));

      let videoFilesHtml = names
        .filter((file) => {
          const fileExt = path.extname(file).toLowerCase().replace(/^\./, "");
          return supportedExts.includes(fileExt);
        })
        .map((file) => {
          const fileExt = path.extname(file).toLowerCase().replace(/^\./, "");
          const isImage = mime.isImageExtension(fileExt);
          const url = isImage
            ? `/comic/${encodeURIComponent(file)}`
            : `/video/${encodeURIComponent(file)}`;
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
          }
        })
        .join("");

      // If there are no video/image files but there are folders, show folders in main area
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
      // caching: compute ETag and Last-Modified
      const mimeType = getMimeType(filename);
      const etag = `W/"${stat.size}-${stat.mtimeMs}"`;
      const lastModified = stat.mtime.toUTCString();
      // For images, set a reasonable cache-control to avoid re-fetching on refresh
      const isImage = String(mimeType).startsWith("image/");
      const cacheControl = isImage ? "public, max-age=86400" : "public, max-age=60"; // images: 1 day, others: 60s

      // Handle conditional requests (If-None-Match / If-Modified-Since) when not requesting a range
      if (!range) {
        const ifNoneMatch = (req.headers["if-none-match"] as string) || undefined;
        const ifModifiedSince = (req.headers["if-modified-since"] as string) || undefined;

        if (ifNoneMatch === etag) {
          logger.info(`【streamVideo】 条件命中 If-None-Match，返回 304 ${filename}`);
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
            logger.info(`【streamVideo】 条件命中 If-Modified-Since，返回 304 ${filename}`);
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
        const head = {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": mimeType,
          ETag: etag,
          "Last-Modified": lastModified,
          "Cache-Control": cacheControl,
        } as Record<string, string | number>;

        res.writeHead(206, head as any);
        file.once("open", () => logger.debug("【streamVideo】 分段流已打开"));
        file.once("close", () => logger.debug("【streamVideo】 分段流已关闭"));
        file.pipe(res);
      } else {
        logger.info("【streamVideo】 完整流请求");
        const head = {
          "Content-Length": fileSize,
          "Content-Type": mimeType,
          ETag: etag,
          "Last-Modified": lastModified,
          "Cache-Control": cacheControl,
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

      // Build folder items: show thumbnail if folder contains only images (treat as comic)
      const folderDirs = dirents.filter((d) => d.isDirectory());
      const imageExts = mime.getImageExtensions();
      const ignoreExts = new Set(["torrent", "nfo", "txt", "url", "sfv", "db", "ds_store"]);
      const folderItemsArr = await Promise.all(
        folderDirs.map(async (d) => {
          const name = d.name;
          const next = path.posix.join(subPath, name).replace(/\\/g, "/");
          const url = `/folder/${encodeURIComponent(next)}`;
          try {
            const childPath = path.join(targetPath, name);
            const subDirents = await fs.readdir(childPath, { withFileTypes: true });
            const files = subDirents
              .filter((s) => s.isFile())
              .map((s) => s.name)
              .filter((fn) => {
                if (!fn) return false;
                if (fn.startsWith('.')) return false;
                const ext = path.extname(fn).toLowerCase().replace(/^\./, "");
                if (!ext) return false;
                if (ignoreExts.has(ext)) return false;
                return true;
              });
            const hasFiles = files.length > 0;
            const allImages = hasFiles && files.every((f) => imageExts.includes(path.extname(f).toLowerCase().replace(/^\./, "")));
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
          } catch (e) {
            // ignore and fall back to default
          }
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

      let videoFilesHtml = dirents
        .filter((d) => d.isFile())
        .map((d) => d.name)
        .filter((file) => {
          const fileExt = path.extname(file).toLowerCase().replace(/^\./, "");
          return mime.getSupportedExtensions().includes(fileExt);
        })
        .sort((a, b) => this.naturalSort(a, b))
        .map((file) => {
          const rel = path.posix.join(subPath, file).replace(/\\/g, "/");
          const fileExt = path.extname(file).toLowerCase().replace(/^\./, "");
          const isImage = mime.isImageExtension(fileExt);
          const url = isImage
            ? `/comic/${encodeURIComponent(rel)}`
            : `/video/${encodeURIComponent(rel)}`;
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
          }
        })
        .join("");

      // If there are no files but only folders, show folders in main area instead of only left sidebar
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
   * Render a comic reader page for a folder or a single image file.
   * If a file is provided, the reader will open the containing folder and
   * start from that image.
   */
  public async comicViewer(req: Request, res: Response): Promise<void> {
    logger.debug("【comicViewer】 入口");
    try {
      const rawPath = (req.params as any).path || (req.params as any)[0] || "";
      const subPath = decodeURIComponent(String(rawPath || ""));
      const targetPath = path.join(this.videoFolder, subPath);

      if (!VideoController.isPathSafe(this.videoFolder, targetPath)) {
        res.status(403).send("禁止访问");
        return;
      }

  // determine whether target is a folder or file
      const stat = await fs.stat(targetPath);
      let images: string[] = [];
      let title = "漫画阅读";
  let startIndex = 0;

          if (stat.isDirectory()) {
        const dirents = await fs.readdir(targetPath, { withFileTypes: true });
        const imgs = dirents
          .filter((d) => d.isFile())
          .map((d) => d.name)
          .filter((file) => {
            const ext = path.extname(file).toLowerCase().replace(/^\./, "");
            return mime.getImageExtensions().includes(ext);
          })
            .sort((a, b) => this.naturalSort(a, b));

          images = imgs.map((f) => {
            const rel = path.posix.join(subPath, f).replace(/\\/g, "/");
            return `/video/${encodeURIComponent(rel)}`;
          });
  title = path.basename(targetPath);
  startIndex = 0;
        } else if (stat.isFile()) {
        const fileExt = path.extname(targetPath).toLowerCase().replace(/^\./, "");
        if (!mime.isImageExtension(fileExt)) {
          // non-image file, redirect to normal streaming
          res.redirect(`/video/${encodeURIComponent(subPath)}`);
          return;
        }

        const parent = path.dirname(targetPath);
        const dirents = await fs.readdir(parent, { withFileTypes: true });
        const imgs = dirents
          .filter((d) => d.isFile())
          .map((d) => d.name)
          .filter((file) => {
            const ext = path.extname(file).toLowerCase().replace(/^\./, "");
            return mime.getImageExtensions().includes(ext);
          })
            .sort((a, b) => this.naturalSort(a, b));

          const fileName = path.basename(targetPath);
          // build list of URLs in natural order; compute start index so viewer can start at clicked file
          const relBase = path.posix.join(path.relative(this.videoFolder, parent)).replace(/\\/g, "/");
          const urls = imgs.map((f) => {
            const rel = relBase ? path.posix.join(relBase, f).replace(/\\/g, "/") : f;
            return `/video/${encodeURIComponent(rel)}`;
          });

          const startIndex = imgs.indexOf(fileName);
          images = urls;
    title = fileName;
    // startIndex already computed above
      }

      if (!images || images.length === 0) {
        res.status(404).send("未找到图片");
        return;
      }

  const html = await templateRenderer.renderComicPage(JSON.stringify(images), title, startIndex);
      res.send(html);
      logger.info(`【comicViewer】 返回漫画页面，图片数 ${images.length}`);
    } catch (err) {
      logger.error("【comicViewer】 失败", err as unknown);
      res.status(404).send("漫画资源未找到");
    }
  }

  /**
   * Render an audio player page for a folder or a single audio file.
   * If a file is provided, the player will open the containing folder and
   * start from that file.
   */
  public async audioPlayer(req: Request, res: Response): Promise<void> {
    logger.debug("【audioPlayer】 入口");
    try {
      const rawPath = (req.params as any).path || (req.params as any)[0] || "";
      const subPath = decodeURIComponent(String(rawPath || ""));
      const targetPath = path.join(this.videoFolder, subPath);

      if (!VideoController.isPathSafe(this.videoFolder, targetPath)) {
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
        const items = dirents
          .filter((d) => d.isFile())
          .map((d) => d.name)
          .filter((file) => audioExts.includes(path.extname(file).toLowerCase().replace(/^\./, "")))
          .sort((a, b) => this.naturalSort(a, b));

        audios = items.map((f) => {
          const rel = path.posix.join(subPath, f).replace(/\\/g, "/");
          return `/video/${encodeURIComponent(rel)}`;
        });
        title = path.basename(targetPath);
        startIndex = 0;
      } else if (stat.isFile()) {
        const fileExt = path.extname(targetPath).toLowerCase().replace(/^\./, "");
        if (!mime.isAudioExtension(fileExt)) {
          // non-audio file, redirect to normal streaming
          res.redirect(`/video/${encodeURIComponent(subPath)}`);
          return;
        }

        const parent = path.dirname(targetPath);
        const dirents = await fs.readdir(parent, { withFileTypes: true });
        const audioExts = mime.getAudioExtensions();
        const items = dirents
          .filter((d) => d.isFile())
          .map((d) => d.name)
          .filter((file) => audioExts.includes(path.extname(file).toLowerCase().replace(/^\./, "")))
          .sort((a, b) => this.naturalSort(a, b));

        const fileName = path.basename(targetPath);
        const relBase = path.posix.join(path.relative(this.videoFolder, parent)).replace(/\\/g, "/");
        const urls = items.map((f) => {
          const rel = relBase ? path.posix.join(relBase, f).replace(/\\/g, "/") : f;
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

      const html = await templateRenderer.renderAudioPage(JSON.stringify(audios), title, startIndex);
      res.send(html);
      logger.info(`【audioPlayer】 返回音频页面，音频数 ${audios.length}`);
    } catch (err) {
      logger.error("【audioPlayer】 失败", err as unknown);
      res.status(404).send("音频资源未找到");
    }
  }
}

/**
 * Singleton controller instance
 * @type {VideoController}
 */
export const videoController = new VideoController();
