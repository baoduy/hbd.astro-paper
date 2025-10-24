---
author: Steven Hoang
pubDatetime: 2024-10-12T12:08:00Z
title: "[Az] Day 08: Setting Up a Deployment Pipeline for Pulumi Projects."
featured: false
draft: false
tags:
  - AKS
  - Private
  - Pulumi
description: "
In this tutorial, We will walk through creating a Continuous Integration and Continuous Deployment (CI/CD) pipeline on Azure DevOps for our Pulumi projects.
"
---

## Introduction
In this tutorial, We will walk through creating a Continuous Integration and Continuous Deployment (CI/CD) pipeline on Azure DevOps for our Pulumi projects.

## Table of Contents

## Prerequisites

Ensure you have:

- An Azure DevOps account with a project.
- [Pulumi extensions](https://marketplace.visualstudio.com/items?itemName=pulumi.build-and-release-task) for Azure DevOps.
- Permissions to deploy resources in your Azure subscription.

## Preparation

### Pulumi Variable Group

Create a variable group in Azure DevOps **Libraries** named **pulumi**, and add the `PULUMI_ACCESS_TOKEN` variable:
<img alt="pulumi-variable-group" src="/assets/az-08-pulumi-setup-deploy-cicd-pipeline/pulumi-variable-group.png" width="450px">

### Setting Up Azure Resource Management Connection

1. Navigate to **Service connections** in Azure DevOps and create a new **Azure Workload Identity** connection named `az-pulumi` for **Azure Resource Management**:
   <img alt="az-federation" src="/assets/az-08-pulumi-setup-deploy-cicd-pipeline/az-federation.png" width="450px">

   > Note: Specifying a resource group is optional. This can be used to restrict the connection's access to a specific resource group if needed.

2. Once the service connection is established, verify the app registration presence in the Azure Portal here:
   ![Azure-Connection-Details](/assets/az-08-pulumi-setup-deploy-cicd-pipeline/az-federation-details.png)
   <p class="ml-44"><em>The app registration on Azure Portal</em></p>

3. Ensure the app registration has enough permissions for deployment:
   - As an `Owner` and `Key Vault Administrator` roles at the **subscription** level.
   - **Microsoft Graph** permissions to provide it with the necessary privileges for comprehensive deployment operations.
      ![api-permission](/assets/az-08-pulumi-setup-deploy-cicd-pipeline/az-app-permission.png)
      <p class="ml-40"><em>The API permission of the app registration</em></p>
   - As member of  `AZ ROL DEV-AKS-ADMIN` Entra Group: This is necessary for granting the permissions for Helm deployment on AzureDevOps.

## Deployment Templates

For reusability, several templates have been developed:

### Build Template: `build-template.yml`

- **Parameters**:

  1. **stack**: Specifies the target Pulumi stack.
  2. **workDir**: Defines the working directory of the Pulumi project.

- **Steps**:

  1. **Install Node.js**: Install current Node LTS version.
  2. **Setup pnpm**: Configures `pnpm` package management.
  3. **Build Commons Project**: Installs dependencies and runs the build script for `az-commons`.
  4. **Install Project Dependencies**: Installs dependencies for the specified `workDir`.

<details><summary><em>View yaml:</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/pipeline/pulumi/build-template.yml#1-1000)

</details>

### Deployment Template: `deploy-template.yml`

- **Parameters**:

  1. **stack**: Specifies the target Pulumi stack.
  2. **workDir**: Defines the working directory of the Pulumi project.
  3. **azureSubscription**: Represents the Azure subscription connection.

- **Steps**:

  1. **Install Pulumi CLI**: Install the latest version of the Pulumi CLI for Linux.
  2. **Pulumi Refresh**: Refreshes the stack if the `pulumi.refresh` parameter is set to true.
  3. **Pulumi Up After Refresh**: Executes `pulumi up` if `pulumi.refresh` is true, ensuring the stack is updated after a refresh.
  4. **Pulumi Up**: Executes `pulumi up` to deploy the stack.

<details><summary><em>View yaml:</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/pipeline/pulumi/deploy-template.yml#1-1000)

</details>

> Using Pulumi refresh is essential for maintaining an accurate state. For more details, refer to [this article](https://www.pulumi.com/blog/repairing-state-with-pulumi-refresh/).

## Pulumi Deployment Pipeline

To establish a deployment pipeline in Azure DevOps, We'll create a new pipeline and use the `deploy.azure-pipelines.yml` file.

### YAML Configuration

1. **Trigger**: The pipeline is set to trigger automatically for branches matching the pattern _releases/\*_.
2. **Agent Pool**: We use the _ubuntu-latest_ agent pool for running our pipeline tasks.
3. **Variables**: The configuration includes several key variables:
   - `pulumi`: A variable group containing essential Pulumi configuration settings.
   - `azureSubscription`: The name of the Azure Resource Manager connection.
   - `pnpm_config_cache`: The specified location for the pnpm cache.
   - `env_name`: Dynamically derived from the branch name, determining the deployment environment.

### Pipeline Structure and Flow

Our pipeline consists of four distinct deployment stages. Each stage utilizes the `build-and-deploy.yml` template file, with appropriate parameters passed to it.

To initiate the pipeline:

1. Create a new branch named `releases/dev`
2. Push the changes to this branch
3. The pipeline will automatically trigger and run

Here's a visual representation of the deployment sequence:
![deploy-pipeline-flow](/assets/az-08-pulumi-setup-deploy-cicd-pipeline/deploy-pipeline-flow.png)

<p class="ml-44"><em>Visualization of the Deployment Pipeline Stages</em></p>

The pipeline progresses through these stages in order, ensuring a systematic and controlled deployment process.
Each stage builds upon the previous one, allowing for a comprehensive and structured approach to deploying our Pulumi projects.

<details><summary><em>View yaml:</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/pipeline/pulumi/deploy.azure-pipelines.yml#1-1000)

</details>

## Pulumi Destroy Pipeline

This pipeline demonstrates how to safely destroy a Pulumi deployment stack. Exercise caution, as once a stack is destroyed, it cannot be restored.

To set up a destruction pipeline in Azure DevOps, use the `danger-destroy.azure-pipelines.yml` file.
The destruction states are reverted from the deployment state.

Here's a visual representation of the deployment sequence:
![deploy-pipeline-flow](/assets/az-08-pulumi-setup-deploy-cicd-pipeline/pulumi-destroy-pipeline.png)
> Each stage in this process uses the `danger-build-and-destroy.yml` file with the necessary parameters.

<p class="ml-44"><em>Visualization of the Destroy Pipeline</em></p>

<details><summary><em>View yaml:</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/pipeline/pulumi/danger-destroy.azure-pipelines.yml#1-1000)

</details>

## Conclusion

In this tutorial, we've successfully set up a CI/CD pipeline using Pulumi and Azure DevOps.
This pipeline automates the deployment of infrastructure, ensuring that our environments are consistent, scalable, and easy to manage.

By leveraging Pulumi's abilities, we can integrate infrastructure as code into our development workflows, enhancing both efficiency and reliability.

## References

- [Pipeline Samples](https://github.com/baoduy/drunk-azure-pulumi-articles/tree/main/pipeline)
- [Pulumi extensions](https://marketplace.visualstudio.com/items?itemName=pulumi.build-and-release-task)
- [Pnpm Pipeline Config](https://pnpm.io/continuous-integration#azure-pipelines)
- [Repairing State With Pulumi Refresh](https://www.pulumi.com/blog/repairing-state-with-pulumi-refresh/).

## Next

**[Day 09: Synchronizing Container Images to ACR for a Private AKS Cluster Using CI/CD Pipelines.](/posts/az-09-private-aks-acr-image-sync)**

In the next article, We explore the process of synchronizing container images with ACR for deployments in a private AKS cluster. We'll cover how to configure and automate this synchronization using CI/CD pipelines, ensuring seamless updates and secure image management for private AKS environments.

## Thank You

Thank you for taking the time to read this guide! We hope it has been helpful. Feel free to explore further and happy coding! 🌟✨

**Steven** | _[GitHub](https://github.com/baoduy)_
