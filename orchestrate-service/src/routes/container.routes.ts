import { Router, Request, Response } from "express";
import {containerRouter} from "../controllers/container.controller.js"
const router = Router();


router.route('/').get(containerRouter);

export default router;