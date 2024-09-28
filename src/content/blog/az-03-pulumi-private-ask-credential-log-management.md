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

In this guide, we will demonstrate how to implement **secret management** across your entire environment using **Azure Key Vault** and **centralized log management** for all applications on Azure with **Log Analytics** and **Application Insights**. By automating the setup with Pulumi, you will create a secure and scalable foundation for managing sensitive information and monitoring application performance.

### Key Objectives:

1. **Secret Management for the Entire Environment**:
   We’ll use **Azure Key Vault** to securely manage and store sensitive information like credentials, certificates, and secrets. This ensures consistent and secure access across all your applications and services.
2. **Centralized Log Management for All Applications**:
   By leveraging **Azure Log Analytics** and **Application Insights**, we’ll set up a centralized logging system that gathers and analyzes logs from all your applications. This will enable you to monitor performance, troubleshoot issues, and maintain operational insights across your environment.

This tutorial is aimed at cloud architects and developers seeking to securely automate their infrastructure management using Infrastructure-as-Code (IaC) with Pulumi.

---

## The Configuration

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

Here is our `config.ts` file at the root folder of the projects

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

> For more details, please can refer to the [source code here](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-commons/README.md).

---

## Creating `Shared` Project

Following the instructions from [Day 01](/posts/az-01-pulumi-setup-developer-account), let's create a new project named `az-01-shared` with the following code:

### the `Vault` module

This script for deploying an Azure Key Vault with associated Azure EntraID group access control.

```typescript
import * as azure from "@pulumi/azure-native";
import * as ad from "@pulumi/azuread";
import { getName, tenantId, subscriptionId } from "@az-commons";
import { interpolate } from "@pulumi/pulumi";

export default (
  name: string,
  {
    //it should be 90 days or more in PRD
    retentionInDays = 7,
    rsGroup,
  }: {
    retentionInDays?: number;
    rsGroup: azure.resources.ResourceGroup;
  }
) => {
  const vaultName = getName(name, "vlt");
  const vault = new azure.keyvault.Vault(
    vaultName,
    {
      resourceGroupName: rsGroup.name,
      properties: {
        //soft delete min value is '7' and max is '90'
        softDeleteRetentionInDays: retentionInDays,
        //Must be authenticated with EntraID for accessing.
        enableRbacAuthorization: true,
        enabledForDeployment: true,
        enabledForDiskEncryption: true,

        tenantId,
        sku: {
          name: azure.keyvault.SkuName.Standard,
          family: azure.keyvault.SkuFamily.A,
        },
      },
    },
    { dependsOn: rsGroup }
  );

  /** As the key vault is require Rbac authentication.
   * So We will create 2 EntraID groups for ReadOnly and Write access to this Key Vault
   */
  const vaultReadOnlyGroup = new ad.Group(`${vaultName}-readOnly`, {
    displayName: `AZ ROL ${vaultName.toUpperCase()} READONLY`,
    securityEnabled: true,
  });
  const vaultWriteGroup = new ad.Group(`${vaultName}-write`, {
    displayName: `AZ ROL ${vaultName.toUpperCase()} WRITE`,
    securityEnabled: true,
  });

  /**
   * These roles allow read access to the secrets in the Key Vault, including keys, certificates, and secrets.
   * The role names and IDs are provided here for reference, but only the ID is used in the code.
   * All roles are combined into a single Entra ID group in this implementation. However, you can split them
   * into separate groups depending on your environment's requirements.
   *
   * To retrieve all available roles in Azure, you can use the following REST API:
   * https://learn.microsoft.com/en-us/azure/role-based-access-control/role-assignments-list-rest
   */

  //ReadOnly Roles
  [
    {
      name: "Key Vault Crypto Service Encryption User",
      id: "e147488a-f6f5-4113-8e2d-b22465e65bf6",
    },
    {
      name: "Key Vault Secrets User",
      id: "4633458b-17de-408a-b874-0445c86b69e6",
    },
    {
      name: "Key Vault Crypto User",
      id: "12338af0-0e69-4776-bea7-57ae8d297424",
    },
    {
      name: "Key Vault Certificate User",
      id: "db79e9a7-68ee-4b58-9aeb-b90e7c24fcba",
    },
    { name: "Key Vault Reader", id: "21090545-7ca7-4776-b22c-e363652d74d2" },
  ].map(
    r =>
      //Grant the resources roles to the group above.
      new azure.authorization.RoleAssignment(
        `${vaultName}-${r.id}`,
        {
          principalType: "Group",
          principalId: vaultReadOnlyGroup.objectId,
          roleAssignmentName: r.id,
          roleDefinitionId: interpolate`/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/${r.id}`,
          scope: vault.id,
        },
        { dependsOn: [vault, vaultReadOnlyGroup] }
      )
  );

  //Write Roles
  [
    {
      name: "Key Vault Certificates Officer",
      id: "a4417e6f-fecd-4de8-b567-7b0420556985",
    },
    {
      name: "Key Vault Crypto Officer",
      id: "14b46e9e-c2b7-41b4-b07b-48a6ebf60603",
    },
    {
      name: "Key Vault Secrets Officer",
      id: "b86a8fe4-44ce-4948-aee5-eccb2c155cd7",
    },
    {
      name: "Key Vault Contributor",
      id: "f25e0fa2-a7c8-4377-a976-54943a77a395",
    },
  ].map(
    r =>
      //Grant the resources roles to the group above.
      new azure.authorization.RoleAssignment(
        `${vaultName}-${r.id}`,
        {
          principalType: "Group",
          principalId: vaultWriteGroup.objectId,
          roleAssignmentName: r.id,
          roleDefinitionId: interpolate`/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/${r.id}`,
          scope: vault.id,
        },
        { dependsOn: [vault, vaultWriteGroup] }
      )
  );

  return { vault, vaultReadOnlyGroup, vaultWriteGroup };
};
```

