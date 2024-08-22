---
author: Steven Hoang
pubDatetime: 2024-08-21T12:00:00Z
title: "[DevOps] Automating Branch Cleanup in Azure DevOps with Node.js"
#postSlug: devops-repositories-branches-cleanup
featured: true
draft: false
tags:
  - azure-devops
  - repo-cleanup
description: "This article provides a comprehensive guide on automating the cleanup of old branches in Azure DevOps Git repositories using a Node.js script.
The script identifies branches that haven't been updated in the last 90 days and deletes them if they meet certain criteria."
---

Managing branches in a Git repository can become cumbersome, especially when dealing with multiple repositories and projects. Over time, old and unused branches can clutter the repository, making it difficult to navigate and manage. To address this issue, we can automate the cleanup process using a Node.js script that interacts with Azure DevOps.

In this blog post, we'll walk through a script that automates the cleanup of old branches in Azure DevOps Git repositories. The script checks for branches that haven't been updated in the last 90 days and deletes them if they meet certain criteria.

## Environment Variables

Before we dive into the script, make sure you have the following environment variables set up in a `.env` file:

- `AZURE_DEVOPS_URL`: The URL of your Azure DevOps organization.
- `AZURE_DEVOPS_PAT`: Your Azure DevOps Personal Access Token.
- `AZURE_DEVOPS_PROJECT`: The name of the Azure DevOps project.
- `DryRun`: Set to `"true"` to run the script in dry-run mode (no actual deletions).

## Configuration

The script uses a `config.json` file to specify the branches to exclude from deletion. Here is an example configuration:

```json
{
  "globalExcludes": [
    "master",
    "develop",
    "main",
    "release"
  ],
  "repositoryExcludes": {
    "your-repo": ["branch/name"]
  }
}
```

## Step-by-Step Implementation and Purpose of Each Method

### 1. Loading Environment Variables

The script starts by loading environment variables from a `.env` file using the `dotenv` package. These variables include the Azure DevOps URL, Personal Access Token (PAT), project name, and a flag to indicate if the script should run in dry-run mode.

```typescript
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Check if the script should run in dry-run mode
const isDryRun = process.env.DryRun === "true";
```

### 2. Configuration Interface

The `Config` interface defines the structure of the configuration object, which includes global and repository-specific branch exclusions.

```typescript
// Configuration interface for branch exclusions
interface Config {
  globalExcludes: string[];
  repositoryExcludes: {
    [repoName: string]: string[];
  };
}
```

### 3. Constants

The `DAYS_90_MS` constant represents 90 days in milliseconds, which is used to determine if a branch is old enough to be considered for deletion.

```typescript
// 90 days in milliseconds
const DAYS_90_MS = 90 * 24 * 60 * 60 * 1000;
```

### 4. Getting the Git API Client

The `getGitApi` function retrieves the Git API client for Azure DevOps using the organization URL and PAT.

```typescript
import * as azdev from "azure-devops-node-api";
import * as GitApi from "azure-devops-node-api/GitApi";

/**
 * Get the Git API client for Azure DevOps.
 * @returns {Promise<GitApi.IGitApi>} The Git API client.
 */
async function getGitApi(): Promise<GitApi.IGitApi> {
  const orgUrl = process.env.AZURE_DEVOPS_URL; // Azure DevOps organization URL
  const token = process.env.AZURE_DEVOPS_PAT; // Personal Access Token (PAT)

  if (!orgUrl) {
    throw new Error(
      "Azure DevOps ORG URL is not set in the environment variable named 'AZURE_DEVOPS_URL'.",
    );
  }
  if (!token) {
    throw new Error(
      "Azure DevOps PAT token is not set in the environment variable named 'AZURE_DEVOPS_URL'.",
    );
  }

  const authHandler = azdev.getPersonalAccessTokenHandler(token);
  const connection = new azdev.WebApi(orgUrl, authHandler);
  return await connection.getGitApi();
}
```

### 5. Loading Configuration

The `loadConfig` function loads the configuration from a `config.json` file, which specifies the branches to exclude from deletion.

```typescript
import * as fs from "fs";
import * as path from "path";

/**
 * Load the configuration from the config.json file.
 * @returns {Config} The configuration object.
 */
function loadConfig(): Config {
  const configPath = path.join(__dirname, "config.json");
  const configContent = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(configContent);
}
```

### 6. Retrieving Repositories and Branches

The `getRepositories` and `getBranches` functions retrieve the list of repositories and branches in a project, respectively.

```typescript
import * as GitInterfaces from "azure-devops-node-api/interfaces/GitInterfaces";

/**
 * Get the list of repositories in a project.
 * @param {GitApi.IGitApi} gitApi - The Git API client.
 * @param {string} project - The project name.
 * @returns {Promise<GitInterfaces.GitRepository[]>} The list of repositories.
 */
async function getRepositories(
  gitApi: GitApi.IGitApi,
  project: string,
): Promise<GitInterfaces.GitRepository[]> {
  return await gitApi.getRepositories(project);
}

/**
 * Get the list of branches in a repository.
 * @param {GitApi.IGitApi} gitApi - The Git API client.
 * @param {string} project - The project name.
 * @param {string} repoId - The repository ID.
 * @returns {Promise<GitInterfaces.GitRef[]>} The list of branches.
 */
async function getBranches(
  gitApi: GitApi.IGitApi,
  project: string,
  repoId: string,
): Promise<GitInterfaces.GitRef[]> {
  const branches = await gitApi.getRefs(repoId, project);
  // Only process refs/heads branches
  return branches.filter((b) => b.name.startsWith("refs/heads"));
}
```

