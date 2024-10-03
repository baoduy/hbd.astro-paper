---
author: Steven Hoang
pubDatetime: 2025-01-01T12:00:00Z
title: "[Az] Day 03: Secret Management and Centralized Log Monitoring on Azure."
featured: false
draft: false
tags:
  - AKS
  - Private
  - Pulumi
description: "In this guide, we’ll walk you through setting up a secure and scalable infrastructure on Azure by automating secret management using Azure Key Vault and centralized log monitoring with Log Analytics and Application Insights."
---

## Introduction

In this guide, we will demonstrate how to implement **secret management** across our entire environment using **Azure Key Vault**, and establish **centralized log management** for all applications on Azure with **Log Analytics** and **Application Insights**.
This approach ensures that sensitive data is securely stored, and application performance is monitored in real time.

### Key Objectives

1. **Secret Management for the Entire Environment**  
   We will use **Azure Key Vault** to securely manage and store sensitive information like credentials, certificates, and secrets. This ensures consistent and secure access across all our applications and services.

2. **Centralized Log Management for All Applications**  
   By leveraging **Azure Log Analytics** and **Application Insights**, we will set up a centralized logging system that gathers and analyzes logs from all our applications. This enables us to monitor performance, troubleshoot issues, and maintain operational insights across our environment.

This tutorial is aimed at cloud architects and developers seeking to securely automate their infrastructure management using Infrastructure-as-Code (IaC) with Pulumi.

![secrets-management](/assets/az-03-pulumi-private-ask-credential-log-management/secrets-management.png)

---

## Table of Contents

---

## Configuration

Before we start coding, it's important to define our configuration settings. This involves specifying resource names and subnet address spaces that we'll use throughout the project.

### Resource Groups

We categorize our resources into groups for better organization and management:

| Resource Group                  | Description                                             |
| ------------------------------- | ------------------------------------------------------- |
| **Shared Resource Group**       | Where our Key Vault and logging components reside.      |
| **Hub VNet Resource Group**     | Contains our main VNet hub.                             |
| **AKS VNet Resource Group**     | Contains resources specific to the AKS cluster.         |
| **CloudPC VNet Resource Group** | For resources related to virtual desktops or cloud PCs. |

### Allocated Subnets