### Key Components:

1. **Key Vault Creation**:

   - The module defines a default export function that accepts a `name` for the Key Vault and configuration options, particularly:
     - `retentionInDays`: The number of days for which deleted secrets will be retained (defaults to 7 days).
     - `rsGroup`: The Azure Resource Group where the Key Vault will reside.

2. **Vault Configuration**:

   - The Key Vault is configured with several key properties:
     - `softDeleteRetentionInDays`: Specifies how long deleted items (secrets, keys, etc.) are retained (between 7 to 90 days).
     - `enableRbacAuthorization`: Enables RBAC (role-based access control) for the vault, requiring authentication through Azure AD.
     - `enabledForDeployment`, `enabledForDiskEncryption`: These are additional configuration options for allowing deployment and disk encryption using the vault.

3. **Azure AD Groups**:

   - Two Azure AD groups are created to manage access to the Key Vault:
     - A **Read-Only Group** for read-only access to the Key Vault.
     - A **Write Group** for write access to the Key Vault.
   - Each group has a distinct `displayName` indicating whether it has read-only or write permissions.

4. **Role Assignments**:
   - Although not fully displayed, the script is designed to assign roles to the AD groups for managing Key Vault access, using a combination of Azure roles for reading secrets, keys, and certificates.

### The `Log` module

This set of modules is designed to provision and manage an Azure Log Analytics workspace, an Application Insights instance, and optionally integrate with an Azure Key Vault for secret storing.
It supports logging and monitoring of web applications, while securely storing instrumentation keys and connection strings in Key Vault.

1. **Workspace.ts**:
   - This module sets up an **Azure Log Analytics Workspace**.
   - The workspace is configured with:
     - `dailyQuotaGb`: The daily data ingestion quota, set to 0.1 GB (100 MB) by default, which can be adjusted based on the environment.
     - `sku`: The pricing tier for the workspace (defaults to `PerGB2018`).
   - The workspace is also configured to purge data after 30 days.

```typescript
import * as azure from "@pulumi/azure-native";
import { getName } from "@az-commons";

export default (
  name: string,
  {
    rsGroup,
    //For demo purpose I config capacity here is 100Mb. Adjust this according to your env.
    dailyQuotaGb = 0.1,
    sku = azure.operationalinsights.WorkspaceSkuNameEnum.PerGB2018,
  }: {
    dailyQuotaGb?: number;
    rsGroup: azure.resources.ResourceGroup;
    sku?: azure.operationalinsights.WorkspaceSkuNameEnum;
  }
) =>
  new azure.operationalinsights.Workspace(
    getName(name, "log"),
    {
      resourceGroupName: rsGroup.name,
      features: { immediatePurgeDataOn30Days: true },
      workspaceCapping: { dailyQuotaGb },
      sku: { name: sku },
    },
    { dependsOn: rsGroup }
  );
```

