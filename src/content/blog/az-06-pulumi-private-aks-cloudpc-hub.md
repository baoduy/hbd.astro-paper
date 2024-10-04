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

Creating a secure private VNet for CloudPC (Windows 365 Enterprise) and Azure DevOps agent allows for an isolated network environment, enabling secure access, management, and control of cloud resources. This guide will walk you through the process of setting up a private VNet using Pulumi, integrating it with the necessary components to support both CloudPC instances and a private Azure DevOps agent. By the end of this tutorial, you will have a well-defined network architecture that ensures security, privacy, and streamlined access to Azure resources.

---

## Table of Contents

---

## Developing the Private VNet Environment

The core objective is to establish a private VNet environment with various components to support CloudPC and Azure DevOps agent infrastructure. We will use Pulumi to provision all the required Azure resources.

1. **Resource Group**: Organizes related resources into a manageable container, ensuring efficient cost tracking and administration.
2. **Private Virtual Network (VNet)**: The main network that will house subnets for CloudPC and the Azure DevOps agent.
3. **Firewall Configuration**: To enforce security policies for ingress and egress traffic.
4. **Azure Bastion**: For secure management access to virtual machines in the private VNet without needing a public IP.
5. **Private Endpoints**: Allow secure access to Azure services from within the private VNet.

### Resource Group Setup (`ResourceGroup.ts`)

We begin by creating a dedicated Resource Group to contain all of the resources we will provision for this project. This helps with effective resource management and simplifies cost tracking.

<details><summary>View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-06-vnet/ResourceGroup.ts#L1-L20)

</details>

### Private VNet Configuration (`PrivateVNet.ts`)

The Private Virtual Network serves as the foundation for the secure communication environment. The VNet includes multiple subnets: one for CloudPC instances and another for Azure DevOps agents. We will also configure VNet peering to enable connectivity with a Hub VNet.

<details><summary>View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-06-vnet/PrivateVNet.ts#L1-L45)

</details>

### Firewall Configuration (`FirewallRules.ts`)

Setting up appropriate firewall rules ensures that only the required traffic flows in and out of the private VNet. This module creates a **FirewallPolicyRuleCollectionGroup** to regulate traffic securely.

<details><summary>View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-06-vnet/FirewallRules.ts#L1-L40)

</details>

### Azure Bastion Configuration (`AzureBastion.ts`)

Azure Bastion is configured to provide secure and seamless RDP and SSH access to the VMs within the private VNet, eliminating the need for public IPs and minimizing exposure to the public internet.

<details><summary>View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-06-vnet/AzureBastion.ts#L1-L25)

</details>

---

## VNet Integration with CloudPC

The CloudPC instances require a secure and well-isolated network environment for effective communication and management. By configuring subnets specifically for CloudPC, we ensure that each instance has restricted yet necessary access to the wider network.

- **Subnet Configuration**: A dedicated subnet for CloudPC instances ensures that all communication is isolated within the private VNet, reducing risks of exposure.
- **Private Endpoints**: Using private endpoints for essential Azure services ensures that CloudPC instances can access them securely without needing to traverse the public internet.

<details><summary>View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-06-vnet/CloudPCIntegration.ts#L1-L38)

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

## Deployment and Cleanup

### Deploying the Stack

To deploy the stack, execute the `pnpm run up` command. This provisions all necessary Azure resources, including the VNet, subnets, firewall, and private endpoints. Ensure that you have logged in to your Azure account via Azure CLI and set up Pulumi with the appropriate backend and credentials.

- Successfully deployed Azure resources:
  ![Azure-Resources](/assets/az-06-private-vnet-cloudpc/az-06-vnet.png)

  _Figure 1: Overview of successfully deployed Azure resources for the private VNet._

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