### 7. Getting the Last Commit Date

The `getLastCommitDate` function retrieves the date of the last commit on a branch. This is used to determine if the branch is old enough to be deleted.

```typescript
/**
 * Get the date of the last commit on a branch.
 * @param {GitApi.IGitApi} gitApi - The Git API client.
 * @param {string} project - The project name.
 * @param {string} repoId - The repository ID.
 * @param {string} branchName - The branch name.
 * @returns {Promise<Date | null>} The date of the last commit or null if no commits found.
 */
async function getLastCommitDate(
  gitApi: GitApi.IGitApi,
  project: string,
  repoId: string,
  branchName: string,
): Promise<Date | null> {
  const commits = await gitApi.getCommits(
    repoId,
    {
      itemVersion: {
        version: branchName,
      },
    },
    project,
    undefined,
    1,
  ); // Fetch only the most recent commit

  if (commits?.length > 0) {
    return new Date(commits[0].committer.date ?? commits[0].author.date);
  }

  return null;
}
```

### 8. Checking if a Branch is Merged

The `isBranchMerged` function checks if a branch is merged into a target branch. This helps ensure that only merged branches are deleted.

```typescript
/**
 * Check if a branch is merged into a target branch.
 * @param {GitApi.IGitApi} gitApi - The Git API client.
 * @param {string} project - The project name.
 * @param {string} repoId - The repository ID.
 * @param {string} branch - The branch name.
 * @param {string} targetBranch - The target branch name.
 * @returns {Promise<boolean>} True if the branch is merged, false otherwise.
 */
async function isBranchMerged(
  gitApi: GitApi.IGitApi,
  project: string,
  repoId: string,
  branch: string,
  targetBranch: string,
): Promise<boolean> {
  const diff = await gitApi.getCommitDiffs(
    repoId,
    project,
    true,
    5,
    undefined,
    {
      baseVersionType: GitVersionType.Branch,
      baseVersion: branch,
    },
    {
      targetVersionType: GitVersionType.Branch,
      targetVersion: targetBranch,
    },
  );

  if (diff?.aheadCount > 0 || diff?.behindCount > 0)
    console.log(`\t${repoId}: ${branch} vs ${targetBranch}:`, diff);
  // diff will be null if the target branch is not found.
  return diff?.aheadCount === 0;
}
```

### 9. Deleting a Branch

The `deleteBranch` function deletes a branch from a repository. If the branch is locked, it first unlocks the branch before deleting it.

```typescript
/**
 * Delete a branch from a repository.
 * @param {GitApi.IGitApi} gitApi - The Git API client.
 * @param {string} project - The project name.
 * @param {string} repoId - The repository ID.
 * @param {GitInterfaces.GitRef} branch - The branch reference.
 */
async function deleteBranch(
  gitApi: GitApi.IGitApi,
  project: string,
  repoId: string,
  branch: GitInterfaces.GitRef,
): Promise<void> {
  try {
    if (!isDryRun) {
      if (branch.isLocked) {
        // Unlock the branch
        await gitApi.updateRef(
          {
            name: branch.name,
            isLocked: false,
          },
          repoId,
          "",
          project,
        );
      }

      // Delete the branch
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
        project,
      );
    }

    console.log(`\t${repoId}: Successfully DELETED branch: ${branch.name}`, {
      isDryRun,
    });
  } catch (error) {
    console.error(
      `\t${repoId}: Failed to delete branch: ${branch.name}.`,
      error.message,
    );
  }
}
```

### 10. Getting the Exclusion List

The `getExclusionList` function retrieves the list of branches to exclude from deletion based on the configuration.

```typescript
/**
 * Get the list of branches to exclude from deletion.
 * @param {Config} config - The configuration object.
 * @param {string} repoName - The repository name.
 * @returns {string[]} The list of branches to exclude.
 */
function getExclusionList(config: Config, repoName: string): string[] {
  const globalExcludes = config.globalExcludes || [];
  const repoSpecificExcludes = config.repositoryExcludes[repoName] || [];
  return [...new Set([...globalExcludes, ...repoSpecificExcludes])];
}
```

### 11. Cleaning Up Branches

The `cleanUpBranches` function orchestrates the entire cleanup process. It retrieves the repositories and branches, checks if the branches are old and merged, and deletes them if they meet the criteria.

