import { 
    detectProjectType, 
    detectNodeVersion, 
    detectBuildCommand, 
    readJSON, 
    detectOutputDir, 
    detectInstallCommand 
} from "./detector/detectProjectType";

import {config18 , config20} from '../../config/ECSconfig'
import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs"
import { AwsCredentialIdentity } from "@aws-sdk/types";

import dotenv from "dotenv";
import logger from "../../logger/logger";


dotenv.config({
     path: '../../../.env'
});

// Load network config from .env
const SUBNETS = process.env.AWS_SUBNETS?.split(',') || [];
const SECURITY_GROUPS = process.env.AWS_SECURITY_GROUPS?.split(',') || [];

if (SUBNETS.length === 0 || SECURITY_GROUPS.length === 0) {
    throw new Error("Missing subnet or security group configuration in .env");
}

const accessKey = process.env.AWS_ACCESS_KEY_ID;
const secretKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!accessKey || !secretKey) throw new Error("Missing AWS credentials");

const credentials: AwsCredentialIdentity = {
  accessKeyId: accessKey,
  secretAccessKey: secretKey,
};

const ecsClient = new ECSClient({
  region: "ap-south-1",
  credentials,
});

// BUILD FRONTEND -----------

export async function buildFrontend(
    url: string,
    frontendDir: string,
    projectId: string,
    defaulFrontendbuildCommand: string,
    envs: Object
): Promise<boolean | null> {

    const envArray = [
        { name: 'GIT_REPOSITORY__URL', value: url },
        { name: 'PROJECT_ID', value: projectId },
        { name: 'FRONTENDPATH', value: frontendDir },
        { name: 'BUILDCOMMAND', value: defaulFrontendbuildCommand },
        { name: 'AWS_ACCESS_KEY_ID', value: process.env.AWS_ACCESS_KEY_ID },
        { name: 'AWS_SECRET_ACCESS_KEY', value: process.env.AWS_SECRET_ACCESS_KEY },
    ]

    if(envs){
            Object.entries(envs).map(([key, value])=>{
            if (value !== undefined && value !== null) {
                envArray.push({ name: key, value });
            }
        })
    }

    const buildVersion = detectNodeVersion(frontendDir);
    const buildType = detectProjectType(frontendDir)
    const InstallCommand = detectInstallCommand(frontendDir, buildType);

    if(!defaulFrontendbuildCommand){
        defaulFrontendbuildCommand = detectBuildCommand(frontendDir, buildType);
    }

    //  ECS ECR S3
    if(buildVersion === "18"){
        const command18 = new RunTaskCommand({
            cluster:config18.CLUSTER,
            taskDefinition:config18.TASK,
            launchType:"FARGATE",
            count: 1,
            networkConfiguration: {
                awsvpcConfiguration: {
                    assignPublicIp: 'ENABLED',
                    subnets: SUBNETS,
                    securityGroups: SECURITY_GROUPS,
                }
            },
            overrides: {
                containerOverrides: [
                    {
                        name: config18.IMAGENAME,
                        environment: envArray
                    }
                ]
            }
        })
        await ecsClient.send(command18)

    } else if(buildVersion === "20"){
        const command20 = new RunTaskCommand({
            cluster:config20.CLUSTER,
            taskDefinition:config20.TASK,
            launchType:"FARGATE",
            count: 1,
            networkConfiguration: {
                awsvpcConfiguration: {
                    assignPublicIp: 'ENABLED',
                    subnets: SUBNETS,
                    securityGroups: SECURITY_GROUPS,
                }
            },
            overrides: {
                containerOverrides: [
                    {
                        name: config20.IMAGENAME,
                        environment: envArray
                    }
                ]
            }
        })       
        const resp = await ecsClient.send(command20)
        if (resp.failures && resp.failures.length > 0) {
            logger.error("Failed to start ECS task:", resp.failures);
            return false;
        }
        const taskArn = resp.tasks?.[0].taskArn;
        logger.info("Task started:", taskArn);
    }

    return true;
}

// NON _CLOUD WAY 
    
    // const hostFrontendPath = `/var/lib/docker/volumes/veren_clones-data/_data/${projectId}/frontend`;

    // const dockerCommand = `
    //     docker run --rm \
    //     --name ${containerName} \
    //     --user ${uid}:${gid} \
    //     --memory=2g \
    //     --cpus=2 \
    //     -v ${hostFrontendPath}:/app \
    //    ${envFlags} \
    //     dynamic-frontend-builder:${buildVersion}-${buildType} \
    //     sh -c "cd /app && ${InstallCommand} && ${defaulFrontendbuildCommand}"
    //     `.trim();

    // await asyncExec(dockerCommand);