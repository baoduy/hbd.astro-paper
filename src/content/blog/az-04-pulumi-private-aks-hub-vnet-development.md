---
author: Steven Hoang
pubDatetime: 2025-01-01T12:00:00Z
title: "[Az] Day 04: Develop a VNet Hub for Private AKS on Azure."
featured: false
draft: false
tags:
  - AKS
  - Private
  - Pulumi
description: "In this article, We'll walk through the process of developing the first Hub VNet for a private AKS environment using Pulumi."
---

## Introduction

In this tutorial, we'll walk through the process of developing the first Hub VNet for a private AKS environment using Pulumi.
This guide is designed to be accessible even if you're new to Azure or Pulumi, so we'll explain each step in detail.

Security is our top priority. As we create our resources, we'll focus on optimizing security while keeping Azure costs reasonable.
We'll explore how to set up network policies, firewalls, and encryption to protect our environment without exceeding our budget.

---

## Table of Contents

---

## The Hub VNet development

Our goal is to set up the main components required for the Hub VNet, which include:

1. **Resource Group**: A container for managing related Azure resources.
2. **Virtual Network (VNet)**: The main network that hosts our subnets.
3. **Subnets**: Segments within the VNet to isolate and organize resources.
4. **Public IP Addresses**: For outbound internet connectivity and firewall management.
5. **Firewall Policy**: Defines rules to control network traffic.
6. **Azure Firewall**: A managed firewall service to protect our network.

Let's dive into each component and see how we can implement them using Pulumi.

### The `VNet` Module

This module facilitates the creation of a Virtual Network, allowing for the specification of subnets as parameters. It also enables VNet encryption by default to enhance security.

<details><summary>View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-02-hub-vnet/VNet.ts#L1-L44)

</details>

### The `FirewallPolicy.ts` Module

This module is responsible for creating a FirewallPolicy resource, which serves as the root policy for the Azure Firewall. This root policy will be the foundation for linking additional policy groups in subsequent Pulumi projects.

<details><summary>View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-02-hub-vnet/FirewallPolicy.ts#L1-L25)

</details>

### The `Firewall.ts` Module

This module is designed to set up an Azure Firewall, including essential components such as IP addresses and diagnostic settings. It ensures the firewall is connected to the designated subnet within the VNet and is associated with the root policy resources.

<details><summary>View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-02-hub-vnet/Firewall.ts#L1-L114)

</details>

### Core Project Module: `index.ts`

Now, let's bring everything together in our main project file.

<details><summary>View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-02-hub-vnet/index.ts#L1-L73)

</details>

> **Note:**
>
> - Properly setting the `dependsOn` property ensures that resources are created and destroyed in the correct sequence.
> - The code above demonstrates how to reuse the log workspace from the `az-01-shared` project for Firewall diagnostics, enabling effective tracing and monitoring of firewall rules.

---

## Deployment and Cleanup

### Deploying the Stack

To deploy the stack, execute the `pnpm run up` command. This provisions the necessary Azure resources. We can verify the deployment as follows:

- Successfully deployed Azure resources:
  ![Azure-Resources](/assets/az-04-pulumi-private-aks-hub-vnet-development/az-02-hub-vnet.png)

### Cleaning Up the Stack

To remove the stack and clean up all associated Azure resources, run the `pnpm run destroy` command. This ensures that any resources no longer needed are properly deleted.

---

Here is a revised version of the conclusion from your article:

---

## Conclusion

In this guide, we have successfully constructed a Hub Virtual Network (VNet) for our private AKS environment using Pulumi.
This Hub VNet serves as a crucial element in managing and securing access to all resources within our infrastructure, ensuring robust control and enhanced security measures.

---

## References

- [az-commons Source Code](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-commons/README.md)
- [az-02-hub-vnet Source Code](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-02-hub-vnet/README.md)
- [Azure DevOps IPs and FQDNs](https://learn.microsoft.com/en-us/azure/devops/organizations/security/allow-list-ip-url)
- [Pulumi for Azure](https://www.pulumi.com/docs/intro/cloud-providers/azure/)

---

## Next Steps

**[Day 05: Implementing a Private AKS Cluster with Pulumi](/posts/az-05-pulumi-private-aks-cluster-env)**

In the next tutorial, We'll build a private AKS cluster with advanced networking features.
We'll explore how to integrate the AKS cluster with the Hub VNet and apply the firewall policies we've created.

---

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven** | _[GitHub](https://github.com/baoduy)_