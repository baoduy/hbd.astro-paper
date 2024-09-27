---
author: Steven Hoang
pubDatetime: 2025-01-01T12:00:00Z
title: "[Az] Day 02: Private AKS Environment Architecture."
featured: false
draft: false
tags:
  - AKS
  - Private
  - Pulumi
description: "This post explains a the architecture of private AKS that we are going to setup on Azure, leveraging multiple subnets, Azure Firewall, and other essential cloud services. This architecture ensures that sensitive workloads remain isolated and protected from public internet exposure."
---

## Introduction

In today's cloud-centric world, security is paramount. By default, many cloud services are publicly accessible over the internet, which can pose significant risks for sensitive workloads. When deploying a private Azure Kubernetes Service (AKS) environment, it's essential to protect all components while maintaining efficient network communication.

This post explains a the architecture of private AKS that we are going to setup on Azure, leveraging multiple subnets, Azure Firewall, and other essential cloud services. This architecture ensures that sensitive workloads remain isolated and protected from public internet exposure.

![Private AKS Environment Architecture Diagram](/assets/az-02-pulumi-private-ask-env-architecture/private-aks.png)
_(Download original draw.io file <a href="/assets/az-02-pulumi-private-ask-env-architecture/private-aks.drawio" download>here</a> )_

---

## Table of Contents

---

## Key Components

This architecture includes the following major components:

- **Azure Firewall**: Acts as the central point of security, controlling all inbound and outbound traffic.
- **AKS Subnet**: Hosts the private Azure Kubernetes Service cluster.
- **General Subnet**: Contains critical infrastructure services like Key Vault and Storage Account.
- **CloudPC and DevOps Subnets**: Isolated subnets for cloud PCs and DevOps operations.

## Summary of Allocated Subnets

| VNet Name           | Subnet Name                    | Address Prefix      | Total | Usable |
| ------------------- | ------------------------------ | ------------------- | ----- | ------ |
| **1. Hub VNet**     | 1.1 Firewall Subnet            | `192.168.30.0/26`   | 64    | 59     |
|                     | 1.2 Firewall Management Subnet | `192.168.30.64/26`  | 54    | 59     |
|                     | 1.3 General Subnet             | `192.168.30.128/27` | 32    | 27     |
| **2. AKS VNet**     | 2.1 AKS Subnet                 | `192.168.31.0/24`   | 256   | 251    |
| **3. CloudPC VNet** | 3.1 CloudPC Subnet             | `192.168.32.0/25`   | 128   | 123    |
|                     | 3.2 DevOps Subnet              | `192.168.32.128/27` | 32    | 27     |

> **Note**: Adjust the address space according to your environment, as this is intended for demonstration purposes.

---

## Component Details

### Azure Firewall: Securing External Access

At the core of the security setup is **Azure Firewall**, deployed in the **Firewall Subnet** (`192.168.30.0/26`) and **Firewall Management Subnet** (`192.168.30.64/26`).
This firewall is configured with a **public IP address** and acts as the only entry and exit point for internet traffic.

- **Outbound Traffic Control**: The Azure Firewall inspects all outgoing traffic, ensuring that only authorized connections reach external resources. Firewall rules are set to allow specific outbound traffic, such as to approved IP ranges or specific services.
- **No Inbound NAT Rules**: In this setup, inbound Network Address Translation (NAT) rules are not configured. This means unsolicited inbound traffic from the internet is blocked, enhancing the security posture.
- **Network Traffic Control**: The Azure Firewall prevents direct access to the AKS cluster and other resources within the virtual network. All traffic is tightly controlled, and only legitimate internal traffic can interact with the resources.

### General Subnet: Supporting Infrastructure Services

The **General Subnet** (`192.168.30.128/27`) hosts essential infrastructure services required for application operations. This subnet is entirely internal, with no public access allowed. It contains the following services:

