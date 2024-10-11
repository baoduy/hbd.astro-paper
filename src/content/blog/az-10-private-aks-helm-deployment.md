---
author: Steven Hoang
pubDatetime: 2025-01-01T12:00:00Z
title: "[Az] Day 10: Implementing a Helm Deployment CI/CD AzureDevOps Pipeline for a Private AKS Cluster."
featured: false
draft: false
tags:
  - AKS
  - Helm
  - CI/CD
  - AzureDevOps
description: "In this article, We will create Helm charts for nginx-ingress and cert-manager, and set up a robust CI/CD pipeline using Azure DevOps for Helm deployments to a private AKS cluster."
---

## Introduction

In our previous article, we covered the process of importing Docker images into a private Azure Container Registry (ACR). 
Building on that foundation, this guide will walk you through creating Helm charts for nginx-ingress and cert-manager, and setting up a comprehensive Helm deployment pipeline for your private Azure Kubernetes Service (AKS) cluster using Azure DevOps.

## Table of Contents

## Configuring an Azure DevOps Agent

To streamline the deployment process of your Helm charts, it's crucial to set up and configure an Azure DevOps agent on the virtual machine (VM) provisioned by the _az-04-cloudPC_ project. 
This setup ensures that your CI/CD pipeline functions smoothly within a private network environment.

### Installing the Azure DevOps Agent

