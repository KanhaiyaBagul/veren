import { Request, Response } from "express";
import { Project } from "@veren/domain";
import ApiError from "../utils/api-utils/ApiError.js";
import asyncHandler from "../utils/api-utils/asyncHandler.js";
import axios from "axios";
import config from "../types/configuration/index.js";
import { safeExecute } from "../utils/api-utils/SafeExecute.js";
import { Deployment } from "@veren/domain";
import { buildQueue } from "../Queue/build-queue.js";

// BASED ON WORKER ENUMS
const repoAnalysisSuccessHandler = async (projectId: string, config:Object, deploymentId:string, commitHash: string, commitMessage: string) => {
  let {
    frontendConfig,
    backendConfig,
  } = config as config;
  
  if (!projectId) {
    throw new ApiError(404, "Project Id is not found")
  }

  if (!deploymentId || typeof deploymentId !== "string") {
    throw new ApiError(400, "Project Id is required for deploying the site.")
  }

  if (!commitHash || !commitMessage || commitHash === "" || commitMessage === "") {
    throw new ApiError(404, "Metadata not found to update the deployment Config");
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project Not found")
  }

  const userId = project.createdBy.toString();

  const frontendEnv = project.envs.frontendEnv;
  const backendEnv = project.envs.backendEnv;
  const url = project.git.repoUrl

  const deployment = await Deployment.findById(deploymentId);

  if (!deployment) {
    throw new ApiError(404, "Deployment Not Found");
  }
  if (deployment.owner.toString() != userId) {
    throw new ApiError(401, "Unauthorized");
  }
  await Deployment.updateOne(
    { _id: deploymentId },
    {
      $set: {
        commitHash,
        commitMessage,
        status: "building"
      }
    }
  )

  await buildQueue.add(
    "buildQueue",
    {
      url,
      projectId: project.name,
      deploymentId,
      frontendConfig: { ...frontendConfig, frontendEnv },
      backendConfig: { ...backendConfig, backendEnv },
    },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    }
  )
}

const updateProjectConfigBuild = asyncHandler(async (req: Request, res: Response) => {
  const { projectId, deploymentId, FrontendtaskArn, BackendtaskArn } = req.body;

  // Update deployment status to Building
  await Deployment.findByIdAndUpdate(deploymentId, {
    status: "building",
    frontendTaskArn: FrontendtaskArn,
    backendTaskArn: BackendtaskArn,
  })
  try {

    // axios.post(`http://notification-service:3000/api/v1/log/${deploymentId}`, {
    //   projectId,
    //   deploymentId,
    //   FrontendtaskArn,
    //   BackendtaskArn
    // })

  } catch (error: any) {
    return new ApiError(500, "Something went wrong while sending request to noti. service", error)
  }
  return res.status(200).json({
    status: "Recieved"
  })
})

const getProjectConfigBuild = asyncHandler(async (req: Request, res: Response) => {

})


export {
  repoAnalysisSuccessHandler,
  updateProjectConfigBuild,
  getProjectConfigBuild
}