2. **AppInsight.ts**:
   - This module provisions an **Application Insights** resource.
   - It takes the `name`, `vault`, `rsGroup`, and `workspace` as arguments.
   - It creates an Application Insights instance associated with the Log Analytics workspace for web applications (`applicationType: "web"`).
   - The retention period for logs is set to 30 days (`retentionInDays: 30`), and data is purged automatically after that period.
   - If a `KeyVault` is provided:
     - It creates two secrets in the Key Vault: one for the Application Insights instrumentation key and another for the connection string.
     - The `retainOnDelete` flag is used to retain these secrets even if the Pulumi-managed resources are deleted.

```typescript
import * as azure from "@pulumi/azure-native";
import { getName } from "@az-commons";

export default (
  name: string,
  {
    vault,
    rsGroup,
    workspace,
  }: {
    rsGroup: azure.resources.ResourceGroup;
    workspace: azure.operationalinsights.Workspace;
    vault?: azure.keyvault.Vault;
  }
) => {
  const appInsightName = getName(name, "insights");
  const appInsight = new azure.insights.Component(
    appInsightName,
    {
      resourceGroupName: rsGroup.name,
      workspaceResourceId: workspace.id,
      kind: "web",
      applicationType: "web",
      retentionInDays: 30,
      immediatePurgeDataOn30Days: true,
      ingestionMode: azure.insights.IngestionMode.LogAnalytics,
    },
    { dependsOn: workspace }
  );

  if (vault) {
    //Add appInsight key to vault
    new azure.keyvault.Secret(
      `${appInsightName}-key`,
      {
        resourceGroupName: rsGroup.name,
        vaultName: vault.name,
        secretName: `${appInsightName}-key`,
        properties: {
          value: appInsight.instrumentationKey,
          contentType: "AppInsight",
        },
      },
      {
        dependsOn: appInsight,
        //The option `retainOnDelete` allows to retain the resources on Azure when deleting pulumi resources.
        //In this case the secret will be retained on Key Vault when deleting.
        retainOnDelete: true,
      }
    );

    //Add App insight connection string to vault
    new azure.keyvault.Secret(
      `${appInsightName}-conn`,
      {
        resourceGroupName: rsGroup.name,
        vaultName: vault.name,
        secretName: `${appInsightName}-conn`,
        properties: {
          value: appInsight.connectionString,
          contentType: "AppInsight",
        },
      },
      {
        dependsOn: appInsight,
        //The option `retainOnDelete` allows to retain the resources on Azure when deleting pulumi resources.
        //In this case the secret will be retained on Key Vault when deleting.
        retainOnDelete: true,
      }
    );
  }

  return appInsight;
};
```

3. **index.ts**:
   - This is the entry point, where the main resources are orchestrated.
   - It imports the `Workspace` and `AppInsight` modules to create a Log Analytics workspace and an Application Insights instance.
   - The function takes two arguments:
     - `name`: A string used to generate resource names.
     - `props`: An object containing the `ResourceGroup` and optionally a `KeyVault`.
   - The `Workspace` function is called to create a Log Analytics workspace, and the `AppInsight` function creates the Application Insights resource, which uses the workspace.
   - The function returns the workspace and Application Insights resources.

```typescript
import * as azure from "@pulumi/azure-native";
import Workspace from "./Workspace";
import AppInsight from "./AppInsight";

export default (
  name: string,
  props: {
    rsGroup: azure.resources.ResourceGroup;
    vault?: azure.keyvault.Vault;
  }
) => {
  const workspace = Workspace(name, props);
  const appInsight = AppInsight(name, { ...props, workspace });

  return { workspace, appInsight };
};
```

### The main file `index.ts`

This main script create shared resources: Resource Group, Key Vault, and Log Analytics Workspace, along with Application Insights for monitoring purposes.
It also exports resource IDs and group information that can be used by other projects or modules.

