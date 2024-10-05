---
author: Steven Hoang
pubDatetime: 2025-01-01T12:00:00Z
title: "[Az] Day 06: Implement a Secure CloudPC and DevOps Agent Hub with Pulumi for AKS environment."
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

---

## Setting Up Private Azure DevOps Agents

Azure DevOps agents are needed to run build and deployment jobs securely. Setting up these agents within a private subnet allows us to keep sensitive data secure while maintaining efficient access to Azure resources.

### Agent Pool Configuration (`AzureDevOpsAgentPool.ts`)

The **Azure DevOps Agent Pool** is deployed to a dedicated subnet within the VNet, configured with secure outbound internet connectivity via firewall rules to access necessary Azure DevOps services.

<details><summary>View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-06-vnet/AzureDevOpsAgentPool.ts#L1-L50)

</details>

---

## Developing the Private VNet Environment

The core objective is to establish a private VNet environment with various components to support CloudPC and Azure DevOps agent infrastructure. We will use Pulumi to provision all the required Azure resources.

1. **Firewall Policy**: To enforce security policies for CouldPC and DevOps agent egress traffic.
2. **VNet and Peering**: The main network that will house subnets for CloudPC and the Azure DevOps agent.
3. **Disk encryption set**: The disk encryption component for Virtual Machine.
4. **AzureDevOps configuration**: The PAT generation and preparation to develop DevOps agent VM.
5. **Deploy a private DevOps agent**: Setup a Linux VM and Install `TeamServicesAgentLinux` using pulumi.

<details><summary>View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-04-cloudPC/index.ts#1-106)

</details>

---

## Deployment and Cleanup

### Deploying the Stack

To deploy the stack, execute the `pnpm run up` command. This provisions all necessary Azure resources, including the VNet, subnets, firewall, and private endpoints. Ensure that you have logged in to your Azure account via Azure CLI and set up Pulumi with the appropriate backend and credentials.

- Successfully deployed Azure resources:
  ![Azure-Resources](/assets/az-06-pulumi-private-aks-cloudpc-hub/az-04-cloudpc.png)
  _Overview of successfully deployed Azure resources._

### Cleaning Up the Stack

To clean up and remove all associated Azure resources, run the `pnpm run destroy` command. This prevents any unnecessary costs and ensures that all provisioned resources are properly deleted after testing or development.

---

## Conclusion

In this tutorial, we have successfully developed a private VNet environment using Pulumi to support Windows 365 CloudPC instances and private Azure DevOps agents. By implementing secure subnets, firewall configurations, and Azure Bastion, we have created an efficient and secure network infrastructure suitable for enterprise-grade cloud services. These steps ensure that both CloudPC instances and DevOps agents operate within a well-protected and isolated environment, minimizing risks and maintaining privacy.

Thank you for following along! I hope this guide has been informative and helpful. If you have any questions or want to explore further, feel free to reach out. Happy coding! 🌟✨

---

## References

- [Azure Virtual Network Documentation](https://learn.microsoft.com/en-us/azure/virtual-network/virtual-networks-overview)
- [Firewall Policies and Rule Collection Groups](https://learn.microsoft.com/en-us/azure/firewall/policy-overview)
- [Azure Bastion Configuration](https://learn.microsoft.com/en-us/azure/bastion/bastion-overview)

---

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven** | _[GitHub](https://github.com/baoduy)_
