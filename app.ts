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
  const ua = req.headers["user-agent"] || "-";
  res.once("finish", () => {
    const duration: number = Date.now() - start;
    logger.info([
      `【请求】 ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms - UA:`,
      typeof ua === "string" ? ua.replace(/\n/g, "") : JSON.stringify(ua),
    ]);
  });
  next();
});

app.use("/", videoRoutes);

app.listen(PORT, () => {
  logger.info(`视频服务器已启动，访问地址: http://localhost:${PORT}`);
  logger.info([`正在共享文件夹:`, VIDEO_FOLDER]);
  logger.info([`节点版本: ${process.version}，进程 PID:`, String(process.pid)]);
});