```typescript
import * as azure from "@pulumi/azure-native";
import { getGroupName } from "@az-commons";
import * as config from "../config";
import Vault from "./Vault";
import Log from "./Log";

// Create Shared Resource Group
const rsGroup = new azure.resources.ResourceGroup(
  getGroupName(config.azGroups.shared)
);

const vaultInfo = Vault(config.azGroups.shared, {
  rsGroup,
  //This should be 90 days in PRD.
  retentionInDays: 7,
});

const logInfo = Log(config.azGroups.shared, {
  rsGroup,
  vault: vaultInfo.vault,
});

// Export the information that will be used in the other projects
export const rsGroupId = rsGroup.id;
export const logWorkspaceId = logInfo.workspace.id;
export const appInsightId = logInfo.appInsight.id;
export const vault = {
  id: vaultInfo.vault.id,
  readOnlyGroupId: vaultInfo.vaultReadOnlyGroup.id,
  writeGroupId: vaultInfo.vaultWriteGroup.id,
};
```

### Key Components:

1. **Resource Group**:

   The first step is to create an Azure Resource Group to host all of your shared resources, such as the Key Vault, Log Analytics Workspace, and Application Insights. A Resource Group helps organize and manage resources easily, grouping them by application or environment.

2. **Key Vault Setup**:

   Azure Key Vault plays a crucial role in securely managing sensitive data such as credentials, certificates, and secrets.

   In this setup, we are integrating Key Vault with Pulumi to automate the process of creating the vault and configuring access controls. By using Role-Based Access Control (RBAC), we can ensure that only specific groups or services have read or write access to the vault.

   The Key Vault will store sensitive data like the instrumentation key and connection string from Application Insights, ensuring these credentials are securely stored and retrievable by authorized services only.

   Key Points:
   RBAC: Assign different roles (such as Key Vault Reader and Key Vault Contributor) to specific groups, ensuring fine-grained access control over your secrets.
   Soft Delete: We set a retention policy for deleted secrets to ensure that, even if a secret is deleted accidentally, it can be recovered within a specified number of days. 3. **Log and Application Insights**:

   - The **Log** module is called to set up a Log Analytics workspace and an Application Insights resource.
   - It uses the same resource group and links the **Key Vault** (`vaultInfo.vault`) for securely storing sensitive logging information (e.g., instrumentation keys).
   - The result (`logInfo`) contains details about both the **Log Analytics Workspace** and **Application Insights**.

3. **Log Workspace and App Insight**:
   Application Insights is a powerful monitoring service used for tracking the performance of your applications, including AKS. In this guide, we integrate Application Insights with a Log Analytics Workspace, allowing you to centralize logging and gain deeper insights into application health.

   With Pulumi, we automate the setup of Application Insights, and link it to the Log Analytics workspace we create. Additionally, we store sensitive connection strings and instrumentation keys in Azure Key Vault for secure access by your applications.

   **Benefits of This Setup:**

   - **Centralized Logging**: All logs from your applications are collected and can be visualized in the Log Analytics Workspace.
   - **Automated Management**: The use of Pulumi ensures that all resources, from Key Vault to Application Insights, are provisioned automatically in a repeatable and scalable manner.
   - **Secure Monitoring**: Sensitive information like the Application Insights connection string is stored in Key Vault, ensuring that it remains protected.

4. **Exporting Key Resource Information**:

   After setting up the Resource Group, Key Vault, and Application Insights, We will export the resource IDs and group information.
   These identifiers are essential for other projects will be able to reuse them.

> For more details, please can refer to the [source code here](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-01-shared/README.md).

---

## Deploy the `shared` project

### Run this command to deploy the stack

