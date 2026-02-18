import {
    SQSClient,
    ReceiveMessageCommand,
    DeleteMessageCommand,
} from "@aws-sdk/client-sqs";

// import { repoAnalysisSuccessHandler } from "../controllers/internalService.controller.js";

import dotenv from 'dotenv';
import { Deployment, Project, publishEvent } from "@veren/domain";
dotenv.config();

const sqs = new SQSClient({
    region: "ap-south-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

const QUEUE_URL = process.env.SERVICE_QUEUE_URL!;

export async function pollQueue() {
    const res = await sqs.send(
        new ReceiveMessageCommand({
            QueueUrl: QUEUE_URL,
            MaxNumberOfMessages: 5,
            WaitTimeSeconds: 5,
            VisibilityTimeout: 60,
        })
    );

    if (!res.Messages) return;

    for (const msg of res.Messages) {
        try {
            const event = JSON.parse(msg.Body!);

            await handleEvent(event);

            await sqs.send(
                new DeleteMessageCommand({
                    QueueUrl: QUEUE_URL,
                    ReceiptHandle: msg.ReceiptHandle!,
                })
            );
        } catch (err) {
            console.error("Processing failed:", err);
        }
    }
}

async function handleEvent(event: any) {
    switch (event.type) {
        // case "FRONTEND_BUILD_SUCCESS":
        //     await frontendBuildSuccess(event);
        //     break;
        // case "BACKEND_BUILD_SUCCESS":
        //     await backendBuildSuccess(event)
        //     break;
        // case "FRONTEND_BUILD_FAILED":
        //     await frontendBuildFailed(event);
        //     break;
        // case "BACKEND_BUILD_FAILED":
        //     await backendBuildFailed(event);
        //     break;
        case "DEPLOYMENT_METADATA_RECIEVED":
            await deploymentMetadataConsumer(event);
            break;
        default:
            // ignore
            break;
    }
}

/* ---------------- ANALYTICS QUEUE STAGE ---------------- */

async function onRepoAnalysisSuccess(event: any) {
    const { projectId, deploymentId } = event;
    const { commitHash, commitMessage, config } = event.payload;

    // await repoAnalysisSuccessHandler(projectId, config, deploymentId, commitHash, commitMessage);
}

async function AnalysisFailed(event: any) {
    const { deploymentId, payload } = event;
    await Deployment.findByIdAndUpdate(deploymentId, {
        status: "failed",
        finishedAt: new Date(),
        error: {
            type: event.type,
            message: payload?.source === "INTERNAL" ? `INTERNAL SERVER ERROR : ${payload.msg}` : payload?.msg,
        }
    })

}

/* ---------------- PRE BUILD QUEUE STAGE ---------------- */

async function buildQueueSuccess(event: any) {
    const { projectId, deploymentId } = event;
    const { frontendTaskArn, backendTaskArn } = event.payload;
    await Deployment.findByIdAndUpdate(deploymentId, {
        status: "building",
        frontendTaskArn,
        backendTaskArn,
    });

}

async function frontendQueueFailed(event: any) {
    // Notify @supoort for the same

    const { deploymentId, payload } = event;
    await Deployment.findByIdAndUpdate(deploymentId, {
        status: "failed",
        finishedAt: new Date(),
        error: {
            type: event.type,
            message: `INTERNAL SERVER ERROR : ${payload.msg}`,
        }
    })
}

async function backendQueueFailed(event: any) {
    // Notify @supoort for the same

    const { deploymentId, payload } = event;
    await Deployment.findByIdAndUpdate(deploymentId, {
        status: "failed",
        finishedAt: new Date(),
        error: {
            type: event.type,
            message: `INTERNAL SERVER ERROR : ${payload.msg}`,
        }
    })
}

async function unknownIssue(event: any) {
    // Notify @supoort for the same

    const { deploymentId, payload } = event;
    await Deployment.findByIdAndUpdate(deploymentId, {
        status: "failed",
        finishedAt: new Date(),
        error: {
            type: event.type,
            message: `UNCATCHED ISSUE : ${payload.msg}`,
        }
    })
}

/* ---------------- ECS POST BUILD STAGE ---------------- */

async function frontendBuildSuccess(event: any) {
    const { projectId, deploymentId, artifactUrl } = event;

    const deployment = await Deployment.findById(deploymentId)
    if (deployment?.rollBackArtifactUrl != "" || deployment?.rollBackArtifactUrl?.length != 0) {
        const oldArtifact = deployment?.artifactUrl;
        await Deployment.findByIdAndUpdate(deploymentId, {
            artifactUrl,
            rollBackArtifactUrl: oldArtifact
        })
    } else {
        await Deployment.findByIdAndUpdate(deploymentId, {
            artifactUrl,
        })
    }
}

async function backendBuildSuccess(event: any) {
    const { deploymentId, projectId } = event;
    const { imageTag } = event.payload;

}
async function frontendBuildFailed(event: any) {
    const { deploymentId, payload } = event;
   
    // queue delete of current deployment if exist
}
async function backendBuildFailed(event: any) {
    const { deploymentId, payload } = event;

    // queue delete of current backend deployment if exist
}

async function deploymentMetadataConsumer(event:any) {
    const {deploymentId, projectId, payload} = event;

    const ip = payload.publicIp;

    console.log(ip);
}