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

Building a private AKS cluster offers enhanced network security and complete control over ingress and egress traffic.

This tutorial will guide you through the setup of a private AKS cluster with advanced networking capabilities, integrating it into a sophisticated network architecture using Pulumi.

By the end of this guide, you'll know how to integrate the AKS cluster with a Hub VNet and apply firewall policies established in the [previous `az-02-hub-vnet` project](az-04-pulumi-private-aks-hub-vnet-development).

## Table of Contents

## The project modules

### The `ContainerRegistry.ts` Module

To enhance security and ensure that all Docker images deployed to our AKS cluster are verified, this module establishes a private Container Registry. By restricting AKS to pull images exclusively from this private registry, we eliminate the need to open firewalls on the public internet.

<details><summary><em>View code:</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-03-aks-cluster/ContainerRegistry.ts#L1-L32)

</details>

### The `AksFirewallRules.ts` Module

This module sets up a **FirewallPolicyRuleCollectionGroup** with policies that enable controlled outbound communication for AKS nodes. The rules ensure that only necessary traffic is permitted, thus enhancing the security posture of our AKS cluster.

<details><summary><em>View code:</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-03-aks-cluster/AksFirewallRules.ts#L1-L104)

</details>

### The `VNet.ts` Module

The Virtual Network (VNet) serves as the backbone for our AKS cluster. It provides the primary network environment that includes subnets dedicated to AKS nodes.
The VNet is peered with the Hub VNet to enable seamless integration with other services and to route all traffic through the Hub's firewall, ensuring all egress traffic is controlled.

1. **Security Group**: By default, the VNet allows resources in all subnets to access the internet. To enhance security, a security group is created with the following default rules:

- Block all internet access from all subnets.
- Allow VNet-to-VNet communication to enable hub-spoke connectivity.
- Additional security rules can be added through parameters.

  <details><summary><em>View code:</em></summary>

  [inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-03-aks-cluster/VNet.ts#L10-L56)

  </details>

2. **Route Table**: This VNet will peer with the hub, necessitating a route table to direct all traffic to the private IP address of the firewall.

<details><summary><em>View code:</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-03-aks-cluster/VNet.ts#L59-L76)

</details>

3. **VNet**: Finally, the VNet is configured to create the route table and security group, injecting them into all provided subnets. Additionally, it establishes VNet peering with the hub VNet.

<details><summary><em>View code:</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-03-aks-cluster/VNet.ts#L78-L173)

</details>

### The `AKS.ts` Module

1. **SSH Key Generation Custom Resource**: SSH keys are crucial for configuring an AKS cluster. Due to Pulumi's lack of native SSH support, I utilize **[Dynamic Resource Providers](https://www.pulumi.com/docs/iac/concepts/resources/dynamic-providers/)** to craft a custom component that dynamically generates SSH keys with the `node-forge` library.

This component also demonstrates how to securely store secrets within the Pulumi state.

<details><summary><em>View SSH generator code:</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-03-aks-cluster/SshGenerator.ts#L1-L129)

</details>

Furthermore, a helper method uses the SSH generator alongside a random password to create an SSH public and private key pair and stored them in Key Vault for AKS.

<details><summary><em>View code:</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-03-aks-cluster/Aks.ts#63-102)

</details>

2. **AKS Identity Creation**: AKS can be configured to utilize Microsoft Entra ID for user authentication.
This setup allows users to sign in to an AKS cluster using a Microsoft Entra authentication to manage access to namespaces and cluster resources.
<details><summary><em>View code:</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-03-aks-cluster/Aks.ts#16-57)

</details>

3. **AKS Cluster Creation**: Finally, by integrating all components, we establish our AKS cluster. The source code contains several key elements worth noting.
<details><summary><em>View code:</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-03-aks-cluster/Aks.ts#106-290)

</details>

## Developing a Private AKS Cluster

Our objective is to configure all necessary components for the AKS Cluster, which include:

1. **Resource Group**: A container for organizing related Azure resources, simplifying management and cost tracking.
2. **Container Registry**: The main repository for all Docker images used by our private AKS, ensuring secure image deployment.
3. **AKS Firewall Policy**: To enable outbound internet connectivity, we must configure firewall rules that allow AKS nodes to communicate securely with essential Azure services.
4. **Virtual Network (VNet)**: The primary network hosting our AKS subnets, integrated with our Hub VNet to ensure secure and managed traffic flow.
5. **AKS Cluster**: An Azure-managed Kubernetes service, configured with advanced security and connectivity options.

<details><summary><em>View code:</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-03-aks-cluster/index.ts#1-93)

</details>

## Deployment and Cleanup

### Deploying the Stack

To deploy the stack, execute the `pnpm run up` command. This provisions the necessary Azure resources. We can verify the deployment as follows:

- Successfully deployed Azure resources:
  ![Azure-Resources](/assets/az-05-pulumi-private-aks-cluster-env/az-03-aks-cluster.png)
  _Overview of successfully deployed Azure resources._

### Cleaning Up the Stack

To remove the stack and clean up all associated Azure resources, run the `pnpm run destroy` command. This ensures that any resources no longer needed are properly deleted.

## Conclusion

In this tutorial, we've successfully implemented a private AKS cluster with advanced networking features using Pulumi.
By setting up a private Container Registry, configuring firewall rules, and integrating the cluster with a Hub VNet, we have enhanced the security and manageability of our Kubernetes environment.
These steps ensure that the AKS cluster is well-secured and capable of meeting the demands of a production-grade infrastructure.

## References

- [Outbound network and FQDN rules for AKS clusters](https://learn.microsoft.com/en-us/azure/aks/outbound-rules-control-egress)
- [Dynamic resource providers](https://www.pulumi.com/docs/iac/concepts/resources/dynamic-providers/)
- [Use EntraID role-based access control for AKS](https://learn.microsoft.com/en-us/azure/aks/manage-azure-rbac?tabs=azure-cli)
- [Use a service principal with AKS](https://learn.microsoft.com/en-us/azure/aks/kubernetes-service-principal?tabs=azure-cli)
- [Best Practices for Private AKS Clusters](https://docs.microsoft.com/azure/aks/private-clusters)

## Next Topic

**[Day 06: Implements a private CloudPC and DevOps Agent Hub with Pulumi](/posts/az-06-pulumi-private-aks-cloudpc-hub)**

In the next tutorial, it will guide us through setting up a secure CloudPC and DevOps agent hub, aimed at improving the management and operational capabilities of your private AKS environment using Pulumi.

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven** | _[GitHub](https://github.com/baoduy)_
