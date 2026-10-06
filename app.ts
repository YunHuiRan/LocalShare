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
import { language, t } from "./utils/i18n";

/**
 * 设置控制台窗口标题，方便双击运行 exe 时识别
 */
process.title = t("LocalShare 文件共享服务", "LocalShare File Sharing Service");

/**
 * 打印本次检测到的控制台语言，便于排查输出为何是中文/英文
 * （可用环境变量 LOCALSHARE_LANG=zh|en 强制指定）
 */
logger.debug(
  t(
    `【语言】 系统语言检测结果: 中文（${language}）`,
    `【i18n】 console language: English (${language})`
  )
);

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
  logger.info(
    t("未选择共享文件夹，程序退出。", "No shared folder selected, exiting.")
  );
  logger.info(
    t(
      '提示: 可把要共享的文件夹直接拖到 LocalShare.exe 图标上，或执行 LocalShare.exe "D:\\要共享的目录"',
      'Tip: drag the folder you want to share onto LocalShare.exe, or run LocalShare.exe "D:\\folder\\to\\share"'
    )
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
    logger.error(
      t(
        `创建共享目录失败: ${folder}`,
        `Failed to create shared folder: ${folder}`
      ),
      e as any
    );
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
  logger.debug(
    t(
      `【请求】 开始 ${req.method} ${req.originalUrl}`,
      `[request] start ${req.method} ${req.originalUrl}`
    )
  );
  const ua = req.headers["user-agent"] || "-";
  res.once("finish", () => {
    const duration: number = Date.now() - start;
    const uaText =
      typeof ua === "string" ? ua.replace(/\n/g, "") : JSON.stringify(ua);
    logger.info(
      t(
        `【请求】 ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms - UA: ${uaText}`,
        `[request] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms - UA: ${uaText}`
      )
    );
    logger.debug(
      t(
        `【请求】 结束 ${req.method} ${req.originalUrl} 耗时 ${duration}ms`,
        `[request] end ${req.method} ${req.originalUrl} after ${duration}ms`
      )
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
  logger.info(
    t(
      `尝试监听端口 ${port}（剩余尝试 ${attemptsLeft}）`,
      `Trying port ${port} (${attemptsLeft} attempts left)`
    )
  );
  const startAttempt = Date.now();
  /** 本次监听是否已失败（用于避免端口被占用时打印出错误的地址） */
  let failed = false;

  const server = app.listen(port, () => {
    setTimeout(() => {
      if (failed || !server.listening) return;
      const took = Date.now() - startAttempt;
      const lanAddresses = getLanIPv4Addresses();
      logger.info("======================================================");
      logger.info(
        t(
          `LocalShare 已启动（耗时 ${took}ms）`,
          `LocalShare started in ${took}ms`
        )
      );
      logger.info(
        t(
          `共享目录: ${SHARED_FOLDERS.join("  |  ")}`,
          `Shared folders: ${SHARED_FOLDERS.join("  |  ")}`
        )
      );
      logger.info(
        t(
          `本机访问: http://localhost:${port}`,
          `Local access: http://localhost:${port}`
        )
      );
      for (const ip of lanAddresses) {
        logger.info(
          t(
            `局域网访问（手机/平板用这个）: http://${ip}:${port}`,
            `LAN access (use this on your phone/tablet): http://${ip}:${port}`
          )
        );
      }
      if (lanAddresses.length === 0) {
        logger.warn(
          t(
            "未检测到局域网 IPv4 地址，请确认网络连接是否正常",
            "No LAN IPv4 address detected, please check your network connection"
          )
        );
      }
      logger.info(
        t(
          "提示: 手机需与电脑连接同一个 Wi-Fi/局域网才能访问",
          "Tip: your phone must be on the same Wi-Fi/LAN as this computer"
        )
      );
      logger.info("======================================================");
      logger.info(
        t(
          `节点版本: ${process.version}，进程 PID: ${String(process.pid)}`,
          `Node version: ${process.version}, PID: ${String(process.pid)}`
        )
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
      logger.warn(
        t(
          `端口 ${port} 被占用，尝试下一端口 ${nextPort}`,
          `Port ${port} is in use, trying the next port ${nextPort}`
        )
      );
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