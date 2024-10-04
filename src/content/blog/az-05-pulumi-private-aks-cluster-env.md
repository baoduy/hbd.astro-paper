---
author: Steven Hoang
pubDatetime: 2025-01-01T12:00:00Z
title: "[Az] Day 05: Implementing a Private AKS Cluster with Pulumi."
featured: false
draft: false
tags:
  - AKS
  - Private
  - Pulumi
description: "In this tutorial, We’ll build a private AKS cluster with advanced networking features. 
We’ll explore how to integrate the AKS cluster with the Hub VNet and apply the firewall policies we’ve created."
---

## Introduction

In this guide, we will construct a private AKS cluster featuring advanced networking capabilities. We will delve into the integration of the AKS cluster with the Hub VNet and the application of firewall policies established in the [previous `az-02-hub-vnet` project](az-04-pulumi-private-aks-hub-vnet-development).

---

## Table of Contents

---

## Developing the Private AKS Cluster

Our objective is to configure all necessary components for the AKS Cluster, which include:

1. **Resource Group**: A container for organizing related Azure resources.
2. **Container Registry**: This serves as the main repository for all Docker images utilized by our private AKS.
3. **AKS Firewall Rules**: To enable outbound internet connectivity, we must configure firewall rules allowing AKS nodes to communicate with essential Azure resources.
4. **Virtual Network (VNet)**: The primary network hosting our AKS subnets.
5. **AKS Cluster**: An Azure-managed Kubernetes service.

### The `ContainerRegistry.ts` Module

To enhance security and ensure that all Docker images deployed to our AKS cluster are verified, this module establishes a private Container Registry. Instead of opening the firewall to allow AKS to download images from the internet, AKS will be restricted to pulling images exclusively from this private Container Registry.

<details><summary>View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-03-aks-cluster/ContainerRegistry.ts#L1-L32)

</details>

### The `AksFirewallRules.ts` Module

This module sets up a **FirewallPolicyRuleCollectionGroup** with specific outbound firewall rules, enabling AKS to communicate with essential Azure resources. For more details, please refer to [this documentation](https://learn.microsoft.com/en-us/azure/aks/outbound-rules-control-egress).

<details><summary>View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-03-aks-cluster/AksFirewallRules.ts#L1-L104)

</details>

### The `VNet.ts` Module

This module will be a enhanced version of the hub VNet, focusing on improved security and routing:

- **Security Group**: By default, the VNet allows resources in all subnets to access the internet. To enhance security, a security group is created with the following default rules:

  - Block all internet access from all subnets.
  - Allow VNet-to-VNet communication to enable hub-spoke connectivity.
  - Additional security rules can be added through parameters.

  <details><summary>View code:</summary>

  [inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-03-aks-cluster/VNet.ts#L10-L56)

  </details>

- **Route Table**: This VNet will peer with the hub, necessitating a route table to direct all traffic to the private IP address of the firewall.

  <details><summary>View code:</summary>

  [inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-03-aks-cluster/VNet.ts#L59-L76)

  </details>

- **VNet**: Finally, the VNet is configured to create the route table and security group, injecting them into all provided subnets. Additionally, it establishes VNet peering with the hub VNet.

  <details><summary>View code:</summary>

  [inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-03-aks-cluster/VNet.ts#L78-L173)

  </details>

### The `AKS.ts` Module

- **SSH Key Generation**: SSH keys are crucial for configuring an AKS cluster. Due to Pulumi's lack of native SSH support, I utilize **[Dynamic Resource Providers](https://www.pulumi.com/docs/iac/concepts/resources/dynamic-providers/)** to craft a custom component that dynamically generates SSH keys with the `node-forge` library. This component also demonstrates how to securely store secrets within the Pulumi state.
  <details><summary>View SSH generator code:</summary>

  [inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-03-aks-cluster/SshGenerator.ts#L1-L129)

  </details>

  Furthermore, a helper class uses the SSH generator alongside a random password to create an SSH public and private key pair, which are securely stored in Key Vault.
  <details><summary>View code:</summary>

  [inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-03-aks-cluster/Aks.ts#L36-L80)

  </details>

- **AKS Identity Creation**: AKS can be configured to utilize Microsoft Entra ID for user authentication. This setup allows users to sign in to an AKS cluster using a Microsoft Entra authentication token. Once authenticated, Kubernetes role-based access control (Kubernetes RBAC) can be employed to manage access to namespaces and cluster resources based on user identity or group membership.
  <details><summary>View code:</summary>

  [inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-03-aks-cluster/Aks.ts#8-34)

  </details>

- **AKS Cluster Creation**: Finally, by integrating all components, we establish our AKS cluster. The source code contains several key elements worth noting.
  <details><summary>View code:</summary>

  [inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-03-aks-cluster/Aks.ts#82-267)

  </details>

### Core Project Module: `index.ts`

Let's consolidate all components in our primary project file, which is tasked with deploying an AKS cluster on Azure using Pulumi. This file orchestrates the creation of essential resources like a resource group, virtual network, container registry, and the application of firewall rules, while also configuring the AKS cluster with specific parameters.

- **Stack References**: These are used to access outputs from other Pulumi stacks (`az-01-shared` and `az-02-hub-vnet`), which likely handle the setup of shared resources and a hub virtual network.
- **Resource Group**: Establishes a new Azure resource group for the AKS cluster, with its name derived from the configuration settings.
- **Container Registry**: Configures a private Azure Container Registry (ACR) within the resource group to store container images for the AKS cluster.
- **Firewall Rules**: Implements firewall rules for the AKS cluster, associating them with a firewall policy from the `az-02-hub` stack to ensure secure and managed network traffic.
- **Virtual Network (VNet)**: Sets up a virtual network with a dedicated subnet for the AKS cluster, incorporating security rules to permit outbound traffic to the hub firewall and routing all traffic through it. It also establishes VNet peering with the hub VNet.
- **AKS Cluster**: Deploys the AKS cluster with defined configurations, including the resource group, admin username, Azure Key Vault integration, logging workspace, VM size, and connections to the ACR and VNet.

<details><summary>View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-03-aks-cluster/index.ts#1-93)

</details>

---

## Deployment and Cleanup

### Deploying the Stack

To deploy the stack, execute the `pnpm run up` command. This provisions the necessary Azure resources. We can verify the deployment as follows:

- Successfully deployed Azure resources:
  ![Azure-Resources](/assets/az-05-pulumi-private-aks-cluster-env/az-03-aks-cluster.png)

### Cleaning Up the Stack

To remove the stack and clean up all associated Azure resources, run the `pnpm run destroy` command. This ensures that any resources no longer needed are properly deleted.

---

## References

- [Outbound network and FQDN rules for AKS clusters](https://learn.microsoft.com/en-us/azure/aks/outbound-rules-control-egress)
- [Dynamic resource providers](https://www.pulumi.com/docs/iac/concepts/resources/dynamic-providers/)
- [Use EntraID role-based access control for AKS](https://learn.microsoft.com/en-us/azure/aks/manage-azure-rbac?tabs=azure-cli)

---

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven** | _[GitHub](https://github.com/baoduy)_
