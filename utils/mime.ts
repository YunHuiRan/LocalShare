/**
 * MIME 类型管理器
 * 负责处理文件扩展名与 MIME 类型之间的映射关系
 *
 * MIME type manager mapping file extensions to MIME types.
 */
class Mime {
  private mimeMap: Record<string, string> = {
    // video
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
    // common images
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    tif: "image/tiff",
    tiff: "image/tiff",
    avif: "image/avif",
    heic: "image/heic",
    ico: "image/x-icon",
    svg: "image/svg+xml",
    // audio
    mp3: "audio/mpeg",
    wav: "audio/wav",
    aac: "audio/aac",
    flac: "audio/flac",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
  };

  /**
   * 根据文件名获取对应的 MIME 类型
   *
   * Resolves the MIME type of a file name; unknown extensions fall back to
   * "application/octet-stream".
   */
  public getMimeType(filename: string): string {
    const fileExtension = filename.split(".").pop()?.toLowerCase() || "";
    return this.mimeMap[fileExtension] || "application/octet-stream";
  }

  /**
   * 获取所有支持的文件扩展名列表
   *
   * Lists every supported file extension.
   */
  public getSupportedExtensions(): string[] {
    return Object.keys(this.mimeMap).map((e) => e.toLowerCase());
  }

  /**
   * 获取所有图像文件扩展名
   *
   * Lists every image file extension.
   */
  public getImageExtensions(): string[] {
    return Object.keys(this.mimeMap).filter((k) =>
      String(this.mimeMap[k]).startsWith("image/")
    );
  }

  /**
   * 检查给定扩展名是否为图像文件扩展名
   *
   * Whether the given extension belongs to an image file.
   */
  public isImageExtension(ext: string): boolean {
    if (!ext) return false;
    return this.getImageExtensions().includes(ext.toLowerCase());
  }

  /**
   * 获取所有音频文件扩展名
   *
   * Lists every audio file extension.
   */
  public getAudioExtensions(): string[] {
    return Object.keys(this.mimeMap).filter((k) =>
      String(this.mimeMap[k]).startsWith("audio/")
    );
  }

  /**
   * 检查给定扩展名是否为音频文件扩展名
   *
   * Whether the given extension belongs to an audio file.
   */
  public isAudioExtension(ext: string): boolean {
    if (!ext) return false;
    return this.getAudioExtensions().includes(ext.toLowerCase());
  }
}

export const mime = new Mime();

/**
 * 根据文件名获取对应的 MIME 类型的便捷函数
 *
 * Convenience wrapper around `mime.getMimeType()`.
 */
export function getMimeType(filename: string): string {
  return mime.getMimeType(filename);
}