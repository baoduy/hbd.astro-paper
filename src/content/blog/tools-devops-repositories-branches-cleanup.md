---
author: Steven Hoang
pubDatetime: 2024-08-21T12:00:00Z
title: "[DevOps] Automating Branch Cleanup in Azure DevOps with Node.js"
postSlug: tools-devops-repositories-branches-cleanup
featured: false
draft: false
tags:
  - azure-devops
  - repo-cleanup
  - tools
description: "A comprehensive guide on automating the cleanup of old branches in Azure DevOps Git repositories using a Node.js script.
The script identifies branches that haven't been updated in the last 90 days and deletes them if they meet certain criteria."
---

## Introduction

As software projects evolve, Git repositories can become cluttered with outdated or redundant branches. This clutter makes repository navigation cumbersome and can introduce confusion or errors in the development process. Automating the cleanup of these branches helps maintain an organized and efficient development environment.

In this guide, we'll walk through setting up a TypeScript script that automatically deletes old, unnecessary branches in Azure DevOps. We'll cover the essential steps, focusing on the implementation and automation of the cleanup process.


## Table of Contents

## Why Automate Branch Cleanup?

Automating branch cleanup is essential for several reasons:

- **Reduce Clutter**: Keeps the repository clean, making it easier for developers to navigate.
- **Improve Performance**: Enhances CI/CD pipeline performance by reducing overhead.
- **Prevent Confusion**: Minimizes the risk of developers working on or merging outdated branches.
- **Enhance Security**: Removes obsolete branches that may contain vulnerabilities.

## Prerequisites

Ensure you have the following before starting:

- **Azure DevOps Account**: Access to your organization's Azure DevOps instance.
- **Personal Access Token (PAT)**: A PAT with permissions to access and manage repositories.
- **Node.js and npm**: Installed on your machine (Node.js version 14 or later).
- **TypeScript**: Installed globally (`npm install -g typescript`).
- **Azure DevOps Node API Package**: Install via `npm install azure-devops-node-api`.
- **dotenv Package**: Install via `npm install dotenv`.


## Project Setup

1. **Create a New Directory**: Initialize a new Node.js project.

   ```bash
   mkdir azure-devops-branch-cleanup
   cd azure-devops-branch-cleanup
   npm init -y
   ```

2. **Install Dependencies**:

   ```bash
   npm install @azure/identity @microsoft/microsoft-graph-client azure-devops-node-api dayjs dotenv
   npm install --save-dev typescript @types/node
   ```


## Configuration File

Create a `config.json` file in your project root to specify branches that should be excluded from deletion:

```json
{
  "globalExcludes": ["master", "develop", "main", "release"],
  "repositoryExcludes": {
    "your-repo-name": ["feature/important-branch"]
  }
}
```

- **globalExcludes**: Branches excluded from deletion across all repositories.
- **repositoryExcludes**: Specific branches to exclude in specific repositories.


## Implementing the TypeScript Script

Create a TypeScript file, e.g., `cleanup.ts`, and implement the following steps:

### 1. Loading Environment Variables

Use the `dotenv` package to load environment variables.

```typescript
import * as dotenv from "dotenv";
dotenv.config();

const isDryRun = process.env.DryRun === "true";
```

**Environment Variables Required**:

- `AZURE_DEVOPS_URL`: Your Azure DevOps organization URL.
- `AZURE_DEVOPS_PAT`: Your Personal Access Token.
- `AZURE_DEVOPS_PROJECT`: Your project name.
- `DryRun`: Set to `"true"` for dry-run mode (no actual deletions).

### 2. Defining the Configuration Interface

Define an interface to ensure type safety.

```typescript
interface Config {
  globalExcludes: string[];
  repositoryExcludes: {
    [repoName: string]: string[];
  };
}
```

### 3. Setting Constants

Define constants used in the script.

```typescript
const DAYS_90_MS = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds
```

### 4. Getting the Git API Client

Authenticate and obtain the Git API client.

