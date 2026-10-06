import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { logger } from "./logger";
import { t } from "./i18n";

/**
 * 文件夹选择窗口超时时间（毫秒），避免用户长时间不操作导致进程一直挂起
 * @type {number}
 */
const PICKER_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * 解析 powershell.exe 的可执行文件路径
 *
 * 打包成 exe 拷贝到其它电脑运行时，若 PATH 不完整（例如被启动器裁剪、
 * 只保留了 System32），仅写 "powershell.exe" 会因找不到文件而弹出失败。
 * 因此优先使用系统目录下的绝对路径，全都找不到时再退回依赖 PATH 的名字。
 *
 * @returns {string} powershell.exe 的路径（优先绝对路径）
 */
function resolvePowerShellPath(): string {
  const systemRoot: string = process.env.SystemRoot || process.env.windir || "C:\\Windows";
  const candidates: string[] = [
    path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
    path.join(systemRoot, "SysWOW64", "WindowsPowerShell", "v1.0", "powershell.exe"),
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (e) {
      // 忽略探测失败，继续尝试下一个候选路径
    }
  }

  return "powershell.exe";
}

/**
 * 生成用于弹出系统文件夹选择窗口的 PowerShell 脚本
 *
 * 选择结果写入环境变量 LOCALSHARE_PICKER_OUT 指定的临时文件（UTF-8 编码），
 * 而不是通过标准输出返回，这样可以避免 Windows 控制台代码页（GBK/UTF-8）
 * 造成中文路径乱码。
 *
 * @returns {string} PowerShell 脚本内容
 */
function buildPickerScript(): string {
  return [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.Windows.Forms | Out-Null",
    "[System.Windows.Forms.Application]::EnableVisualStyles()",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$dialog.Description = $env:LOCALSHARE_PICKER_TITLE",
    "$dialog.ShowNewFolderButton = $true",
    "if ($env:LOCALSHARE_PICKER_START -and (Test-Path -LiteralPath $env:LOCALSHARE_PICKER_START)) { $dialog.SelectedPath = $env:LOCALSHARE_PICKER_START }",
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
    "  $utf8 = [System.Text.UTF8Encoding]::new($false)",
    "  [System.IO.File]::WriteAllText($env:LOCALSHARE_PICKER_OUT, $dialog.SelectedPath, $utf8)",
    "}",
  ].join("\n");
}

/**
 * 弹出系统“选择文件夹”窗口，让用户选择要共享的目录
 *
 * 通过 PowerShell 调用 .NET 的 FolderBrowserDialog 实现，
 * 不依赖任何第三方原生模块，打包成 exe 后在没有 Node 环境的电脑上同样可用。
 *
 * @param {string} [description] - 窗口中的提示文字
 * @param {string} [initialDir] - 打开窗口时默认定位的目录
 * @returns {string|null} 用户选择的文件夹绝对路径；用户取消或调用失败时返回 null
 */
export function pickFolder(
  description = t("请选择要共享的文件夹", "Select a folder to share"),
  initialDir?: string
): string | null {
  if (process.platform !== "win32") {
    logger.warn(
      t(
        "当前系统不是 Windows，无法弹出文件夹选择窗口",
        "The folder picker is only available on Windows"
      )
    );
    return null;
  }

  const resultFile = path.join(
    os.tmpdir(),
    `localshare-picker-${process.pid}-${Date.now()}.txt`
  );

  try {
    const powerShellPath: string = resolvePowerShellPath();
    logger.debug(
      t(
        `【pickFolder】 正在调用 PowerShell 弹出文件夹选择窗口: ${powerShellPath}`,
        `[pickFolder] opening the folder picker via PowerShell: ${powerShellPath}`
      )
    );
    const result = spawnSync(
      powerShellPath,
      [
        "-NoProfile",
        "-STA",
        "-ExecutionPolicy",
        "Bypass",
        "-WindowStyle",
        "Hidden",
        "-Command",
        buildPickerScript(),
      ],
      {
        env: {
          ...process.env,
          LOCALSHARE_PICKER_TITLE: description,
          LOCALSHARE_PICKER_START: initialDir || "",
          LOCALSHARE_PICKER_OUT: resultFile,
        },
        windowsHide: true,
        encoding: "utf8",
        timeout: PICKER_TIMEOUT_MS,
      }
    );

    if (result.error) {
      logger.error(
        t(
          `【pickFolder】 调用 PowerShell 失败: ${result.error.message}`,
          `[pickFolder] failed to launch PowerShell: ${result.error.message}`
        )
      );
      return null;
    }

    if (typeof result.status === "number" && result.status !== 0) {
      const stderr = String(result.stderr || "").trim();
      logger.warn(
        t(
          `【pickFolder】 文件夹选择窗口异常退出（exit code ${result.status}）${
            stderr ? `: ${stderr}` : ""
          }`,
          `[pickFolder] the folder picker exited abnormally (exit code ${
            result.status
          })${stderr ? `: ${stderr}` : ""}`
        )
      );
      return null;
    }

    // 用户取消选择时不会生成结果文件
    if (!fs.existsSync(resultFile)) {
      logger.info(
        t(
          "【pickFolder】 用户取消了文件夹选择",
          "[pickFolder] the user cancelled folder selection"
        )
      );
      return null;
    }

    const selected = fs.readFileSync(resultFile, "utf8").trim();
    return selected ? path.resolve(selected) : null;
  } catch (e) {
    logger.error(
      t(
        "【pickFolder】 弹出文件夹选择窗口时出错",
        "[pickFolder] error while opening the folder picker"
      ),
      e as any
    );
    return null;
  } finally {
    try {
      if (fs.existsSync(resultFile)) fs.unlinkSync(resultFile);
    } catch (e) {
      // 临时文件清理失败不影响主流程
    }
  }
}
