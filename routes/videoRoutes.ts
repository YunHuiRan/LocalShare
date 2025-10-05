import { Router } from "express";
import { getVideoList, streamVideo } from "../controllers/videoController.ts";

const router = Router();

router.get("/", getVideoList);

router.get("/video/:filename", streamVideo);

export default router;
