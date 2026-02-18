import dotenv from "dotenv";
import { buildResult } from "../types";
import { AwsCredentialIdentity } from "@aws-sdk/types";
import { deploymentJobError } from "../utils/jobError";
import {DeploymentStatus, publishEvent} from "@veren/domain"
import {
    ECSClient,
    RegisterTaskDefinitionCommand,
    CreateServiceCommand,
    UpdateServiceCommand,
    DescribeServicesCommand
} from "@aws-sdk/client-ecs"

import { ListTasksCommand, DescribeTasksCommand } from "@aws-sdk/client-ecs"
import { DescribeNetworkInterfacesCommand, EC2Client } from "@aws-sdk/client-ec2"


dotenv.config({
    path: "../../.env"
})

// Network config
const SUBNETS = process.env.AWS_SUBNETS?.split(',') || []
const SECURITY_GROUPS = process.env.AWS_SECURITY_GROUPS?.split(',') || []

if (SUBNETS.length === 0 || SECURITY_GROUPS.length === 0) {
    throw new Error("Missing subnet or security group configuration in .env");
}

const accessKey = process.env.AWS_ACCESS_KEY_ID!;
const secretKey = process.env.AWS_SECRET_ACCESS_KEY!;


if (!accessKey || !secretKey) {
    throw new Error("Missing AWS credentials");
}
const credentials: AwsCredentialIdentity = {
    accessKeyId: accessKey,
    secretAccessKey: secretKey
}
const ecs = new ECSClient({
    region: "ap-south-1",
    credentials
})


const ec2 = new EC2Client({
    region: "ap-south-1",
    credentials
})


export default async function deploy(
    deploymentId: string,
    projectId: string,
    imageTag: string,
    installCommand: string,
    startCommand: string,
    envs: any): Promise<buildResult> {

    try {
        const family = `backend-${projectId}`;

        const serviceName = `backend-service-${projectId}`;

        const cluster = process.env.AWS_BACKEND_CLUSTER!;

        // ENV HANDLING
        const RESERVED_ENV_KEYS = new Set([
            "PORT", "NODE_ENV", "START_CMD", "FRONTEND_URL"
        ])

        const dynamicenvs: { name: string; value: string }[] = [];

        (envs || []).forEach((env: any) => {
            const key = String(env.key).trim();

            if (!key) return;

            if (RESERVED_ENV_KEYS.has(key)) {
                console.warn(`Skipping reserved env variable: ${key}`);
                return;
            }

            dynamicenvs.push({
                name: key,
                value: String(env.value ?? ""),
            });
        });

        // Register new task defination (everytime work)
        const registerResponse = await ecs.send(new RegisterTaskDefinitionCommand({
            family,
            requiresCompatibilities: ['FARGATE'],
            networkMode: "awsvpc",
            cpu: "256",
            memory: "512",
            executionRoleArn: process.env.AWS_EXECUTION_ROLE_ARN,
            containerDefinitions: [
                {
                    name: "backend",
                    image: imageTag,
                    essential: true,
                    portMappings: [{ containerPort: 80, protocol: "tcp" }],

                    environment: [
                        { name: "NODE_ENV", value: "production" },
                        { name: "START_CMD", value: startCommand },
                        { name: "FRONTEND_URL", value: "http://6971ca39a05c7356e60f8864.veren:8004" },
                        { name: "PORT", value: "80" },
                        ...dynamicenvs
                    ],

                    logConfiguration: {
                        logDriver: "awslogs",
                        options: {
                            "awslogs-group": "/ecs/backend",
                            "awslogs-region": process.env.AWS_REGION!,
                            "awslogs-stream-prefix": serviceName,
                        }
                    }
                }
            ]
        }))

        const taskDefArn = registerResponse.taskDefinition?.taskDefinitionArn!;

        // Checking ifg service exists
        const describe = await ecs.send(
            new DescribeServicesCommand({
                cluster,
                services: [serviceName],
            })
        )

        const serviceExists =
            describe.services &&
            describe.services.length > 0 &&
            describe.services[0].status !== "INACTIVE";

        if (!serviceExists) {
            // creating a service
            await ecs.send(
                new CreateServiceCommand({
                    cluster,
                    serviceName,
                    taskDefinition: taskDefArn,
                    desiredCount: 1,
                    launchType: "FARGATE",
                    networkConfiguration: {
                        awsvpcConfiguration: {
                            subnets: SUBNETS,
                            securityGroups: SECURITY_GROUPS,
                            assignPublicIp: "ENABLED"
                        }
                    }
                })
            )
        } else {
            // update service
            await ecs.send(
                new UpdateServiceCommand({
                    cluster,
                    service: serviceName,
                    taskDefinition: taskDefArn,
                    forceNewDeployment: true,
                })
            )
        }
        let newestTask;
        let attempts = 0;

        while (!newestTask && attempts < 20) {
            const list = await ecs.send(new ListTasksCommand({
                cluster,
                serviceName
            }));

            if (!list.taskArns?.length) {
                console.log("Waiting for ECS task to start...");
                await new Promise(res => setTimeout(res, 5000));
                attempts++;
                continue;
            }

            const described = await ecs.send(new DescribeTasksCommand({
                cluster,
                tasks: list.taskArns
            }));

            const runningTasks = described.tasks
                ?.filter(t => t.startedAt)
                .sort((a, b) =>
                    new Date(b.startedAt!).getTime() -
                    new Date(a.startedAt!).getTime()
                );

            newestTask = runningTasks?.[0];

            if (!newestTask) {
                await new Promise(res => setTimeout(res, 5000));
                attempts++;
            }
        }

        if (!newestTask) {
            throw new Error("No tasks found.");
        }

        const eniId = newestTask.attachments?.[0].details
            ?.find(d => d.name === "networkInterfaceId")?.value;
        const eni = await ec2.send(new DescribeNetworkInterfacesCommand({
            NetworkInterfaceIds: [eniId!]
        }))

        const publicIp = eni.NetworkInterfaces?.[0]
            ?.Association?.PublicIp
        console.log(publicIp);
    

        publishEvent({
            type: DeploymentStatus.DEPLOYMENT_METADATA_RECIEVED,
            projectId: projectId,
            deploymentId: deploymentId,
            payload: {
                publicIp
            },
        });

        return {
            status: true,
            backendDeploymentArn: taskDefArn
        }

    } catch (err) {

        if (err instanceof deploymentJobError) {
            throw err;
        }
        console.log(err);
        throw new deploymentJobError("Backend Final build operation failed", {
            msg: "Unexpected failure",
            metadata: deploymentId
        })
    }
}

