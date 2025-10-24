---
author: Steven Hoang
pubDatetime: 2024-10-12T12:06:00Z
title: "[Az] Day 06: Implement a private CloudPC and DevOps Agent Hub with Pulumi."
featured: false
draft: false
tags:
  - AKS
  - Private
  - Pulumi
description: "
In this tutorial, guide us through setting up a secure CloudPC and DevOps agent hub, aimed at improving the management and operational capabilities of the private AKS environment using Pulumi.
"
---

## Introduction

Creating a secure private VNet for CloudPC (Windows 365 Enterprise) and Azure DevOps agent allows for an isolated network environment, enabling secure access, management, and control of cloud resources.

This guide will walk you through the process of setting up a private VNet using Pulumi, integrating it with the Hub VNet was created in the previous article.

## Table of Contents

## The project modules

### The `CloudPcFirewallRules` Module

This module defines the firewall policies for:

- **CloudPC**: We adhere to the recommended network rules for [Windows 365 Enterprise](https://learn.microsoft.com/en-us/windows-365/enterprise/requirements-network?tabs=enterprise%2Cent). Additionally, we ensure that all machines within the CloudPC subnet have access to AKS, DevOps subnets, and other Azure resources.
  <details><summary><em>View code:</em></summary>

  [inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-04-cloudPC/CloudPcFirewallRules/cloudpcPolicyGroup.ts#1-1000)

  </details>

- **DevOps**: The current setup allows all machines in the DevOps subnet unrestricted access to all resources, including those on the internet. To improve security, it is recommended to restrict access to only necessary resources and implement more granular firewall rules.
  <details><summary><em>View code:</em></summary>

  [inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-04-cloudPC/CloudPcFirewallRules/devopsPolicyGroup.ts#1-1000)

  </details>

- **Index File**: Combines CloudPC and DevOps rules into a unified `FirewallPolicyRuleCollectionGroup`, linking them to the root policy established in the `az-02-hub-vnet` project.
  <details><summary><em>View code:</em></summary>

  [inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-04-cloudPC/CloudPcFirewallRules/index.ts#1-1000)

  </details>

### The `VNet.ts` Module

This module is responsible for creating a virtual network (VNet) with two subnets.
It also establishes peering with the Hub VNet that was set up in the previous project, similar to the VNet component used for AKS in `az-03-aks-cluster` project.

<details><summary><em>View code:</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-04-cloudPC/VNet.ts#78-172)

</details>

### The `DiskEncryptionSet.ts` Module

This module demonstrates how to encrypt Azure resources using a custom encryption key stored in Azure Key Vault. It includes the following components:

- **User Assigned Identity**: This identity is used to grant access to the Key Vault, allowing it to read the encryption key.
  <details><summary><em>View code:</em></summary>

  [inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-04-cloudPC/DiskEncryptionSet.ts#17-44)

  </details>

- **Vault Encryption Key**: A custom encryption key with a size of 4096 bits, configured for automatic rotation every year within the Key Vault.
  <details><summary><em>View code:</em></summary>

  [inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-04-cloudPC/DiskEncryptionSet.ts#49-88)

  </details>

- **Disk Encryption Set**: This component creates a `DiskEncryptionSet` using the User Assigned Identity and the custom encryption key mentioned above.

  <details><summary><em>View code:</em></summary>

  [inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-04-cloudPC/DiskEncryptionSet.ts#90-119)

  </details>

### The `VM.ts` Module

This module facilitates the provisioning of a Linux virtual machine (VM)
on Azure with automatically generated login credentials and disk encryption and connects the VM to a subnet within the virtual network.

<details><summary><em>View code:</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-04-cloudPC/VM.ts#1-1000)

</details>

### The `PrivateDNS.ts` Module

To optimize internal network communication, we implement a DNS resolver. This module sets up a private DNS zone that facilitates efficient name resolution within our network infrastructure.

1. **Private DNS Zone**: Creates a dedicated DNS zone for internal use.
2. **VNet Links**: Establishes connections between the private DNS zone and both the Hub and CloudPC virtual networks.
3. **A Record**: Configures A record that points to the private IP address of our NGINX ingress controller.
   > In the following topics, We will cover the NGINX ingress controller deployed on AKS as private ingress, and it will be assigned the internal IP address `192.168.31.250`. This IP must be within the AKS subnet range.

By linking this private DNS to both the Hub and CloudPC VNets, we ensure that all DNS requests for our internal services are correctly routed to the NGINX ingress controller. This setup enhances security and improves network performance by keeping internal traffic within our private network.

<details><summary><em>View code:</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-04-cloudPC/PrivateDNS.ts#1-1000)

</details>

## Developing the CloudPC Stack

Our objective is to establish a private Virtual Network (VNet) for CloudPC and Azure DevOps agents using Pulumi,
enabling us to provision the necessary Azure resources effectively.

1. **Firewall Policy**: Implement security policies to manage egress traffic for CloudPC and DevOps agents.
2. **VNet and Peering**: Develop the primary network infrastructure, including subnets for CloudPC and the Azure DevOps agent, with necessary VNet peering.
3. **Disk Encryption Set**: Integrate a disk encryption set to secure virtual machine data at rest.
4. **Deploy a Linux VM**: Provision a Linux virtual machine to host the Azure DevOps agent. The agent installation process will be covered in the following topic.

<details><summary><em>View code:</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-04-cloudPC/index.ts#1-1000)

</details>

## Deployment and Cleanup

### Deploying the Stack

To deploy the stack, run the `pnpm run up` command. This will provision all the necessary Azure resources, such as the Virtual Network (VNet), subnets, firewall, and private endpoints. Before executing the command, ensure you are logged into your Azure account using the Azure CLI and have configured Pulumi with the correct backend and credentials.

![Azure-Resources](/assets/az-06-pulumi-private-aks-cloudpc-hub/az-04-cloudpc.png)

<p class="ml-44"><em>The deployed Azure resources</em></p>

### Cleaning Up the Stack

To remove all associated Azure resources and clean up the stack, execute the `pnpm run destroy` command. This will help avoid unnecessary costs and ensure that all resources are properly deleted after testing or development.

## References

- [Azure Virtual Network Documentation](https://learn.microsoft.com/en-us/azure/virtual-network/virtual-networks-overview)
- [Firewall Policies and Rule Collection Groups](https://learn.microsoft.com/en-us/azure/firewall/policy-overview)
- [Azure Bastion Configuration](https://learn.microsoft.com/en-us/azure/bastion/bastion-overview)
- [TeamServicesAgentLinux Extension](https://learn.microsoft.com/en-us/azure/devops/pipelines/release/deployment-groups/howto-provision-deployment-group-agents?view=azure-devops)
- [Network requirements For Windows 365 Enterprise](https://learn.microsoft.com/en-us/windows-365/enterprise/requirements-network?tabs=enterprise%2Cent)
- [AzureDevOps Allowed IP addresses and domain URLs](https://learn.microsoft.com/en-us/azure/devops/organizations/security/allow-list-ip-url?view=azure-devops&tabs=IP-V4)

## Next

**[Day 07: Setup Windows 365 Enterprise as a private VDI](/posts/az-07-setup-cloudpc-windows365-enterprise)**

In the next article, we will explore how to configure a CloudPC with Windows 365 Enterprise to establish a secure and efficient Virtual Desktop Infrastructure (VDI) for accessing a private AKS environment.

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven** | _[GitHub](https://github.com/baoduy)_
