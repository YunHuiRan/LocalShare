import type { Request, Response } from "express";
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { VIDEO_FOLDER } from "../config";
import { mime, getMimeType } from "../utils/mime";
import { templateRenderer } from "../utils/template";
import { spawn } from "child_process";
import { logger } from "../utils/logger";

export class VideoController {
  private videoFolder: string;

  constructor(videoFolder: string = VIDEO_FOLDER) {
    this.videoFolder = videoFolder;
  }

  static isPathSafe(base: string, target: string): boolean {
    const resolvedBase: string = path.resolve(base);
    const resolvedTarget: string = path.resolve(target);
    return resolvedTarget.startsWith(resolvedBase);
  }

  public async getVideoList(req: Request, res: Response): Promise<void> {
    const startTs: number = Date.now();
    try {
      const cacheKey = "__videoListCache";
      const cache: { ts: number; html: string } = (global as any)[cacheKey] || {
        ts: 0,
        html: "",
      };
      if (Date.now() - cache.ts < 5000 && cache.html) {
        logger.info("【缓存】 使用视频列表缓存");
        res.send(cache.html);
        logger.info(`【耗时】 getVideoList ${Date.now() - startTs}ms`);
        return;
      }

      logger.info(`【目录】 读取视频目录: ${this.videoFolder}`);
  const dirents = await fs.readdir(this.videoFolder, { withFileTypes: true });
  const files: string[] = dirents.map((d) => d.name);
      logger.info(`【目录】 目录条目数量: ${files.length}`);

      // folders first
      const folderItemsHtml: string = dirents
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

      const videoFilesHtml: string = files
        .filter((file: string) => {
          const ext: string = file.toLowerCase();
          return (
            ext.endsWith(".mp4") ||
            ext.endsWith(".mkv") ||
            ext.endsWith(".avi") ||
            ext.endsWith(".mov")
          );
        })
        .map((file: string) => {
          const url: string = `/video/${encodeURIComponent(file)}`;
          const icon: string = file.toLowerCase().endsWith(".mp4")
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

      // build breadcrumb from folderPath (show tail)
      const breadcrumb = `<a href="/" class="text-blue-600 hover:underline">Home</a> <span class="text-gray-400">/</span> <span class="text-gray-600">${path.basename(this.videoFolder)}</span>`;

      const html: string = await templateRenderer.renderVideoListPage(
        videoFilesHtml,
        this.videoFolder,
        folderItemsHtml,
        breadcrumb
      );
      (global as any)[cacheKey] = { ts: Date.now(), html };
      res.send(html);
      logger.info(
        `【耗时】 getVideoList ${Date.now() - startTs}ms（生成），条目: ${
          videoFilesHtml.length
        }`
      );
    } catch (err) {
      logger.error("【错误】 getVideoList 读取或渲染失败", err);
      res.status(500).send("无法读取视频目录");
    }
  }

  public async streamVideo(req: Request, res: Response): Promise<void> {
    try {
      // support wildcard route /video/* -> req.params[0]
  const rawFilename: any = (req.params as any).filename || (req.params as any)[0];
  const filename: string = decodeURIComponent(rawFilename || "");
      const videoPath: string = path.join(this.videoFolder, filename);

      logger.info(`【流】 请求文件: ${filename}`);

      if (!VideoController.isPathSafe(this.videoFolder, videoPath)) {
        res.status(403).send("禁止访问");
        return;
      }

      await fs.access(videoPath);
      const stat = await fs.stat(videoPath);
      logger.info(`【流】 文件存在，大小: ${stat.size} 字节`);
      const fileSize: number = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        logger.info(`【流】 Range 请求：start=${start}, end=${end}`);
        const chunkSize: number = end - start + 1;

        const file = createReadStream(videoPath, { start, end });

        const head = {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": getMimeType(filename),
        };

        res.writeHead(206, head);
        file.pipe(res);
        file.once("open", () => logger.info("【流】 分段流已打开"));
        file.once("close", () => logger.info("【流】 分段流已关闭"));
      } else {
        const head = {
          "Content-Length": fileSize,
          "Content-Type": getMimeType(filename),
        };

        res.writeHead(200, head);
        const full = createReadStream(videoPath);
        full.pipe(res);
        full.once("open", () => logger.info("【流】 全量流已打开"));
        full.once("close", () => logger.info("【流】 全量流已关闭"));
      }
    } catch (err) {
      logger.error("【错误】 streamVideo 流式传输失败", err);
      res.status(404).send("视频文件未找到");
    }
  }

  public async getFolderList(req: Request, res: Response): Promise<void> {
    const startTs = Date.now();
    try {
  const rawPath: any = (req.params as any).path || (req.params as any)[0] || "";
  const subPath = decodeURIComponent(rawPath || "");
      const targetPath = path.join(this.videoFolder, subPath);

      if (!VideoController.isPathSafe(this.videoFolder, targetPath)) {
        res.status(403).send("禁止访问");
        return;
      }

      logger.info(`【目录】 读取子目录: ${targetPath}`);
      const dirents = await fs.readdir(targetPath, { withFileTypes: true });

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
          const ext = file.toLowerCase();
          return ext.endsWith(".mp4") || ext.endsWith(".mkv") || ext.endsWith(".avi") || ext.endsWith(".mov");
        })
        .map((file) => {
          const rel = path.posix.join(subPath, file).replace(/\\/g, "/");
          const url = `/video/${encodeURIComponent(rel)}`;
          const icon = file.toLowerCase().endsWith(".mp4") ? "fa-file-video-o" : file.toLowerCase().endsWith(".mkv") ? "fa-film" : "fa-play-circle";
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

      // build breadcrumb
      const parts = subPath ? subPath.split(/[\\/]+/) : [];
      let breadcrumb = `<a href="/" class="text-blue-600 hover:underline">Home</a>`;
      let acc = "";
      for (let i = 0; i < parts.length; i++) {
        acc = acc ? path.posix.join(acc, parts[i]) : parts[i];
        breadcrumb += ` <span class="text-gray-400">/</span> <a href="/folder/${encodeURIComponent(acc)}" class="text-blue-600 hover:underline">${parts[i]}</a>`;
      }

      const html: string = await templateRenderer.renderVideoListPage(
        videoFilesHtml,
        targetPath,
        folderItemsHtml,
        breadcrumb
      );

      res.send(html);
      logger.info(`【耗时】 getFolderList ${Date.now() - startTs}ms`);
    } catch (err) {
      logger.error("【错误】 getFolderList 失败", err);
      res.status(500).send("无法读取目录");
    }
  }

  public async openFolder(req: Request, res: Response): Promise<void> {
    try {
      const raw = (req.query.path as string) || "";
      const subPath = decodeURIComponent(raw || "");
      const targetPath = path.join(this.videoFolder, subPath);

      if (!VideoController.isPathSafe(this.videoFolder, targetPath)) {
        res.status(403).json({ ok: false, message: "禁止访问" });
        return;
      }

      logger.info(`【打开】 尝试在服务器上打开: ${targetPath}`);

      // choose command based on platform
      const platform = process.platform;
      let cmd: string;
      let args: string[] = [];
      if (platform === "win32") {
        cmd = "explorer";
        args = [targetPath];
      } else if (platform === "darwin") {
        cmd = "open";
        args = [targetPath];
      } else {
        cmd = "xdg-open";
        args = [targetPath];
      }

      const p = spawn(cmd, args, { detached: true, stdio: "ignore" });
      p.unref();

      res.json({ ok: true });
    } catch (err) {
      logger.error("【错误】 openFolder 失败", err);
      res.status(500).json({ ok: false, message: "无法打开文件夹" });
    }
  }
}

export const videoController = new VideoController();
