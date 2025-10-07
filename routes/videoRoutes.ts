import { Router } from "express";
import { videoController } from "../controllers/videoController";

const router = Router();

router.get("/", videoController.getVideoList.bind(videoController));

router.get(
  "/video/:filename",
  videoController.streamVideo.bind(videoController)
);

export default router;
