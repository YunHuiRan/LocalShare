# LocalShare · 局域网媒体共享服务

**简体中文** | [English](README_EN.md)

> 用 TypeScript + Express 实现的轻量级局域网媒体服务器：在电脑上选一个文件夹，手机 / 平板 / 电视用浏览器即可在线播放里面的电影、剧集、漫画和音乐。
> 支持打包成**单文件 exe**，在没有安装 Node.js 的 Windows 电脑上双击即用；文件不出局域网、不上传、不转码。

`TypeScript` · `Node.js` · `Express 5` · `HTTP Range` · `单文件分发`

---

## 目录

- [一、项目背景](#一项目背景)
- [二、功能特性](#二功能特性)
- [三、技术栈](#三技术栈)
- [四、系统架构](#四系统架构)
- [五、目录结构](#五目录结构)
- [六、快速开始](#六快速开始)
- [七、共享目录的四种指定方式](#七共享目录的四种指定方式)
- [八、HTTP 接口一览](#八http-接口一览)
- [九、关键技术实现](#九关键技术实现)
- [十、性能与可靠性设计](#十性能与可靠性设计)
- [十一、可扩展方向](#十一可扩展方向)
- [十二、开发约定](#十二开发约定)

## 一、项目背景

**要解决的问题**：电脑里存着大量电影、剧集、漫画、无损音乐，想躺着用手机 / 平板看，但

- 拷贝到手机：占空间、传输慢、看完还要删；
- 网盘 / 流媒体：需要上传、转码、开会员，文件还会离开局域网；
- 投屏 / 第三方播放器：格式、广告、收费、隐私各种限制。

**做法**：既然手机和电脑通常连在同一个 Wi-Fi 下，直接让电脑起一个 HTTP 服务，把浏览器当播放器用即可。因此项目的核心目标是三个「零」：

| 目标 | 落地方式 |
| --- | --- |
| **零安装** | 打包成单文件 exe，目标机器不需要 Node.js、数据库或任何运行时 |
| **零上传** | 文件只走局域网，服务端直读磁盘原始文件流式下发，不转码、不留副本 |
| **零学习成本** | 双击 → 选文件夹 → 控制台给出访问地址，手机输入网址即可；视频 / 漫画 / 音乐统一入口 |

## 二、功能特性

### 2.1 媒体浏览与播放

- **视频播放**：服务端实现 HTTP `Range` 分段传输（`206 Partial Content`），拖动进度条即时跳转，无需等待整个文件下载。
- **漫画阅读**：把一个目录里的图片当作一本「书」，支持鼠标点击左右区域、键盘方向键、移动端左右滑动三种翻页方式，并自动预加载相邻页。
- **音乐播放**：网页播放列表，自动连播下一首、用 `localStorage` 记住每首的上次播放进度、播放中申请 Wake Lock 防止手机熄屏、空格 / 方向键快捷控制。
- **智能首页**：自动识别目录内容——纯图片目录渲染成带缩略图的「漫画」卡片，其余显示文件夹 / 视频 / 音频卡片；没有内容时不渲染空区块。
- **统一排序**：所有列表按**文件创建时间从新到旧**排列（`birthtime` 不支持时回退 `mtime`），时间相同时按名称自然排序（`1、2、10` 而非 `1、10、2`）。

### 2.2 使用体验

- **一键选目录**：双击 exe 自动弹出 Windows 系统「选择文件夹」对话框。
- **多根目录共享**：可同时共享多个磁盘 / 目录，首页展示各根目录，并以「根目录名」作为 URL 前缀区分（如 `/folder/电影/2024`）；旧版单根链接仍然兼容。
- **端口占用自动顺延**：默认 `3000`，被占用时自动尝试 `3001`、`3002`……
- **启动即给地址**：自动枚举所有网卡的非内网 IPv4，控制台直接打印 `http://192.168.x.x:3000`，手机照着输入。
- **中文路径友好**：`Content-Disposition` 按 RFC 5987 编码，中文文件名不会乱码。

### 2.3 工程与健壮性

- **纯 TypeScript**：`strict` 模式，`controllers / routes / utils / views` 分层，类型与 JSDoc 注释完整。
- **依赖极少**：运行期只依赖 `express`、`cors`、`compression`；模板引擎、数据库、原生模块一律不用。
- **路径遍历防护**：所有由 URL 拼出的路径都会 `path.resolve` 后校验是否落在共享根目录内，越界直接 `403`。
- **缓存与条件请求**：`ETag` / `Last-Modified`（命中返回 `304`）、图片 `Cache-Control: max-age=86400`、其余 `60`、首页 HTML 5 秒内存缓存。
- **Gzip 智能旁路**：对 `/video/`、`/watch/` 以及携带 `Range` 的请求关闭压缩，避免破坏媒体流。
- **分级日志**：`debug / info / warn / error` 四级，含请求耗时与 UA，可通过 `LOG_LEVEL` 环境变量控制。
- **中英文控制台**：启动时检测系统语言（`LOCALSHARE_LANG` > `LC_ALL` / `LANG` > ICU 区域），非中文环境自动切换为英文日志，中文环境保持原文案。

## 三、技术栈

| 分类 | 选型 | 说明 |
| --- | --- | --- |
| 语言 | TypeScript 5.9 | `strict`、`target: ES2022`、`module: NodeNext` |
| 运行时 | Node.js 18+ | pkg 打包目标 `node18-win-x64` |
| Web 框架 | Express 5 | 路由 + 中间件 |
| 中间件 | `cors`、`compression` | 跨域、gzip（媒体流自动旁路） |
| 前端 | 原生 HTML / JS | 无框架、无构建步骤；TailwindCSS CDN + Font Awesome |
| 开发工具 | `tsx` | 直接运行 `.ts`，无需先编译 |
| 打包分发 | `pkg` | 单文件 exe，`views/*.html` 通过 `pkg.assets` 内嵌 |
| 测试 | — | 暂未引入自动化测试（见「可扩展方向」） |

## 四、系统架构

### 4.1 分层结构

```
浏览器（手机 / 平板 / PC）
        │  HTTP
        ▼
┌───────────────────────────────────────────────┐
│ app.ts            启动流程 / 中间件 / 端口监听  │
│   ├─ compression   gzip（媒体流旁路）           │
│   ├─ cors          跨域                        │
│   └─ 请求日志       方法 / URL / 状态码 / 耗时   │
├───────────────────────────────────────────────┤
│ routes/videoRoutes.ts    URL → Controller      │
├───────────────────────────────────────────────┤
│ controllers/videoController.ts                 │
│   列表页 / 视频流 / 播放页 / 漫画 / 音频 / 目录  │
├───────────────────────────────────────────────┤
│ utils/                                         │
│   mime          扩展名 → MIME + 类型判定        │
│   template      模板加载与占位符渲染            │
│   shareFolders  共享目录解析（参数/环境变量/弹窗）│
│   folderPicker  系统「选择文件夹」对话框         │
│   logger        分级日志                        │
│   file          文件存在性 / 视频文件枚举        │
└───────────────────────────────────────────────┘
        │
        ▼
   本地磁盘（一个或多个共享根目录）
```

### 4.2 启动流程

```
node dist/app.js  /  LocalShare.exe
        │
        ├─ 1. resolveSharedFolders()
        │      命令行参数 > 环境变量 > 图形选择窗口 > config.ts 默认值
        │      （用户取消弹窗 → 打印提示并退出）
        ├─ 2. videoController.setVideoFolders(...)   注入本次要共享的目录
        ├─ 3. 确保每个共享目录存在（不存在则递归创建）
        ├─ 4. 装载中间件并挂载路由
        └─ 5. tryListen(PORT, 10)
               EADDRINUSE → 端口 +1 重试（最多 10 次）
               成功后打印本机 / 局域网访问地址
```

> 端口被占用时，Windows 上可能先触发 `listening` 再触发 `error`，所以启动横幅延迟 `300ms` 打印，避免显示一个实际没有在使用的端口。

## 五、目录结构

```
LocalShare/
├─ app.ts                     # 入口：参数解析、中间件、端口监听与启动信息
├─ config.ts                  # 端口与默认共享目录配置
├─ routes/
│  └─ videoRoutes.ts          # 路由表（正则捕获子路径）
├─ controllers/
│  └─ videoController.ts      # 核心控制器（列表 / 视频流 / 漫画 / 音频 / 目录）
├─ utils/
│  ├─ mime.ts                 # 扩展名 ↔ MIME，支持类型枚举与判定
│  ├─ template.ts             # HTML 模板加载（多候选路径 + 缓存）与渲染
│  ├─ shareFolders.ts         # 共享目录解析（命令行 / 环境变量 / 弹窗 / 默认）
│  ├─ folderPicker.ts         # PowerShell 调起系统「选择文件夹」对话框
│  ├─ logger.ts               # 四级日志
│  ├─ i18n.ts                 # 控制台语言检测与中英文案
│  └─ file.ts                 # 文件存在性、视频文件枚举
├─ views/
│  ├─ baseTemplate.html       # 首页 / 目录页模板（{{videoItems}} 等占位符）
│  ├─ video.html              # 视频播放器页
│  ├─ comic.html              # 漫画阅读器页
│  └─ audio.html              # 音频播放器页
├─ package.json               # 脚本 + pkg 打包配置（pkg.assets）
├─ tsconfig.json
└─ dist/                      # 编译产物与 LocalShare.exe
```

## 六、快速开始

### 6.1 环境要求

- Node.js 18 及以上（开发 / 构建）
- Windows 10 / 11（图形选目录、打包 exe 依赖 Windows；核心 HTTP 服务本身跨平台）

### 6.2 开发调试

```bash
npm install

npm run dev     # tsx 直接运行 app.ts（会弹出文件夹选择窗口）
npm run build   # tsc 编译到 dist/
npm start       # 运行编译产物 node dist/app.js
```

### 6.3 打包单文件 exe（目标机器无需 Node.js）

```bash
npm run build:exe
```

构建脚本做三件事：`tsc` 编译 → 把 `views/` 复制到 `dist/views/` → `pkg` 打包为 `dist/LocalShare.exe`（单文件，约 40–50MB）。

把 exe 拷到任意 Windows 电脑双击：

1. 弹出系统「选择文件夹」窗口，选择要共享的目录（例如 `D:\电影`）；
2. 控制台打印访问地址：
   - 本机：`http://localhost:3000`
   - 局域网：`http://192.168.x.x:3000` ← **手机 / 平板用这个**
3. 手机连接同一个 Wi-Fi，用浏览器打开局域网地址即可。

> **打包要点**：`pkg` 只会在「入口文件所在目录」查找配置文件。入口是 `dist/app.js` 时读不到项目根目录 `package.json` 里的 `pkg` 字段，因此命令必须显式带 `--config package.json`，否则 HTML 模板不会被打进 exe，页面会报 `500 template not found`。

## 七、共享目录的四种指定方式

解析优先级：**命令行参数 > 环境变量 > 图形选择窗口 > `config.ts` 默认值**

```bat
:: 1. 命令行参数（可多个，用空格分隔；路径必须真实存在且为目录才生效）
LocalShare.exe "D:\电影" "E:\漫画"

:: 2. 环境变量（多个用分号分隔；SHARE_DIR 与 SHARE_DIRS 等价）
set SHARE_DIR=D:\电影;E:\漫画
LocalShare.exe

:: 3. 跳过弹窗，直接使用 config.ts 中的默认目录（自动化 / 调试）
set NO_PICKER=1
LocalShare.exe

:: 4. 什么都不传 → 自动弹出「选择文件夹」窗口
LocalShare.exe
```

| 环境变量 | 作用 |
| --- | --- |
| `SHARE_DIR` / `SHARE_DIRS` | 指定共享目录，多个用 `;` 分隔 |
| `NO_PICKER=1` | 跳过文件夹选择弹窗 |
| `LOG_LEVEL` | 日志级别：`debug`（默认）/ `info` / `warn` / `error` |
| `LOCALSHARE_LANG` | 强制控制台语言：`zh` / `en`；不设置时按系统语言自动判断（也可用 `LOCALSHARE_LANGUAGE`） |

默认端口与默认共享目录可在 `config.ts` 中修改：

```ts
export const PORT: number = 3000;
export const VIDEO_FOLDERS: string[] = ["F:\\video"]; // 支持配置多个根目录
```

## 八、HTTP 接口一览

全部为 `GET` 请求；路径中的文件 / 目录名统一 `encodeURIComponent` 编码，服务端 `decodeURIComponent` 还原，对中文、空格、`#` 等特殊字符安全。

| 路由 | 处理函数 | 说明 |
| --- | --- | --- |
| `GET /` | `getVideoList` | 首页。单根：列出该目录内容；多根：列出各根目录入口。带 5 秒内存缓存 |
| `GET /folder/*` | `getFolderList` | 目录浏览页，含面包屑导航、文件夹卡片（纯图片目录显示封面）与文件卡片 |
| `GET /watch/*` | `watch` | 视频播放页（内嵌 `<video>`）；若目标是目录 / 图片 / 音频，会 302 到对应页面 |
| `GET /video/*` | `streamVideo` | **媒体文件流**。支持 `Range`（206）与条件请求（304），图片 / 音频 / 视频共用 |
| `GET /comic/*` | `comicViewer` | 漫画阅读页：目录 → 整目录图片成集；单图 → 以所在目录成集并从该页开始 |
| `GET /audio/*` | `audioPlayer` | 音频播放页：目录 → 整目录音频成歌单；单曲 → 以所在目录成歌单并从该曲开始 |

**接口约定**：`/video/` 不只服务视频，漫画图片和音频也复用它——一套流式逻辑同时获得 Range 与缓存能力，前端播放器 / 阅读器直接引用即可。

**URL 命名空间**：多根模式下第一条路径段是「根目录名」，例如共享根为 `D:\电影`、`E:\漫画` 时：

```
/folder/电影          → D:\电影
/folder/电影/2024     → D:\电影\2024
/video/电影/2024/a.mp4 → D:\电影\2024\a.mp4
```

## 九、关键技术实现

> 这一节是面试时可以展开讲的部分。

### 9.1 HTTP Range 分段传输（视频「秒开、可拖拽」）

`streamVideo` 自行解析 `Range: bytes=start-end` 请求头：

- 有 `Range` → `createReadStream(path, { start, end })`，返回 `206`，携带 `Content-Range`、`Content-Length`、`Accept-Ranges: bytes`；
- 无 `Range` → 返回 `200` 全量流，同样声明 `Accept-Ranges`，让浏览器后续可以发起分段请求；
- 未写 `end` 时默认取 `fileSize - 1`，兼容 `bytes=0-` 这种常见写法。

这样播放器只需要请求需要的那一段字节，拖动进度条时立即发起新的 Range 请求，无需等待整个文件下载，内存占用与文件大小解耦。

### 9.2 条件请求与分级缓存

- 依据 `size + mtimeMs` 生成弱 `ETag`，同时返回 `Last-Modified`；
- 命中 `If-None-Match` 或 `If-Modified-Since` 时返回 `304` 且不带响应体，省掉重复传输；
- `Cache-Control`：图片 `max-age=86400`（漫画翻页、缩略图命中缓存后无需再请求服务器），其他资源 `max-age=60`；
- 首页 HTML 额外做 5 秒进程内缓存，避免频繁读盘。

### 9.3 多根目录的路由映射与向后兼容

URL 里没有天然的「磁盘」概念，方案是用**根目录名作为命名空间**：

1. `resolveBaseAndRel(subPath)`：取路径第一段与各根目录的 `basename` 比较，命中则把剩余部分作为相对路径；
2. 只配置一个根时，整段路径都当作相对路径，行为与单根版本完全一致；
3. 多根且第一段没匹配上时，`asyncResolveBaseAndRel` 会依次在每个根下 `fs.stat` 探测该相对路径，命中即采用——**让升级前生成的老链接继续可用**。

### 9.4 安全：路径遍历防护与响应头净化

- `isPathSafe(base, target)`：两侧都 `path.resolve` 后比较，拦截 `../../` 式的目录穿越；
- 所有涉及文件读取的路由（媒体流、播放页、漫画、音频、目录）在读盘前都会先做该校验，越界返回 `403`；
- `Content-Disposition` 先剔除控制字符与引号，再按 RFC 5987 提供 `filename*=UTF-8''...`，兼顾兼容性与中文文件名。

### 9.5 不引入模板引擎的页面渲染

`template.ts` 只做两件事：从候选路径依次尝试读取模板文件并缓存，再用 `replace` 替换 `{{占位符}}`：

- 候选路径覆盖三种运行形态：编译产物旁（`__dirname/../views`）、项目根（`cwd/views`）、pkg 内嵌（`cwd/dist/views`）；
- 首页模板 `baseTemplate.html` 读一次即缓存，后续请求零磁盘 IO。

好处是没有额外依赖、打包友好、模板可被直接修改；代价是需自行处理输出转义等注入问题。

### 9.6 打包与「零依赖运行」

- `pkg` 把 Node 运行时 + 编译后的 JS + 内嵌资源压成一个 exe（目标 `node18-win-x64`），双击即用；
- `views/*.html` 通过 `package.json` 的 `pkg.assets` 声明为内嵌资源，构建时先复制到 `dist/views/`；
- 因 `pkg` 找配置文件只看入口所在目录，构建脚本显式带 `--config package.json`。

### 9.7 系统「选择文件夹」窗口

需求是「双击 exe 就能选目录」，但又不能引入原生模块（会破坏单文件打包）。做法是用 PowerShell 调用 .NET：

- `spawnSync` 启动 `powershell.exe -NoProfile -STA -ExecutionPolicy Bypass`（`-STA` 是 WinForms 对话框必需）；
- 脚本内使用 `System.Windows.Forms.FolderBrowserDialog`；
- 结果**写进临时文件**（UTF-8 无 BOM）而不是走标准输出，规避 Windows 控制台代码页导致的中文路径乱码；
- 拿不到 `powershell.exe` 时回退到系统绝对路径（应对 PATH 被裁剪的环境）；
- 设置 5 分钟超时、`windowsHide`，并在 `finally` 中保证临时文件被清理。

### 9.8 列表排序：创建时间倒序 + 自然排序

新增媒体通常最想看，所以按 `birthtimeMs` 倒序；部分文件系统无创建时间则回退 `mtimeMs`；时间相同（批量复制很常见）时用 `localeCompare(..., { numeric: true })` 做自然排序，保证 `第2集` 排在 `第10集` 前面。

### 9.9 启动健壮性

- 端口占用时按 +1 自动重试（最多 10 次），避免与已运行的实例冲突；
- 启动横幅延迟 300ms 打印，规避 Windows 上 `listening` 早于 `error` 触发导致的「假端口」提示；
- 双击运行时若报错退出，`pauseBeforeExit()` 在 `stdin` 为 TTY 时执行 `pause`，防止窗口一闪而过；脚本 / 管道场景则直接退出，不阻塞自动化。

### 9.10 控制台语言自动检测

`utils/i18n.ts` 在模块加载时完成一次语言探测，之后所有日志都通过 `t("中文", "English")` 取值：

1. `LOCALSHARE_LANG` / `LOCALSHARE_LANGUAGE`（显式覆盖，便于演示与排障）；
2. `LC_ALL` / `LC_MESSAGES` / `LANG` / `LANGUAGE`（Linux / macOS 上常见）；
3. `Intl.DateTimeFormat().resolvedOptions().locale`（Windows 上取自系统区域设置）；
4. 全部无法判定时保持中文，与历史行为一致。

语言标记统一按主语言子标签归一化（`zh_CN.UTF-8` → `zh`，`en-US` → `en`），`POSIX` / `C` 视为「未指定」；非 `zh` 一律回落到英文。日志级别标签随之切换（`[信息]` / `[INFO]`）。由于中英文案写在同一个调用点，无需维护键值表，也不会出现「新增日志忘记翻译」的漏网项，启动时还会打印一行探测结果，方便确认当前生效的语言。

## 十、性能与可靠性设计

| 关注点 | 措施 |
| --- | --- |
| 大文件传输 | 流式读取 + Range 分段，内存占用与文件大小解耦 |
| 重复传输 | `ETag` / `Last-Modified` / `304` + 按类型分级的 `Cache-Control` |
| 首页开销 | 5 秒进程内 HTML 缓存，读盘次数与访问量无关 |
| 压缩开销 | 媒体流与 Range 请求跳过 gzip，避免 CPU 浪费与流损坏 |
| 漫画翻页 | 前端预加载相邻页，翻页几乎无等待 |
| 音频续播 | 每首独立 `localStorage` 进度，切歌 / 重进页面可续播 |
| 手机熄屏 | 播放时申请 Screen Wake Lock，页面重新可见时自动续租 |
| 可观测性 | 每个请求记录方法、URL、状态码、耗时、UA；日志级别可调 |

## 十一、可扩展方向

- **测试**：为 `isPathSafe`、`resolveBaseAndRel`、Range 解析、`shareFolders` 优先级补充单元测试（可用 Node 内置 `node:test`，不新增依赖），并为路由补集成测试。
- **安全**：引入可选的 Token / 口令鉴权、`path.relative` 版路径校验、模板输出转义。
- **体验**：视频续播进度、列表搜索与分页、外挂字幕（`.srt` / `.ass`）加载、服务端缩略图生成。
- **能力**：可选集成 `ffmpeg` 做按需转码 / HLS 分片，覆盖浏览器原生不支持的格式。
- **工程**：加入 ESLint / Prettier 与 CI；`pkg` 之外评估 `node --experimental-sea`、`bun build --compile` 等更新的单文件方案。

## 十二、开发约定

- **分层职责**：`routes` 只做 URL → handler 映射；`controllers` 承载业务逻辑；`utils` 提供无状态能力。
- **类型与注释**：开启 `strict`，导出成员均带 JSDoc（中文说明 + 参数 / 返回值类型）。
- **错误处理**：每个 handler 内部 `try/catch`，按语义返回 `403 / 404 / 500` 并记录 `logger.error`，避免异常泄漏到进程。
- **命名**：文件小驼峰（`shareFolders.ts`），类名大驼峰，常量全大写下划线，日志统一带 `【模块名】` 前缀便于检索。
- **提交信息**：遵循 `feat: / fix: / chore:` 前缀（见 `git log`）。

---

## 关于

- 仓库：<https://github.com/YunHuiRan/LocalShare>
- 定位：个人局域网媒体共享工具，同时是 TypeScript + Express 全链路的实践项目——涵盖路由与中间件、HTTP 流式传输与缓存协商、跨端（手机浏览器）适配、以及 `pkg` 单文件打包分发。
- 本 README 中提到的所有能力均可在代码中对应到实现（`app.ts`、`controllers/videoController.ts`、`utils/*`、`views/*`）。
