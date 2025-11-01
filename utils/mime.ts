/**
 * Map of file extension to mime type
 */

class Mime {
  /** Combined map of extension -> mime type for videos and images */
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
   * Get mime type for a filename
   * @param {string} filename
   * @returns {string}
   */
  public getMimeType(filename: string): string {
    const fileExtension = filename.split(".").pop()?.toLowerCase() || "";
    return this.mimeMap[fileExtension] || "application/octet-stream";
  }

  /**
   * Get supported extensions (both video and image)
   * @returns {string[]}
   */
  public getSupportedExtensions(): string[] {
    return Object.keys(this.mimeMap).map((e) => e.toLowerCase());
  }

  /**
   * Get extensions that are images
   * @returns {string[]}
   */
  public getImageExtensions(): string[] {
    return Object.keys(this.mimeMap).filter((k) =>
      String(this.mimeMap[k]).startsWith("image/")
    );
  }

  /**
   * Check whether a given extension (without dot) is an image
   * @param {string} ext
   */
  public isImageExtension(ext: string): boolean {
    if (!ext) return false;
    return this.getImageExtensions().includes(ext.toLowerCase());
  }

  /**
   * Get audio extensions
   */
  public getAudioExtensions(): string[] {
    return Object.keys(this.mimeMap).filter((k) =>
      String(this.mimeMap[k]).startsWith("audio/")
    );
  }

  /**
   * Check whether extension is audio
   */
  public isAudioExtension(ext: string): boolean {
    if (!ext) return false;
    return this.getAudioExtensions().includes(ext.toLowerCase());
  }
}

export const mime = new Mime();

/**
 * Convenience wrapper
 * @param {string} filename
 * @returns {string}
 */
export function getMimeType(filename: string): string {
  return mime.getMimeType(filename);
}