```typescript
/**
 * Clean up old branches in all repositories of a project.
 */
async function cleanUpBranches(): Promise<void> {
  const project = process.env.AZURE_DEVOPS_PROJECT;
  if (!project) {
    throw new Error(
      "Azure DevOps PROJECT name is not set in the environment variable named 'AZURE_DEVOPS_PROJECT'.",
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
        console.log(`\t${repo.name}: Skipping excluded branch: ${branchName}`);
        continue;
      }

      const lastCommitDate = await getLastCommitDate(
        gitApi,
        project,
        repo.id,
        branchName,
      );

      if (
        !lastCommitDate ||
        now.getTime() - lastCommitDate.getTime() < DAYS_90_MS
      ) {
        console.log(`\t${repo.name}: Branch is still in use: ${branchName}`);
        continue;
      }

      const status = await Promise.all(
        config.globalExcludes.map(
          async (b) =>
            await isBranchMerged(gitApi, project, repo.id, branchName, b),
        ),
      );

      if (status.find((s) => s === true)) {
        await deleteBranch(gitApi, project, repo.id, branch);
      } else {
        console.log(
          `\t${repo.name}: The Branch is not merged to any of:`,
          config.globalExcludes,
        );
      }
    }
  }
}

// Start the branch cleanup process and handle any errors
cleanUpBranches().catch((err) => {
  console.error("An error occurred:", err);
});
```

## How It Works

1. **Loading Environment Variables**: The script loads environment variables from a `.env` file to get the Azure DevOps URL, PAT, project name, and dry-run mode flag.
2. **Loading Configuration**: The script loads the branch exclusion configuration from a `config.json` file.
3. **Getting the Git API Client**: The script retrieves the Git API client for Azure DevOps using the organization URL and PAT.
4. **Retrieving Repositories and Branches**: The script retrieves the list of repositories and branches in the specified project.
5. **Getting the Last Commit Date**: The script retrieves the date of the last commit on each branch to determine if the branch is old enough to be considered for deletion.
6. **Checking if a Branch is Merged**: The script checks if each branch is merged into any of the target branches specified in the configuration.
7. **Deleting a Branch**: The script deletes branches that are old and merged, unless the script is running in dry-run mode.
8. **Cleaning Up Branches**: The script orchestrates the entire cleanup process, iterating through repositories and branches, and deleting branches that meet the criteria.

## Full Code of the Program

Please download the complete code of the program here: https://dev.azure.com/drunk24/drunkcoding-public/_git/az.tools?path=/az-devops-delete-branches

## Azure DevOps Pipeline Setup

To automate the execution of this script, you can set up an Azure DevOps pipeline. Here is an example YAML pipeline configuration:

1. **Setting Up Azure DevOps Library Group for Environment Variables**

To securely manage and use environment variables in your Azure DevOps pipeline, you can set up a library group:

- **Navigate to Azure DevOps**: Go to your Azure DevOps project.
- **Library**: In the left sidebar, click on **Pipelines** and then **Library**.
- **Add Variable Group**: Click on **+ Variable group**.
- **Name and Description**: Provide a name ex: `az-devops` and description for the variable group.
- **Add Variables**: Add the following variables:
  - `AZURE_DEVOPS_URL`
  - `AZURE_DEVOPS_PAT`
  - `AZURE_DEVOPS_PROJECT`
- **Save**: Click **Save** to create the variable group.

2. **Setting Up Azure DevOps Pipeline**
   Setup an azure pipeline and schedule it running at midnight every Sunday and perform the branch cleanup.

```yaml:azure-pipelines.yml
schedules:
  - cron: "0 0 * * 0" # Runs every Sunday at 00:00
    displayName: "Weekly Sunday Midnight Schedule"
    branches:
      include:
        - main
    always: true # Ensures that the pipeline runs regardless of whether the source code has changed

pool:
  vmImage: ubuntu-latest

variables:
  - group: az-devops

steps:
- task: UseNode@2
  inputs:
    versionSpec: '21.x'
  displayName: 'Install Node.js'

- task: Bash@3
  displayName: "Branches Cleanup"
  inputs:
    targetType: 'inline'
    script: |
      npm ci
      npm run run
    workingDirectory: 'az-devops-delete-branches'
  bashEnvValue:
    AZURE_DEVOPS_URL: $(AZURE_DEVOPS_URL)
    AZURE_DEVOPS_PAT: $(AZURE_DEVOPS_PAT)
    AZURE_DEVOPS_PROJECT: $(AZURE_DEVOPS_PROJECT)
```

In this pipeline:

1. The `UseNode@2` task installs Node.js.
2. The script step installs the necessary npm packages and runs the `index.ts` script.
3. Environment variables are passed to the script from the pipeline variables.

## Conclusion

By automating the branch cleanup process, you can keep your repositories clean and manageable, making it easier to navigate and maintain your codebase. This script provides a robust solution for identifying and deleting old, unused branches in Azure DevOps Git repositories. With the provided pipeline setup, you can schedule regular cleanups to ensure your repositories remain clutter-free.

<hr/>
Thank you for your time! If you have any further questions, feel free to ask. 🌟✨🎁

Steven
[GitHub](<[https://github.com/baoduy](https://github.com/baoduy)>)
