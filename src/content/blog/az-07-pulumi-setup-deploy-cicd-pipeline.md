---
author: Steven Hoang
pubDatetime: 2025-01-01T12:00:00Z
title: "[Az] Day 07: Setting Up a Deployment Pipeline for Pulumi Private AKS Environment on Azure."
featured: false
draft: false
tags:
  - AKS
  - Private
  - Pulumi
description: "In this article, we'll walk through creating a Continuous Integration and Continuous Deployment (CI/CD) pipeline on Azure DevOps for setting up a private AKS environment on Azure using Pulumi."
---

In this article, we'll walk through creating a Continuous Integration and Continuous Deployment (CI/CD) pipeline on Azure DevOps for setting up a private AKS environment on Azure using Pulumi.
This tutorial is part of a series on setting up a secure and scalable AKS environment. Pulumi is a great tool for managing cloud infrastructure with code, allowing developers to use familiar programming languages to define and deploy cloud resources.
Here, we'll provide a complete guide on setting up Azure DevOps pipelines for deploying Pulumi stacks.

### Prerequisites

Before diving into the pipeline configuration, make sure you have:

- An Azure DevOps account with a project set up.
- [Pulumi extensions](https://marketplace.visualstudio.com/items?itemName=pulumi.build-and-release-task) for Azure DevOps.
- Proper permissions to deploy resources to your Azure subscription.

### Pipeline Overview

The pipeline setup for entire the AKS environment using Pulumi that had been developed in the previous topics.
These templates are developed to be reusable, making it easy to adapt them for similar deployment scenarios:

#### 1. Build Template: `build-template.yml`

The `build-template.yml` file is used to perform the build process required for each project of our infrastructure.

<details><summary>View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/pipeline/build-template.yml#1-32)

</details>

This template installs the necessary Node.js version, installs dependencies using `pnpm`, and then builds the project.

#### 2. Deploy Template: `deploy-template.yml`

The `deploy-template.yml` file handles the deployment process using Pulumi.

```yaml
steps:
  - task: Bash@3
    displayName: install latest pulumi
    inputs:
      targetType: "inline"
      script: "curl -fsSL https://get.pulumi.com | sh"

  - task: Pulumi@1
    displayName: "pulumi refresh"
    continueOnError: true
    condition: eq(variables['pulumi.refresh'], 'true')
    inputs:
      azureSubscription: ${{ parameters.azureSubscription }}
      command: "refresh"
      cwd: ${{ parameters.workDir }}
      stack: ${{ parameters.stack }}
      args: "--yes --skip-preview"

  - task: Pulumi@1
    displayName: "pulumi up"
    inputs:
      azureSubscription: ${{ parameters.azureSubscription }}
      command: "up"
      cwd: ${{ parameters.workDir }}
      stack: ${{ parameters.stack }}
      args: "--yes --skip-preview"
```

This template installs Pulumi and runs the necessary commands to deploy resources to the Azure environment using `pulumi up`.

#### 3. Build and Deploy: `build-and-deploy.yml`

Finally, the `build-and-deploy.yml` file brings together both the build and deploy steps.

```yaml
jobs:
  - job: "build_and-deploy"
    displayName: Build & Deploy
    steps:
      - template: build-template.yml
        parameters:
          stack: ${{ parameters.stack }}
          workDir: ${{ parameters.workDir }}

      - template: deploy-template.yml
        parameters:
          stack: ${{ parameters.stack }}
          workDir: ${{ parameters.workDir }}
          azureSubscription: ${{ parameters.azureSubscription }}
```

It first runs the build steps followed by the deployment steps, making it a complete job for a specific part of the infrastructure.

#### 4. Main Azure Pipelines File: `deploy.azure-pipelines.yml`

The main pipeline file (`deploy.azure-pipelines.yml`) is the entry point for our CI/CD pipeline. It defines different stages for deploying our shared resources, Virtual Network (Hub), AKS Cluster, and Cloud PC setup.

```yaml
trigger:
  branches:
    include:
      - releases/*
    exclude:
      - main

pool:
  vmImage: ubuntu-latest

variables:
  - group: pulumi
  - name: azureSubscription
    value: "az-drunk"
  - name: env_name
    value: $[replace(variables['Build.SourceBranchName'], 'refs/heads/releases', '')]

stages:
  - stage: "deploy_share"
    displayName: "01. Shared Resources"
    jobs:
      - job:
        displayName: "Preparing"
        steps:
          - task: Bash@3
            displayName: print env name
            inputs:
              targetType: "inline"
              script: 'echo "Env name is: $(env_name)"'

  - stage: "deploy_shared"
    displayName: "Deploy az-01-shared"
    jobs:
      - template: build-and-deploy.yml
        parameters:
          workDir: "az-01-shared"
          stack: $(env_name)
          azureSubscription: $(azureSubscription)

  - stage: "deploy_hub"
    dependsOn: "deploy_shared"
    displayName: "Deploy az-02-hub-vnet"
    jobs:
      - template: build-and-deploy.yml
        parameters:
          workDir: "az-02-hub-vnet"
          stack: $(env_name)
          azureSubscription: $(azureSubscription)
# Additional stages for AKS and CloudPC deployment
```

The pipeline is triggered for branches that start with `releases/`. The stages defined in the pipeline follow a dependency structure, where each stage deploys a part of the infrastructure in a specific order.

---

### Running the Pipeline

To run this pipeline, you need to ensure the following:

- Set up Azure Workload Identity Federation by following the steps on the Azure DevOps UI.
- Create a variable group in Azure DevOps to set Pulumi variables, such as `PULUMI_ACCESS_TOKEN` and other required variables for your Pulumi code. This setup helps maintain consistency across environments and reduces the chance of manual errors.

You can also modify the pipeline to add more stages, such as testing stages, additional environments (e.g., staging, production), or other resources that need to be deployed.

---

### Conclusion

By following this guide, you now have a CI/CD pipeline that allows you to automate the deployment of a private AKS environment using Pulumi on Azure DevOps. This setup ensures that your infrastructure is deployed securely and consistently across all environments. This setup can be extended to include other cloud services or environments as required. Pulumi provides a modern approach to managing cloud infrastructure, and using Azure DevOps helps integrate this with your overall software development lifecycle.

---

## References

- [Pulumi extensions](https://marketplace.visualstudio.com/items?itemName=pulumi.build-and-release-task)

---

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven** | _[GitHub](https://github.com/baoduy)_
