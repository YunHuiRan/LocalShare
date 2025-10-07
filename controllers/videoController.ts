import type { Request, Response } from "express";
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { VIDEO_FOLDER } from "../config";
import { mime, getMimeType } from "../utils/mime";
import { templateRenderer } from "../utils/template";
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
      const files: string[] = await fs.readdir(this.videoFolder);
      logger.info(`【目录】 目录条目数量: ${files.length}`);

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

      const html: string = await templateRenderer.renderVideoListPage(
        videoFilesHtml,
        this.videoFolder
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
      const filename: string = decodeURIComponent(req.params.filename);
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
}

export const videoController = new VideoController();
