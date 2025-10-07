import express from "express";
import cors from "cors";
import compression from "compression";
import fs from "fs";
import videoRoutes from "./routes/videoRoutes";
import { PORT, VIDEO_FOLDER } from "./config";
import { logger } from "./utils/logger";

/**
 * 应用入口
 * - 启用压缩与 CORS
 * - 挂载路由
 */

if (!fs.existsSync(VIDEO_FOLDER)) {
  fs.mkdirSync(VIDEO_FOLDER);
}

const app = express();

app.use(compression());
app.use(cors());

/**
 * 请求日志中间件
 * 记录：HTTP 方法、URL、响应状态、耗时(ms)、User-Agent
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

app.use("/", videoRoutes);

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

const server = tryListen(PORT, 10);

server.on("error", (err: any) => {
  logger.error([
    "[server] error",
    String(err && err.message ? err.message : err),
  ]);
});

server.on("listening", () => {
  logger.info([
    "[server] listening event, address=",
    JSON.stringify(server.address()),
  ]);
});