```typescript
import * as azdev from "azure-devops-node-api";
import * as GitApi from "azure-devops-node-api/GitApi";

async function getGitApi(): Promise<GitApi.IGitApi> {
  const orgUrl = process.env.AZURE_DEVOPS_URL;
  const token = process.env.AZURE_DEVOPS_PAT;

  if (!orgUrl || !token) {
    throw new Error(
      "Azure DevOps URL or PAT is not set in environment variables."
    );
  }

  const authHandler = azdev.getPersonalAccessTokenHandler(token);
  const connection = new azdev.WebApi(orgUrl, authHandler);
  return await connection.getGitApi();
}
```

### 5. Loading the Configuration

Load the `config.json` file.

```typescript
import * as fs from "fs";
import * as path from "path";

function loadConfig(): Config {
  const configPath = path.join(__dirname, "config.json");
  const configContent = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(configContent) as Config;
}
```

### 6. Retrieving Repositories and Branches

Get the list of repositories and branches.

```typescript
import * as GitInterfaces from "azure-devops-node-api/interfaces/GitInterfaces";

async function getRepositories(
  gitApi: GitApi.IGitApi,
  project: string
): Promise<GitInterfaces.GitRepository[]> {
  return await gitApi.getRepositories(project);
}

async function getBranches(
  gitApi: GitApi.IGitApi,
  project: string,
  repoId: string
): Promise<GitInterfaces.GitRef[]> {
  const branches = await gitApi.getRefs(repoId, project);
  return branches.filter(b => b.name.startsWith("refs/heads/"));
}
```

### 7. Determining the Last Commit Date

Get the date of the last commit on a branch.

```typescript
async function getLastCommitDate(
  gitApi: GitApi.IGitApi,
  project: string,
  repoId: string,
  branchName: string
): Promise<Date | null> {
  const commits = await gitApi.getCommits(
    repoId,
    { itemVersion: { version: branchName } },
    project,
    undefined,
    1
  );

  if (commits.length > 0) {
    const commitDate = commits[0].committer.date || commits[0].author.date;
    return new Date(commitDate);
  }

  return null;
}
```

### 8. Checking if a Branch is Merged

Check if a branch is merged into any of the target branches.

```typescript
import { GitVersionType } from "azure-devops-node-api/interfaces/GitInterfaces";

async function isBranchMerged(
  gitApi: GitApi.IGitApi,
  project: string,
  repoId: string,
  branch: string,
  targetBranches: string[]
): Promise<boolean> {
  for (const targetBranch of targetBranches) {
    const diff = await gitApi.getCommitDiffs(
      repoId,
      project,
      true,
      1,
      undefined,
      { baseVersionType: GitVersionType.Branch, baseVersion: branch },
      { targetVersionType: GitVersionType.Branch, targetVersion: targetBranch }
    );

    if (diff && diff.aheadCount === 0) {
      return true;
    }
  }
  return false;
}
```

### 9. Deleting a Branch

Delete the branch if it meets the criteria.

```typescript
async function deleteBranch(
  gitApi: GitApi.IGitApi,
  project: string,
  repoId: string,
  branch: GitInterfaces.GitRef
): Promise<void> {
  if (!isDryRun) {
    if (branch.isLocked) {
      await gitApi.updateRef(
        { name: branch.name, isLocked: false },
        repoId,
        "",
        project
      );
    }

    await gitApi.updateRefs(
      [
        {
          name: branch.name,
          newObjectId: "0000000000000000000000000000000000000000",
          oldObjectId: branch.objectId,
        },
      ],
      repoId,
      "",
      project
    );
  }

  console.log(`Deleted branch: ${branch.name} (Dry Run: ${isDryRun})`);
}
```

### 10. Compiling the Exclusion List

Combine global and repository-specific exclusions.

```typescript
function getExclusionList(config: Config, repoName: string): string[] {
  const globalExcludes = config.globalExcludes || [];
  const repoSpecificExcludes = config.repositoryExcludes[repoName] || [];
  return [...new Set([...globalExcludes, ...repoSpecificExcludes])];
}
```

### 11. Cleaning Up Branches

Main function orchestrating the cleanup.

