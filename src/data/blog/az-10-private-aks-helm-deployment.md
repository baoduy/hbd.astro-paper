---
author: Steven Hoang
pubDatetime: 2024-10-12T12:10:00Z
title: "[Az] Day 10: Implementing a Helm Deployment CI/CD AzureDevOps Pipeline for a Private AKS Cluster."
featured: false
draft: false
tags:
  - AKS
  - Helm
  - CI/CD
  - AzureDevOps
description: "
In this tutorial, We will create Helm charts for nginx-ingress and cert-manager, and set up a robust CI/CD pipeline using Azure DevOps for Helm deployments to a private AKS cluster.
"
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

After installed, the agent should be listed under Azure DevOps project's agents as below:
![private-aks-agent-pool](/assets/az-10-private-aks-helm-deployment/private-aks-agent-pool.png)

### Installing Essential Tools

For effective Helm chart deployment, ensure the following tools are installed on the agent:

- **Azure CLI**: Required for managing Azure resources. Follow the installation guide [here](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-linux?pivots=apt).
- **KubeLogin**: This is a client-go credential plugin implementing azure authentication and required for pipeline deployment to authenticate with AKS using Service Principal. Refer [here](https://azure.github.io/kubelogin/install.html).
- **Helm CLI**: Essential for managing Kubernetes applications. Refer to the installation instructions [here](https://helm.sh/docs/intro/install/).
- **Kubectl**: Necessary for Kubernetes cluster management. Installation guidance is available [here](https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/).

> Note: After installing these tools, restart the VM to ensure that the installations are correctly applied and effective.

### Azure DevOps Extensions

To facilitate our deployment process, we'll be using the [Replace Tokens](https://marketplace.visualstudio.com/items?itemName=qetza.replacetokens) extension for Azure Pipelines.
This task replaces tokens in text-based files with actual variable values, allowing for dynamic configuration of our Helm charts.
Ensure this extension is installed in your Azure DevOps environment before proceeding with the pipeline setup.

## Nginx and Cert Manager Helm Chart

Our Helm chart is designed to deploy three essential parts:

1. **Nginx Ingress Controller**: This internal ingress controller will service traffic at the IP address `192.168.31.250`, using the internal domain `drunkcoding.net`.
2. **Cert-Manager**: This component is responsible for generating SSL certificates for all internal subdomains. It also monitors certificate expiration and handles timely renewals.
3. **Let's Encrypt ClusterIssuer**: The chart includes templates to deploy a Let's Encrypt ClusterIssuer, enabling Cert-Manager to issue free SSL certificates from Let's Encrypt.

<details><summary><em>View the <code>Chart.yaml</code> file</em></summary>
[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/pipeline/ingress-helm/Chart.yaml#1-1000)

</details>

### Env-Variables Values

We've created a `values-dev.yaml` file to configure our development environment.
- **Chart Variables**: Tokens in the format `${{Name}}` are placeholders for variables that will be populated from the pipeline during deployment. These variables can be sourced from library groups, Azure Key Vault, or inline variables.
- **Chart Images**: All chart images are configured to be pulled from our internal Azure Container Registry (ACR), which was set up in the previous topic.

<details><summary><em>View the <code>values-dev.yaml</code> file</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/pipeline/ingress-helm/values-dev.yaml#1-1000)

</details>

### Setting Up an Azure DevOps Pipeline

With our Helm charts prepared, it's time to create an Azure DevOps pipeline to deploy these to our secure AKS cluster.

**Pipeline Preparation:**
- First, go to your Git repository and start a new pipeline. Choose "Existing pipeline" and choose the `ingress-helm.azure-pipelines.yml` file.
- Next, We'll need to set up some variables for this pipeline:
  1. `cf-dns`: This group includes two key details:
     - `cf-domain`: This is the Cloudflare domain, used here for SSL verification since we are managing DNS internally.
     - `cf-dns-token`: A token from Cloudflare that lets us edit DNS; it has certain permissions. You can refer [here](/posts/ks-08-cert-manager-with-private-aks) for guidance on setting this up.
     <img alt="cf-variable-group" src="/assets/az-10-private-aks-helm-deployment/cf-variable-group.png" width="450px">
  2. `env_name`: This should be the name of the branch from which the pipeline building.
  3. `azureSubscription`: The name of your Azure subscription, set as _az-pulumi_ from previous steps. Make sure this account can manage Helm deployment and is part of the `AZ ROL DEV-AKS-ADMIN` group within AKS Admin Active Directory.
  4. `rsGroup`: The name of the Azure resource group that contains your AKS cluster.
  5. `aksName`: The name given to your AKS cluster.
  6. `acrName`: The name of the Azure Container Registry.
  7. `private-ip`: A dedicated private IP for the ingress controller.
  8. `valueFile`: The specific Helm values file name only.
  9. `chart`: The location of Helm chart.
  10. `releaseName`: The name of the Helm release.

**Pipeline Deployment:**
- Once the deployment is successful:
    ![nginx-ingress-pipeline](/assets/az-10-private-aks-helm-deployment/nginx-ingress-pipeline.png)

- We'll find that the pods are now active within the `nginx-ingress` namespace.
    ![nginx-ingress-namespace-pods](/assets/az-10-private-aks-helm-deployment/nginx-ingress-namespace-pods.png)

<details><summary><em>View the <code>values-dev.yaml</code> here</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/pipeline/ingress-helm/ingress-helm.azure-pipelines.yml#1-1000)

</details>

## Application Helm Chart

Now, let's create another Helm chart to deploy our applications. For this example, we'll use a Helm chart to deploy the `azuredocs/aks-helloworld:v1` image, provided by the Microsoft AKS team for demonstration purposes. Once deployed, the cert-manager will automatically issue an SSL certificate for the subdomain `hello.drunkcoding.net`, enabling us to access the application via Windows 365 VDI.
**Pipeline Deployment:**
- Upon successful deployment:
  ![drunk-apps-helm-deployment](/assets/az-10-private-aks-helm-deployment/drunk-apps-helm-deployment.png)

- The application pods should now be active within the `drunk-apps` namespace.
  ![drunk-apps-namespace-pods](/assets/az-10-private-aks-helm-deployment/drunk-apps-namespace-pods.png)

- The SSL certificate `tls-hello-world-lets` should be successfully issued and stored in the `drunk-apps` namespace's secrets.
  ![drunk-apps-namespace-cert](/assets/az-10-private-aks-helm-deployment/issued-cert-hello.png)

**Application Access:**
- Access the app via Windows 365 VDI:
    ![windows365-drunk-apps](/assets/az-10-private-aks-helm-deployment/windows365-drunk-apps.png)

<details><summary><em>View the app helm chart here</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/pipeline/drunk-apps-helm/drunk-apps-helm.azure-pipelines.yml#1-1000)

</details>

## Conclusion

In this guide, we've walked through the process of creating Helm charts for nginx-ingress and cert-manager, and setting up an Azure DevOps pipeline to deploy these charts to a private AKS cluster. This approach allows for easy management and deployment of these critical components in your Kubernetes infrastructure.

By leveraging Helm and Azure DevOps, We can ensure consistent and repeatable deployments across your environments, making it easier to manage and scale your applications in a private AKS cluster.

Remember to always follow security best practices, such as using Azure Key Vault for storing sensitive information and regularly updating your deployments with the latest security patches.

## References

- [Nginx Helm Chart](https://github.com/baoduy/drunk-azure-pulumi-articles/tree/main/pipeline/ingress-helm)
- [Drunk Apps Helm Chart](https://github.com/baoduy/drunk-azure-pulumi-articles/tree/main/pipeline/drunk-apps-helm)
- [Self-hosted Linux agents](https://learn.microsoft.com/en-gb/azure/devops/pipelines/agents/linux-agent?view=azure-devops)
- [Helm Documentation](https://helm.sh/docs/)
- [Nginx Ingress Controller Documentation](https://kubernetes.github.io/ingress-nginx/)
- [Cert-Manager Documentation](https://cert-manager.io/docs/)
- [AzureDevOps Replace Token Extension](https://marketplace.visualstudio.com/items?itemName=qetza.replacetokens&targetId=aed13a53-890d-4411-a029-49b8b9bf9004&utm_source=vstsproduct&utm_medium=ExtHubManageList)

## Next

**[Day 11: Exposing a Private AKS Application via Cloudflare Tunnel.](/posts/az-11-private-aks-expose-public-app-with-cloudflare-tunnel)**

In the next article, We demonstrate how to securely expose an application running on a private AKS cluster to the internet using Cloudflare Tunnel, without the need for public IP addresses or open ports. We'll also show how to apply authentication to all exposed applications and centralize access control using Azure Entra ID Groups, ensuring only authorized users have access.

## Thank You

Thank you for taking the time to read this guide! We hope it has been helpful in setting up your Helm deployment pipeline for a private AKS cluster. Feel free to explore further and happy deploying! 🚀🌟

**Steven** | _[GitHub](https://github.com/baoduy)_
