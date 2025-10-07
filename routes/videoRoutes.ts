import { Router } from "express";
import { videoController } from "../controllers/videoController";

const router = Router();

router.get("/", videoController.getVideoList.bind(videoController));

// use regex routes to capture nested paths (avoids path-to-regexp parameter syntax issues)
router.get(/^\/video\/(.*)/, videoController.streamVideo.bind(videoController));

// browse folders (supports nested paths)
router.get(/^\/folder\/(.*)/, videoController.getFolderList.bind(videoController));

router.get("/open", videoController.openFolder.bind(videoController));

export default router;