```typescript
async function cleanUpBranches(): Promise<void> {
  const project = process.env.AZURE_DEVOPS_PROJECT;
  if (!project) {
    throw new Error(
      "Azure DevOps project name is not set in environment variables."
    );
  }

  const config = loadConfig();
  const now = new Date();
  const gitApi = await getGitApi();
  const repositories = await getRepositories(gitApi, project);

  for (const repo of repositories) {
    console.log(`Processing repository: ${repo.name}`);
    const excludeBranches = getExclusionList(config, repo.name);
    const branches = await getBranches(gitApi, project, repo.id);

    for (const branch of branches) {
      const branchName = branch.name.replace("refs/heads/", "");

      if (excludeBranches.includes(branchName)) {
        console.log(`Skipping excluded branch: ${branchName}`);
        continue;
      }

      const lastCommitDate = await getLastCommitDate(
        gitApi,
        project,
        repo.id,
        branchName
      );

      if (
        !lastCommitDate ||
        now.getTime() - lastCommitDate.getTime() < DAYS_90_MS
      ) {
        console.log(`Branch is recent or active: ${branchName}`);
        continue;
      }

      const isMerged = await isBranchMerged(
        gitApi,
        project,
        repo.id,
        branchName,
        config.globalExcludes
      );

      if (isMerged) {
        await deleteBranch(gitApi, project, repo.id, branch);
      } else {
        console.log(`Branch is not merged: ${branchName}`);
      }
    }
  }
}

cleanUpBranches().catch(err => {
  console.error("An error occurred:", err);
});
```

## Automating with Azure DevOps Pipeline

To automate the script execution, set up an Azure DevOps Pipeline.

1. **Create a Variable Group**:

   - Navigate to **Pipelines** > **Library** in Azure DevOps.
   - Click **"Variable groups"** > **"Add variable group"**.
   - Name the group, e.g., `az-devops`.
   - Add the variables:
     - `AZURE_DEVOPS_URL`
     - `AZURE_DEVOPS_PAT` (set as secret)
     - `AZURE_DEVOPS_PROJECT`
   - Save the variable group.

2. **Create the Pipeline YAML File**:

   Create a `azure-pipelines.yml` file in your repository:

   ```yaml
   trigger: none

   schedules:
     - cron: "0 0 * * 0" # Runs every Sunday at 00:00
       displayName: "Weekly Branch Cleanup"
       branches:
         include:
           - main
       always: true
       batch: false

   pool:
     vmImage: ubuntu-latest

   variables:
     - group: az-devops

   steps:
     - task: NodeTool@0
       inputs:
         versionSpec: "14.x"
       displayName: "Install Node.js"

     - script: |
         npm ci
         npx ts-node cleanup.ts
       displayName: "Run Branch Cleanup Script"
       env:
         AZURE_DEVOPS_URL: $(AZURE_DEVOPS_URL)
         AZURE_DEVOPS_PAT: $(AZURE_DEVOPS_PAT)
         AZURE_DEVOPS_PROJECT: $(AZURE_DEVOPS_PROJECT)
   ```

   - **Notes**:
     - Replace `cleanup.ts` with the path to your script.
     - Ensure the pipeline has access to the variable group.


## Conclusion

Automating branch cleanup ensures your repositories remain organized, improving developer productivity and reducing potential errors. By following this guide, you can set up a script to automatically identify and delete old, unused branches in Azure DevOps, and schedule it using Azure Pipelines for regular maintenance.

**Benefits**:

- **Efficiency**: Saves time and resources.
- **Consistency**: Maintains a consistent repository state.
- **Scalability**: Easily extends to multiple projects and repositories.


## Additional Resources

- **Full Working Source Code**: [drunkcoding public code](https://dev.azure.com/drunk24/drunkcoding-public/_git/az.tools?path=/az-devops-delete-branches&version=GBmain)
- **Azure DevOps Node API Documentation**: [Git API Reference](https://github.com/microsoft/azure-devops-node-api/blob/master/api/GitApi.ts)
- **Azure DevOps REST API Reference**: [Git Repositories](https://docs.microsoft.com/en-us/rest/api/azure/devops/git/repositories)


**Note**: Always test scripts in a controlled environment before deploying them in production. Ensure compliance with your organization's policies and procedures.


## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven** | *[GitHub](https://github.com/baoduy)*
