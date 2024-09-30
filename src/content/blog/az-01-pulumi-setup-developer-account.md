---
author: Steven Hoang
pubDatetime: 2025-01-01T12:00:00Z
title: "[Az] Day 01: Setup pulumi developer account"
featured: false
draft: false
tags:
  - aks
  - private
  - pulumi
description: "A guide on how to set up a Pulumi developer account and deploy Azure resources using Infrastructure as Code (IaC) via Pulumi. 
It walks users through the setup process from account creation to deploying Azure Resources using Pulumi and TypeScript."
---

# Introduction

Pulumi is an open-source Infrastructure as Code (IaC) tool that enables developers to define cloud resources using familiar programming languages like TypeScript, Python, Go, and C#.
By leveraging the full power of these tool you can efficiently manage your infrastructure on Cloud (Azure, AWS, Google, ...).

In this guide, we'll walk you through:

- Registering for a Pulumi account
- Generating a Personal Access Token (PAT)
- Setting up the Pulumi and Azure CLI tools
- Creating your first Pulumi project using the TypeScript template for Azure
- Deploying your first Azure Resource Group and Storage Account

---

## Table of Contents

- [Introduction](#introduction)
- [Conclusion](#conclusion)
- [References](#references)
- [Next Steps](#next-steps)
- [Thank You](#thank-you)

---

## Prerequisites

- **Node.js** installed on your machine
- An **Azure account** (you can [create a free account here](https://azure.microsoft.com/free/))

---

## 1: Pulumi Setup

### 1.1. Create a Pulumi Account

1. **Visit the Pulumi Website**

   Navigate to the [Pulumi website](https://www.pulumi.com/) and click on the **"Sign Up"** button.

2. **Choose a Sign-Up Method**

   Sign up using one of the following methods:

   - **GitHub**
   - **GitLab**
   - **Bitbucket**
   - **Email**

   Follow the on-screen instructions to complete the registration.

3. **Confirm Your Email**

   If you signed up using an email address, check your inbox for a confirmation email and verify your account.

### 1.2. Generate a Personal Access Token (PAT)

A Personal Access Token (PAT) is required to authenticate the Pulumi CLI with your Pulumi account.

1. **Log In to the Pulumi Dashboard**

   Visit the [Pulumi Dashboard](https://app.pulumi.com/) and log in with your credentials.

2. **Access the Tokens Page**

   - Click on your avatar or username in the top-right corner.
   - Select **"Access Tokens"** from the dropdown menu.

3. **Create a New Token**

   - Click on **"Create Token"**.
   - Provide a description (e.g., "Pulumi CLI Token").
   - Click **"Create"** and copy the generated token for later use.

### 1.3. (Optional) Create a New Organization

If you'd like to manage your projects under a separate organization:

1. **Navigate to Organizations**

   - In the Pulumi Console, click on your avatar or username.
   - Select **"Organizations"**.

2. **Create a New Organization**

   - Click on **"Create Organization"**.
   - Follow the prompts to set up your organization.

![Pulumi Account](/assets/az-01-pulumi-setup-developer-account/pulumi-account.png)

---

## 2: Install CLI Tools

### 2.1. Install the Pulumi CLI

Follow the instructions [here](https://www.pulumi.com/docs/get-started/install/) to install the Pulumi CLI for your operating system.

### 2.2. Install the Azure CLI

Next, Install the Azure CLI by following the instructions [here](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli).

**Here are the current versions after installed them successfully.**

```bash
> pulumi version
v3.133.0

> az -v
azure-cli  2.64.0
```

---

## 3: Configure Pulumi for Azure

Before diving into coding, let's configure Pulumi to work with your Azure account. Run the following commands to set up your Pulumi stack with the correct Azure subscription details:

```bash
# Set the default Pulumi organization (replace with your organization name)
pulumi org set-default YOUR_PULUMI_ORGANIZATION

# Configure Azure settings
pulumi config set azure-native:tenantId YOUR_AZURE_TENANT_ID
pulumi config set azure-native:subscriptionId YOUR_AZURE_SUBSCRIPTION_ID
pulumi config set azure-native:location YOUR_AZURE_LOCATION  # e.g., SoutheastAsia

# Optional: If you're using a service principal for authentication
pulumi config set azure-native:clientId YOUR_AZURE_CLIENT_ID
pulumi config set azure-native:clientSecret YOUR_AZURE_CLIENT_SECRET --secret
```

**Note:** Replace placeholders with your actual Azure details. The `--secret` flag ensures sensitive information is encrypted.

---

## 4: Create Your First Pulumi Project

### 4.1. Set Up a Git Repository

Create a new directory for your Pulumi project and initialize a Git repository:

```bash
mkdir day00_pulumi-azure-start
cd day00_pulumi-azure-start
git init
```

### 4.2. Initialize a New Pulumi Project

Run the following command to create a new Pulumi project using the Azure TypeScript template:

```bash
pulumi new azure-typescript
```

You'll be prompted to provide:

- **Login**: Authenticate using the PAT token generated earlier.
- **Project name**: Accept the default or enter a custom name.
- **Project description**: (Optional)
- **Stack name**: e.g., `dev`
- **Package manager**: Choose your preferred package manager (e.g., `npm`, `yarn`, `pnpm`). Here I will pick `pnpm`.
- **Azure location**: e.g., `SoutheastAsia`

After the project is created, if you are using your own account for development then ensure you're logged into Azure:

```bash
az login

# Sample Code
Retrieving tenants and subscriptions for the selection...

[Tenant and subscription selection]

No     Subscription name    Subscription ID                       Tenant
-----  -------------------  ------------------------------------  -----------
[1] *  DrunkCoding          54dbd16b-81cd-yyyy-xxxx-xxxyyyzzz000  DrunkCoding

```

> **Note**:
>
> - Pulumi supports various package managers, including `npm`, `yarn`, and `pnpm`. For consistency, this guide will use `pnpm` for all Pulumi projects.
> - In Pulumi, each stack represents a different environment, and by default, all stacks are encrypted with a randomly generated key. If you prefer to use a custom encryption key, refer to the [Pulumi documentation](https://www.pulumi.com/docs/iac/concepts/secrets/#configuring-secrets-encryption) for instructions.

---

## 5: Understand the Project Structure

### 5.1. Project files

The template generates several files:

- **Pulumi.yaml**: Contains project metadata.
- **Pulumi.dev.yaml**: Contains stack-specific configuration.
- **index.ts**: The main program file where you'll define your infrastructure.
- **package.json**: Node.js project metadata.
- **tsconfig.json**: TypeScript compiler configuration.

### 5.2: Review the Sample Code

Open `index.ts` in your preferred code editor and review the sample code. It typically includes the creation of a Resource Group and a Storage Account.

**Sample Code:**

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/day-0/day00_pulumi-azure-start/index.ts#L1-L23)

> Note: Exporting the key here is just for demo purposes. In the real environment all the key, connection string and credentials should be store in the Key Vault instead.

---

## 6: Preview and Deploy Your Stack

### 6.1. Preview the Changes

Before deploying, preview the changes to ensure everything is set up correctly:

```bash
pulumi up

# Sample Output
Previewing update (dev)

View in Browser (Ctrl+O): https://app.pulumi.com/drunkcoding/day00_pulumi-azure-start/dev/previews/xxxxxxxx-1f60-4ed9-bb35-xxxxxxxxxxxx

     Type                                     Name                          Plan
 +   pulumi:pulumi:Stack                      day00_pulumi-azure-start-dev  create
 +   ├─ azure-native:resources:ResourceGroup  resourceGroup                 create
 +   └─ azure-native:storage:StorageAccount   sa                            create

Outputs:
    primaryStorageKey: output<string>

Resources:
    + 3 to create

Do you want to perform this update?  [Use arrows to move, type to filter]
  yes
> no
  details
```

You should see a plan indicating that new resources will be created.

### 6.2. Deploy the Stack

Deploy your resources to Azure:

```bash
pulumi up -y

# Sample Output
Updating (dev)

View Live: https://app.pulumi.com/YOUR_ORGANIZATION/day00_pulumi-azure-start/dev/updates/1

     Type                                     Name                          Status
 +   pulumi:pulumi:Stack                      day00_pulumi-azure-start-dev  created
 +   ├─ azure-native:resources:ResourceGroup  resourceGroup                 created
 +   └─ azure-native:storage:StorageAccount   storageaccount                created

Outputs:
    primaryStorageKey: "<secure>"

Resources:
    + 3 created

Duration: 35s
```

### 6.3: Verify the Deployment

After deployment, you can verify the resources in the Azure Portal:

- Log in to the [Azure Portal](https://portal.azure.com/).
- Navigate to **Resource Groups** and locate your newly created resource group.
- Verify that the Storage Account is present within the resource group.

![Azure Resources](/assets/az-01-pulumi-setup-developer-account/az-resources.png)

---

## 7: Clean Up Resources

To avoid incurring unnecessary costs, destroy the resources when they're no longer needed:

```bash
pulumi destroy -y

# Sample Output
Destroying (dev)

View Live: https://app.pulumi.com/YOUR_ORGANIZATION/day00_pulumi-azure-start/dev/updates/2

     Type                                     Name                          Status
 -   pulumi:pulumi:Stack                      day00_pulumi-azure-start-dev  deleted
 -   ├─ azure-native:storage:StorageAccount   storageaccount                deleted
 -   └─ azure-native:resources:ResourceGroup  resourceGroup                 deleted

Outputs:
  - primaryStorageKey: "<secure>"

Resources:
    - 3 deleted

Duration: 25s

The resources in the stack have been deleted, but the history and configuration are still maintained.
If you want to remove the stack completely, run `pulumi stack rm dev`.
```

---

## Conclusion

Congratulations! You've successfully:

- Registered for a Pulumi account
- Generated a Personal Access Token
- Set up the Pulumi and Azure CLI tools
- Created your first Pulumi project using TypeScript for Azure
- Deployed an Azure Resource Group and Storage Account

Pulumi simplifies cloud resource management by allowing you to use familiar programming languages and tools. You can now explore adding more complex resources and configurations to your project.

- [Refer here for the source code](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/day-0/day00_pulumi-azure-start/README.md#day-0)

---

## Next Steps

**[Day 02: Private Aks Environment Architecture.](/posts/az-02-pulumi-private-ask-env-architecture)**

In the next tutorial will explains a the architecture of private AKS that we are going to setup on Azure, leveraging multiple subnets, Azure Firewall, and other essential cloud services.
This architecture ensures that sensitive workloads remain isolated and protected from public internet exposure.

---

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven**
[GitHub](https://github.com/baoduy)
