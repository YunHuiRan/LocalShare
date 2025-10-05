一、架构概览

- 技术栈：Node.js + Express + TypeScript
- 功能：将本地目录视频生成 HTML 列表并通过 HTTP 提供 Range 支持的流式传输
- 缓存：
  - 模板缓存（内存，首次加载后缓存，进程生命周期内有效）
  - 视频列表页面短期缓存（内存，TTL = 5s，可调整）

二、重要模块说明

1. `app.ts`

- 启用 gzip 压缩（compression）和 CORS
- 挂载 `routes/videoRoutes.ts`

2. `controllers/videoController.ts`

- `getVideoList(req, res)`：读取目录、生成视频条目 HTML、调用模板渲染、返回页面。包含短期缓存（全局变量 `__videoListCache`），缓存 TTL 节点代码处为 5 秒。
- `streamVideo(req, res)`：处理 `/video/:filename`，先做路径安全校验，检查文件并响应 Range 或完整流。输出流打开/关闭日志，记录文件大小与 range 参数。

3. `utils/template.ts`

- `renderVideoListPage(videoItems, folderPath)`：使用 `views/videoList.html` 模板并替换占位符，模板首次加载后缓存。

4. `utils/mime.ts`、`utils/file.ts`

- `getMimeType(filename)`：返回视频 MIME 类型
- `getVideoFiles(folder)`：列出视频文件（后缀过滤）

三、日志与指标（如何用日志定位“首次打开慢”）

关键日志前缀：

- 【请求】：记录所有请求（方法、URL、状态、耗时、UA），可直接看到首个请求耗时
- 【模板】：模板是否从磁盘加载（首次）或使用缓存
- 【目录】：目录读取时长与条目数量
- 【缓存】：页面缓存命中
- 【流】：stream 打开/关闭、Range 请求详情
- 【错误】：捕获异常与堆栈

排查流程（首次打开慢）

1. 观察首次访问日志：是否包含 `【模板】 从磁盘加载模板` 或 `【目录】 读取视频目录`；如果这些耗时很长，问题在服务端 I/O。
2. 若服务端耗时很短，但页面仍然白屏，检查浏览器控制台与网络面板：是否 Blocked 在外部 CSS/字体（Tailwind/FontAwesome）上？若是，把它们本地化或内联 critical CSS。
3. 在移动网络下测试：测量 HTML 大小和响应时间；若传输慢但服务器生成快，启用/验证 gzip 是否生效（响应头 Content-Encoding）。
4. 视频播放首帧慢：播放器会在获取到 Range 后加载播放，若第一次 Range 请求慢，检查流日志（【流】）和网络链路。

四、性能调优建议（优先级）

1. 本地化静态依赖（Tailwind/FontAwesome）——最大程度减少第三方网络阻塞
2. 设定 Cache-Control/ETag：让浏览器缓存首页与静态资源
3. 长期部署使用 nginx 反向代理：静态资源缓存、gzip、TLS、HTTP/2
4. 若目录非常大：实现分页或服务端索引任务（定时扫描并缓存索引）
5. 将日志改为结构化 JSON 并接入日志收集（ELK/Vector/Promtail）以做聚合分析

五、运行与测试示例

安装与启动：

```bash
npm install
npx tsx app.ts
```

在服务器上测试（示例）：

```bash
# 首次访问（模拟移动 UA）
curl -i -H "User-Agent: Mobile-Test" http://192.168.1.1:3000/

# 请求 Range（前 1MB）
curl -i -H "Range: bytes=0-999999" http://192.168.1.1:3000/video/示例.mp4
```

查看日志：服务端控制台将包含中文日志行，注意首次访问的 `【模板】` / `【目录】` 输出与 `【请求】` 耗时。

六、部署建议

- 生产建议：使用 PM2 或 systemd 管理进程；放在内网时使用 nginx 做反向代理与 TLS；如果对外提供服务，考虑 CDN 做静态资源分发。
- Docker：可将项目打包到基于 node 的镜像，并将 `VIDEO_FOLDER` 作为卷挂载。

七、配置项

- `config.ts`：
  - `PORT`：服务监听端口
  - `VIDEO_FOLDER`：视频所在绝对路径