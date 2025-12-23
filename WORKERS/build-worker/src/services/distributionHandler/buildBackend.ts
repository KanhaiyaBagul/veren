import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import {
    detectProjectType,
    detectNodeVersion,
    detectBuildCommand,
    readJSON,
    detectOutputDir,
    detectInstallCommand
} from "./detector/detectProjectType";

const asyncExec = promisify(exec);

export async function buildBackend(backendDir: string, projectId: string, defaulBackendtbuildCommand: string): Promise<string | null> {

    const buildVersion = detectNodeVersion(backendDir);
    const uid = process.getuid?.() ?? 1000;
    const gid = process.getgid?.() ?? 1000;

    const hostBackendPath = `/var/lib/docker/volumes/veren_clones-data/_data/${projectId}/backend`;
    const containerName = `backend-builder-${projectId}`;

    const dockerCommand = `
        docker run --rm \
        --name ${containerName} \
        --user ${uid}:${gid} \
        --memory=2g \
        --cpus=2 \
        -v ${hostBackendPath}:/app \
        dynamic-backend-builder:${buildVersion}} \
        sh -c "cd /app && npm i && ${defaulBackendtbuildCommand}"
        `.trim();

    await asyncExec(dockerCommand);

    console.log(`Container ${containerName} started for backend build.`);

    return containerName;
}
