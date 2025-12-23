import { Worker } from "bullmq";
import { Redis } from "ioredis";
import fs from "fs"
import logger from "../logger/logger";
import { buildFrontend } from "../services/distributionHandler/buildFrontend";
import { buildBackend } from "../services/distributionHandler/buildBackend"
import dotenv from "dotenv";

dotenv.config({
     path: '../../.env'
});
const connection = new Redis({
    maxRetriesPerRequest: null,
    host: process.env.REDIS_HOST || "internal-redis",
    port: 6379,
})

async function safeExecute<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
        return await fn();
    } catch (err) {
        logger.error("Caught error in safeExecute:", err);
        return fallback;
    }
}

const worker = new Worker('buildQueue',
    async (job) => {
        const { url,
            pathToFolder,
            repoConfig,
            token,
            projectId,
            dirPath,
            cloneSkipped} = job.data;
        if(cloneSkipped){
            return { buildSkipped: true };
        }
        if (!projectId || !pathToFolder || !repoConfig) {
            logger.error("Some data missing in worker of build");
            return { buildSkipped: true };
        }

        let repositoryConfig = JSON.parse(JSON.stringify(repoConfig))
        let directoryPath = JSON.parse(JSON.stringify(dirPath))

        if (!fs.existsSync(directoryPath.baseDir)) {
            logger.error("Directory do not exist for project: ", projectId);
            return { projectId, buildSkipped: true };
        }

        // Safe execute buildFrontend
        const buildDone = await safeExecute(() => buildFrontend(url,directoryPath.frontendDir, projectId, repositoryConfig.buildCommand.FrontendBuildCommand, repositoryConfig.envs.frontendEnv), null);

        // // safe execute buildBackend
        // const backendDist = await safeExecute(() => buildFrontend(directoryPath.backendDir, projectId, 
        // repositoryConfig.buildCommand.BackendBuildCommand, repositoryConfig.envs.backendEnv), null);

        if (!buildDone) {
            logger.info(`Build was skipped for project ${projectId}`);
            return { projectId, dirPath, buildSkipped: true };
        }
        console.log(`http://${projectId}.localhost:8004/`)
        return { projectId, dirPath, buildSkipped: false }

    }, { connection }
)

worker.on('completed', async (job, result) => {
    try {
        const { projectId, dirPath, buildSkipped } = result;

        if (buildSkipped) {
            logger.info(`Build was skipped for project : ${projectId} due to server constraints`);
            return
        }

        if (!projectId || !dirPath) {
            logger.error("DATA MISSING ON BUILD COMPLETE");
            return;
        }

        logger.info(`Job ${job.id} completed successfully`);

    } catch (error) {
        logger.error("Error in completed handler:", error);
    }
})

worker.on('failed', async (job: any, err: any) => {
    logger.error(`JOB FAILED WITH ${job.id}`, err);
})

process.on('uncaughtException', (err) => {
    logger.error("Uncaught exception in worker:", err);
});

process.on('unhandledRejection', (reason) => {
    logger.error("Unhandled promise rejection in worker:", reason);
});




