# LocalShare — Documentation / 文档

## 概要 / Overview

LocalShare 是一个用 TypeScript 编写的轻量级本地视频共享与流媒体服务，目标是在局域网或本地机器上快速搭建一个浏览与播放视频的页面。

LocalShare is a lightweight local video sharing and streaming service written in TypeScript. It's designed to quickly expose a local folder as a browsable video library with streaming support.

---

## 运行与调试 / Running & Debugging

1. 安装依赖：`npm install`
2. 开发运行：`npm run dev`（使用 `tsx` 直接运行 `app.ts`）
3. 生产构建：`npm run build` -> `npm run start`

配置文件：`config.ts` 包含 `PORT` 与 `VIDEO_FOLDER`。在部署前请修改 `VIDEO_FOLDER` 指向你的媒体目录。

---

## 路由与 API / Routes & API

本服务主要以 HTML 页面为主，下面列出对外的 HTTP 接口：

- GET /

  - 描述：渲染并返回根目录下的文件夹与视频文件的列表页面（HTML）。
  - 返回：HTML 页面（Content-Type: text/html）。

- GET /video/\*

  - 描述：对指定的视频文件进行流式响应，支持 Range（分段）请求。
  - 参数：URL path 后续部分为文件相对路径（相对于 `VIDEO_FOLDER`）。例如：`/video/my.mp4` 或 `/video/sub/folder/my.mp4`。
  - 成功返回：
    - 若请求包含 Range 头：返回 206 Partial Content，带 Content-Range、Accept-Ranges、Content-Length 和正确的 Content-Type（参见 `utils/mime.ts`）。
    - 若无 Range：返回 200 OK，Content-Length 和 Content-Type。
  - 错误情况：
    - 403 如果路径越界（检测到尝试访问 VIDEO_FOLDER 之外的路径）
    - 404 如果文件不存在或无法访问

- GET /folder/\*
  - 描述：渲染并返回指定子目录下的文件夹与视频文件（HTML）。
  - 参数：URL path 后续部分为子目录相对路径。
  - 返回：HTML 页面列出子目录中的子文件夹与支持的视频文件。
  - 错误：403 路径越界，500 读取目录失败。

示例（curl）:

部分请求（Range）:

```bash
curl -H "Range: bytes=0-1023" -v http://localhost:3000/video/sample.mp4
```

获取目录页面:

```bash
curl -v http://localhost:3000/folder/subfolder
```

---

## 关键实现细节 / Key implementation details

- 模板渲染器：`utils/template.ts` 会尝试在若干候选路径中加载 `views/videoList.html` 并缓存模板字符串，然后通过简单的占位符替换输出最终 HTML。
- MIME 类型：`utils/mime.ts` 包含视频扩展名到 Content-Type 的映射，用于设置响应头。
- 断点续传（Range）：在 `controllers/videoController.ts` 中处理 `Range` 头，解析 start/end，使用 `fs.createReadStream` 创建分段流并返回 206 响应。
- 路径安全：通过 `VideoController.isPathSafe`（基于 path.resolve）防止路径穿越（path traversal），若检测到越界会返回 403。
- 缓存：`getVideoList` 使用简单的全局缓存（`global.__videoListCache`）缓存生成的 HTML，缓存时间为 5 秒以减少频繁的文件系统访问。

---

## 数据形状与错误模式 / Data shapes & error modes

- HTML 输出没有结构化 JSON API；页面上的视频与文件夹项是直接渲染的 HTML 片段。
- 错误处理：
  - 500 系列：文件系统读取失败（如权限问题或磁盘错误）
  - 404：请求的视频文件未找到或读取失败
  - 403：路径越界检测触发

在可能的边界场景下，请考虑：

- 空目录：页面将渲染无视频项与无文件夹项的空视图
- 超大文件：Range 支持能减小单次传输大小，但仍需关注服务器带宽与并发
- 非支持格式：若文件后缀不在 `utils/mime.ts` 列表中，会使用 `application/octet-stream` 作为 Content-Type

---

## 常见问题 / FAQ

Q: 如何修改视频根目录？
A: 编辑 `config.ts` 中的 `VIDEO_FOLDER`，或把它改为从环境变量读取（推荐）。

Q: 如何在局域网内其他设备访问？
A: 确保服务器机器允许入站连接（防火墙放行），并使用机器 IP 和端口例如 `http://192.168.1.100:3000/`。若需要公网访问，请使用反向代理或隧道服务。

Q: 为什么某些视频无法播放？
A: 可能是浏览器不支持对应编码，或文件损坏，或 Content-Type 不正确。可在 `utils/mime.ts` 中确认扩展名是否已映射，或将文件转码为更通用的容器/编码（例如 MP4 + H.264/AAC）。

---

## 部署建议 / Deployment recommendations

- 通过 PM2 或 systemd 运行生产进程
- 使用 Nginx / Caddy 做反向代理、TLS 终止和访问控制
- 将 `VIDEO_FOLDER` 指向一个只读路径或受限用户以减少风险

---

## 开发者提示 / Developer tips

- 若要添加 API 返回 JSON（例如文件列表 JSON），可以在 `controllers/videoController.ts` 中增加一个 query 参数或单独路由来返回结构化数据。
- 如果需要认证，建议在 `app.ts` 的中间件链上添加认证中间件，并在模板中显示登录/登出链接。

---

## 文件清单 / Key files

- `app.ts` — 启动与中间件
- `config.ts` — 配置（端口、视频目录）
- `controllers/videoController.ts` — 路由处理与流媒体逻辑
- `routes/videoRoutes.ts` — 路由定义
- `utils/mime.ts` — 扩展名到 Content-Type 的映射
- `utils/template.ts` — 模板加载与渲染
- `views/videoList.html` — HTML 模板
