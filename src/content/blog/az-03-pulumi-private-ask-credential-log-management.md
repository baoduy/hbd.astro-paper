---
author: Steven Hoang
pubDatetime: 2025-01-01T12:00:00Z
title: "[Az] Day 03: How to manage the Azure Resource Credentials and How to share and Manage logs from all components."
featured: false
draft: false
tags:
  - AKS
  - Private
  - Pulumi
description: "This showing How to leverage pulumi to automate the environment credential creation and management automatically and securely store them in the Key Vault.
Beside that We also provision some shared resources for Logging purposes."
---

## Introduction

There are 2 major things we discuss here:

1. **Secure Resource Credentials**:
   Most of Azure Resources already support `Service Principal` authentication that the application can authenticate again EntraID using `Service Principal` before accessing the resources.
   However, there are some resources still using the traditional `Connection String` So that to secure these resources credentials We will leverage the pulumi to automate end-to-end cycle of the credential management from create, store, retrieve and renew automatically.
   And protect them from sharing directly to the developers by automate the CI/CD deployment that can pull the secrets and replace to the deployment specs during deploying in an private Azure DevOps agents.
   ![secret-management](/assets/az-03-pulumi-private-ask-credential-log-management/secrets-management.png)

2. **Log management**:
   Collecting and management the logs from the applications is also important as that allows our developers to trace and debugs the applications in DEV environment and allows app-support to monitor the applications in PRD environment.
   Azure provide an efficient way to manage the env log on Azure and leverage the power of Azure Monitor to tracking the entire Azure resources by not only applications logs but also the security monitoring as well.

   - Application insight: For application log
   - Log Workspace: for log analytic
   - Storage Account: for database (Azure SQL Server) monitoring.

   In this, post will show us how to create an resources group that have all resources mention above and reuse them for the subsequence resources provision later.

---

## Setting Up the Configuration

Before we start coding, it's important to define our configuration settings.
This involves specifying resource names and subnet address spaces that we'll use throughout the project.

- **Resource Groups**: We categorize our resources into groups for better organization and management. We define three main resource groups:

  - **Shared Resource Group**: This is where our Key Vault and Logs components will reside.
  - **Hub VNet Resource Group**: This is where our main VNet hub will reside.
  - **AKS VNet Resource Group**: This group will contain resources specific to the AKS.
  - **CloudPC VNet Resource Group**: This group is for resources related to virtual desktops or cloud PCs.

- **Subnet Address Spaces**: We allocate specific IP address ranges for different subnets within our VNet. This helps in segregating network traffic and applying network policies effectively. The subnets include:
  - **Firewall Subnet**: Dedicated for the Azure Firewall.
  - **Firewall Management Subnet**: Used for managing the firewall.
  - **General Subnet**: A general-purpose subnet for various resources.
  - **AKS Subnet**: Specifically for the AKS cluster.
  - **CloudPC Subnet**: For virtual desktop instances.
  - **DevOps Subnet**: For resources related to DevOps activities.

```typescript
export const azGroups = {
  //The name of Shared resource group
  shared: "01-shared",
  //The name of Hub VNet resource group
  hub: "02-hub",
  //The name of AKS VNet resource group
  ask: "03-ask",
  //The name of CloudPC VNet resource group
  cloudPC: "04-cloudPC",
};

//The subnet IP address spaces
export const subnetSpaces = {
  firewall: "192.168.30.0/26",
  firewallManage: "192.168.30.64/26",
  general: "192.168.30.128/27",
  aks: "192.168.31.0/24",
  cloudPC: "192.168.32.0/25",
  devOps: "192.168.32.128/27",
};
```

> **Note:** Adding a number as a prefix to the Azure resource group names just helps keep them sorted in sequence and making them easier to find and navigate.

---

## Creating a `Common` Project

To promote code reusability and maintainability, we create a common project named `az-commons`. This project contains utilities and helper functions that we'll use across all our Pulumi projects.

### The `azEnv` module

- **Purpose**: The `azEnv` module provides functions to retrieve Azure environment configurations.
- **Key Components**:
  - **Tenant ID**: Identifies the Azure Active Directory (AAD) tenant.
  - **Subscription ID**: Identifies the Azure subscription where resources will be deployed.
  - **Current Principal**: The object ID of the user or service principal executing the scripts.
  - **Region Code**: Specifies the Azure region, defaulting to "SoutheastAsia" if not explicitly set.

### The `naming` module

- **Purpose**: The `naming` module helps generate resource names with a consistent prefix based on the Pulumi stack name.
- **Key Functions**:
  - **getGroupName**: Prepends the stack name to a resource group name.
  - **getName**: Generates a resource name with an optional suffix.

### The `stackEnv` module

- **Purpose**: The `stackEnv` module provides functions to retrieve Pulumi stack environment configurations.
- **Key Components**:
  - **isDryRun**: Indicates whether the current execution is a dry run (preview) or an actual deployment.
  - **Organization**: The Pulumi organization name.
  - **Project Name**: The name of the Pulumi project.
  - **Stack**: The name of the Pulumi stack.

> For more details, you can refer to the [source code here](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-commons/README.md).

---

## Creating `Shared` Project

Following the instructions from [Day 01](/posts/az-01-pulumi-setup-developer-account), let's create a new project named `az-01-shared` with the following code:

```typescript

```

---

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven**
[GitHub](<[https://github.com/baoduy](https://github.com/baoduy)>)
