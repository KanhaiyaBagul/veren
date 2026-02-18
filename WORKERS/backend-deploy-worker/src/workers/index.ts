import { ConnectionOptions, Job, tryCatch, Worker } from "bullmq"
import { Redis } from "ioredis"
import dotenv from 'dotenv';
import { deploymentJobError } from "../utils/jobError";
import deploy from "../service/deploy";
import { safeExecute } from "../service/safeExecute";

dotenv.config({ path: "../../../.env" });

interface BackendDeployJobData {
    deploymentId: string;
    projectId: string;
    imageTag: string;
    installCommand: string;
    startCommand: string;
    envs: any;
}

interface BackendDeployResult {
    msg: false,
    backendDeploymentQueued: any
}
const redis = new Redis({ host: "internal-redis", port: 6379, maxRetriesPerRequest: null });
const connection: ConnectionOptions = redis as unknown as ConnectionOptions;

const worker = new Worker<BackendDeployJobData, BackendDeployResult>('backendDeployQueue',
    async (job: Job<BackendDeployJobData, BackendDeployResult>) => {

        // get all data out of Job
        let {
            deploymentId,
            projectId,
            imageTag,
            installCommand,
            startCommand,
            envs } = job.data;
        try {
            if (!deploymentId) {
                throw new deploymentJobError("Missing DeploymentId", {
                    msg: "deploymentId missing",
                    metadata: { jobId: job.id },
                    source: "INTERNAL",
                })
            }

            envs = JSON.parse(JSON.stringify(envs));

            if (!envs) {
                throw new deploymentJobError("", {
                    msg: "envs for backend is missing",
                    metadata: { deploymentId },
                    source: "DATABASE"
                })
            }

            if (!installCommand || !startCommand) {
                throw new deploymentJobError("Missing execution commands", {
                    msg: "install and start command are missing during queue for backend build",
                    metadata: { deploymentId },
                    source: "DATABASE"
                })
            }

            if (!imageTag) {
                throw new deploymentJobError("Missing imageTag", {
                    msg: "Image URI named imageTag is missing",
                    metadata: { deploymentId },
                    source: "INTERNAL"
                })
            }

            const backendDeploymentQueued = await safeExecute(() => deploy(
                deploymentId,
                projectId,
                imageTag,
                installCommand,
                startCommand,
                envs), { status: false })
            console.log("Registering ECS task definition:", {
                backendDeploymentQueued
            });
            return {
                msg: false,
                backendDeploymentQueued
            }
        } catch (err) {
    console.error("Deploy failed:", err);
    throw err;
}
    }, { connection })


worker.on("completed", async () => {
    console.log("TASK DEFINATION DONE")
})

worker.on("error", async () => {

})