---
author: Steven Hoang
pubDatetime: 2025-01-01T12:00:00Z
title: "[Az] Day 03: Automating Secret Management and Centralized Log Monitoring on Azure."
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
_(Download original file <a href="/assets/az-03-pulumi-private-ask-credential-log-management/secrets-management.drawio" download>here</a> )_

---

## Table of Contents

- [Introduction](#introduction)
- [Conclusion](#conclusion)
- [References](#references)
- [Next Steps](#next-steps)
- [Thank You](#thank-you)

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

## Summary of Allocated Subnets

Again, this is the subnet Ip address spaces that we have defined in the [previous post](/posts/az-02-pulumi-private-ask-env-architecture#summary-of-allocated-subnets).

| VNet Name           | Subnet Name                    | Address Prefix      | Total | Usable |
| ------------------- | ------------------------------ | ------------------- | ----- | ------ |
| **1. Hub VNet**     | 1.1 Firewall Subnet            | `192.168.30.0/26`   | 64    | 59     |
|                     | 1.2 Firewall Management Subnet | `192.168.30.64/26`  | 54    | 59     |
|                     | 1.3 General Subnet             | `192.168.30.128/27` | 32    | 27     |
| **2. AKS VNet**     | 2.1 AKS Subnet                 | `192.168.31.0/24`   | 256   | 251    |
| **3. CloudPC VNet** | 3.1 CloudPC Subnet             | `192.168.32.0/25`   | 128   | 123    |
|                     | 3.2 DevOps Subnet              | `192.168.32.128/27` | 32    | 27     |

<details><summary>Here is our <code>config.ts</code> file:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/config.ts#L1-L21)

</details>

> **Note:** Adding a number as a prefix to the Azure resource group names helps keep them sorted in sequence, making them easier to find and navigate.
>
> The `getName` method will remove the number before creating the resources inside Resource Group.

---

## Creating a `Common` Project

To promote code reusability and maintainability, we create a common project named `az-commons`. This project contains utilities and helper functions that we'll use across all our Pulumi projects.

### The `azEnv` Module

The `azEnv` module provides functions to retrieve Azure environment configurations:

- **Tenant ID**: Identifies the Azure Active Directory (Azure AD) tenant.
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

  > For more details, please refer to the [source code here](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-commons/README.md).

---

## Creating the `Shared` Project

Following the instructions from [Day 01](/posts/az-01-pulumi-setup-developer-account), we create a new project named `az-01-shared`. This project will include the following components:

### The `Vault` Module

The `Vault` module is responsible for deploying an Azure Key Vault with associated Azure Active Directory (Azure AD) group access control.

**Key Components:**

1. **Key Vault Creation**

   We configure the Key Vault with:

   - **RBAC Authorization**: `enableRbacAuthorization` set to `true`, requiring authentication through Azure AD.
   - **Soft Delete Retention**: A retention period is set to ensure deleted secrets can be recovered within a specified number of days.
   - **Deployment Settings**: Options like `enabledForDeployment` and `enabledForDiskEncryption` are enabled to allow integration with other Azure services.

2. **Vault Roles Management**

   To implement the principle of least privilege, we create two Azure AD groups:

   - **Read-Only Group**: For read-only access to the Key Vault.
   - **Write Group**: For write access to the Key Vault.

   We assign specific roles to these groups, ensuring services or individuals accessing the vault only have the permissions they need.

<details><summary>Here is our <code>Vault.ts</code> file:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-01-shared/Vault.ts#L1-L132)

</details>

### The `Log` Module

This module provisions an Azure Log Analytics workspace and an Application Insights instance. Optionally, it integrates with an Azure Key Vault for storing secrets.

**Key Components:**

1. **Workspace Setup**

   - **Log Analytics Workspace**: We create a workspace configured with a daily data ingestion quota, which can be adjusted based on the environment.
   - **Retention Policies**: Data is purged automatically after 30 days to manage storage costs and comply with data retention policies.

<details><summary>Here is our <code>Workspace.ts</code> file:</summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-01-shared/Log/Workspace.ts#L1-L126)

</details>

2. **Application Insights Setup**

   - **Application Insights Instance**: Associated with the Log Analytics workspace for monitoring web applications.
   - **Secret Management**: If a Key Vault is provided, we store the instrumentation key and connection string as secrets for secure access.

<details><summary>Here is our <code>AppInsight.ts</code> file:</summary>

  [inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-01-shared/Log/AppInsight.ts#L1-L174)

</details>

### Main Project Code `index.ts`

In the main script of the `shared` project, we create the Resource Group, Key Vault, Log Analytics Workspace, and Application Insights. We also export resource IDs and group information that can be used by other Pulumi projects.

**Key Components:**

1. **Resource Group Creation**

   We create an Azure Resource Group to host all our shared resources, such as the Key Vault, Log Analytics Workspace, and Application Insights.

2. **Key Vault Setup**

   The Key Vault securely manages sensitive data:

   - **RBAC Implementation**: Assign different roles to specific groups for fine-grained access control.
   - **Soft Delete Policy**: Set a retention policy for deleted secrets.

3. **Log Analytics and Application Insights**

   - **Centralized Logging**: All logs from our applications are collected and visualized in the Log Analytics Workspace.
   - **Secure Monitoring**: Sensitive information like the Application Insights connection string is stored securely in the Key Vault.

4. **Exporting Resource Information**

   We export resource `name, ID` for every created resources for reuse in other projects, ensuring consistent references across our infrastructure.

<details><summary>Here is our <code>index.ts</code> file:</summary>

  [inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-01-shared/index.ts#L1-L37)

</details>

> For more details, please refer to the [source code here](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-01-shared/README.md).

---

## Deploying the `Shared` Project

### Deploy the Stack

Run the following command to deploy the stack:

```bash
pnpm run up
```

<details><summary>Sample Output:</summary>

```bash
> az-01-hub-vnet@ up /Volumes/VMs_2T/_GIT/drunk-azure-pulumi-articles/az-01-shared
> pulumi up --yes --skip-preview

Updating (dev)

View in Browser (Ctrl+O): https://app.pulumi.com/drunkcoding/az-01-shared/dev/updates/21

     Type                                           Name                                                 Status            Info
 +   pulumi:pulumi:Stack                            az-01-shared-dev                                     created (86s)     6 messages
 +   ├─ azuread:index:Group                         dev-shared-vlt-write                                 created (22s)
 +   ├─ azure-native:resources:ResourceGroup        dev-01-shared                                        created (2s)
 +   ├─ azuread:index:Group                         dev-shared-vlt-readOnly                              created (23s)
 +   ├─ azure-native:keyvault:Vault                 dev-shared-vlt                                       created (40s)
 +   ├─ azure-native:operationalinsights:Workspace  dev-shared-log                                       created (31s)
 +   ├─ azure-native:insights:Component             dev-shared-insights                                  created (4s)
 +   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-14b46e9e-c2b7-41b4-b07b-48a6ebf60603  created (3s)
 +   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-21090545-7ca7-4776-b22c-e363652d74d2  created (5s)
 +   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-db79e9a7-68ee-4b58-9aeb-b90e7c24fcba  created (7s)
 +   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-f25e0fa2-a7c8-4377-a976-54943a77a395  created (8s)
 +   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-e147488a-f6f5-4113-8e2d-b22465e65bf6  created (2s)
 +   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-4633458b-17de-408a-b874-0445c86b69e6  created (4s)
 +   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-12338af0-0e69-4776-bea7-57ae8d297424  created (7s)
 +   ├─ azure-native:keyvault:Secret                dev-shared-insights-key                              created (2s)
 +   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-a4417e6f-fecd-4de8-b567-7b0420556985  created (5s)
 +   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-b86a8fe4-44ce-4948-aee5-eccb2c155cd7  created (8s)
 +   └─ azure-native:keyvault:Secret                dev-shared-insights-conn                             created (7s)

Diagnostics:
  pulumi:pulumi:Stack (az-01-shared-dev):
    Pulumi Environments: {
      organization: 'drunkcoding',
      projectName: 'az-01-shared',
      stack: 'dev',
      isDryRun: false
    }

Outputs:
    appInsight  : {
        id : "/subscriptions/54dbd16b-81cd-4444-b4fd-02c2dcd59d3d/resourceGroups/dev-01-shared5cc639c5/providers/microsoft.insights/components/dev-shared-insights42ea1dd8"
        key: "c6114e12-fe84-4b4b-a3c1-1ac036d61bd4"
    }
    logWorkspace: {
        customerId: "21edf4e0-2fec-4da5-8c2a-c09a5d9dbdef"
        id        : "/subscriptions/54dbd16b-81cd-4444-b4fd-02c2dcd59d3d/resourceGroups/dev-01-shared5cc639c5/providers/Microsoft.OperationalInsights/workspaces/dev-shared-logc34ae06a"
    }
    rsGroupId   : "/subscriptions/54dbd16b-81cd-4444-b4fd-02c2dcd59d3d/resourceGroups/dev-01-shared5cc639c5"
    vault       : {
        id             : "/subscriptions/54dbd16b-81cd-4444-b4fd-02c2dcd59d3d/resourceGroups/dev-01-shared5cc639c5/providers/Microsoft.KeyVault/vaults/dev-shared-vltad719b50"
        readOnlyGroupId: "3d71130a-773f-45c3-99ca-cc19a29cac7d"
        writeGroupId   : "0feed654-26fa-4ce5-b1ba-a880965e1bcb"
    }

Resources:
    + 18 created

Duration: 1m28s
```

</details>

### Azure Resources After Deployment

#### Azure AD Groups

The Azure AD groups for Key Vault access control are created:

![Entra-Group](/assets/az-03-pulumi-private-ask-credential-log-management/az-01-entra-groups.png)

#### Azure Resources

The Azure resources including the Resource Group, Key Vault, Log Analytics Workspace, and Application Insights are deployed:

![Entra-Group](/assets/az-03-pulumi-private-ask-credential-log-management/az-01-resources.png)

> **Note:** Ensure that the images render correctly on the platform where this guide is published, and provide descriptive alt text for accessibility.

### Destroy the Stack

To destroy the stack and clean up resources, run:

```bash
pnpm run destroy
```

<details><summary>Sample Output:</summary>

```bash
> az-01-hub-vnet@ destroy /Volumes/VMs_2T/_GIT/drunk-azure-pulumi-articles/az-01-shared
> pulumi destroy --yes --skip-preview

Destroying (dev)

View in Browser (Ctrl+O): https://app.pulumi.com/drunkcoding/az-01-shared/dev/updates/20

     Type                                           Name                                                 Status
 -   pulumi:pulumi:Stack                            az-01-shared-dev                                     deleted (1s)
 -   ├─ azure-native:keyvault:Secret                dev-shared-insights-conn                             deleted (5s)[retain]
 -   ├─ azure-native:keyvault:Secret                dev-shared-insights-key                              deleted (6s)[retain]
 -   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-14b46e9e-c2b7-41b4-b07b-48a6ebf60603  deleted (5s)
 -   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-e147488a-f6f5-4113-8e2d-b22465e65bf6  deleted (5s)
 -   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-db79e9a7-68ee-4b58-9aeb-b90e7c24fcba  deleted (2s)
 -   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-b86a8fe4-44ce-4948-aee5-eccb2c155cd7  deleted (3s)
 -   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-f25e0fa2-a7c8-4377-a976-54943a77a395  deleted (4s)
 -   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-12338af0-0e69-4776-bea7-57ae8d297424  deleted (3s)
 -   ├─ azure-native:insights:Component             dev-shared-insights                                  deleted (5s)
 -   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-a4417e6f-fecd-4de8-b567-7b0420556985  deleted (4s)
 -   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-4633458b-17de-408a-b874-0445c86b69e6  deleted (5s)
 -   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-21090545-7ca7-4776-b22c-e363652d74d2  deleted (7s)
 -   ├─ azure-native:keyvault:Vault                 dev-shared-vlt                                       deleted (8s)
 -   ├─ azure-native:operationalinsights:Workspace  dev-shared-log                                       deleted (1s)
 -   ├─ azuread:index:Group                         dev-shared-vlt-readOnly                              deleted (21s)
 -   ├─ azure-native:resources:ResourceGroup        dev-01-shared                                        deleted (15s)
 -   └─ azuread:index:Group                         dev-shared-vlt-write                                 deleted (21s)

Outputs:
  - appInsightId  : "/subscriptions/54dbd16b-81cd-4444-b4fd-02c2dcd59d3d/resourceGroups/dev-01-shared79f10573/providers/microsoft.insights/components/dev-shared-insights00f71ffa"
  - logWorkspaceId: "/subscriptions/54dbd16b-81cd-4444-b4fd-02c2dcd59d3d/resourceGroups/dev-01-shared79f10573/providers/Microsoft.OperationalInsights/workspaces/dev-shared-loga30aa58f"
  - rsGroupId     : "/subscriptions/54dbd16b-81cd-4444-b4fd-02c2dcd59d3d/resourceGroups/dev-01-shared79f10573"
  - vault         : {
      - id             : "/subscriptions/54dbd16b-81cd-4444-b4fd-02c2dcd59d3d/resourceGroups/dev-01-shared79f10573/providers/Microsoft.KeyVault/vaults/dev-shared-vlt2fdd6d3f"
      - readOnlyGroupId: "92758d51-8f7c-4b5e-9442-5dca96965961"
      - writeGroupId   : "9ff3b17c-3d4c-4be6-bb97-4c27eb480539"
    }

Resources:
    - 18 deleted

Duration: 51s
```

</details>

---

## Conclusion

By following this guide, we have successfully automated the deployment of secure secret management and centralized log management using Azure Key Vault, Log Analytics, and Application Insights with Pulumi. This setup ensures that sensitive data is securely stored and that we have real-time monitoring of application performance across our environment.

Implementing RBAC and the principle of least privilege enhances the security posture of our infrastructure. Centralized logging enables us to efficiently troubleshoot issues and gain operational insights.

---

## Next Steps

**[Day 04: Develop a Virtual Network Hub for Private AKS on Azure](/posts/az-04-pulumi-private-aks-hub-vnet-development)**

Now that we've established secure credential management and centralized logging, the next step is to build out the virtual network hub for a private AKS environment.
In this article, We'll walk through the process of developing the first Hub VNet for a private AKS environment using Pulumi.

---

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven**
[GitHub](https://github.com/baoduy)
