/**
 * 根据文件名后缀返回合适的 MIME 类型
 * @param filename 文件名
 * @returns 对应的 MIME 类型字符串
 */
export function getMimeType(filename: string): string {
  const fileExtension: string = filename.split(".").pop()?.toLowerCase() || "";

  const videoMimeMap: Record<string, string> = {
    mp4: "video/mp4",
    mkv: "video/x-matroska",
    avi: "video/x-msvideo",
    mov: "video/quicktime",
    webm: "video/webm",
    flv: "video/x-flv",
    wmv: "video/x-ms-wmv",
    m4v: "video/x-m4v",
    ts: "video/MP2T",
    mpeg: "video/mpeg",
    mpg: "video/mpeg",
    mts: "video/MP2T",
    m2ts: "video/MP2T",
  };

  return videoMimeMap[fileExtension] || "application/octet-stream";
}
