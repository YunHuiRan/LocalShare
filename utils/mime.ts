/**
 * Map of file extension to mime type
 */

class Mime {
  /** @type {Record<string, string>} */
  private videoMimeMap: Record<string, string> = {
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

  /**
   * Get mime type for a filename
   * @param {string} filename
   * @returns {string}
   */
  public getMimeType(filename: string): string {
    const fileExtension = filename.split('.').pop()?.toLowerCase() || '';
    return this.videoMimeMap[fileExtension] || 'application/octet-stream';
  }

  /**
   * Get supported extensions
   * @returns {string[]}
   */
  public getSupportedExtensions(): string[] {
    return Object.keys(this.videoMimeMap).map((e) => e.toLowerCase());
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
