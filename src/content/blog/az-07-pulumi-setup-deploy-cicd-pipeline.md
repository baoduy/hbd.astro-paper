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

## Introduction

In this article, we will guide you through the process of establishing a Continuous Integration and Continuous Deployment (CI/CD) pipeline using Azure DevOps.
This pipeline will facilitate the deployment of the previously developed Pulumi projects.

---

## Table of Contents

---

## Prerequisites

Ensure you have:

- An Azure DevOps account with a project.
- [Pulumi extensions](https://marketplace.visualstudio.com/items?itemName=pulumi.build-and-release-task) for Azure DevOps.
- Permissions to deploy resources in your Azure subscription.

## Preparation

### Pulumi Variable Group

Create a variable group in Azure DevOps **Libraries** named `pulumi`, including the Pulumi PAT token:
<img src="/assets/az-07-pulumi-setup-deploy-cicd-pipeline/pulumi-variable-group.png" width="450px">

### Setting Up Azure Resource Management Connection

1. Navigate to **Service connections** in Azure DevOps and create a new connection named `az-pulumi` for **Azure Resource Management**:
   <img src="/assets/az-07-pulumi-setup-deploy-cicd-pipeline/az-federation.png" width="450px">

   > Note: Specifying a resource group is optional. This can be used to restrict the connection's access to a specific resource group if needed.

2. Once the service connection is established, verify its presence in the Azure Portal. Here are the details:
   ![Azure-Connection-Details](/assets/az-07-pulumi-setup-deploy-cicd-pipeline/az-federation-details.png)

3. Grant the service connection `Owner` and `Key Vault Administrator` roles at the **subscription** level.
   Additionally, configure the necessary Graph permissions to ensure it has sufficient privileges for complete deployment operations:
   ![api-permission](/assets/az-07-pulumi-setup-deploy-cicd-pipeline/az-app-permission.png)

## Deployment Templates

### Build Template: `build-template.yml`

- **Parameters**:

  - `stack`: Target Pulumi stack.
  - `workDir`: Working directory of the Pulumi project.

- **Steps**:

  - **Install Node.js**: Version 20.
  - **Setup pnpm**: Configures `pnpm`.
  - **Build Commons Project**: Installs dependencies and runs the build script for `az-commons`.
  - **Install Project Dependencies**: Installs dependencies for the specified `workDir`.

<details><summary><em>View code:</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/pipeline/build-template.yml#1-32)

</details>

### Deployment Template: `deploy-template.yml`

- **Parameters**:

  - `stack`: Specifies the target Pulumi stack.
  - `workDir`: Defines the working directory of the Pulumi project.
  - `azureSubscription`: Represents the Azure subscription connection.

- **Steps**:

  1. **Install Pulumi CLI**: Installs the latest version of the Pulumi CLI for Linux.
  2. **Pulumi Refresh**: Refreshes the stack if the `pulumi.refresh` parameter is set to true.
  3. **Pulumi Up After Refresh**: Executes `pulumi up` if `pulumi.refresh` is true, ensuring the stack is updated after a refresh.
  4. **Pulumi Up**: Executes `pulumi up` to deploy the stack.
     > Using Pulumi refresh is essential for maintaining accurate state. For more details, refer to [this article](https://www.pulumi.com/blog/repairing-state-with-pulumi-refresh/).

<details><summary><em>View code:</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/pipeline/deploy-template.yml#1-58)

</details>

---

## Pulumi Deployment Pipeline

To set up a deployment pipeline in Azure DevOps, use the `deploy.azure-pipelines.yml` file.

### YAML Configuration

- **Trigger**: Automatically initiates on branches matching _releases/\*_.
- **Agent Pool**: Utilizes the _ubuntu-latest_ agent pool.
- **Variables**: Includes `pulumi`, `azureSubscription`, and `pnpm_config_cache`. The `env_name` is derived from the branch name.

### Pipeline Stages

1. **deploy_shared**: Deploys the `az-01-shared` module.
2. **deploy_hub**: Deploys the `az-02-hub-vnet` module, following the completion of `deploy_shared`.
3. **deploy_aks**: Deploys the `az-03-aks-cluster` module, subsequent to `deploy_hub`.
4. **deploy_cloudpc**: Deploys the `az-04-cloudPC` module, after `deploy_hub`.

Each stage utilizes the `build-and-deploy.yml` file with the necessary parameters.

<details><summary><em>View Code:</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/pipeline/deploy.azure-pipelines.yml#1-64)

</details>

![deploy-pipeline-flow](/assets/az-07-pulumi-setup-deploy-cicd-pipeline/deploy-pipeline-flow.png)
_Visualization of the Deployment Pipeline_

---

## Pulumi Destroy Pipeline

This section demonstrates how to safely destroy a Pulumi deployment stack. Exercise caution, as once a stack is destroyed, it cannot be restored.

To set up a destruction pipeline in Azure DevOps, use the `danger-destroy.azure-pipelines.yml` file. To effectively reverse the entire Pulumi deployment, ensure that the states are reverted from the deployment state. Each stage in this process utilizes the `danger-build-and-destroy.yml` file with the necessary parameters.

<details><summary><em>View Code:</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/pipeline/danger-destroy.azure-pipelines.yml#1-58)

</details>

![deploy-pipeline-flow](/assets/az-07-pulumi-setup-deploy-cicd-pipeline/pulumi-destroy-pipeline.png)
_Visualization of the Destroy Pipeline_

---

### Conclusion

In this tutorial, we've successfully set up a CI/CD pipeline using Pulumi and Azure DevOps.
This pipeline automates the deployment of infrastructure, ensuring that our environments are consistent, scalable, and easy to manage.

By leveraging Pulumi's capabilities, we can integrate infrastructure as code into our development workflows, enhancing both efficiency and reliability.

## References

- [Pipeline Samples](https://github.com/baoduy/drunk-azure-pulumi-articles/tree/main/pipeline)
- [Pulumi extensions](https://marketplace.visualstudio.com/items?itemName=pulumi.build-and-release-task)
- [Pnpm Pipeline Config](https://pnpm.io/continuous-integration#azure-pipelines)
- [Repairing State With Pulumi Refresh](https://www.pulumi.com/blog/repairing-state-with-pulumi-refresh/).

---

## Thank You

Thank you for reading! Explore further and happy coding! 🌟✨

**Steven** | _[GitHub](https://github.com/baoduy)_