import express from "express";
import cors from "cors";
import compression from "compression";
import fs from "fs";
import videoRoutes from "./routes/videoRoutes";
import { PORT, VIDEO_FOLDER } from "./config";
import { logger } from "./utils/logger";

/**
 * 检查视频文件夹是否存在，如果不存在则创建该文件夹
 */
if (!fs.existsSync(VIDEO_FOLDER)) {
  fs.mkdirSync(VIDEO_FOLDER);
}

/**
 * Express 应用实例
 * @type {express.Application}
 */
const app = express();

/**
 * 启用 gzip 压缩中间件
 */
app.use(compression());

/**
 * 启用 CORS 跨域资源共享中间件
 */
app.use(cors());

/**
 * 请求日志记录中间件
 * 记录每个请求的开始时间、方法、URL 和结束时间
 * @param {express.Request} req - Express 请求对象
 * @param {express.Response} res - Express 响应对象
 * @param {express.NextFunction} next - Express 下一步函数
 */
app.use((req, res, next) => {
  const start: number = Date.now();
  logger.debug(`【请求】 开始 ${req.method} ${req.originalUrl}`);
  const ua = req.headers["user-agent"] || "-";
  res.once("finish", () => {
    const duration: number = Date.now() - start;
    logger.info(
      `【请求】 ${req.method} ${req.originalUrl} ${
        res.statusCode
      } ${duration}ms - UA: ${
        typeof ua === "string" ? ua.replace(/\n/g, "") : JSON.stringify(ua)
      }`
    );
    logger.debug(
      `【请求】 结束 ${req.method} ${req.originalUrl} 耗时 ${duration}ms`
    );
  });
  next();
});

/**
 * 挂载视频相关路由
 */
app.use("/", videoRoutes);

/**
 * 尝试监听指定端口，如果端口被占用则尝试下一个端口
 * @param {number} port - 要监听的端口号
 * @param {number} attemptsLeft - 剩余尝试次数，默认为3次
 * @returns {import("http").Server} HTTP 服务器实例
 */
function tryListen(port: number, attemptsLeft = 3) {
  logger.info(`尝试监听端口 ${port}（剩余尝试 ${attemptsLeft}）`);
  const startAttempt = Date.now();
  const server = app.listen(port, () => {
    const took = Date.now() - startAttempt;
    logger.info(
      `视频服务器已启动，访问地址: http://localhost:${port}（启动耗时 ${took}ms）`
    );
    logger.info(`正在共享文件夹: ${VIDEO_FOLDER}`);
    logger.info(
      `节点版本: ${process.version}，进程 PID: ${String(process.pid)}`
    );
  });

  server.on("error", (err: Error & { code?: string }) => {
    logger.error([
      "[server] error",
      String(err && (err as any).message ? (err as any).message : err),
    ]);
    if (err && err.code === "EADDRINUSE" && attemptsLeft > 0) {
      const nextPort = port + 1;
      logger.warn(`端口 ${port} 被占用，尝试下一端口 ${nextPort}`);
      setTimeout(() => tryListen(nextPort, attemptsLeft - 1), 200);
    }
  });

  server.on("listening", () => {
    logger.info(
      `[server] listening event, address=${JSON.stringify(server.address())}`
    );
  });

  return server;
}

/**
 * HTTP 服务器实例
 * @type {import("http").Server}
 */
const server: import("http").Server = tryListen(PORT, 10);

/**
 * 服务器错误事件监听器
 * @param {any} err - 错误对象
 */
server.on("error", (err: any) => {
  logger.error([
    "[server] error",
    String(err && err.message ? err.message : err),
  ]);
});

/**
 * 服务器监听事件监听器
 */
server.on("listening", () => {
  logger.info([
    "[server] listening event, address=",
    JSON.stringify(server.address()),
  ]);
});