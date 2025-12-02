/**
 * 服务器监听端口号
 * @type {number}
 */
export const PORT: number = 3000;

/**
 * 视频文件存储文件夹路径
 * @type {string}
 */
/**
 * 支持多个视频存储路径，优先使用数组的第一个作为默认目录
 * @type {string[]}
 */
export const VIDEO_FOLDERS: string[] = ["C:\\Users\\voori\\OneDrive\\图片", "D:\\迅雷下载",];

/**
 * 向后兼容：默认视频文件夹，等于 `VIDEO_FOLDERS[0]`
 * @type {string}
 */
export const VIDEO_FOLDER: string = VIDEO_FOLDERS[0];