Again, this is the subnet Ip address spaces that we have defined in the [previous post](/posts/az-02-pulumi-private-ask-env-architecture#summary-of-allocated-subnets).

| VNet Name           | Subnet Name                    | Address Prefix      | Total | Usable |
| ------------------- | ------------------------------ | ------------------- | ----- | ------ |
| **1. Hub VNet**     | 1.1 Firewall Subnet            | `192.168.30.0/26`   | 64    | 59     |
|                     | 1.2 Firewall Management Subnet | `192.168.30.64/26`  | 54    | 59     |
|                     | 1.3 General Subnet             | `192.168.30.128/27` | 32    | 27     |
| **2. AKS VNet**     | 2.1 AKS Subnet                 | `192.168.31.0/24`   | 256   | 251    |
| **3. CloudPC VNet** | 3.1 CloudPC Subnet             | `192.168.32.0/25`   | 128   | 123    |
|                     | 3.2 DevOps Subnet              | `192.168.32.128/27` | 32    | 27     |

<details><summary>View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/config.ts#L1-L21)

</details>

> **Note:** Adding a number as a prefix to the Azure resource group names helps keep them sorted in sequence, making them easier to find and navigate.
>
> The `getName` method will format the name with convention `{stack}-nameWithoutNumber-{suffix}` and remove the numbers before creating the resources inside Resource Group.

---

## The `Common` Library

To promote code reusability and maintainability, we create a common project named `az-commons`.
This library contains utilities and helper functions that we'll use across all our Pulumi projects.

### The `azEnv` Module

The `azEnv` module provides functions to retrieve Azure environment configurations:

- **Tenant ID**: Identifies the Azure Active Directory (EntraID) tenant.
- **Subscription ID**: Identifies the Azure subscription where resources will be deployed.
- **Current Principal**: The object ID of the user or service principal executing the scripts.
- **Region Code**: Specifies the Azure region, defaulting to `"SoutheastAsia"` if not explicitly set.

### The `naming` Module

The `naming` module helps generate resource names with a consistent prefix based on the Pulumi stack name:

- **`getGroupName`**: Prepends the stack name to a resource group name.
- **`getName`**: Generates a resource name without the number with an optional suffix.

### The `stackEnv` Module

The `stackEnv` module provides functions to retrieve Pulumi stack environment configurations:

- **`isDryRun`**: Indicates whether the current execution is a dry run (preview) or an actual deployment.
- **Organization**: The Pulumi organization name.
- **Project Name**: The name of the Pulumi project.
- **Stack**: The name of the Pulumi stack.
- **StackReference**: This helper function ensures that a project correctly references stacks within the same organization and environment.
  For example, the `dev` stack of project `az-02-hub-vnet` will reference the `dev` stack of project `az-01-shared`.
  This mechanism prevents cross-environment resource referencing, ensuring that resources from different environments (e.g., dev and prod) are kept isolated and properly aligned within the intended environment.

  > For more details, please refer to the [source code here](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-commons).

---

## The `Shared` Project

Following the instructions from [Day 01](/posts/az-01-pulumi-setup-developer-account), we create a new project named `az-01-shared`.
This project will include the following components:

### The `Vault` Module

Creating a `Azure Key Vault` is a secure storage solution for managing secrets, keys, and certificates. It helps safeguard cryptographic keys and secrets used by cloud applications and services. The vault ensures that sensitive information is protected and can be accessed securely by authorized applications and users.

- **Vault Options**:

  - **enablePurgeProtection**: This option enables purge protection for the Key Vault. When enabled, it prevents the permanent deletion of the vault and its contents for a specified retention period, even if a delete operation is performed. This is crucial for compliance and recovery scenarios.
  - **enabledForDiskEncryption**: This setting allows the Key Vault to be used for Azure Disk Encryption. It is necessary for encrypting virtual machine disks, ensuring that data at rest is protected.
  - **softDeleteRetentionInDays**: This specifies the number of days that deleted vault items (like keys, secrets, and certificates) are retained in a "soft deleted" state. During this period, they can be recovered. The minimum value is 7 days, and the maximum is 90 days.
  - **enableRbacAuthorization:** This enables Role-Based Access Control (RBAC) for managing access to the Key Vault. It requires authentication through EntraID, allowing for more granular and secure access management.

- **Vault Roles Management**: To implement the principle of least privilege, we create two EntraID groups:
  - **Read-Only Group**: For read-only access to the Key Vault.
  - **Write Group**: For write access to the Key Vault.

<details><summary> View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-01-shared/Vault.ts#L1-L132)

</details>

### The `Log` Module

This module provisions a Log Analytics Workspace, which is used for collecting and analyzing telemetry data from various sources, providing insights into resource utilization and performance.

- **Workspace Options**:
  - **immediatePurgeDataOn30Days**: which allows data to be purged immediately after 30 days.
  - **workspaceCapping**: Sets a daily data ingestion quota to control costs and manage data volume.
  - **sku**: Defines the pricing tier for the workspace, which affects cost and features.

<details><summary> View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-01-shared/Log/Workspace.ts#L1-L126)

</details>

### The `AppInsight` module

this module is setup an Application Insights component for monitoring web applications, linking it to a Log Analytics Workspace for data ingestion, and storing sensitive information in a Key Vault for secure access.

- **AppInsights Options**:
  - **kind** and **applicationType**: Define the type of application being monitored, in this case, a web application.
  - **retentionInDays**: Sets the data retention period to 30 days.
  - **immediatePurgeDataOn30Days**: Allows data to be purged immediately after 30 days.
  - **ingestionMode**: Specifies that data ingestion is done through Log Analytics.

<details><summary>View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-01-shared/Log/AppInsight.ts#L1-L174)

</details>

### Core Project module: `index.ts`

The `index.ts` file acts as the central hub for the `shared` project, and a similar structure is maintained across all related projects. This file is tasked with:

- Establishing Resource Groups.
- Deploying all the Azure Resources above.
- Providing essential resource details for future use by other projects.

<details><summary>View code:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-01-shared/index.ts#L1-L55)

</details>

> For more details, please refer to the [source code here](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-01-shared).

---

## Deployment and Cleanup

### Deploying the Stack

To deploy the stack, execute the `pnpm run up` command. This provisions the necessary Azure resources. We can verify the deployment as follows:

- EntraID groups configured for Key Vault access control:
  ![Entra-Group](/assets/az-03-pulumi-private-ask-credential-log-management/az-01-entra-groups.png)

- Successfully deployed Azure resources:
  ![Azure-Resources](/assets/az-03-pulumi-private-ask-credential-log-management/az-01-resources.png)

### Cleaning Up the Stack

To remove the stack and clean up all associated Azure resources, run the `pnpm run destroy` command. This ensures that any resources no longer needed are properly deleted.

---

## Conclusion

By following this guide, we have successfully automated the deployment of secure `secret management` and centralized `log management` using Azure Key Vault, Log Analytics, and Application Insights with Pulumi.
This setup ensures that sensitive data is securely stored and that we have real-time monitoring of application performance across our environment.

Implementing RBAC and the principle of least privilege enhances the security posture of our infrastructure. Centralized logging enables us to efficiently troubleshoot issues and gain operational insights.

---

## References

- [az-01-shared](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-01-shared).
- [az-commons](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-commons).

---

## Next Steps

**[Day 04: Develop a Virtual Network Hub for Private AKS on Azure](/posts/az-04-pulumi-private-aks-hub-vnet-development)**

Now that we've established secure credential management and centralized logging, the next step is to build out the virtual network hub for a private AKS environment.
In this article, We'll walk through the process of developing the first Hub VNet for a private AKS environment using Pulumi.

---

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven** | _[GitHub](https://github.com/baoduy)_