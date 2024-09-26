---
author: Steven Hoang
pubDatetime: 2025-01-01T12:00:00Z
title: "[Az] Day 02: Private Aks Environment Architecture."
featured: false
draft: false
tags:
  - aks
  - private
  - pulumi
description: ""
---

## Diagram

Before, start writing pulumi code, Let's review our azure environment architecture design with the illustration below.

This environment involved 3 virtual networks linked together with following details Ip Address spaces allocation below.

**Summary of Allocated Subnets**

| Subnet Name       | Address Prefix      | IP Range                            | Total Addresses | Usable Addresses |
| ----------------- | ------------------- | ----------------------------------- | --------------- | ---------------- |
| AKSSubnet         | `192.168.32.0/23`   | `192.168.32.0` - `192.168.33.255`   | 512             | 507              |
| GeneralSubnet     | `192.168.30.0/26`   | `192.168.30.0` - `192.168.30.63`    | 64              | 59               |
| CloudPCSubnet     | `192.168.30.64/27`  | `192.168.30.64` - `192.168.30.95`   | 32              | 27               |
| AzureDevOpsSubnet | `192.168.30.96/28`  | `192.168.30.96` - `192.168.30.111`  | 16              | 11               |
| FirewallSubnet    | `192.168.30.112/29` | `192.168.30.112` - `192.168.30.119` | 8               | 3                |

> - **Available for Future Use:**
>   - **Address Range:** `192.168.30.120` - `192.168.31.255`
>   - **Total Addresses:** 384

---

## Virtual Networks

### 1. VNet Hub

This hub is a central VNet where connecting all other VNets and control the access between other spoke VNETs, internet outbound access through Azure Firewall.

- **Firewall Subnet** `192.168.30.112/29`: The subnet where we will deploy a Azure Firewall and an public IpAddress to control all internal and internet outbound request from all VNets.
- **General Subnet** `192.168.30.0/26`: Most of Azure resources are supporting VNet private link that allows to link to a VNet when the resources linked to a VNET we can block all public access and only allows the access from linked VNets.

### 2. ASK VNet.

This is dedicated VNet for ASK cluster.

- **AKS Subnet** `192.168.32.0/23`: The subnet for AKS Nodes, for demo purpose for this article there is only 1 Subnet created for AKS here with available for up to 500 pods here, I think it should be enough for a small/medium AKS clusters.

### 3. AzureDevOps and CloudPC VNet.

In this VNet we will host both Azure DevOps private agent `Virtual Machine` and `Window 365 Enterprise` in the same VNet however each of them will have separate subnet.

- **Azure DevOps Subnet** `192.168.30.96/28`: This subnet is for Azure DevOps private agents which can host up to 11 VMs.
- ** CloudPC Subnet** 192.168.30.64/27: This subnet is for CloudPC (aka: VID) in here I'm using `Window 365 Enterprise` version and can host up to 24 VMs.

> Note: As this is for demo purposes so do adjust the address space according your environment.

---

## Next Steps

- **Day 3: Create a Virtual Network Hub on Azure**

  Continue your Pulumi journey by setting up a virtual network hub, adding virtual machines, or deploying Azure Functions.

---

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven**
[GitHub](<[https://github.com/baoduy](https://github.com/baoduy)>)
