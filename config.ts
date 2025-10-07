/**
 * 服务监听端口
 */
export const PORT: number = 3000;
// allow overriding port via environment variable
export const ENV_PORT = process.env.PORT ? Number(process.env.PORT) : undefined;

/**
 * 本地视频目录
 */
export const VIDEO_FOLDER: string = "C:\\Users\\voori\\Downloads\\新建文件夹";
