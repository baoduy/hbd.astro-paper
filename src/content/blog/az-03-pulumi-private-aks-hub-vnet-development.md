---
author: Steven Hoang
pubDatetime: 2025-01-01T12:00:00Z
title: "[Az] Day 03: Develop a VNet Hub for Private AKS on Azure."
featured: false
draft: false
tags:
  - AKS
  - Private
  - Pulumi
description: "In this post, We're going to dive into hands-on coding for the first Hub VNet (VNet) for our private AKS environment.
We'll walk through each step together, so even if you're new to this, you'll be able to follow along and get your environment up and running on Azure."
---

## Introduction

Today, we're going to dive into hands-on coding for the first Hub VNet (VNet) for our private AKS environment.
We'll walk through each step together, so even if you're new to this, you'll be able to follow along and get your environment up and running on Azure.

Security is paramount, so as we create our resources, we'll focus on optimizing security as much as possible while keeping our Azure costs reasonable.
We'll explore how to set up network policies, firewalls, and encryption to protect our environment but still under our budgets.

## Table of Contents

- [Introduction](#introduction)
- [Setting Up the Configuration](#setting-up-the-configuration)
- [Creating a Common Project](#creating-a-common-project)
  - [Module `azEnv`](#module-azenv)
  - [Module `naming`](#module-naming)
  - [Module `stackEnv`](#module-stackenv)
- [Developing the Hub VNet](#developing-the-hub-vnet)
  - [Main Resources (`index.ts`)](#main-resources-indexts)
  - [Explanation](#explanation)
- [Understanding the Firewall Policy](#understanding-the-firewall-policy)
  - [AKS Policy Group](#aks-policy-group)
  - [DevOps Policy Group](#devops-policy-group)
  - [CloudPC Policy Group](#cloudpc-policy-group)
  - [Combining the Policies](#combining-the-policies)
- [Deploying and Cleaning Up with Pulumi](#deploying-and-cleaning-up-with-pulumi)
  - [Deploying the Stack](#deploying-the-stack)
  - [Destroying the Stack](#destroying-the-stack)
- [Conclusion](#conclusion)
- [References](#references)
- [Next Steps](#next-steps)
- [Thank You](#thank-you)

---

## Setting Up the Configuration

Before we start coding, it's important to define our configuration settings.
This involves specifying resource names and subnet address spaces that we'll use throughout the project.

- **Resource Groups**: We categorize our resources into groups for better organization and management. We define three main resource groups:

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
  //The name of Hub VNet resource group
  hub: "01-hub",
  //The name of AKS VNet resource group
  ask: "02-ask",
  //The name of CloudPC VNet resource group
  cloudPC: "03-cloudPC",
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

## Creating a Common Project

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

## Developing the Hub VNet

Now, let's move on to developing the Hub VNet, which serves as the central network hub in our architecture.

### Main Resources (`index.ts`)

Following the instructions from [Day 01](#), let's create a new project named `az-01-hub-vnet` with the following code:

```typescript
import * as resources from "@pulumi/azure-native/resources";
import * as network from "@pulumi/azure-native/network";
import { getGroupName, getName } from "@az-commons";
import * as config from "../config";
import FirewallPolicy from "./FirewallPolicy";

// Create Hub Resource Group
const rsGroup = new resources.ResourceGroup(getGroupName(config.azGroups.hub));

// Create VNet with Subnets
const vnet = new network.VirtualNetwork(
  getName(config.azGroups.hub, "vnet"),
  {
    resourceGroupName: rsGroup.name, // Resource group name
    addressSpace: {
      addressPrefixes: [
        config.subnetSpaces.firewall, // Address space for firewall subnet
        config.subnetSpaces.general, // Address space for general subnet
        config.subnetSpaces.firewallManage, // Address space for firewall management subnet
      ],
    },
    subnets: [
      {
        // Azure Firewall subnet name must be `AzureFirewallSubnet`
        name: "AzureFirewallSubnet",
        addressPrefix: config.subnetSpaces.firewall, // Address prefix for firewall subnet
      },
      {
        // Azure Firewall Management subnet name must be `AzureFirewallManagementSubnet`
        name: "AzureFirewallManagementSubnet",
        addressPrefix: config.subnetSpaces.firewallManage, // Address prefix for firewall management subnet
      },
      {
        name: "general",
        addressPrefix: config.subnetSpaces.general, // Address prefix for general subnet
        // Allows Azure Resources Private Link
        privateEndpointNetworkPolicies:
          network.VirtualNetworkPrivateEndpointNetworkPolicies.Enabled,
      },
    ],
  },
  { dependsOn: rsGroup } // Ensure the VNet depends on the resource group
);

// Create Public IP Address for outbound traffic
const publicIP = new network.PublicIPAddress(
  getName("outbound", "ip"),
  {
    resourceGroupName: rsGroup.name, // Resource group name
    publicIPAllocationMethod: network.IPAllocationMethod.Static, // Static IP allocation
    sku: {
      name: network.PublicIPAddressSkuName.Standard, // Standard SKU
      tier: network.PublicIPAddressSkuTier.Regional, // Regional tier
    },
  },
  { dependsOn: rsGroup } // Ensure the public IP depends on the resource group
);

// Create Management Public IP Address for Firewall "Basic" tier
const managePublicIP = new network.PublicIPAddress(
  getName("manage", "ip"),
  {
    resourceGroupName: rsGroup.name, // Resource group name
    publicIPAllocationMethod: network.IPAllocationMethod.Static, // Static IP allocation
    sku: {
      name: network.PublicIPAddressSkuName.Standard, // Standard SKU
      tier: network.PublicIPAddressSkuTier.Regional, // Regional tier
    },
  },
  { dependsOn: rsGroup } // Ensure the management public IP depends on the resource group
);

//Firewall Policy
const rules = FirewallPolicy(getName(config.azGroups.hub, "fw-policy"), {
  rsGroup,
  //The Policy tier and Firewall tier must be the same
  tier: network.FirewallPolicySkuTier.Basic,
});

// Create Azure Firewall
const firewall = new network.AzureFirewall(
  getName(config.azGroups.hub, "firewall"),
  {
    resourceGroupName: rsGroup.name, // Resource group name
    firewallPolicy: {
      id: rules.policy.id, // Firewall policy ID
    },
    ipConfigurations: [
      {
        name: publicIP.name, // Name of the IP configuration
        publicIPAddress: { id: publicIP.id }, // Public IP address ID
        subnet: {
          id: vnet.subnets.apply(
            s => s!.find(s => s!.name === "AzureFirewallSubnet")!.id!
          ), // Subnet ID for the firewall
        },
      },
    ],
    managementIpConfiguration: {
      name: managePublicIP.name, // Name of the management IP configuration
      publicIPAddress: { id: managePublicIP.id }, // Management public IP address ID
      subnet: {
        id: vnet.subnets.apply(
          s => s!.find(s => s!.name === "AzureFirewallManagementSubnet")!.id!
        ), // Subnet ID for firewall management
      },
    },
    sku: {
      name: network.AzureFirewallSkuName.AZFW_VNet,
      //The Policy tier and Firewall tier must be the same
      tier: network.AzureFirewallSkuTier.Basic,
    },
  },
  {
    // Ensure the firewall dependents
    dependsOn: [
      publicIP,
      vnet,
      managePublicIP,
      rules.policy,
      rules.policyGroup,
    ],
  }
);

// Export the information that will be used in the other projects
export const rsGroupId = rsGroup.id; // Resource group ID
export const vnetId = vnet.id; // VNet ID
export const IPAddress = { address: publicIP.ipAddress, id: publicIP.id }; // Public IP address and ID
export const firewallId = {
  address: firewall.ipConfigurations.apply(c => c![0]!.privateIPAddress!), // Firewall private IP address
  id: firewall.id, // Firewall ID
};
```

Our goal here is to set up the main components required for the Hub VNet, which include:

1. **Resource Group**:

   - We create a resource group specifically for the Hub VNet.
   - The name incorporates the stack name for easy identification (e.g., `dev-01-hub`).

2. **VNet (VNet) Setup**:

   - We establish a VNet that will host multiple subnets.
   - The VNet uses the address spaces we defined earlier in our configuration.

3. **Subnet Creation**:

   - **AzureFirewallSubnet**: A dedicated subnet for deploying Azure Firewall.
   - **AzureFirewallManagementSubnet**: Used for managing the Azure Firewall.
   - **General Subnet**: A subnet for general-purpose resources, configured to allow private endpoints.

4. **Public IP Addresses**:

   - **Outbound Public IP**: Used for outbound traffic from the firewall to the internet.
   - **Management Public IP**: Used for managing the Azure Firewall.

5. **Firewall Policy**:

   - We define a firewall policy that includes various network and application rules.
   - The policy is created to match the firewall's tier (e.g., Basic or Standard).

6. **Azure Firewall Deployment**:

   - We deploy an Azure Firewall instance within the `AzureFirewallSubnet`.
   - The firewall is configured with the policy and IP configurations we defined.

7. **Exporting Outputs**:
   - We export certain resource identifiers and properties (e.g., resource group ID, VNet ID, firewall ID) for use in other projects or scripts.

> **Note:** Setting the `dependsOn` property correctly ensures that resources are created and destroyed in the right order.

---

## The Firewall Policy

Now, let's delve deeper into the firewall policy, which is crucial for controlling network traffic and securing our environment.

### AKS Policy Group

**Purpose**: To allow the AKS cluster to access essential Azure services required for its operation.

**Key Components**:

- **Network Rules**:
  - Allow outbound traffic from the AKS subnet to Azure services like:
    - Azure Container Registry
    - Microsoft Container Registry
    - Azure Monitor
    - App Configuration
    - Azure Key Vault
  - **Ports**: Typically port 443 (HTTPS) is used.
- **Application Rules**:
  - Allow access to specific fully qualified domain names (FQDNs) required by AKS.
  - Examples include:
    - `*.hcp.<region>.azmk8s.io` (AKS API server endpoints)
    - `mcr.microsoft.com` (Microsoft Container Registry)
    - `login.microsoftonline.com` (Azure EntrID)

```typescript
import { subnetSpaces } from "../../config";
import { currentRegionCode } from "@az-commons";
import * as pulumi from "@pulumi/pulumi";
import * as inputs from "@pulumi/azure-native/types/input";

const netRules: pulumi.Input<inputs.network.NetworkRuleArgs>[] = [
  // Network Rule for AKS
  {
    ruleType: "NetworkRule",
    name: "azure-services-tags",
    description: "Allows internal services to connect to Azure Resources.",
    ipProtocols: ["TCP"],
    sourceAddresses: [subnetSpaces.aks],
    destinationAddresses: [
      "AzureContainerRegistry",
      "MicrosoftContainerRegistry",
      "AzureMonitor",
      "AppConfiguration",
      "AzureKeyVault",
    ],
    destinationPorts: ["443"],
  },
];

const appRules: pulumi.Input<inputs.network.ApplicationRuleArgs>[] = [
  // Application Rule for AKS
  {
    ruleType: "ApplicationRule",
    name: "aks-fqdn",
    description: "Azure Global required FQDN",
    sourceAddresses: [subnetSpaces.aks],
    targetFqdns: [
      // Target FQDNs
      `*.hcp.${currentRegionCode}.azmk8s.io`,
      "mcr.microsoft.com",
      "*.data.mcr.microsoft.com",
      "mcr-0001.mcr-msedge.net",
      "management.azure.com",
      "login.microsoftonline.com",
      "packages.microsoft.com",
      "acs-mirror.azureedge.net",
    ],
    protocols: [{ protocolType: "Https", port: 443 }],
  },
];

export default { appRules, netRules };
```

### DevOps Policy Group

**Purpose**: To allow DevOps resources to interact with Azure DevOps services and deploy to AKS.

```typescript
import { subnetSpaces } from "../../config";
import * as pulumi from "@pulumi/pulumi";
import * as inputs from "@pulumi/azure-native/types/input";

const netRules: pulumi.Input<inputs.network.NetworkRuleArgs>[] = [
  {
    ruleType: "NetworkRule",
    name: "devops-to-aks",
    description: "Allows devops to access aks for deployment purposes.",
    ipProtocols: ["TCP"],
    sourceAddresses: [subnetSpaces.devOps],
    destinationAddresses: ["*"],
    destinationPorts: ["443"],
  },
];

const appRules: pulumi.Input<inputs.network.ApplicationRuleArgs>[] = [];

export default { appRules, netRules };
```

### CloudPC Policy Group

**Purpose**: To enable virtual desktops or cloud PCs to access internal resources for administrative or support purposes.

```typescript
import { subnetSpaces } from "../../config";
import { currentRegionCode } from "@az-commons";
import * as pulumi from "@pulumi/pulumi";
import * as inputs from "@pulumi/azure-native/types/input";

const netRules: pulumi.Input<inputs.network.NetworkRuleArgs>[] = [
  {
    ruleType: "NetworkRule",
    name: "cloudpc-to-aks",
    description: "Allows CloudPC access to AKS and DevOps.",
    ipProtocols: ["TCP"],
    sourceAddresses: [subnetSpaces.cloudPC],
    destinationAddresses: [subnetSpaces.devOps, subnetSpaces.aks],
    destinationPorts: ["443"],
  },
  {
    ruleType: "NetworkRule",
    name: "cloudpc-services-tags",
    description: "Allows CloudPC access to Azure Resources.",
    ipProtocols: ["TCP"],
    sourceAddresses: [subnetSpaces.aks],
    destinationAddresses: [`AzureCloud.${currentRegionCode}`],
    destinationPorts: ["443"],
  },
];

const appRules: pulumi.Input<inputs.network.ApplicationRuleArgs>[] = [];

export default { appRules, netRules };
```

### Combining the Policies

After defining the individual policy groups, we combine them into a single firewall policy and associate it with the Azure Firewall.

1. **Create a Firewall Policy**:

   - This acts as a container for all the rules.
   - Must have the same tier as the Azure Firewall.

2. **Aggregate Rules**:

   - Collect all network and application rules from the AKS, DevOps, and CloudPC policy groups.
   - Ensure there are no conflicting rules.

3. **Create Rule Collection Groups**:

   - Organize rules into collections based on priority and action (e.g., allow or deny).
   - Assign priorities to determine the order in which rules are evaluated.

4. **Associate with Azure Firewall**:
   - Link the firewall policy to the Azure Firewall instance.
   - This ensures that all traffic passing through the firewall is subject to the defined rules.

```typescript
import * as network from "@pulumi/azure-native/network";
import * as resources from "@pulumi/azure-native/resources";
import aksPolicyGroup from "./aksPolicyGroup";
import devopsPolicyGroup from "./devopsPolicyGroup";
import cloudpcPolicyGroup from "./cloudpcPolicyGroup";
import * as pulumi from "@pulumi/pulumi";
import * as inputs from "@pulumi/azure-native/types/input";

//Create Firewall Policy Group for appRules and netRules
const createPolicyGroup = ({
  name,
  appRules,
  netRules,
  rsGroup,
  policy,
}: {
  name: string;
  policy: network.FirewallPolicy;
  rsGroup: resources.ResourceGroup;
  netRules: pulumi.Input<inputs.network.NetworkRuleArgs>[];
  appRules: pulumi.Input<inputs.network.ApplicationRuleArgs>[];
}) => {
  const ruleCollections: pulumi.Input<inputs.network.FirewallPolicyFilterRuleCollectionArgs>[] =
    [];
  if (netRules.length > 0) {
    ruleCollections.push({
      name: "net-rules-collection",
      priority: 300,
      ruleCollectionType: "FirewallPolicyFilterRuleCollection",
      action: {
        type: network.FirewallPolicyFilterRuleCollectionActionType.Allow,
      },
      rules: netRules,
    });
  }
  if (appRules.length > 0) {
    ruleCollections.push({
      name: "app-rules-collection",
      priority: 301,
      ruleCollectionType: "FirewallPolicyFilterRuleCollection",
      action: {
        type: network.FirewallPolicyFilterRuleCollectionActionType.Allow,
      },
      rules: appRules,
    });
  }

  return new network.FirewallPolicyRuleCollectionGroup(
    `${name}-group`,
    {
      resourceGroupName: rsGroup.name, // Resource group name
      firewallPolicyName: policy.name, // Name of the firewall policy
      priority: 300, // Priority of the rule collection group
      ruleCollections,
    },
    // Ensure the rule collection group depends on the policy
    { dependsOn: [policy, rsGroup] }
  );
};

// Export a function that creates a Firewall Policy
export default (
  name: string,
  {
    rsGroup,
    //This tier should be similar to Firewall tier
    tier,
  }: {
    rsGroup: resources.ResourceGroup;
    tier: network.FirewallPolicySkuTier;
  }
) => {
  // Create a Firewall Policy
  const policy = new network.FirewallPolicy(
    name,
    {
      resourceGroupName: rsGroup.name,
      sku: { tier },
      snat: { autoLearnPrivateRanges: "Enabled" },
    },
    { dependsOn: rsGroup } // Ensure the policy depends on the resource group
  );

  const netRules: pulumi.Input<inputs.network.NetworkRuleArgs>[] = [];
  const appRules: pulumi.Input<inputs.network.ApplicationRuleArgs>[] = [];

  // Policy Groups
  netRules.push(...aksPolicyGroup.netRules);
  appRules.push(...aksPolicyGroup.appRules);
  netRules.push(...devopsPolicyGroup.netRules);
  appRules.push(...devopsPolicyGroup.appRules);
  netRules.push(...cloudpcPolicyGroup.netRules);
  appRules.push(...cloudpcPolicyGroup.appRules);

  //Create Policy Group for the rules above
  const policyGroup = createPolicyGroup({
    name,
    appRules,
    netRules,
    rsGroup,
    policy,
  });

  return { policy, policyGroup };
};
```

> For more details, you can refer to the [source code here](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-01-hub-vnet/README.md).

---

## Pulumi Deploying

Now that we've set up our configuration and resources, let's look at how to deploy them to Azure using Pulumi and how to clean up afterward.

### Deploying the Stack

1. **Initialize the Pulumi Project**:

   - Ensure you have a Pulumi project set up with the appropriate stack (e.g., `dev`).

2. **Run the Deployment Command**:

   - Use the command `pulumi up` or `pnpm run up` if using a package manager script.
   - The `--yes` flag can be used to skip the confirmation prompt.

3. **Monitor the Deployment**:

   - Pulumi will display the resources being created.
   - Any errors will be shown in the output.

4. **Verify the Deployment**:
   - After successful deployment, verify the resources in the Azure Portal.
   - Check the resource group, VNet, subnets, public IPs, firewall policy, and Azure Firewall.

```bash
pnpm run up

# Sample Output
> az-01-hub-vnet@ up /Volumes/VMs_2T/_GIT/drunk-azure-pulumi-articles/az-01-hub-vnet
> pulumi up --yes --skip-preview

Updating (dev)

View in Browser (Ctrl+O): https://app.pulumi.com/drunkcoding/az-01-hub-vnet/dev/updates/27

     Type                                                       Name                     Status             Info
 +   pulumi:pulumi:Stack                                        az-01-hub-vnet-dev       created (528s)     6 messages
 +   ├─ azure-native:resources:ResourceGroup                    dev-01-hub               created (1s)
 +   ├─ azure-native:network:VirtualNetwork                     dev-hub-vnet             created (4s)
 +   ├─ azure-native:network:PublicIPAddress                    dev-outbound-ip          created (3s)
 +   ├─ azure-native:network:FirewallPolicy                     dev-hub-fw-policy        created (13s)
 +   ├─ azure-native:network:PublicIPAddress                    dev-manage-ip            created (4s)
 +   ├─ azure-native:network:FirewallPolicyRuleCollectionGroup  dev-hub-fw-policy-group  created (12s)
 +   └─ azure-native:network:AzureFirewall                      dev-hub-firewall         created (485s)

Diagnostics:
  pulumi:pulumi:Stack (az-01-hub-vnet-dev):
    Pulumi Environments: {
      organization: 'drunkcoding',
      projectName: 'az-01-hub-vnet',
      stack: 'dev',
      isDryRun: false
    }

Outputs:
    IPAddress : {
        address: "40.65.180.206"
        id     : "/subscriptions/54dbd16b-81cd-4444-b4fd-02c2dcd59d3d/resourceGroups/dev-01-hubd13622bb/providers/Microsoft.Network/publicIPAddresses/dev-outbound-ip63a8a800"
    }
    firewallId: {
        address: "192.168.30.4"
        id     : "/subscriptions/54dbd16b-81cd-4444-b4fd-02c2dcd59d3d/resourceGroups/dev-01-hubd13622bb/providers/Microsoft.Network/azureFirewalls/dev-hub-firewall021b5cdb"
    }
    rsGroupId : "/subscriptions/54dbd16b-81cd-4444-b4fd-02c2dcd59d3d/resourceGroups/dev-01-hubd13622bb"
    vnetId    : "/subscriptions/54dbd16b-81cd-4444-b4fd-02c2dcd59d3d/resourceGroups/dev-01-hubd13622bb/providers/Microsoft.Network/virtualNetworks/dev-hub-vnet81c8398a"

Resources:
    + 8 created

Duration: 8m50s

```

Here's how the Azure resources look in the portal after a successful deployment:

![Azure Resources](/assets/az-03-pulumi-private-aks-hub-vnet-development/az-hub-vnet-resources.png)

### Destroying the Stack

**Steps**:

1. **Run the Destroy Command**:

   - Use the command `pulumi destroy` or `pnpm run destroy` if using a package manager script.
   - The `--yes` flag can be used to skip the confirmation prompt.

2. **Monitor the Destruction**:

   - Pulumi will display the resources being deleted.
   - Dependencies are handled automatically to ensure resources are deleted in the correct order.

3. **Verify the Cleanup**:
   - After the command completes, verify in the Azure Portal that the resources have been removed.

```bash
pnpm run destroy

# Sample Output
> az-01-hub-vnet@ destroy /Volumes/VMs_2T/_GIT/drunk-azure-pulumi-articles/az-01-hub-vnet
> pulumi destroy --yes --skip-preview

Destroying (dev)

View in Browser (Ctrl+O): https://app.pulumi.com/drunkcoding/az-01-hub-vnet/dev/updates/28

     Type                                                       Name                     Status
 -   pulumi:pulumi:Stack                                        az-01-hub-vnet-dev       deleted (0.87s)
 -   ├─ azure-native:network:AzureFirewall                      dev-hub-firewall         deleted (385s)
 -   ├─ azure-native:network:FirewallPolicyRuleCollectionGroup  dev-hub-fw-policy-group  deleted (12s)
 -   ├─ azure-native:network:PublicIPAddress                    dev-manage-ip            deleted (11s)
 -   ├─ azure-native:network:FirewallPolicy                     dev-hub-fw-policy        deleted (3s)
 -   ├─ azure-native:network:PublicIPAddress                    dev-outbound-ip          deleted (12s)
 -   ├─ azure-native:network:VirtualNetwork                     dev-hub-vnet             deleted (12s)
 -   └─ azure-native:resources:ResourceGroup                    dev-01-hub               deleted (16s)

Outputs:
  - IPAddress : {
      - address: "40.65.180.206"
      - id     : "/subscriptions/54dbd16b-81cd-4444-b4fd-02c2dcd59d3d/resourceGroups/dev-01-hubd13622bb/providers/Microsoft.Network/publicIPAddresses/dev-outbound-ip63a8a800"
    }
  - firewallId: {
      - address: "192.168.30.4"
      - id     : "/subscriptions/54dbd16b-81cd-4444-b4fd-02c2dcd59d3d/resourceGroups/dev-01-hubd13622bb/providers/Microsoft.Network/azureFirewalls/dev-hub-firewall021b5cdb"
    }
  - rsGroupId : "/subscriptions/54dbd16b-81cd-4444-b4fd-02c2dcd59d3d/resourceGroups/dev-01-hubd13622bb"
  - vnetId    : "/subscriptions/54dbd16b-81cd-4444-b4fd-02c2dcd59d3d/resourceGroups/dev-01-hubd13622bb/providers/Microsoft.Network/virtualNetworks/dev-hub-vnet81c8398a"

Resources:
    - 8 deleted

Duration: 7m12s
```

---

## Conclusion

Congratulations! You've successfully built and understood a Hub VNet for a private AKS environment on Azure using Pulumi. We covered:

- Setting up configurations for resource groups and subnet address spaces.
- Creating a common project for shared utilities.
- Developing the main resources, including the VNet, subnets, public IPs, firewall policy, and Azure Firewall.
- Understanding and combining firewall policies to control network traffic effectively.
- Deploying and destroying resources using Pulumi commands.

This foundational knowledge sets you up to tackle more complex infrastructure projects on Azure and automate deployments using infrastructure as code principles.

---

## References

- [az-commons Source Code](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-commons/README.md)
- [az-01-hub-vnet Source Code](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-01-hub-vnet/README.md)
- [Outbound Network and FQDN Rules for AKS Clusters](https://learn.microsoft.com/en-us/azure/aks/outbound-rules-control-egress)
- [Azure DevOps IPs and FQDNs](https://learn.microsoft.com/en-us/azure/devops/organizations/security/allow-list-ip-url)
- [Pulumi for Azure](https://www.pulumi.com/docs/intro/cloud-providers/azure/)

---

## Next Steps

- **Day 04: Setting Up the AKS VNet**
  - In the next installment, we'll focus on setting up the VNet for the AKS cluster, integrating it with the Hub VNet, and configuring network peering.

---

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven**
[GitHub](<[https://github.com/baoduy](https://github.com/baoduy)>)