1. Log into your virtual machine using Windows 365 Virtual Desktop Infrastructure (VDI).
2. Follow the detailed instructions in the [Microsoft documentation](https://learn.microsoft.com/en-gb/azure/devops/pipelines/agents/linux-agent?view=azure-devops) to install the Azure DevOps agent on a Linux-based VM.
3. Once installed, assign the agent to the `aks-agents` pool to optimize resource allocation.

After configuration, the agent should be listed under Azure DevOps project's agents as below:
![private-aks-agent-pool](/assets/az-10-private-aks-helm-deployment/private-aks-agent-pool.png)

### Installing Essential Tools

For effective Helm chart deployment, ensure the following tools are installed on the agent:

- **Azure CLI**: Required for managing Azure resources. Follow the installation guide [here](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-linux?pivots=apt).
- **KubeLogin**: This is a client-go credential plugin implementing azure authentication and required for pipeline deployment to authenticate with AKS using Service Principal. Refer [here](https://azure.github.io/kubelogin/install.html).
- **Helm CLI**: Essential for managing Kubernetes applications. Refer to the installation instructions [here](https://helm.sh/docs/intro/install/).
- **Kubectl**: Necessary for Kubernetes cluster management. Installation guidance is available [here](https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/).

> Note: After installing these tools, restart the VM to ensure that the installations are correctly applied and effective.

## Creating Helm Charts

Before we set up our deployment pipeline, we need to create Helm charts for nginx-ingress and cert-manager. 
These charts will define the configuration and deployment settings for our applications.

### Nginx Ingress Controller

First, let's create a Helm chart for the Nginx Ingress Controller:

1. Create a new directory for your Helm charts:

```bash
mkdir -p helm-charts/nginx-ingress
cd helm-charts/nginx-ingress
```

2. Create a `Chart.yaml` file:

```yaml
apiVersion: v2
name: nginx-ingress
description: A Helm chart for Nginx Ingress Controller
version: 0.1.0
appVersion: "1.0"
```

3. Create a `values.yaml` file with the following content:

```yaml
controller:
  image:
    repository: <your-acr-name>.azurecr.io/ingress-nginx/controller
    tag: "v1.2.0"
  replicaCount: 2
  service:
    type: LoadBalancer
```

4. Create a `templates` directory and add the necessary Kubernetes manifest files (e.g., `deployment.yaml`, `service.yaml`, etc.) for the Nginx Ingress Controller.

### Cert-Manager

Now, let's create a Helm chart for cert-manager:

1. Create a new directory for the cert-manager chart:

```bash
mkdir -p helm-charts/cert-manager
cd helm-charts/cert-manager
```

2. Create a `Chart.yaml` file:

```yaml
apiVersion: v2
name: cert-manager
description: A Helm chart for cert-manager
version: 0.1.0
appVersion: "1.8.0"
```

3. Create a `values.yaml` file with the following content:

```yaml
image:
  repository: <your-acr-name>.azurecr.io/jetstack/cert-manager-controller
  tag: "v1.8.0"

installCRDs: true
```

4. Create a `templates` directory and add the necessary Kubernetes manifest files for cert-manager.

## Setting Up Azure DevOps Pipeline

Now that we have our Helm charts ready, let's set up an Azure DevOps pipeline to deploy them to our private AKS cluster.

1. Create a new pipeline in Azure DevOps and choose "Azure Repos Git" as the source.

2. Select your repository and choose "Starter pipeline" to create a new YAML file.

3. Replace the contents of the YAML file with the following:

```yaml
trigger:
  - main

variables:
  - group: aks-deployment-vars

stages:
  - stage: Deploy
    jobs:
      - job: DeployHelmCharts
        pool:
          vmImage: 'ubuntu-latest'
        steps:
          - task: HelmInstaller@1
            inputs:
              helmVersion: 'latest'

          - task: AzureCLI@2
            inputs:
              azureSubscription: '$(AZURE_SUBSCRIPTION)'
              scriptType: 'bash'
              scriptLocation: 'inlineScript'
              inlineScript: |
                az aks get-credentials --resource-group $(AKS_RESOURCE_GROUP) --name $(AKS_CLUSTER_NAME)

          - task: HelmDeploy@0
            inputs:
              connectionType: 'Kubernetes Service Connection'
              namespace: 'ingress-nginx'
              command: 'upgrade'
              chartType: 'FilePath'
              chartPath: './helm-charts/nginx-ingress'
              releaseName: 'nginx-ingress'
              install: true

          - task: HelmDeploy@0
            inputs:
              connectionType: 'Kubernetes Service Connection'
              namespace: 'cert-manager'
              command: 'upgrade'
              chartType: 'FilePath'
              chartPath: './helm-charts/cert-manager'
              releaseName: 'cert-manager'
              install: true
```

4. Create a variable group named `aks-deployment-vars` in Azure DevOps and add the following variables:
    - `AZURE_SUBSCRIPTION`: Your Azure subscription name or ID
    - `AKS_RESOURCE_GROUP`: The resource group of your AKS cluster
    - `AKS_CLUSTER_NAME`: The name of your AKS cluster

## Implementing the Deployment Pipeline

With our pipeline set up, we can now implement the deployment process:

1. Commit and push your Helm charts and the Azure pipeline YAML file to your repository.

2. In Azure DevOps, go to Pipelines and run the newly created pipeline.

3. The pipeline will authenticate with Azure, connect to your AKS cluster, and deploy both the nginx-ingress and cert-manager Helm charts.

## Testing and Verification

After the pipeline has completed successfully, you can verify the deployments:

1. Connect to your AKS cluster using `kubectl`:

```bash
az aks get-credentials --resource-group <your-resource-group> --name <your-aks-cluster-name>
```

2. Check the status of the nginx-ingress deployment:

```bash
kubectl get pods -n ingress-nginx
```

3. Verify the cert-manager deployment:

```bash
kubectl get pods -n cert-manager
```

4. Test the nginx-ingress by creating a sample application and an Ingress resource that uses the nginx-ingress controller.

5. Test cert-manager by creating a Certificate resource and verifying that it's properly issued.

## Conclusion

In this guide, we've walked through the process of creating Helm charts for nginx-ingress and cert-manager, and setting up an Azure DevOps pipeline to deploy these charts to a private AKS cluster. This approach allows for easy management and deployment of these critical components in your Kubernetes infrastructure.

By leveraging Helm and Azure DevOps, you can ensure consistent and repeatable deployments across your environments, making it easier to manage and scale your applications in a private AKS cluster.

Remember to always follow security best practices, such as using Azure Key Vault for storing sensitive information and regularly updating your deployments with the latest security patches.

## References

- [Self-hosted Linux agents](https://learn.microsoft.com/en-gb/azure/devops/pipelines/agents/linux-agent?view=azure-devops)
- [Helm Documentation](https://helm.sh/docs/)
- [Azure DevOps Documentation](https://docs.microsoft.com/en-us/azure/devops/?view=azure-devops)
- [Nginx Ingress Controller Documentation](https://kubernetes.github.io/ingress-nginx/)
- [Cert-Manager Documentation](https://cert-manager.io/docs/)

## Thank You

Thank you for taking the time to read this guide! We hope it has been helpful in setting up your Helm deployment pipeline for a private AKS cluster. Feel free to explore further and happy deploying! 🚀🌟

**Steven** | _[GitHub](https://github.com/baoduy)_
