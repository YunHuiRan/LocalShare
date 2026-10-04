# LocalShare

把电脑上的电影、剧集、漫画、音乐通过局域网共享给手机/平板浏览器播放的轻量服务器。

## 打包成 exe（目标电脑无需安装 Node.js）

```bash
npm install
npm run build:exe
```

构建完成后可执行文件位于 **`dist/LocalShare.exe`**（单文件，约 40~50MB）。

把 `LocalShare.exe` 复制到任意 Windows 电脑，双击运行：

1. 自动弹出系统「选择文件夹」窗口，选择要共享的目录（例如 `D:\电影`）；
2. 控制台会显示访问地址：
   - 本机访问：`http://localhost:3000`
   - 局域网访问：`http://192.168.x.x:3000`（手机/平板用这个）
3. 手机与电脑连接同一个 Wi-Fi/局域网，用浏览器打开局域网地址即可。

## 指定共享目录的其他方式

解析优先级：**命令行参数 > 环境变量 > 文件夹选择窗口 > `config.ts` 默认值**

```bat
:: 方式一：命令行参数（可写多个，用空格分隔，路径存在才会生效）
LocalShare.exe "D:\电影" "E:\漫画"

:: 方式二：环境变量（多个用分号分隔）
set SHARE_DIR=D:\电影;E:\漫画
LocalShare.exe

:: 方式三：跳过弹窗、直接使用 config.ts 中的默认目录（自动化/调试用）
set NO_PICKER=1
LocalShare.exe
```

## 开发调试

```bash
npm run dev     # 用 tsx 直接运行 app.ts（同样会弹出文件夹选择窗口）
npm run build   # TypeScript 编译到 dist
npm start       # 运行编译结果 dist/app.js
```

## 说明

- 默认端口 `3000`，被占用时会自动依次尝试 `3001`、`3002`……（最多 10 次）。
- 日志级别可用环境变量 `LOG_LEVEL` 调整：`debug` / `info` / `warn` / `error`。
- 所有列表（首页、文件夹页、漫画图集、音频歌单）统一按**创建时间从新到旧**排序。
- 打包使用 `pkg`，目标平台 `node18-win-x64`；`views/*.html` 模板通过 `package.json`
  中的 `pkg.assets` 内嵌进 exe（构建脚本会先把 `views/` 复制到 `dist/views/`）。
  注意：`pkg` 只会在「入口文件所在目录」查找配置文件，入口是 `dist/app.js` 时读不到
  项目根目录 `package.json` 里的 `pkg` 字段，因此构建命令必须显式带上
  `--config package.json`，否则模板不会被打包进去（页面会报 500 template not found）。
- 文件夹选择窗口通过 PowerShell 调用 .NET 的 `FolderBrowserDialog` 实现，
  不依赖任何第三方原生模块。
