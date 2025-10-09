# LocalShare — 本地视频共享

## 简介

LocalShare 是一个极简的本地视频共享与在线播放服务。把一个本地文件夹作为视频库，浏览文件夹并在线播放支持的媒体格式。项目使用 Express + TypeScript 编写，包含简单的模板渲染、视频断点续传（Range）以及基础安全检查（防止路径越界）。

## Quick summary

LocalShare is a minimal local video sharing and streaming service. It exposes a folder as a video library, lets you browse folders and play supported video files in the browser. Built with Express + TypeScript. Features include server-side HTML rendering, HTTP Range streaming, and basic path-safety checks.

---

## 特性 / Features

- 浏览根目录与子文件夹（目录视图）
- 支持视频流（包含 Range 响应，适配浏览器/播放器）
- 模板渲染首页与目录页（`views/videoList.html`）
- 简单的请求日志与压缩（compression + cors）

---

## 快速开始 / Quick start

先确保已安装 Node.js 与 npm/yarn。项目使用 TypeScript。

安装依赖:

```bash
npm install
```

开发:

```bash
npm run dev
```

生产：先构建然后启动分发目录

```bash
npm run build
npm run start
```

脚本:

- `dev` — 使用 `npx tsx app.ts` 直接运行 TypeScript
- `build` — `tsc`，把 TypeScript 编译到 `dist/`
- `start` — `node dist/app.js`，启动已编译的应用

---

## 配置 / Configuration

默认配置位于 `config.ts`：

- 默认端口: `PORT = 3000`
- 默认视频目录: `VIDEO_FOLDER`（默认为开发机上的一个路径，建议修改为你的媒体目录）

请根据需要编辑 `config.ts` 来指定你要共享的视频文件夹或更改端口。

---

## 路由概览 / Routes

- `GET /` — 首页（渲染 HTML，列出根目录下的文件夹与视频文件）
- `GET /video/*` — 视频流（支持 HTTP Range，用于播放器与浏览器按需加载）
- `GET /folder/*` — 浏览子文件夹（渲染目录页）

示例：在浏览器打开 `http://localhost:3000/` 查看界面。

---

## 支持的视频扩展名 / Supported extensions

mp4, mkv, avi, mov, webm, flv, wmv, m4v, ts, mpeg, mpg, mts, m2ts

（MIME 映射在 `utils/mime.ts` 中）

---

## 测试视频流（curl 示例）

请求视频的部分内容（Range 请求示例）：

```bash
curl -H "Range: bytes=0-1023" -v http://localhost:3000/video/your-video.mp4
```

完整流（非分段）:

```bash
curl -v http://localhost:3000/video/your-video.mp4
```

---

## 注意事项 / Notes

- `config.ts` 中的 `VIDEO_FOLDER` 默认为一个硬编码路径，请务必修改为你实际的媒体目录，或在部署前将其指向正确位置。
- 服务包含基本的路径安全检查（防止越界访问），但不要将敏感目录指向该服务的共享根目录。
- 若需要外网访问，请通过反向代理（nginx/Caddy）或为 Node 进程配置更完善的安全和认证措施。
