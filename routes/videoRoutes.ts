import { Router } from "express";
import { videoController } from "../controllers/videoController";

const router = Router();

// 首页视频与文件夹列表
router.get("/", videoController.getVideoList.bind(videoController));

// 捕获任意嵌套路径用于视频流
router.get(/^\/video\/(.*)/, videoController.streamVideo.bind(videoController));

// 浏览文件夹
router.get(
  /^\/folder\/(.*)/,
  videoController.getFolderList.bind(videoController)
);

export default router;
