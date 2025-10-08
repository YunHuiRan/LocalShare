import { Router } from "express";
import { videoController } from "../controllers/videoController";

/**
 * Router for video related endpoints
 * @type {import('express').Router}
 */
const router = Router();

router.get("/", videoController.getVideoList.bind(videoController));

router.get(/^\/video\/(.*)/, videoController.streamVideo.bind(videoController));

router.get(
  /^\/folder\/(.*)/,
  videoController.getFolderList.bind(videoController)
);

export default router;
