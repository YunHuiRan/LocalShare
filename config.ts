/**
 * 服务器监听端口号
 *
 * Server listening port.
 */
export const PORT: number = 3000;

/**
 * 支持多个共享目录，优先使用数组的第一个作为默认目录
 *
 * Multiple folders can be shared; the first entry is the default one.
 */
export const VIDEO_FOLDERS: string[] = ["F:\\video"];

/**
 * 向后兼容：默认共享目录，等于 `VIDEO_FOLDERS[0]`
 *
 * Backwards compatibility alias for the default folder (`VIDEO_FOLDERS[0]`).
 */
export const VIDEO_FOLDER: string = VIDEO_FOLDERS[0];
