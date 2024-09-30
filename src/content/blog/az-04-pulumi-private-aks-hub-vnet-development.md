---
author: Steven Hoang
pubDatetime: 2025-01-01T12:00:00Z
title: "[Az] Day 04: Develop a VNet Hub for Private AKS on Azure."
featured: false
draft: false
tags:
  - AKS
  - Private
  - Pulumi
description: "In this article, We'll walk through the process of developing the first Hub VNet for a private AKS environment using Pulumi."
---

## Introduction

In this tutorial, we'll walk through the process of developing the first Hub VNet for a private AKS environment using Pulumi.
This guide is designed to be accessible even if you're new to Azure or Pulumi, so we'll explain each step in detail.

Security is our top priority. As we create our resources, we'll focus on optimizing security while keeping Azure costs reasonable.
We'll explore how to set up network policies, firewalls, and encryption to protect our environment without exceeding our budget.

---

## Table of Contents

- [Introduction](#introduction)
- [Conclusion](#conclusion)
- [References](#references)
- [Next Steps](#next-steps)
- [Thank You](#thank-you)

---

## Setting Up the Hub VNet

Our goal is to set up the main components required for the Hub VNet, which include:

1. **Resource Group**: A container for managing related Azure resources.
2. **Virtual Network (VNet)**: The main network that hosts our subnets.
3. **Subnets**: Segments within the VNet to isolate and organize resources.
4. **Public IP Addresses**: For outbound internet connectivity and firewall management.
5. **Firewall Policy**: Defines rules to control network traffic.
6. **Azure Firewall**: A managed firewall service to protect our network.

Let's dive into each component and see how we can implement them using Pulumi.

### Creating the VNet Module

The `VNet` module helps us create a Virtual Network with customized parameters.

**Key Features:**

- **Virtual Network Creation**: Sets up a VNet with specified address spaces.
- **Subnets**: Allows the creation of multiple subnets within the VNet.
- **Security Enhancements**:
  - **VM Protection**: `enableVmProtection` set to `true` to protect virtual machines from undesired access.
  - **Encryption**: Enables encryption for traffic within the VNet.

```typescript
import * as resources from "@pulumi/azure-native/resources";
import * as network from "@pulumi/azure-native/network";
import * as inputs from "@pulumi/azure-native/types/input";
import { getName } from "@az-commons";

export default (
  name: string,
  {
    rsGroup,
    subnets,
  }: {
    rsGroup: resources.ResourceGroup;
    subnets: inputs.network.SubnetArgs[];
  }
) =>
  new network.VirtualNetwork(
    getName(name, "vnet"),
    {
      resourceGroupName: rsGroup.name,
      //Enable VN protection
      enableVmProtection: true,
      //Enable Vnet encryption
      encryption: {
        enabled: true,
        enforcement:
          network.VirtualNetworkEncryptionEnforcement.AllowUnencrypted,
      },
      addressSpace: {
        addressPrefixes: subnets.map(s => s.addressPrefix!),
      },
      subnets,
    },
    // Ensure the virtual network depends on the resource group
    { dependsOn: rsGroup }
  );
```

### Creating the Firewall Module

The `Firewall` module creates an Azure Firewall along with the necessary components like IP addresses and diagnostic settings.

**Key Features:**

- **Public IP Addresses**:
  - **Outbound IP**: For outbound internet traffic.
  - **Management IP**: Specifically for managing the firewall.
- **Azure Firewall Deployment**:
  - Configured with the firewall policy and associated with the VNet.
  - Specifies SKU (stock-keeping unit) tiers for performance and features.
- **Diagnostic Settings**:
  - Integrates with Log Analytics for monitoring and logging.

```typescript
import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure-native";
import { getName } from "@az-commons";

export default (
  name: string,
  {
    vnet,
    rsGroup,
    policy,
    policyGroup,
    //The Policy tier and Firewall tier must be the same
    tier = azure.network.AzureFirewallSkuTier.Basic,
    logWorkspaceId,
  }: {
    vnet: azure.network.VirtualNetwork;
    rsGroup: azure.resources.ResourceGroup;
    policy: azure.network.FirewallPolicy;
    policyGroup: azure.network.FirewallPolicyRuleCollectionGroup;
    tier?: azure.network.AzureFirewallSkuTier;
    logWorkspaceId?: pulumi.Output<string>;
  }
) => {
  const firewallSubnetId = vnet.subnets!.apply(
    s => s!.find(s => s!.name === "AzureFirewallSubnet")!.id!
  );
  const firewallManageSubnetId = vnet.subnets!.apply(
    s => s!.find(s => s!.name === "AzureFirewallManagementSubnet")!.id!
  );
  // Create Public IP Address for outbound traffic
  const publicIP = new azure.network.PublicIPAddress(
    getName(`${name}-outbound`, "ip"),
    {
      resourceGroupName: rsGroup.name, // Resource group name
      publicIPAllocationMethod: azure.network.IPAllocationMethod.Static, // Static IP allocation
      sku: {
        name: azure.network.PublicIPAddressSkuName.Standard, // Standard SKU
        tier: azure.network.PublicIPAddressSkuTier.Regional, // Regional tier
      },
    },
    { dependsOn: rsGroup } // Ensure the public IP depends on the resource group
  );

  // Create Management Public IP Address for Firewall "Basic" tier
  const managePublicIP = new azure.network.PublicIPAddress(
    getName(`${name}-manage`, "ip"),
    {
      resourceGroupName: rsGroup.name, // Resource group name
      publicIPAllocationMethod: azure.network.IPAllocationMethod.Static, // Static IP allocation
      sku: {
        name: azure.network.PublicIPAddressSkuName.Standard, // Standard SKU
        tier: azure.network.PublicIPAddressSkuTier.Regional, // Regional tier
      },
    },
    { dependsOn: rsGroup } // Ensure the management public IP depends on the resource group
  );

  // Create Azure Firewall
  const firewallName = getName(name, "firewall");
  const firewall = new azure.network.AzureFirewall(
    firewallName,
    {
      resourceGroupName: rsGroup.name,
      firewallPolicy: { id: policy.id },
      ipConfigurations: [
        {
          name: publicIP.name,
          publicIPAddress: { id: publicIP.id },
          subnet: { id: firewallSubnetId },
        },
      ],
      managementIpConfiguration: {
        name: managePublicIP.name,
        publicIPAddress: { id: managePublicIP.id },
        subnet: { id: firewallManageSubnetId },
      },
      sku: {
        name: azure.network.AzureFirewallSkuName.AZFW_VNet,
        tier,
      },
    },
    {
      // Ensure the firewall dependents
      dependsOn: [publicIP, vnet, managePublicIP, policy, policyGroup],
    }
  );

  //create Diagnostic
  if (logWorkspaceId) {
    new azure.insights.DiagnosticSetting(
      firewallName,
      {
        resourceUri: firewall.id,
        logAnalyticsDestinationType: "AzureDiagnostics",
        workspaceId: logWorkspaceId,
        //Logs
        logs: [
          "AzureFirewallApplicationRule",
          "AzureFirewallNetworkRule",
          "AzureFirewallDnsProxy",
        ].map(c => ({
          category: c,
          retentionPolicy: { enabled: false, days: 7 },
          enabled: true,
        })),
      },
      { dependsOn: firewall }
    );
  }

  return { firewall, publicIP };
};
```

### Main Project Code (`index.ts`)

Now, let's bring everything together in our main project file.

**Steps:**

1. **Import Modules and Configurations**: Import necessary modules and retrieve configurations.
2. **Reference Shared Resources**: Use `StackReference` to access outputs from the `az-01-shared` project, such as the Log Analytics workspace ID.
3. **Create Resource Group**: Initialize a resource group for the Hub VNet resources.
4. **Set Up the VNet and Subnets**:
   - Create the VNet using the `VNet` module.
   - Define subnets for the firewall, firewall management, and general purposes.
5. **Configure the Firewall Policy**:
   - Use the `FirewallPolicy` module to define network and application rules.
6. **Deploy the Azure Firewall**:
   - Utilize the `Firewall` module to create the Azure Firewall instance.
   - Attach the firewall policy and configure IP addresses.
7. **Export Outputs**: Make resource IDs and properties available for other projects or scripts.

```typescript
import * as resources from "@pulumi/azure-native/resources";
import * as pulumi from "@pulumi/pulumi";
import * as network from "@pulumi/azure-native/network";
import { getGroupName, StackReference } from "@az-commons";
import * as config from "../config";
import VNet from "./VNet";
import Firewall from "./Firewall";
import FirewallPolicy from "./FirewallPolicy";

//Reference to the output of `az-01-shared` and link workspace to firewall for log monitoring.
const sharedStack = StackReference("az-01-shared") as pulumi.Output<{
  logWorkspace: { id: string };
}>;

// Create Hub Resource Group
const rsGroup = new resources.ResourceGroup(getGroupName(config.azGroups.hub));

// Create Virtual Network with Subnets
const vnet = VNet(config.azGroups.hub, {
  rsGroup,
  subnets: [
    {
      // Azure Firewall subnet name must be `AzureFirewallSubnet`
      name: "AzureFirewallSubnet",
      addressPrefix: config.subnetSpaces.firewall,
    },
    {
      // Azure Firewall Management subnet name must be `AzureFirewallManagementSubnet`
      name: "AzureFirewallManagementSubnet",
      addressPrefix: config.subnetSpaces.firewallManage,
    },
    {
      name: "general",
      addressPrefix: config.subnetSpaces.general,
      // Allows Azure Resources Private Link
      privateEndpointNetworkPolicies:
        network.VirtualNetworkPrivateEndpointNetworkPolicies.Enabled,
    },
  ],
});

//Firewall Policy
const rules = FirewallPolicy(config.azGroups.hub, {
  rsGroup,
  //The Policy tier and Firewall tier must be the same
  tier: network.FirewallPolicySkuTier.Basic,
});

const { publicIP, firewall } = Firewall(config.azGroups.hub, {
  ...rules,
  rsGroup,
  vnet,
  //The Policy tier and Firewall tier must be the same
  tier: network.AzureFirewallSkuTier.Basic,
  //Link Firewall diagnostic to the log workspace resource that was created in project `az-01-shared`.
  logWorkspaceId: sharedStack.logWorkspace.id,
});

// Export the information that will be used in the other projects
export const rsGroupId = rsGroup.id;
export const hubVnetId = vnet.id;
export const ipAddress = { address: publicIP.ipAddress, id: publicIP.id };
export const firewallId = {
  address: firewall.ipConfigurations.apply(c => c![0]!.privateIPAddress!),
  id: firewall.id,
};
```

> **Note:**
>
> - Properly setting the `dependsOn` property ensures that resources are created and destroyed in the correct sequence.
> - The code above demonstrates how to reuse the log workspace from the `az-01-shared` project for Firewall diagnostics, enabling effective tracing and monitoring of firewall rules.

---

## Understanding the Firewall Policy

The firewall policy is crucial for controlling network traffic and securing our environment. It defines the rules that the Azure Firewall uses to allow or deny traffic.

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

**Purpose**: Enables DevOps resources to interact with Azure DevOps services and deploy to AKS.

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

Allows virtual desktops or cloud PCs to access internal resources for administrative or support purposes.

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

### Consolidating Policies

After defining individual policy groups, we combine them into a single firewall policy and associate it with the Azure Firewall.

**Steps**:

1. **Create a Firewall Policy**: Acts as a container for all rules.
2. **Aggregate Rules**: Collect network and application rules from all policy groups.
3. **Create Rule Collection Groups**: Organize rules based on priority and action.
4. **Associate with Azure Firewall**: Link the policy to the firewall instance to enforce the rules.

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

> For more details, you can refer to the [source code here](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-02-hub-vnet/README.md).

---

## Pulumi Deploying

Now that we've set up our configuration and resources, let's deploy them to Azure using Pulumi.

### Deploying the Stack

```bash
pnpm run up

# Sample Output
> az-02-hub-vnet@ up /Volumes/VMs_2T/_GIT/drunk-azure-pulumi-articles/az-02-hub-vnet
> pulumi up --yes --skip-preview

Updating (dev)

View in Browser (Ctrl+O): https://app.pulumi.com/drunkcoding/az-02-hub-vnet/dev/updates/27

     Type                                                       Name                     Status             Info
 +   pulumi:pulumi:Stack                                        az-02-hub-vnet-dev       created (528s)     6 messages
 +   ├─ azure-native:resources:ResourceGroup                    dev-01-hub               created (1s)
 +   ├─ azure-native:network:VirtualNetwork                     dev-hub-vnet             created (4s)
 +   ├─ azure-native:network:PublicIPAddress                    dev-outbound-ip          created (3s)
 +   ├─ azure-native:network:FirewallPolicy                     dev-hub-fw-policy        created (13s)
 +   ├─ azure-native:network:PublicIPAddress                    dev-manage-ip            created (4s)
 +   ├─ azure-native:network:FirewallPolicyRuleCollectionGroup  dev-hub-fw-policy-group  created (12s)
 +   └─ azure-native:network:AzureFirewall                      dev-hub-firewall         created (485s)

Diagnostics:
  pulumi:pulumi:Stack (az-02-hub-vnet-dev):
    Pulumi Environments: {
      organization: 'drunkcoding',
      projectName: 'az-02-hub-vnet',
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

### Verifying Azure Resources

After deployment, you can verify the resources in the Azure Portal.

- **Resource Group**: Should contain all the resources we created.
- **Virtual Network**: Check that the VNet and subnets are correctly configured.
- **Azure Firewall**: Ensure the firewall is deployed and associated with the VNet.
- **Public IP Addresses**: Verify that the IPs are allocated and attached to the firewall.

![Azure Resources](/assets/az-04-pulumi-private-aks-hub-vnet-development/az-hub-vnet-resources.png)

### Destroying the Stack

To clean up and remove all the resources, run:

```bash
pnpm run destroy

# Sample Output
> az-02-hub-vnet@ destroy /Volumes/VMs_2T/_GIT/drunk-azure-pulumi-articles/az-02-hub-vnet
> pulumi destroy --yes --skip-preview

Destroying (dev)

View in Browser (Ctrl+O): https://app.pulumi.com/drunkcoding/az-02-hub-vnet/dev/updates/28

     Type                                                       Name                     Status
 -   pulumi:pulumi:Stack                                        az-02-hub-vnet-dev       deleted (0.87s)
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

Congratulations! You've successfully built a Hub VNet for a private AKS environment on Azure using Pulumi. Throughout this tutorial, we've:

- **Set Up Configurations**: Defined resource groups and subnet address spaces.
- **Created Reusable Modules**: Developed `VNet` and `Firewall` modules for resource creation.
- **Defined Firewall Policies**: Established network and application rules to secure our environment.
- **Deployed Resources**: Used Pulumi to deploy and manage Azure resources.
- **Cleaned Up Resources**: Learned how to destroy resources when they're no longer needed.

This foundational knowledge equips you to handle more complex infrastructure projects on Azure and automate deployments using Infrastructure as Code (IaC) principles.

---

## References

- [az-commons Source Code](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-commons/README.md)
- [az-02-hub-vnet Source Code](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/az-02-hub-vnet/README.md)
- [Outbound Network and FQDN Rules for AKS Clusters](https://learn.microsoft.com/en-us/azure/aks/outbound-rules-control-egress)
- [Azure DevOps IPs and FQDNs](https://learn.microsoft.com/en-us/azure/devops/organizations/security/allow-list-ip-url)
- [Pulumi for Azure](https://www.pulumi.com/docs/intro/cloud-providers/azure/)

---

## Next Steps

**[Day 05: Implementing Private AKS Clusters with Advanced Networking](/posts/az-05-pulumi-private-aks-cluster-env)**

In the next tutorial, we'll build a private AKS cluster with advanced networking features.
We'll explore how to integrate the AKS cluster with the Hub VNet and apply the firewall policies we've created.

---

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven**
[GitHub](https://github.com/baoduy)
