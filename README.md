# LocalShare 视频共享服务

一个基于 Express 的轻量视频共享服务（TypeScript）。该服务把本地目录里的视频文件以网页形式列出并支持按需视频流，适用于在局域网或单机场景下快速共享视频。

主要特性

- 列表页渲染（服务器端渲染 HTML）
- 支持断点/按需播放（HTTP Range）
- 简单内存缓存：模板缓存与短期页面缓存，减少磁盘 I/O
- 启用 gzip 压缩以减少移动端传输开销

目录结构（关键文件）

```
app.ts                     # 服务器入口
config.ts                  # 配置（端口、视频目录）
controllers/               # 控制器（请求处理逻辑）
  videoController.ts
routes/                    # 路由定义
  videoRoutes.ts
utils/                     # 工具函数（模板、mime、文件操作）
views/                     # HTML 模板
  videoList.html
package.json
README.md
docs/DOCUMENTATION.md      # 项目详细文档
```

快速开始

1. 系统依赖

- Node.js v18+
- npm

2. 安装依赖

```bash
npm install
npm install --save-dev @types/compression
```

3. 配置

- 编辑 `config.ts`，设置 `VIDEO_FOLDER` 指向你的本地视频目录（绝对路径），确认 `PORT`。

4. 启动服务

```bash
npx tsx app.ts
```

5. 用手机或浏览器访问

http://<服务器 IP>:<PORT>/

示例：

```
http://192.168.1.1:3000/
```

API 与页面

- GET / -> 视频列表页面（HTML）
- GET /video/:filename -> 视频文件（支持 Range 请求）

```bash
# 模拟手机 UA 的首次请求
curl -i -H "User-Agent: Mobile-Test" http://localhost:3000/

# 请求视频第一段（Range）
curl -i -H "Range: bytes=0-999999" http://localhost:3000/video/%E4%BE%8B%E5%AD%90.mp4
```
