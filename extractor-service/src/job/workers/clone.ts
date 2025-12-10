import { Worker } from "bullmq";
import { Redis } from "ioredis";
import logger from "../../logger/logger.js";
import { cloneRepo } from "../../services/GitHandler/gitHandler.js";
import { CloneResult, CloneSkipped } from "../../types/clone.js";
import { safeExecute } from "../../types/index.js";
import axios from "axios";

const connection = new Redis({
    maxRetriesPerRequest: null,
    host: process.env.REDIS_HOST || "notification_redis",
    port: 6379,
});

const worker = new Worker(
    "cloneQueue",
    async (job) => {
        const { repoUrl, frontend, backend, id, token } = job.data || {};

        if (!repoUrl || !frontend || !backend || !id || !token) {
            logger.error("Missing data in cloneQueue", job.data)
            return { cloneSkipped: true };
        }

        const result = await safeExecute<CloneResult>(
            () => cloneRepo(repoUrl, frontend, backend, id, token),
            { cloneSkipped: true }
        );

        if (!result || result.cloneSkipped) {
            logger.error("Cloning was skipped for job:", job.id);
            return { cloneSkipped: true } as CloneSkipped;
        }

        return {
            ...result, cloneSkipped: result.cloneSkipped?? false
        }
    }, { connection }
)

worker.on('completed', async (job, result) => {
    try {
        const { projectId, baseDir, backendDir, frontendDir, cloneSkipped } = result;

        if (cloneSkipped) {
            logger.info(`Cloning was skipped for job ${job.id}, not queuing build.`);
            return
        }

        if (!projectId || !baseDir || !backendDir || !frontendDir) {
            logger.error("DATA MISSING ON CLONE COMPLETE");
            return;
        }
  
        logger.info(`Job ${job.id} completed`);

        await safeExecute(
            () => axios.post(
                "http://backend-service:3000/api/v1/operational",
                {
                    ...result
                },
                { timeout: 10000 }
            ),
            null
        );
       
    } catch (error) {
        logger.error("Error in completed handler:", error);

    }
})

worker.on('failed', async (job: any, err: any) => {
    logger.error(`JOB FAILED WITH ${job.id}`, err);
})

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception in clone worker:", err);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection in clone worker:", reason);
});