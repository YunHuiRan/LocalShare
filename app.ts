import express from "express";
import cors from "cors";
import compression from "compression";
import fs from "fs";
import os from "os";
import { execSync } from "child_process";
import videoRoutes from "./routes/videoRoutes";
import { videoController } from "./controllers/videoController";
import { PORT, VIDEO_FOLDERS } from "./config";
import { logger } from "./utils/logger";
import { resolveSharedFolders } from "./utils/shareFolders";

/**
 * 设置控制台窗口标题，方便双击运行 exe 时识别
 */
process.title = "LocalShare 文件共享服务";

/**
 * 获取本机所有局域网 IPv4 地址
 * @returns {string[]} 局域网 IPv4 地址列表
 */
function getLanIPv4Addresses(): string[] {
  const addresses: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const info of interfaces[name] || []) {
      const family = String(info.family);
      if (family !== "IPv4" && family !== "4") continue;
      if (info.internal) continue;
      addresses.push(info.address);
    }
  }
  return addresses;
}

/**
 * 退出前暂停，避免双击运行时窗口一闪而过看不到提示信息
 *
 * 仅在标准输入是终端（即双击运行）时暂停；管道/重定向场景直接退出，
 * 这样自动化脚本不会被阻塞。
 */
function pauseBeforeExit(): void {
  if (!process.stdin.isTTY) return;
  try {
    execSync("pause", { stdio: "inherit" });
  } catch (e) {
    // 暂停失败（例如非 cmd 环境）时忽略，直接退出
  }
}

/**
 * 本次运行实际要共享的目录列表
 *
 * 解析优先级：命令行参数 > 环境变量 SHARE_DIR/SHARE_DIRS > 文件夹选择窗口 > 配置文件默认目录
 * @type {string[]|null}
 */
const resolvedFolders: string[] | null = resolveSharedFolders();

if (resolvedFolders === null) {
  logger.info("未选择共享文件夹，程序退出。");
  logger.info(
    '提示: 可把要共享的文件夹直接拖到 LocalShare.exe 图标上，或执行 LocalShare.exe "D:\\要共享的目录"'
  );
  pauseBeforeExit();
  process.exit(0);
}

/**
 * 本次运行实际使用的共享目录（没有指定时回退到配置文件中的默认目录）
 * @type {string[]}
 */
const SHARED_FOLDERS: string[] =
  resolvedFolders.length > 0 ? resolvedFolders : VIDEO_FOLDERS;

// 让控制器使用本次运行选择的共享目录
videoController.setVideoFolders(SHARED_FOLDERS);

// 确保每个共享目录存在（支持多个路径）
for (const folder of SHARED_FOLDERS) {
  try {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
  } catch (e) {
    logger.error(`创建共享目录失败: ${folder}`, e as any);
  }
}

/**
 * Express 应用实例
 * @type {express.Application}
 */
const app = express();

/**
 * 启用 gzip 压缩中间件
 */
// 压缩中间件：对大文件（视频流）和带 Range 的请求禁用压缩，避免破坏媒体流
app.use(
  compression({
    filter: (req, res) => {
      try {
        const url = String(req.url || "");
        // 如果是视频流或播放器页面或存在 Range 请求，则不要压缩
        if (url.startsWith("/video/") || url.startsWith("/watch/")) return false;
        if (req.headers && req.headers.range) return false;
      } catch (e) {}
      return compression.filter(req, res);
    },
  })
);

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
 * 打印启动信息前的等待时间（毫秒）
 *
 * 在 Windows 上端口已被占用时，Node 可能先触发 listening 再触发 error，
 * 若在 listening 回调里立刻打印地址，屏幕上会出现一个其实没有在使用的端口号。
 * 因此稍等片刻，确认本次监听没有报错后再打印启动信息。
 *
 * @type {number}
 */
const STARTUP_BANNER_DELAY_MS = 300;

/**
 * 尝试监听指定端口，如果端口被占用则尝试下一个端口
 * @param {number} port - 要监听的端口号
 * @param {number} attemptsLeft - 剩余尝试次数，默认为3次
 * @returns {import("http").Server} HTTP 服务器实例
 */
function tryListen(port: number, attemptsLeft = 3) {
  logger.info(`尝试监听端口 ${port}（剩余尝试 ${attemptsLeft}）`);
  const startAttempt = Date.now();
  /** 本次监听是否已失败（用于避免端口被占用时打印出错误的地址） */
  let failed = false;

  const server = app.listen(port, () => {
    setTimeout(() => {
      if (failed || !server.listening) return;
      const took = Date.now() - startAttempt;
      const lanAddresses = getLanIPv4Addresses();
      logger.info("======================================================");
      logger.info(`LocalShare 已启动（耗时 ${took}ms）`);
      logger.info(`共享目录: ${SHARED_FOLDERS.join("  |  ")}`);
      logger.info(`本机访问: http://localhost:${port}`);
      for (const ip of lanAddresses) {
        logger.info(`局域网访问（手机/平板用这个）: http://${ip}:${port}`);
      }
      if (lanAddresses.length === 0) {
        logger.warn("未检测到局域网 IPv4 地址，请确认网络连接是否正常");
      }
      logger.info("提示: 手机需与电脑连接同一个 Wi-Fi/局域网才能访问");
      logger.info("======================================================");
      logger.info(
        `节点版本: ${process.version}，进程 PID: ${String(process.pid)}`
      );
    }, STARTUP_BANNER_DELAY_MS);
  });

  server.on("error", (err: Error & { code?: string }) => {
    failed = true;
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