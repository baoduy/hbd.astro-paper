---
author: Steven Hoang
pubDatetime: 2025-01-01T12:00:00Z
title: "[Az] Day 06: Implement a private CloudPC and DevOps Agent Hub with Pulumi."
featured: false
draft: false
tags:
  - AKS
  - Private
  - Pulumi
description: "This tutorial guides us through setting up a secure CloudPC and DevOps agent hub, aimed at improving the management and operational capabilities of your private AKS environment using Pulumi."
---

## Introduction

Creating a secure private VNet for CloudPC (Windows 365 Enterprise) and Azure DevOps agent allows for an isolated network environment, enabling secure access, management, and control of cloud resources.

This guide will walk you through the process of setting up a private VNet using Pulumi, integrating it with the Hub VNet was created in the previous article.

---

## Table of Contents

---

## The project modules

### The `CloudPcFirewallRules` Module

This module defines the firewall policies for:

- **CloudPC**: Grants all machines within the CloudPC subnet access to AKS, DevOps, and other Azure resources.
  <details><summary>View code:</summary>

  [inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-04-cloudPC/CloudPcFirewallRules/cloudpcPolicyGroup.ts#1-29)

  </details>

- **DevOps**: Permits all machines in the DevOps subnet to access all resources, including those on the internet.
  <details><summary>View code:</summary>

  [inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-04-cloudPC/CloudPcFirewallRules/devopsPolicyGroup.ts#1-20)

  </details>

> Caution: This rule poses a security risk as it allows DevOps agents extensive internet access. It is not advisable for production workloads and should be reviewed to restrict access to only necessary resources for the production environment.

- **Index File**: Combines CloudPC and DevOps rules into a unified `FirewallPolicyRuleCollectionGroup`, linking them to the root policy established in the `az-02-hub-vnet` project.
  <details><summary>View code:</summary>

  [inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-04-cloudPC/CloudPcFirewallRules/index.ts#1-55)

  </details>

### The `VNet.ts` Module

This module is responsible for creating a virtual network (VNet) with two subnets.
It also establishes peering with the Hub VNet that was set up in the previous project, similar to the VNet component used for AKS in `az-03-aks-cluster` project.

<details><summary>View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-04-cloudPC/VNet.ts#78-172)

</details>

### The `DiskEncryptionSet.ts` Module

This module demonstrates how to encrypt Azure resources using a custom encryption key stored in Azure Key Vault. It includes the following components:

- **User Assigned Identity**: This identity is used to grant access to the Key Vault, allowing it to read the encryption key.
  <details><summary>View code:</summary>

  [inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-04-cloudPC/DiskEncryptionSet.ts#17-44)

  </details>

- **Vault Encryption Key**: A custom encryption key with a size of 4096 bits, configured for automatic rotation every year within the Key Vault.
  <details><summary>View code:</summary>

  [inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-04-cloudPC/DiskEncryptionSet.ts#49-88)

  </details>

- **Disk Encryption Set**: This component creates a `DiskEncryptionSet` using the User Assigned Identity and the custom encryption key mentioned above.

  <details><summary>View code:</summary>

  [inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-04-cloudPC/DiskEncryptionSet.ts#90-119)

  </details>

### The `VM.ts` Module

This module facilitates the provisioning of a Linux virtual machine (VM) on Azure with automatically generated login credentials and disk encryption.

It connects the VM to a subnet within the virtual network and installs the **[TeamServicesAgentLinux](https://learn.microsoft.com/en-us/azure/devops/pipelines/release/deployment-groups/howto-provision-deployment-group-agents?view=azure-devops)**. The installation requires the following parameters:

- **VSTSAccountName**: Specify the URL of your Azure DevOps organization, for example, https://dev.azure.com/contoso.
- **TeamProject**: Provide the name of your project, such as myProject.
- **DeploymentGroup**: Indicate the name of the deployment group you have created.
- **AgentName**: Optionally, assign a name to the agent. If left blank, the agent will default to the VM name with a -DG suffix.
- **Personal Access Token**: Input the Personal Access Token (PAT) for authenticating with Azure Pipelines.
- **Tags**: Optionally, provide a comma-separated list of tags to assign to the agent. Each tag can be up to 256 characters, is case insensitive, and there is no limit to the number of tags.

<details><summary>View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-04-cloudPC/VM.ts#1-221)

</details>

---

## Setting Up Private Azure DevOps Agents

Before provisioning a private DevOps agent, it's essential to set up several resources in Azure DevOps:

- **Personal Access Token (PAT)**: The private agent requires a PAT with specific permissions to install and configure the agent on a VM. You can create a `az-PAT-token` via the Azure DevOps User Settings portal with the following permissions:

  - `Read` access to the Deployment group.
  - `Read` access to Code.
  - `Expiration`: Set to 1 year from the creation date.

  Once created, add the token as a secret named `devops-pat` in the Pulumi project `az-04-cloudPC` using the following command. This command encrypts the PAT token and stores it in the project state for later use during VM provisioning and agent installation.

  ```bash
  pulumi config set devops-pat YOUR_PAT_HERE --secret
  ```

- **Deployment Group Creation**: Navigate to _Pipelines_ > _Deployment group_ in Azure DevOps and create a deployment group with a name of your choice, such as `cloud-agents`.

---

## Developing the CloudPC Stack

Our goal is to create a private VNet for CloudPC and Azure DevOps agents using Pulumi to provision necessary Azure resources.

1. **Firewall Policy**: To enforce security policies for CouldPC and DevOps agent egress traffic.
2. **VNet and Peering**: The main network that will house subnets for CloudPC and the Azure DevOps agent.
3. **Disk encryption set**: The disk encryption component for Virtual Machine.
4. **AzureDevOps configuration**: The PAT generation and preparation to develop DevOps agent VM.
5. **Deploy a private DevOps agent**: Setup a Linux VM and Install `TeamServicesAgentLinux` extension using the parameters We have prepared above.

<details><summary>View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-04-cloudPC/index.ts#1-106)

</details>

---

## Deployment and Cleanup

### Deploying the Stack

To deploy the stack, run the `pnpm run up` command. This will provision all the necessary Azure resources, such as the Virtual Network (VNet), subnets, firewall, and private endpoints. Before executing the command, ensure you are logged into your Azure account using the Azure CLI and have configured Pulumi with the correct backend and credentials.

- Overview of the deployed Azure resources:
  ![Azure-Resources](/assets/az-06-pulumi-private-aks-cloudpc-hub/az-04-cloudpc.png)
  _Successfully deployed Azure resources._

After the `TeamServicesAgentLinux` extension is installed, an agent should appear in Azure DevOps under the `cloud-agents` deployment group. This agent will be used in future projects to deploy Helm charts into the AKS cluster.
![AzureDevOps-Agent](/assets/az-06-pulumi-private-aks-cloudpc-hub/private-ado-agent.png)
_Overview of the private agent in Azure DevOps._

### Cleaning Up the Stack

To remove all associated Azure resources and clean up the stack, execute the `pnpm run destroy` command. This will help avoid unnecessary costs and ensure that all resources are properly deleted after testing or development.

---

## References

- [Azure Virtual Network Documentation](https://learn.microsoft.com/en-us/azure/virtual-network/virtual-networks-overview)
- [Firewall Policies and Rule Collection Groups](https://learn.microsoft.com/en-us/azure/firewall/policy-overview)
- [Azure Bastion Configuration](https://learn.microsoft.com/en-us/azure/bastion/bastion-overview)
- [TeamServicesAgentLinux Extension](https://learn.microsoft.com/en-us/azure/devops/pipelines/release/deployment-groups/howto-provision-deployment-group-agents?view=azure-devops)

---

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven** | _[GitHub](https://github.com/baoduy)_
