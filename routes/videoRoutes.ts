import { Router } from "express";
import { getVideoList, streamVideo } from "../controllers/videoController.ts";

/**
 * 视频相关路由
 */
const router = Router();

// 首页：视频列表
router.get("/", getVideoList);

// 视频流：支持 range
router.get("/video/:filename", streamVideo);

export default router;
