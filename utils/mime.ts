type MimeMap = Record<string, string>;

class Mime {
  private videoMimeMap: MimeMap = {
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
  } as MimeMap;

  public getMimeType(filename: string): string {
    const fileExtension = filename.split(".").pop()?.toLowerCase() || "";
    return this.videoMimeMap[fileExtension] || "application/octet-stream";
  }

  public getSupportedExtensions(): string[] {
    return Object.keys(this.videoMimeMap).map((e) => e.toLowerCase());
  }
}

export const mime = new Mime();

export function getMimeType(filename: string): string {
  return mime.getMimeType(filename);
}
