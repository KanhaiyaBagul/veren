import { Request, Response } from "express";
import { buildQueue } from "../job/queue/build-queue.js";
import { safeExecute } from "../types/safeExecute.js";

// here we will write Build File logic before Build Service is ready
// will also be updating tarefik config to add new services

export default async function operationalController(req: Request, res: Response) {

    const { projectId, baseDir, backendDir, frontendDir, cloneSkipped } = req.body;

    if (cloneSkipped) {
        console.log("Cloning was skipped, not queuing build.");
        return res.json({ msg: "Cloning was skipped, not queuing build." });
    }

    // Queue build job
    await safeExecute(
        async () => {
            await buildQueue.add(
                "buildQueue",
                { projectId, baseDir, backendDir, frontendDir },
                {
                    attempts: 3,
                    backoff: {
                        type: "exponential",
                        delay: 5000,
                    },
                }
            )
        }, null);

    console.log("OPERATIONAL CHECK FOR ID:", projectId);

    return res.json({ msg: "Operational controller is working", projectId });
}