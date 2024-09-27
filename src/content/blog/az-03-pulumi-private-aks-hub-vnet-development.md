---
author: Steven Hoang
pubDatetime: 2025-01-01T12:00:00Z
title: "[Az] Day 03: Develop a Virtual Network Hub for Private AKS on Azure."
featured: false
draft: false
tags:
  - AKS
  - Private
  - Pulumi
description: "In this post, We will dive into pulumi development to build up the Hub VNet for our private AKS environment."
---

## Introduction

"One line of code is always better than a thousand words", Let's start our coding to build up the Hub VNet for our AKS Env today. In this post will show step-by-step to bring up our environment on Azure.

## Table of Contents

---

## Hub VNet Development

### Configuration

Before start coding, I will create a `config.ts` file at the root project folder for the Resource naming and subnet address spaces configuration as below.

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

> I added the number as prefix of the Azure resource group to sort them in sequence that easier for lookup and navigation.

---

## Common Project

Next, I created a `az-commons` typescript project where We will develop some common utilities that will be shared to all pulumi projects later.

#### Module `azEnv`

This module provides functions to retrieve Azure environment configurations.

- **tenantId**: The tenant ID from the Azure client configuration.
- **subscriptionId**: The subscription ID from the Azure client configuration.
- **currentPrincipal**: The object ID of the current principal (user or service principal).
- **currentRegionCode**: The current Azure region code, defaulting to "SoutheastAsia" if not set.

#### Module `naming`

This module provides functions to generate resource names with a stack name as a prefix.

- **getGroupName(name: string)**: Retrieves the resource group name with the stack name as a prefix.
- **getName(name: string, suffix?: string)**: Retrieves the resource name with the stack name as a prefix and optionally appends a suffix.

#### Module `stackEnv`

This module provides functions to retrieve Pulumi stack environment configurations.

- **isDryRun**: Indicates if the current run is a dry run.
- **organization**: The Pulumi organization.
- **projectName**: The Pulumi project name.
- **stack**: The Pulumi stack name.

> Please refer [here for details](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-commons/README.md) source code of the project.

## The Hub VNet Development

### The main resource `index.ts`

Follow the instruction from [Day-01](/posts/az-01-pulumi-setup-developer-account), Let's create a new project named `az-01-hub-vnet` with the following code.

```typescript
import * as resources from "@pulumi/azure-native/resources";
import * as network from "@pulumi/azure-native/network";
import { getGroupName, getName } from "@az-commons";
import * as config from "../config";
import FirewallPolicy from "./FirewallPolicy";

// Create Hub Resource Group
const rsGroup = new resources.ResourceGroup(getGroupName(config.azGroups.hub));

// Create Virtual Network with Subnets
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
  { dependsOn: rsGroup } // Ensure the virtual network depends on the resource group
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

// Create Azure Firewall
const firewall = new network.AzureFirewall(
  getName(config.azGroups.hub, "firewall"),
  {
    resourceGroupName: rsGroup.name, // Resource group name
    firewallPolicy: {
      id: FirewallPolicy(getName(config.azGroups.hub, "fw-policy"), {
        rsGroup,
      }).id, // Firewall policy ID
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
      name: network.AzureFirewallSkuName.AZFW_VNet, // Firewall SKU name
      tier: network.AzureFirewallSkuTier.Basic, // Firewall SKU tier
    },
  },
  { dependsOn: [publicIP, vnet, managePublicIP] } // Ensure the firewall depends on the public IPs and virtual network
);

// Export the information that will be used in the other projects
export const rsGroupId = rsGroup.id; // Resource group ID
export const vnetId = vnet.id; // Virtual network ID
export const IPAddress = { address: publicIP.ipAddress, id: publicIP.id }; // Public IP address and ID
export const firewallId = {
  address: firewall.ipConfigurations.apply(c => c![0]!.privateIPAddress!), // Firewall private IP address
  id: firewall.id, // Firewall ID
};
```

**Explanation**

1. **Create Resource Group**:

   - It creates a new resource group using the Pulumi `ResourceGroup` class with a name is `01-hub` with a prefix is the current pulumi stack name. In this case the name will be `dev-01-hub`.

2. **Create Virtual Network with Subnets**:

   - A virtual network (VNet) is created with three subnets:
     - **AzureFirewallSubnet**: A dedicated subnet for Azure Firewall.
     - **AzureFirewallManagementSubnet**: A subnet for managing the firewall.
     - **General**: A general-purpose subnet, with policies for private endpoints.

3. **Create Public IP Addresses**:

   - Two public IP addresses are created for `outbound traffic` and `firewall management`. These are used for the Azure Firewall.

4. **Create Azure Firewall**:

   - An Azure Firewall instance with `Basic` tier is created and associated with the virtual network. The firewall has two configurations:
     - **IP Configuration**: Uses the public IP created earlier and is attached to the `AzureFirewallSubnet`.
     - **Management IP Configuration**: Uses the management public IP and is attached to the `AzureFirewallManagementSubnet`.

5. **Export Outputs**:

   - It exports the resource group ID, virtual network ID, public IP address, and firewall information (private IP and ID) to be used in other pulumi projects later.

### The `FirewallPolicy` file

> Please refer [here for details](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-01-hub-vnet/README.md) source code of the project.

## Conclusion

---

## References

- **[az-commons](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-commons/README.md)**
- **[az-01-hub-vnet](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-01-hub-vnet/README.md)**

---

## Next Steps

- **[Day 03: Develop a Virtual Network Hub for Private AKS on Azure](/posts/az-03-pulumi-private-aks-hub-vnet-development)**

---

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven**
[GitHub](<[https://github.com/baoduy](https://github.com/baoduy)>)
