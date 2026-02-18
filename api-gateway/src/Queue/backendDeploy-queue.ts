import { ConnectionOptions, Queue } from "bullmq";
import { Redis } from "ioredis";

const redis = new Redis({ host: "internal-redis", port: 6379, maxRetriesPerRequest: null });
const connection: ConnectionOptions = redis as unknown as ConnectionOptions;

export const backendDeployQueue = new Queue('backendDeployQueue', { connection });