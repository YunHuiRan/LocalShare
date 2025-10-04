import express from "express";
import cors from "cors";
import compression from "compression";
import fs from "fs";
import videoRoutes from "./routes/videoRoutes.ts";
import { PORT, VIDEO_FOLDER } from "./config.ts";

/**
 * 应用入口
 * - 启用压缩与 CORS
 * - 添加请求日志中间件（输出中文）
 * - 挂载路由
 */

// 确保视频目录存在
if (!fs.existsSync(VIDEO_FOLDER)) {
  fs.mkdirSync(VIDEO_FOLDER);
}

const app = express();

// 启用 gzip/deflate 压缩，减少移动网络传输体积
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
    console.log(
      `【请求】 ${req.method} ${req.originalUrl} ${
        res.statusCode
      } ${duration}ms - UA:${
        typeof ua === "string" ? ua.replace(/\n/g, "") : JSON.stringify(ua)
      }`
    );
  });
  next();
});

app.use("/", videoRoutes);

app.listen(PORT, () => {
  console.log(`视频服务器已启动，访问地址: http://localhost:${PORT}`);
  console.log(`正在共享文件夹: ${VIDEO_FOLDER}`);
  console.log(`节点版本: ${process.version}，进程 PID: ${process.pid}`);
});
