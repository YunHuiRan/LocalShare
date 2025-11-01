import { Router } from "express";
import { videoController } from "../controllers/videoController";

/**
 * 视频相关路由实例
 * @type {express.Router}
 */
const router = Router();

/**
 * 获取视频列表路由
 * GET / - 返回视频文件夹中的视频列表
 */
router.get("/", videoController.getVideoList.bind(videoController));

/**
 * 视频流媒体路由
 * GET /video/* - 提供视频文件流媒体服务
 */
router.get(/^\/video\/(.*)/, videoController.streamVideo.bind(videoController));

/**
 * 漫画查看器路由
 * GET /comic/* - 提供漫画查看器页面
 */
router.get(/^\/comic\/(.*)/, videoController.comicViewer.bind(videoController));

/**
 * 音频播放器路由
 * GET /audio/* - 提供音频播放器页面
 */
router.get(/^\/audio\/(.*)/, videoController.audioPlayer.bind(videoController));

/**
 * 文件夹列表路由
 * GET /folder/* - 返回指定文件夹中的内容列表
 */
router.get(
  /^\/folder\/(.*)/,
  videoController.getFolderList.bind(videoController)
);

export default router;