/**
 * MIME 类型管理器
 * 负责处理文件扩展名与 MIME 类型之间的映射关系
 */
class Mime {
  /**
   * MIME 类型映射表
   * @private
   * @type {Record<string, string>}
   */
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
   * @param {string} filename - 文件名
   * @returns {string} 对应的 MIME 类型，如果未找到则返回 "application/octet-stream"
   */
  public getMimeType(filename: string): string {
    const fileExtension = filename.split(".").pop()?.toLowerCase() || "";
    return this.mimeMap[fileExtension] || "application/octet-stream";
  }

  /**
   * 获取所有支持的文件扩展名列表
   * @returns {string[]} 支持的文件扩展名数组
   */
  public getSupportedExtensions(): string[] {
    return Object.keys(this.mimeMap).map((e) => e.toLowerCase());
  }

  /**
   * 获取所有图像文件扩展名
   * @returns {string[]} 图像文件扩展名数组
   */
  public getImageExtensions(): string[] {
    return Object.keys(this.mimeMap).filter((k) =>
      String(this.mimeMap[k]).startsWith("image/")
    );
  }

  /**
   * 检查给定扩展名是否为图像文件扩展名
   * @param {string} ext - 文件扩展名
   * @returns {boolean} 如果是图像文件扩展名返回 true，否则返回 false
   */
  public isImageExtension(ext: string): boolean {
    if (!ext) return false;
    return this.getImageExtensions().includes(ext.toLowerCase());
  }

  /**
   * 获取所有音频文件扩展名
   * @returns {string[]} 音频文件扩展名数组
   */
  public getAudioExtensions(): string[] {
    return Object.keys(this.mimeMap).filter((k) =>
      String(this.mimeMap[k]).startsWith("audio/")
    );
  }

  /**
   * 检查给定扩展名是否为音频文件扩展名
   * @param {string} ext - 文件扩展名
   * @returns {boolean} 如果是音频文件扩展名返回 true，否则返回 false
   */
  public isAudioExtension(ext: string): boolean {
    if (!ext) return false;
    return this.getAudioExtensions().includes(ext.toLowerCase());
  }
}

/**
 * MIME 类型管理器实例
 * @type {Mime}
 */
export const mime = new Mime();

/**
 * 根据文件名获取对应的 MIME 类型的便捷函数
 * @param {string} filename - 文件名
 * @returns {string} 对应的 MIME 类型
 */
export function getMimeType(filename: string): string {
  return mime.getMimeType(filename);
}