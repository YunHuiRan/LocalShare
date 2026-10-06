# LocalShare · LAN Media Sharing Server

**English** | [简体中文](README.md)

> A lightweight LAN media server built with TypeScript + Express. Pick a folder on your PC, then play the movies, TV shows, comics and music inside it from a phone, tablet or TV browser.
> It ships as a **single-file exe** that runs on Windows machines without Node.js installed — nothing is uploaded, nothing is transcoded, and files never leave your LAN.

`TypeScript` · `Node.js` · `Express 5` · `HTTP Range` · `Single-file distribution`

---

## Table of Contents

- [1. Background](#1-background)
- [2. Features](#2-features)
- [3. Tech Stack](#3-tech-stack)
- [4. Architecture](#4-architecture)
- [5. Project Structure](#5-project-structure)
- [6. Quick Start](#6-quick-start)
- [7. Specifying Shared Folders](#7-specifying-shared-folders)
- [8. HTTP API](#8-http-api)
- [9. Key Implementation Details](#9-key-implementation-details)
- [10. Performance & Reliability](#10-performance--reliability)
- [11. Future Work](#11-future-work)
- [12. Development Conventions](#12-development-conventions)

## 1. Background

**The problem**: you keep a large collection of movies, TV shows, comics and lossless music on your PC and want to enjoy it on a phone or tablet, but:

- Copying files to the phone wastes storage, is slow, and needs cleanup afterwards.
- Cloud drives / streaming services require uploading, transcoding and a subscription — and the files leave your LAN.
- Screen-mirroring apps and third-party players come with format limits, ads, fees and privacy concerns.

**The approach**: your phone and PC are usually on the same Wi-Fi, so just run an HTTP server on the PC and use the browser as the player. That leads to three "zero" goals:

| Goal                    | How it is achieved                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zero install**        | Packaged as a single-file exe; the target machine needs no Node.js, no database and no runtime                                                 |
| **Zero upload**         | Files stay on the LAN; the server streams the original files straight from disk — no transcoding, no copies                                    |
| **Zero learning curve** | Double-click → pick a folder → the console prints the URL; just type it into the phone's browser. Video / comics / music share one entry point |

## 2. Features

### 2.1 Browsing and playback

- **Video playback**: the server implements HTTP `Range` streaming (`206 Partial Content`), so seeking jumps instantly instead of waiting for the whole file to download.
- **Comic reading**: all images in a folder are treated as a single book. Pages can be turned by clicking the left/right side of the image, using the arrow keys, or swiping on a touch screen, with adjacent pages preloaded.
- **Music playback**: a web playlist that auto-plays the next track, remembers the last playback position per track in `localStorage`, requests a Screen Wake Lock while playing so the phone does not sleep, and supports Space / arrow-key shortcuts.
- **Smart home page**: folder contents are detected automatically — image-only folders become "comic" cards with a thumbnail cover, while other entries become folder / video / audio cards. Empty sections are not rendered.
- **Consistent ordering**: every list is sorted by **file creation time, newest first** (falling back to `mtime` when `birthtime` is unsupported), with natural name sorting for ties (`1, 2, 10` instead of `1, 10, 2`).

### 2.2 Usability

- **One-click folder picking**: double-clicking the exe opens the native Windows "Select Folder" dialog.
- **Multiple share roots**: several disks or folders can be shared at once. The home page lists each root, and the root folder name acts as the URL prefix (e.g. `/folder/Movies/2024`); old single-root links keep working.
- **Automatic port fallback**: defaults to `3000` and retries `3001`, `3002`, … when the port is taken.
- **Addresses on startup**: all non-internal IPv4 addresses are enumerated and the console prints `http://192.168.x.x:3000` so you can type it straight into the phone.
- **Non-ASCII friendly**: `Content-Disposition` is encoded per RFC 5987, so non-ASCII filenames are not garbled.

### 2.3 Engineering and robustness

- **Pure TypeScript**: `strict` mode, layered into `controllers / routes / utils / views`, with complete types and JSDoc comments.
- **Minimal dependencies**: only `express`, `cors` and `compression` at runtime — no template engine, database or native module.
- **Path traversal protection**: every path built from a URL is `path.resolve`d and verified to stay inside the share root; anything else gets a `403`.
- **Caching and conditional requests**: `ETag` / `Last-Modified` (answered with `304` on a hit), `Cache-Control: max-age=86400` for images and `60` for everything else, plus a 5-second in-memory cache for the home page HTML.
- **Smart gzip bypass**: compression is disabled for `/video/`, `/watch/` and any request carrying a `Range` header, so media streams are never corrupted.
- **Levelled logging**: `debug / info / warn / error`, including request duration and user agent, controlled by the `LOG_LEVEL` environment variable.
- **Bilingual console & UI**: the system language is detected at start-up (`LOCALSHARE_LANG` > `LC_ALL` / `LANG` > ICU locale); on non-Chinese systems both the web pages (titles, buttons, cards, error messages) and the console logs switch to English, Chinese systems keep the original wording.

## 3. Tech Stack

| Area          | Choice                | Notes                                                         |
| ------------- | --------------------- | ------------------------------------------------------------- |
| Language      | TypeScript 5.9        | `strict`, `target: ES2022`, `module: NodeNext`                |
| Runtime       | Node.js 18+           | pkg target `node18-win-x64`                                   |
| Web framework | Express 5             | Routing + middleware                                          |
| Middleware    | `cors`, `compression` | CORS and gzip (bypassed for media streams)                    |
| Front end     | Plain HTML / JS       | No framework, no build step; TailwindCSS CDN + Font Awesome   |
| Dev tooling   | `tsx`                 | Runs `.ts` directly, no pre-compilation                       |
| Packaging     | `pkg`                 | Single-file exe with `views/*.html` embedded via `pkg.assets` |
| Testing       | —                     | No automated tests yet (see "Future Work")                    |

## 4. Architecture

### 4.1 Layers

```
Browser (phone / tablet / PC)
        │  HTTP
        ▼
┌────────────────────────────────────────────────┐
│ app.ts       startup / middleware / listening  │
│   ├─ compression   gzip (bypassed for media)   │
│   ├─ cors          cross-origin                │
│   └─ request log   method / URL / status / ms  │
├────────────────────────────────────────────────┤
│ routes/videoRoutes.ts      URL → Controller    │
├────────────────────────────────────────────────┤
│ controllers/videoController.ts                 │
│   listing / video stream / player / comic /    │
│   audio / folder browsing                      │
├────────────────────────────────────────────────┤
│ utils/                                         │
│   mime           extension → MIME + type check │
│   template       template loading + rendering  │
│   shareFolders   share directory resolution    │
│   folderPicker   native "Select Folder" dialog │
│   logger         levelled logging              │
│   file           file existence / video files  │
└────────────────────────────────────────────────┘
        │
        ▼
   Local disk (one or more share roots)
```

### 4.2 Startup flow

```
node dist/app.js  /  LocalShare.exe
        │
        ├─ 1. resolveSharedFolders()
        │      CLI args > env vars > folder picker > config.ts default
        │      (cancelled dialog → print a hint and exit)
        ├─ 2. videoController.setVideoFolders(...)   inject this run's roots
        ├─ 3. ensure every share root exists (created recursively if missing)
        ├─ 4. install middleware and mount the routes
        └─ 5. tryListen(PORT, 10)
               EADDRINUSE → retry on port + 1 (up to 10 times)
               print local / LAN addresses on success
```

> On Windows a busy port can emit `listening` before `error`, so the startup banner is printed after a `300ms` delay to avoid advertising a port that is not actually in use.

## 5. Project Structure

```
LocalShare/
├─ app.ts                     # Entry point: args, middleware, listening, banner
├─ config.ts                  # Port and default share folders
├─ routes/
│  └─ videoRoutes.ts          # Route table (regex-captured sub-paths)
├─ controllers/
│  └─ videoController.ts      # Core controller (listing / stream / comic / audio / folder)
├─ utils/
│  ├─ mime.ts                 # Extension ↔ MIME, type enumerations and checks
│  ├─ template.ts             # Template loading (candidate paths + cache) and rendering
│  ├─ shareFolders.ts         # Share folder resolution (CLI / env / dialog / default)
│  ├─ folderPicker.ts         # Native "Select Folder" dialog via PowerShell
│  ├─ logger.ts               # Levelled logging
│  ├─ i18n.ts                 # Language detection + zh/en logs & page text
│  └─ file.ts                 # File existence, video file enumeration
├─ views/
│  ├─ baseTemplate.html       # Home / folder template ({{videoItems}} + {{t:中文|English}})
│  ├─ video.html              # Video player page
│  ├─ comic.html              # Comic reader page
│  └─ audio.html              # Audio player page
├─ package.json               # Scripts + pkg configuration (pkg.assets)
├─ tsconfig.json
└─ dist/                      # Build output and LocalShare.exe
```

## 6. Quick Start

### 6.1 Requirements

- Node.js 18 or newer (development / build)
- Windows 10 / 11 (the native folder picker and exe packaging require Windows; the HTTP server itself is cross-platform)

### 6.2 Development

```bash
npm install

npm run dev     # run app.ts with tsx (also opens the folder picker)
npm run build   # compile with tsc into dist/
npm start       # run the compiled output: node dist/app.js
```

### 6.3 Building the single-file exe (no Node.js needed on the target machine)

```bash
npm run build:exe
```

The script does three things: `tsc` compiles → `views/` is copied to `dist/views/` → `pkg` bundles `dist/LocalShare.exe` (single file, roughly 40–50 MB).

Copy the exe to any Windows machine and double-click it:

1. The native "Select Folder" dialog appears — choose the folder to share (e.g. `D:\Movies`).
2. The console prints the addresses:
   - Local: `http://localhost:3000`
   - LAN: `http://192.168.x.x:3000` ← **use this one on the phone / tablet**
3. Connect the phone to the same Wi-Fi and open the LAN address in a browser.

> **Packaging gotcha**: `pkg` only looks for its configuration in the directory of the entry file. With `dist/app.js` as the entry, the `pkg` field in the project-root `package.json` is not read, so the command must pass `--config package.json` explicitly. Otherwise the HTML templates are not embedded and pages fail with `500 template not found`.

## 7. Specifying Shared Folders

Resolution priority: **CLI arguments > environment variables > native folder dialog > `config.ts` default**

```bat
:: 1. CLI arguments (multiple folders separated by spaces; only paths that really exist as directories are used)
LocalShare.exe "D:\Movies" "E:\Comics"

:: 2. Environment variables (separate multiple folders with ;  — SHARE_DIR and SHARE_DIRS are equivalent)
set SHARE_DIR=D:\Movies;E:\Comics
LocalShare.exe

:: 3. Skip the dialog and use the default folder from config.ts (automation / debugging)
set NO_PICKER=1
LocalShare.exe

:: 4. Pass nothing → the native "Select Folder" dialog opens automatically
LocalShare.exe
```

| Environment variable       | Purpose                                                                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `SHARE_DIR` / `SHARE_DIRS` | Share folders, separated by `;`                                                                                                        |
| `NO_PICKER=1`              | Skip the folder-picking dialog                                                                                                         |
| `LOG_LEVEL`                | Log level: `debug` (default) / `info` / `warn` / `error`                                                                               |
| `LOCALSHARE_LANG`          | Force the UI and console language: `zh` / `en`; when unset it is auto-detected from the system language (alias: `LOCALSHARE_LANGUAGE`) |

The default port and default share folders live in `config.ts`:

```ts
export const PORT: number = 3000;
export const VIDEO_FOLDERS: string[] = ["F:\\video"]; // multiple roots supported
```

## 8. HTTP API

All routes are `GET`. File and folder names in paths are `encodeURIComponent`-encoded by the client and `decodeURIComponent`-decoded by the server, so non-ASCII characters, spaces and `#` are handled safely.

| Route           | Handler         | Description                                                                                                                   |
| --------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `GET /`         | `getVideoList`  | Home page. Single root: lists that folder; multiple roots: lists the root entries. 5-second in-memory cache                   |
| `GET /folder/*` | `getFolderList` | Folder browsing page with breadcrumbs, folder cards (image-only folders get a cover) and file cards                           |
| `GET /watch/*`  | `watch`         | Video player page (inline `<video>`); redirects (302) to the matching page for folders, images and audio                      |
| `GET /video/*`  | `streamVideo`   | **Media stream.** Supports `Range` (206) and conditional requests (304); shared by images, audio and video                    |
| `GET /comic/*`  | `comicViewer`   | Comic reader: a folder becomes a full image collection; a single image opens its folder as a collection starting at that page |
| `GET /audio/*`  | `audioPlayer`   | Audio player: a folder becomes a playlist; a single track opens its folder as a playlist starting at that track               |

**Convention**: `/video/` serves more than video — comic images and audio reuse it, so a single streaming implementation provides both range support and caching to every player.

**URL namespaces**: with multiple roots, the first path segment is the root folder name. For roots `D:\Movies` and `E:\Comics`:

```
/folder/Movies           → D:\Movies
/folder/Movies/2024      → D:\Movies\2024
/video/Movies/2024/a.mp4 → D:\Movies\2024\a.mp4
```

## 9. Key Implementation Details

### 9.1 HTTP Range streaming (instant start, seekable video)

`streamVideo` parses the `Range: bytes=start-end` header itself:

- with `Range` → `createReadStream(path, { start, end })` responding `206` with `Content-Range`, `Content-Length` and `Accept-Ranges: bytes`;
- without `Range` → a full `200` stream that still advertises `Accept-Ranges`, so the browser can switch to range requests afterwards;
- when `end` is omitted it defaults to `fileSize - 1`, covering the common `bytes=0-` form.

The player therefore requests only the bytes it needs and issues a new range request on every seek, keeping memory usage independent of file size.

### 9.2 Conditional requests and tiered caching

- A weak `ETag` is derived from `size + mtimeMs` and returned together with `Last-Modified`;
- `If-None-Match` / `If-Modified-Since` hits return `304` with an empty body, avoiding redundant transfers;
- `Cache-Control`: images `max-age=86400` (comic pages and thumbnails stop hitting the server), other resources `max-age=60`;
- the home page HTML additionally gets a 5-second in-process cache to avoid repeated disk reads.

### 9.3 Multi-root routing and backward compatibility

A URL has no notion of disks, so the root folder name is used as a namespace:

1. `resolveBaseAndRel(subPath)` compares the first path segment against the `basename` of every root; on a match the rest of the path becomes the relative path;
2. with a single root the whole path is treated as relative, exactly like the single-root version;
3. with multiple roots and no match on the first segment, `asyncResolveBaseAndRel` probes each root with `fs.stat` and uses the first hit — so links generated before the upgrade keep working.

### 9.4 Security: path traversal protection and header sanitisation

- `isPathSafe(base, target)` resolves both sides with `path.resolve` and compares them, blocking `../../` style traversal;
- every route that reads from disk (stream, player, comic, audio, folder) performs this check before touching the filesystem and returns `403` when the path escapes the root;
- `Content-Disposition` strips control characters and quotes, then emits an RFC 5987 `filename*=UTF-8''...` value so non-ASCII filenames survive intact.

### 9.5 Page rendering without a template engine

`template.ts` only loads a template from a list of candidate paths, caches it and replaces `{{placeholders}}`:

- the candidates cover all three runtime shapes: next to the compiled output (`__dirname/../views`), the project root (`cwd/views`) and the pkg bundle (`cwd/dist/views`);
- `baseTemplate.html` is read once and cached, so later requests do no disk I/O at all.

The upside is zero extra dependencies, packaging friendliness and templates that can be edited directly; the cost is that output escaping (and other injection concerns) is your own responsibility.

### 9.6 Packaging and "no-runtime" execution

- `pkg` compiles the Node runtime + compiled JS + embedded assets into a single exe (target `node18-win-x64`) that runs on double-click;
- `views/*.html` are declared as embedded assets through the `pkg.assets` field in `package.json`, after being copied into `dist/views/` during the build;
- because `pkg` only looks for its configuration next to the entry file, the build script passes `--config package.json` explicitly.

### 9.7 The native "Select Folder" dialog

The requirement is "double-click the exe and pick a folder", but native modules would break single-file packaging. The solution is to drive .NET from PowerShell:

- `spawnSync` launches `powershell.exe -NoProfile -STA -ExecutionPolicy Bypass` (`-STA` is required by WinForms dialogs);
- the script instantiates `System.Windows.Forms.FolderBrowserDialog`;
- the result is written to a temp file (UTF-8, no BOM) instead of stdout, avoiding mojibake caused by the Windows console code page;
- when `powershell.exe` is not on `PATH`, it falls back to the absolute path under the system directory;
- a 5-minute timeout and `windowsHide` are set, and a `finally` block guarantees the temp file is deleted.

### 9.8 List ordering: newest-first creation time + natural sort

Newly added media is usually what you want to watch, so lists are sorted by `birthtimeMs` descending, falling back to `mtimeMs` on filesystems without a creation time. When timestamps are identical (very common after a bulk copy) `localeCompare(..., { numeric: true })` provides natural order, so `Episode2` comes before `Episode10`.

### 9.9 Startup robustness

- a busy port triggers automatic retries on port + 1 (up to 10 times), avoiding clashes with an already running instance;
- the startup banner is delayed by 300ms, working around Windows emitting `listening` before `error` (which would otherwise advertise a port that is not really in use);
- when launched by double-click and exiting with an error, `pauseBeforeExit()` runs `pause` only if `stdin` is a TTY so the window does not vanish; scripts and pipes exit immediately and are never blocked.

### 9.10 Automatic UI and console language detection

`utils/i18n.ts` performs a single language probe when the module is loaded, after which every log line and every page string is produced through the same `t("中文", "English")` call:

1. `LOCALSHARE_LANG` / `LOCALSHARE_LANGUAGE` (explicit override for demos and troubleshooting);
2. `LC_ALL` / `LC_MESSAGES` / `LANG` / `LANGUAGE` (the usual source on Linux / macOS);
3. `Intl.DateTimeFormat().resolvedOptions().locale` (on Windows this comes from the system regional settings);
4. when nothing can be determined, Chinese is kept, matching the historical behaviour.

Language tags are normalised to their primary subtag (`zh_CN.UTF-8` → `zh`, `en-US` → `en`), `POSIX` / `C` count as unspecified, and anything that is not `zh` falls back to English. The log-level labels switch as well (`[信息]` / `[INFO]`).

Page text is localised in two places so that a non-Chinese system gets an entirely English UI:

| Location                                                     | How                    | Coverage                                                                                                                                            |
| ------------------------------------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| HTML fragments and HTTP error bodies built in the controller | `t("中文", "English")` | card subtitles (`根目录 · …` / `漫画 · N 页` / `文件夹`), the “Home” breadcrumb, the multi-root page title, `res.status(404).send(...)` and friends |
| `views/*.html` templates                                     | `{{t:中文              | English}}`                                                                                                                                          | the “Refresh” link, the audio player button tooltips and `aria-label`s, the playlist heading and the empty-state text |

`localizeTemplate()` rewrites those tokens in all four render entry points and also syncs `<html lang="zh-CN">` to the active language. The token pass runs before `{{videoItems}}` / `{{title}}` placeholders are substituted, so a user folder name can never be mistaken for a token. Because both variants live at the call site there is no key/value table to maintain and no message can silently stay untranslated; a single line printed at start-up also reports the detected language.

## 10. Performance & Reliability

| Concern             | Measure                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------- |
| Large file transfer | Streaming reads + range requests keep memory usage independent of file size                 |
| Redundant transfer  | `ETag` / `Last-Modified` / `304` plus type-aware `Cache-Control`                            |
| Home page cost      | 5-second in-process HTML cache, so disk reads are independent of traffic                    |
| Compression cost    | Media streams and range requests skip gzip, avoiding wasted CPU and corrupted streams       |
| Comic page turns    | Adjacent pages are preloaded on the client, so turning a page is almost instant             |
| Audio resume        | Per-track `localStorage` progress, resume after switching tracks or reloading               |
| Screen sleep        | A Screen Wake Lock is requested while playing and re-acquired when the page becomes visible |
| Observability       | Every request logs method, URL, status, duration and user agent; log level is configurable  |

## 11. Future Work

- **Testing**: unit tests for `isPathSafe`, `resolveBaseAndRel`, range parsing and the `shareFolders` priority chain (Node's built-in `node:test` avoids new dependencies), plus integration tests for the routes.
- **Security**: optional token / password authentication, a `path.relative`-based path check and template output escaping.
- **Experience**: video resume position, list search and paging, external subtitles (`.srt` / `.ass`) and server-side thumbnail generation.
- **Capability**: optional `ffmpeg` integration for on-demand transcoding / HLS segmentation to cover formats browsers cannot play natively.
- **Tooling**: ESLint / Prettier and CI, plus an evaluation of newer single-file alternatives to `pkg` such as `node --experimental-sea` and `bun build --compile`.

## 12. Development Conventions

- **Layering**: `routes` only map URLs to handlers; `controllers` hold the business logic; `utils` provide stateless helpers.
- **Types and comments**: `strict` mode is enabled and exported members carry JSDoc comments.
- **Error handling**: every handler wraps its work in `try/catch`, returns `403 / 404 / 500` as appropriate and reports through `logger.error` instead of letting exceptions reach the process.
- **Naming**: lowerCamelCase file names (`shareFolders.ts`), PascalCase classes, UPPER_SNAKE_CASE constants, and log messages prefixed with a bracketed module name for easy filtering.
- **Commits**: follow the `feat: / fix: / chore:` prefix convention (see `git log`).

---
