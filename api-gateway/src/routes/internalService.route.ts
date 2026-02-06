import { Router } from "express"
import {getProjectConfigBuild,updateProjectConfigBuild} from "../controllers/internalService.controller.js"
const router = Router();

/*  IT IS FOR INTERNAL WORKER MODULES  */
router.route("/:projectId/clone-metadata")
    // .patch(updateProjectConfigClone)

router.route("/:projectId/build-metadata")
    .get(getProjectConfigBuild)
    .patch(updateProjectConfigBuild)


export default router;