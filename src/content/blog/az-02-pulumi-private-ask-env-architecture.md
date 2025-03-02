---
author: Steven Hoang
pubDatetime: 2024-10-12T12:00:00Z
title: "[Az] Day 02: Private Azure Kubernetes (AKS) Environment Architecture."
featured: false
draft: false
tags:
  - AKS
  - Private
  - Pulumi
description: "
In this tutorial, We will explore the design of a private AKS environment on Azure. We'll use multiple subnets, Azure Firewall, and other critical cloud services to construct a secure architecture.
This setup is designed to keep sensitive workloads isolated and shielded from exposure to the public internet.
"
---

## Introduction

In today's cloud-centric world, security is paramount. By default, many cloud services are publicly accessible over the internet, which can pose significant risks for sensitive workloads. 

When deploying a private AKS (AKS) environment, it's essential to protect all components while maintaining efficient network communication.

This post explains an architecture of private AKS that we are going to set up on Azure, leveraging multiple subnets, Azure Firewall, and other essential cloud services. 

![Private AKS Environment Architecture Diagram](/assets/az-02-pulumi-private-ask-env-architecture/private-aks-day-02.png)
<p class="ml-44"><em>(Download the original draw.io file <a href="/assets/az-02-pulumi-private-ask-env-architecture/private-aks.drawio" download>here)</a></em></p>

## Table of Contents

## Architecture Overview

This architecture ensures that sensitive workloads remain isolated and protected from public internet exposure.

### Hub VNet

The Hub VNet acts as the central point for network security and communication management, utilizing a **hub-and-spoke** architecture. It includes:

- **Azure Firewall**: Positioned in dedicated subnets, it serves as the main security gateway, regulating all the network traffic. 
  It consolidates outbound traffic through a single public IP address for **easier control and third-party whitelisting**. 
  Security measures include:
  - **Outbound Traffic Control**: Inspects and authorizes outgoing traffic to approved IP ranges or services.
  - **No Inbound NAT Rules**: Blocks unsolicited inbound internet traffic, enhancing security.
  - **Network Traffic Control**: Restricts direct access to the AKS cluster and other resources, allowing only legitimate internal interactions.

- **General Subnet**: Allocated for Azure resources with private links, such as Key Vault, SQL Server, and Storage Account. It is entirely internal with no public access, ensuring secure operations.

### AKS VNet

The AKS VNet is designed to host the private AKS cluster, ensuring secure and efficient communication with other network components:

- **AKS Subnet**: Hosts the AKS cluster within a dedicated subnet. The Kubernetes API server is accessible only via a private endpoint, and pod networking manages secure communication with services in the General Subnet. 
- **Azure Firewall Rules:** only allows external access to necessary resources for AKS cluster.

### CloudPC VNet

The CloudPC VNet provides secure environments for virtual desktops and DevOps operations, maintaining isolation from critical infrastructure:

- **CloudPC Subnet**: Provides secure VDI environment (using Windows 365 enterprise) for internal resource access, eliminating public exposure.
- **DevOps Subnet**: Hosts resources for DevOps private agents, including CI/CD pipelines for private ASK deployment.

## Subnet IP Allocation

Here is the summary of the private IP address allocation for each subnet:

| VNet Name           | Subnet Name                    | Address Prefix      | Total | Usable |
|---------------------|--------------------------------|---------------------|-------|--------|
| **1. Hub VNet**     | 1.1 Firewall Subnet            | `192.168.30.0/26`   | 64    | 59     |
|                     | 1.2 Firewall Management Subnet | `192.168.30.64/26`  | 54    | 59     |
|                     | 1.3 General Subnet             | `192.168.30.128/27` | 32    | 27     |
| **2. AKS VNet**     | 2.1 AKS Subnet                 | `192.168.31.0/24`   | 256   | 251    |
| **3. CloudPC VNet** | 3.1 CloudPC Subnet             | `192.168.32.0/25`   | 128   | 123    |
|                     | 3.2 DevOps Subnet              | `192.168.32.128/27` | 32    | 27     |

> **Note**: Adjust the address space according to your environment, as this is intended for demonstration purposes.

## Conclusion

Designing the network architecture with a strong focus on security allows us to fully utilize Azure services while safeguarding our workloads from external threats. This private AKS environment offers a robust, scalable, and adaptable platform for deploying containerized applications.

- **Complete Isolation**: Essential resources remain shielded from the public internet. Service access is secured through private endpoints and managed by Azure Firewall.
- **Centralized Security Management**: Azure Firewall acts as a unified control point for overseeing and securing all network traffic and leaving the environment.
- **Scalability and Flexibility**: Each subnet can be scaled independently according to workload demands, offering flexibility in expanding the AKS cluster or integrating additional services.
- **Reduced Attack Surface**: By segmenting services into distinct subnets and employing Azure Firewall as a protective barrier, the attack surface is significantly minimized, reducing the risk of unauthorized access.
- **Efficient Communication**: Private endpoints and internal routing facilitate seamless communication between services without exposing them to external networks.

## References

- [Use Azure Firewall to help protect an AKS cluster](https://learn.microsoft.com/en-us/azure/architecture/guide/aks/aks-firewall)
- [Limit network traffic with Azure Firewall in AKS](https://learn.microsoft.com/en-us/azure/aks/limit-egress-traffic?tabs=aks-with-system-assigned-identities)

## Next

**[Day 03: Secret Management and Centralized Log Monitoring on Azure](/posts/az-03-pulumi-private-ask-credential-log-management)**

In the next article, we will guide you through the process of establishing a secure and automated system for secret management using Azure Key Vault.
Additionally, we will cover how to implement centralized log monitoring using Azure Log Analytics and Application Insights, enhancing observability and operational efficiency.

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven** | _[GitHub](https://github.com/baoduy)_
