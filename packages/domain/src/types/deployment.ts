import { Types } from "mongoose";

export interface IDeployment {
    _id: Types.ObjectId;

    projectId: Types.ObjectId;
    owner: Types.ObjectId,
    status: "queued" | "building" | "deployed" | "failed";
    number: number;
    commitHash: string;
    commitMessage?: string;
    buildLogsUrl?: string;
    frontendTaskArn: string;
    backendTaskArn: string;
    backendImageUrl: string;
    artifactUrl?: string;
    rollBackArtifactUrl?: string
    startedAt: Date;
    finishedAt?: Date;
}