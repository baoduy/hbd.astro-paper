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
2. **Virtual Network (VNet)**: The primary network hosting our subnets.
3. **Subnets**: Divisions within the VNet to segregate and manage resources.
4. **AKS Firewall Rules**: To enable outbound internet connectivity, we must configure firewall rules allowing AKS nodes to communicate with essential Azure resources.
5. **Container Registry**: This serves as the main repository for all Docker images utilized by our private AKS.
6. **AKS Cluster**: An Azure-managed Kubernetes service.

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

### The `VNet.ts` module

<details><summary>View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-03-aks-cluster/VNet.ts#L1-L173)

</details>

---

## References

- [Outbound network and FQDN rules for AKS clusters](https://learn.microsoft.com/en-us/azure/aks/outbound-rules-control-egress)

---

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven** | _[GitHub](https://github.com/baoduy)_
