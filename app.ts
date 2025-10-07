import express from "express";
import cors from "cors";
import compression from "compression";
import fs from "fs";
import videoRoutes from "./routes/videoRoutes";
import { PORT, VIDEO_FOLDER, ENV_PORT } from "./config";
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

const startPort = ENV_PORT || PORT;

function tryListen(port: number, attemptsLeft = 3) {
  const server = app.listen(port, () => {
    logger.info(`视频服务器已启动，访问地址: http://localhost:${port}`);
    logger.info([`正在共享文件夹:`, VIDEO_FOLDER]);
    logger.info([`节点版本: ${process.version}，进程 PID:`, String(process.pid)]);
  });

  server.on('error', (err: any) => {
    logger.error(['【server】 error', err]);
    if (err && err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      const nextPort = port + 1;
      logger.info([`【server】 端口 ${port} 被占用，尝试下一个端口 ${nextPort}`]);
      setTimeout(() => tryListen(nextPort, attemptsLeft - 1), 200);
    }
  });

  server.on('listening', () => {
    try {
      logger.info(['【server】 listening event, address=', JSON.stringify(server.address())]);
    } catch(e) {
      logger.info(['【server】 listening event (address read failed)']);
    }
  });

  // delayed diagnostic: check server state and active handles after short delay
  setTimeout(() => {
    try {
      logger.info(['【diagnose】 server.listening', JSON.stringify({ listening: !!(server && (server as any).listening) })]);
      try { logger.info(['【diagnose】 server.address', JSON.stringify(server.address())]); } catch(e) {}
      logger.info(['【diagnose】 active handles', JSON.stringify(summarizeHandles())]);
    } catch(e) {
      logger.error(['【diagnose】 failed', e]);
    }
  }, 200);

  return server;
}

const server = tryListen(startPort, 10);

server.on('error', (err: any) => {
  logger.error(['【server】 error', err]);
});

server.on('listening', () => {
  try {
    logger.info(['【server】 listening event, address=', JSON.stringify(server.address())]);
  } catch(e) {
    logger.info(['【server】 listening event (address read failed)']);
  }
});

// delayed diagnostic: check server state and active handles after short delay
setTimeout(() => {
  try {
    logger.info(['【diagnose】 server.listening', JSON.stringify({ listening: !!(server && (server as any).listening) })]);
    try { logger.info(['【diagnose】 server.address', JSON.stringify(server.address())]); } catch(e) {}
    logger.info(['【diagnose】 active handles', JSON.stringify(summarizeHandles())]);
  } catch(e) {
    logger.error(['【diagnose】 failed', e]);
  }
}, 200);

function summarizeHandles() {
  try {
    // @ts-ignore internal API for debugging
    const handles = (process as any)._getActiveHandles ? (process as any)._getActiveHandles() : [];
    const requests = (process as any)._getActiveRequests ? (process as any)._getActiveRequests() : [];
    return {
      handlesCount: handles.length,
      requestsCount: requests.length,
      handles: handles.map((h: any) => {
        try { return h && h.constructor && h.constructor.name } catch(e){ return String(h); }
      }),
    };
  } catch(e) {
    return { handlesCount: -1, requestsCount: -1 };
  }
}

// Debug helpers: log unexpected exits so we can diagnose sudden shutdowns
process.on('uncaughtException', (err) => {
  logger.error(['【进程】 未捕获异常，进程即将退出', err]);
  // give logger a moment then exit
  logger.info(['【进程】 当前活动句柄/请求：', JSON.stringify(summarizeHandles())]);
  setTimeout(() => process.exit(1), 100);
});

process.on('unhandledRejection', (reason) => {
  logger.error(['【进程】 未处理的 Promise 拒绝', reason as any]);
  logger.info(['【进程】 当前活动句柄/请求：', JSON.stringify(summarizeHandles())]);
});

process.on('beforeExit', (code) => {
  logger.info([`【进程】 beforeExit code=${code}`]);
  logger.info(['【进程】 server listening?', JSON.stringify({ listening: !!(server && (server as any).listening) })]);
  logger.info(['【进程】 当前活动句柄/请求：', JSON.stringify(summarizeHandles())]);
});

process.on('exit', (code) => {
  logger.info([`【进程】 exit code=${code}`]);
  logger.info(['【进程】 server listening?', JSON.stringify({ listening: !!(server && (server as any).listening) })]);
  logger.info(['【进程】 当前活动句柄/请求：', JSON.stringify(summarizeHandles())]);
});

['SIGINT','SIGTERM','SIGHUP'].forEach(sig => {
  process.on(sig as NodeJS.Signals, () => {
    logger.info(`【进程】 收到信号 ${sig}，准备退出`);
    process.exit(0);
  });
});