```bash
pnpm run up

# Sample Output
> az-01-hub-vnet@ up /Volumes/VMs_2T/_GIT/drunk-azure-pulumi-articles/az-01-shared
> pulumi up --yes --skip-preview

Updating (dev)

View in Browser (Ctrl+O): https://app.pulumi.com/drunkcoding/az-01-shared/dev/updates/16

     Type                                           Name                                                 Status             Info
 +   pulumi:pulumi:Stack                            az-01-shared-dev                                     created (116s)     6 messages
 +   ├─ azuread:index:Group                         dev-shared-vlt-readOnly                              created (22s)
 +   ├─ azuread:index:Group                         dev-shared-vlt-write                                 created (22s)
 +   ├─ azure-native:resources:ResourceGroup        dev-01-shared                                        created (1s)
 +   ├─ azure-native:keyvault:Vault                 dev-shared-vlt                                       created (71s)
 +   ├─ azure-native:operationalinsights:Workspace  dev-shared-log                                       created (32s)
 +   ├─ azure-native:insights:Component             dev-shared-insights                                  created (4s)
 +   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-db79e9a7-68ee-4b58-9aeb-b90e7c24fcba  created (6s)
 +   ├─ azure-native:keyvault:Secret                dev-shared-insights-key                              created (3s)
 +   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-21090545-7ca7-4776-b22c-e363652d74d2  created (9s)
 +   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-e147488a-f6f5-4113-8e2d-b22465e65bf6  created (8s)
 +   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-4633458b-17de-408a-b874-0445c86b69e6  created (5s)
 +   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-f25e0fa2-a7c8-4377-a976-54943a77a395  created (11s)
 +   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-12338af0-0e69-4776-bea7-57ae8d297424  created (6s)
 +   ├─ azure-native:keyvault:Secret                dev-shared-insights-conn                             created (1s)
 +   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-b86a8fe4-44ce-4948-aee5-eccb2c155cd7  created (10s)
 +   ├─ azure-native:authorization:RoleAssignment   dev-shared-vlt-a4417e6f-fecd-4de8-b567-7b0420556985  created (6s)
 +   └─ azure-native:authorization:RoleAssignment   dev-shared-vlt-14b46e9e-c2b7-41b4-b07b-48a6ebf60603  created (11s)

Diagnostics:
  pulumi:pulumi:Stack (az-01-shared-dev):
    Pulumi Environments: {
      organization: 'drunkcoding',
      projectName: 'az-01-shared',
      stack: 'dev',
      isDryRun: false
    }

Outputs:
    appInsightId  : "/subscriptions/54dbd16b-81cd-4444-b4fd-02c2dcd59d3d/resourceGroups/dev-01-shared79f10573/providers/microsoft.insights/components/dev-shared-insights00f71ffa"
    logWorkspaceId: "/subscriptions/54dbd16b-81cd-4444-b4fd-02c2dcd59d3d/resourceGroups/dev-01-shared79f10573/providers/Microsoft.OperationalInsights/workspaces/dev-shared-loga30aa58f"
    rsGroupId     : "/subscriptions/54dbd16b-81cd-4444-b4fd-02c2dcd59d3d/resourceGroups/dev-01-shared79f10573"
    vault         : {
        id             : "/subscriptions/54dbd16b-81cd-4444-b4fd-02c2dcd59d3d/resourceGroups/dev-01-shared79f10573/providers/Microsoft.KeyVault/vaults/dev-shared-vlt2fdd6d3f"
        readOnlyGroupId: "92758d51-8f7c-4b5e-9442-5dca96965961"
        writeGroupId   : "9ff3b17c-3d4c-4be6-bb97-4c27eb480539"
    }

Resources:
    + 18 created

Duration: 1m58s

```

### The resources on Azure portal after deployed successfully

- **EntraID Groups**

  ![Entra-Group](/assets/az-03-pulumi-private-ask-credential-log-management/az-01-entra-groups.png)

- **Azure Resources**

![Entra-Group](/assets/az-03-pulumi-private-ask-credential-log-management/az-01-resources.png)

### Run this command to destroy the stack

```bash
pnpm run destroy

# Sample Output
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

---

## Conclusion

By the end of this guide, We have successfully automated the deployment of a secure AKS environment that includes centralized log management and credential storage.
Using Pulumi to manage Azure resources such as Key Vault, Application Insights, and Log Analytics Workspace, We can now securely manage sensitive data and monitor application performance in real time.

This setup provides a scalable and secure way to manage your Azure infrastructure, and the use of RBAC ensures that only authorized users and services can access the credentials and logs.

---

## Next Steps

**[Day 04: Develop a Virtual Network Hub for Private AKS on Azure](/posts/az-04-pulumi-private-aks-hub-vnet-development)**

In this post, We're going to dive into hands-on coding for the first Hub VNet (VNet) for our private AKS environment.
We'll walk through each step together, so even if you're new to this, you'll be able to follow along and get your environment up and running on Azure.

---

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven**
[GitHub](<[https://github.com/baoduy](https://github.com/baoduy)>)