- **Azure Key Vault**: Securely stores secrets, keys, and certificates. Accessed via private endpoints to prevent public exposure.
- **Azure Storage Account**: Handles persistent storage for applications and workloads. Uses private endpoints for secure communication.
- **Database Services**: Managed database services like Azure SQL Database or Cosmos DB. Accessed securely within the virtual network.
- **Azure Service Bus**: Manages communication between different components, allowing for decoupled and scalable messaging.

Each service in this subnet communicates with other components, such as the AKS cluster and VMs, through private endpoints, enhancing security by eliminating public exposure.

### AKS Subnet: Hosting the Kubernetes Cluster

The **AKS Subnet** (`192.168.31.0/24`) houses the Azure Kubernetes Service (AKS) cluster, where all containerized workloads are deployed and orchestrated.

- **Private Cluster Configuration**: The AKS cluster is configured as a **private cluster**, meaning the Kubernetes API server is not accessible from the public internet. Communication with the API server is handled via a private endpoint within the virtual network.
- **Pod Networking**: Pod networking is managed within this subnet, allowing the AKS cluster to securely communicate with other services like databases or storage located in the General Subnet.
- **Azure Firewall Integration**: The Azure Firewall restricts any external traffic from directly accessing the AKS nodes. Only authorized internal traffic can interact with Kubernetes resources.

### CloudPC and DevOps Subnets: Managing Infrastructure

These subnets host specific workloads related to cloud desktops and DevOps operations.

#### CloudPC Subnet (`192.168.32.0/25`)

- Contains virtual desktops that allow secure access to internal resources.
- Provides a secure environment for users needing access to internal tools and services.
- Eliminates the need for exposing resources to the public internet.

#### DevOps Subnet (`192.168.32.128/27`)

- Houses virtual machines and other resources required for DevOps operations.
- Can include CI/CD pipelines, automation tools, and management servers.
- Isolated from the AKS cluster and other critical infrastructure to provide an extra layer of security.

## Internal Network Communication

The environment is built on a **hub-and-spoke** model, with Azure Firewall acting as the central point for controlling traffic. Internal communication between the subnets occurs over private IP addresses.

- **Routing**: Traffic between subnets is routed through the virtual network, and the Azure Firewall controls any necessary traffic filtering.
- **Isolation**: Each subnet is isolated using Network Security Groups (NSGs) and Azure Firewall rules, minimizing lateral movement in case of a security breach.
- **Private Endpoints**: Services like Azure Key Vault and Storage Account use private endpoints, ensuring that all communication stays within the Azure network.

## Benefits of the Architecture

- **Complete Isolation**: Critical resources are not exposed to the public internet. Access to services is secured via private endpoints and controlled through Azure Firewall.
- **Centralized Security Management**: Azure Firewall provides a single point of control for managing and securing all network traffic in and out of the environment.
- **Scalability and Flexibility**: Each subnet can be independently scaled based on workload needs, providing flexibility in expanding the AKS cluster or adding more services.
- **Reduced Attack Surface**: By isolating services into different subnets and using Azure Firewall as a gatekeeper, the attack surface is drastically reduced, minimizing the risk of unauthorized access.
- **Efficient Communication**: Private endpoints and internal routing ensure efficient communication between services without exposing them to external networks.

---

## Conclusion

By carefully designing your network architecture with security in mind, you can leverage the full power of Azure services while keeping your workloads safe from external threats. This private AKS environment provides a secure, scalable, and flexible foundation for running containerized applications.

## References

- [Use Azure Firewall to help protect an AKS cluster](https://learn.microsoft.com/en-us/azure/architecture/guide/aks/aks-firewall)
- [Limit network traffic with Azure Firewall in AKS](https://learn.microsoft.com/en-us/azure/aks/limit-egress-traffic?tabs=aks-with-system-assigned-identities)

---

## Next Steps

- **[Day 03: Develop a Virtual Network Hub for Private AKS on Azure](/posts/az-03-pulumi-private-aks-hub-vnet-development)**

---

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven**
[GitHub](<[https://github.com/baoduy](https://github.com/baoduy)>)
