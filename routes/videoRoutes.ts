import { Router } from "express";
import { videoController } from "../controllers/videoController";

const router = Router();

/**
 * 获取视频列表路由
 * GET / - 返回视频文件夹中的视频列表
 *
 * Video list route: GET / - lists the videos of the video folder.
 */
router.get("/", videoController.getVideoList.bind(videoController));

/**
 * 视频流媒体路由
 * GET /video/* - 提供视频文件流媒体服务
 *
 * Video streaming route: GET /video/* - serves video files over HTTP.
 */
router.get(/^\/video\/(.*)/, videoController.streamVideo.bind(videoController));

/**
 * 视频播放页面路由
 * GET /watch/* - 嵌入 <video> 标签的播放器页面
 *
 * Watch page route: GET /watch/* - player page with an embedded <video> element.
 */
router.get(/^\/watch\/(.*)/, videoController.watch?.bind(videoController) || videoController.streamVideo.bind(videoController));

/**
 * 漫画查看器路由
 * GET /comic/* - 提供漫画查看器页面
 *
 * Comic viewer route: GET /comic/* - serves the comic viewer page.
 */
router.get(/^\/comic\/(.*)/, videoController.comicViewer.bind(videoController));

/**
 * 音频播放器路由
 * GET /audio/* - 提供音频播放器页面
 *
 * Audio player route: GET /audio/* - serves the audio player page.
 */
router.get(/^\/audio\/(.*)/, videoController.audioPlayer.bind(videoController));

/**
 * 文件夹列表路由
 * GET /folder/* - 返回指定文件夹中的内容列表
 *
 * Folder listing route: GET /folder/* - lists the content of a folder.
 */
router.get(
  /^\/folder\/(.*)/,
  videoController.getFolderList.bind(videoController)
);

export default router;