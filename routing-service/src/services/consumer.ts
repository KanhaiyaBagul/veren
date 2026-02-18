import {
    SQSClient,
    ReceiveMessageCommand,
    DeleteMessageCommand,
} from "@aws-sdk/client-sqs";

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
        case "DEPLOYMENT_METADATA_RECIEVED":
            await deploymentMetadataConsumer(event);
            break;
        default:
            // ignore
            break;
    }
}

async function deploymentMetadataConsumer(event:any) {
    const {deploymentId, projectId, payload} = event;

    const ip = payload.publicIp;

    console.log(ip);
}