---
author: Steven Hoang
pubDatetime: 2025-01-01T12:00:00Z
title: "[Az] Day-0: Setup pulumi developer account"
postSlug: az-pulumi-setup-developer-account
featured: true
draft: true
tags:
  - aks
  - private
  - pulumi
description: ""
---

## Introduction

Pulumi is an open-source Infrastructure as Code (IaC) tool that allows developers to define cloud resources using familiar programming languages like TypeScript, Python, Go, and C#. This approach enables you to leverage the full power of programming languages, including loops, conditionals, and functions, to manage your infrastructure.

In this guide, we'll walk you through:

- Registering for a Pulumi account
- Generating a Personal Access Token (PAT)
- Creating your first Pulumi project using the TypeScript template for Azure
- Deploying your first Azure Resource Group

---

## Table of Contents

---

## Prerequisites

- **Node.js** installed on your machine
- **Azure CLI** installed and configured
- An **Azure account** (you can [create a free account here](https://azure.microsoft.com/free/))

## Step 1: Pulumi Setup

### a) Account Creation

1. **Visit the Pulumi Website**

   Navigate to the [Pulumi website](https://www.pulumi.com/) and click on the **"Sign Up"** button.

2. **Choose a Sign-Up Method**

   You can sign up using:

   - **GitHub**
   - **GitLab**
   - **Bitbucket**
   - **Email**

   Choose the method that suits you best and follow the on-screen instructions to complete the registration.

3. **Confirm Your Email**

   If you signed up using an email address, check your inbox for a confirmation email and verify your account.

### b) PAT Token Generation

A Personal Access Token (PAT) is needed to authenticate the Pulumi CLI with your Pulumi account.

1. **Log In to the Pulumi Console**

   Visit the [Pulumi Console](https://app.pulumi.com/) and log in with your credentials.

2. **Access the Tokens Page**

   - Click on your avatar or username in the top-right corner.
   - Select **"Access Tokens"** from the dropdown menu.
   - Create and safeguard your token for later use.
   -

3. **Create a New Organization**
   If you would like to have separate organization you can create from this portal or just go ahead using the default organization was created for the account.

## Step 3: Setup CLI

1. **Install the Pulumi CLI**
   Please follow the instruction [here](https://www.pulumi.com/docs/iac/download-install/) to install the Pulumi CLI to start managing your infrastructure.

2. **Setup Azure CLI**
   Similarly, we also need to install the Azure CLI before start the developer following the instruction [here](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli).

## Step 4: Create Your First Pulumi Project with TypeScript for Azure

Before dive into the coding lets prepare some information for pulumi as below.
These script need to be run for every pulumi `stack` project after create to ensure it is using correct azure subscription for each environment.

```bash
pulumi org set-default PULUMI_ORGANIZATION_NAME #ex:drunkcoding
pulumi config set azure-native:tenantId AZURE_TENANT_ID
pulumi config set azure-native:subscriptionId AZURE_SUBSCRIPTION_ID
pulumi config set azure-native:location AZURE_LOCATION #ex:SoutheastAsia
```

Create the Git repository and getting start with a simple pulumi project:

1. **Create Git Directory**

Run the below command under your git directory to create a `pulumi-azure-start` folder where we start with a simple pulumi project.

```bash
mkdir pulumi-azure-start
cd pulumi-azure-start
```

2. **Initialize a New Pulumi Project**

   ```bash
   pulumi new azure-typescript
   ```

   You'll be prompted to provide:

   - **Login**: using the pulumi's PAT token was generated in Step 1b above.
   - **Project name:** (Accept default or enter a name)
   - **Project description:** (Optional)
   - **Stack name:** (e.g., `dev`)
   - **Azure location:** (e.g., `SoutheastAsia`)
   - **Azure subscription info:** Run the pulumi commands prepared above for this `dev` stack.

This command sets up a new Pulumi project with a TypeScript template for Azure.

## Step 7: Understand the Project Structure

The template generates several files:

- **Pulumi.yaml:** Contains project metadata.
- **Pulumi.dev.yaml:** Contains stack-specific configuration.
- **index.ts:** The main program file where you'll define your infrastructure.
- **package.json:** Node.js project metadata.
- **tsconfig.json:** TypeScript compiler configuration.

## Step 8: Define a Resource Group in `index.ts`

Open `index.ts` in your preferred code editor and replace its contents with the following code:

```typescript
import * as azure from "@pulumi/azure-native";

// Create an Azure Resource Group
const resourceGroup = new azure.resources.ResourceGroup("my-resource-group");

// Export the resource group name
export const resourceGroupName = resourceGroup.name;
```

This script creates a new Azure Resource Group named **"my-resource-group"**.

## Step 9: Install Dependencies

Install the required npm packages.

```bash
npm install
```

## Step 10: Preview and Deploy Your Stack

### Preview the Changes

Before deploying, preview the changes to ensure everything is set up correctly.

```bash
pulumi preview
```

You should see a plan that indicates a new resource group will be created.

### Deploy the Stack

```bash
pulumi up
```

- Review the changes.
- Type **`yes`** to confirm and proceed with the deployment.

## Step 11: Verify the Deployment

### Using the Azure Portal

- Log in to the [Azure Portal](https://portal.azure.com/).
- Navigate to **"Resource Groups"**.
- You should see **"my-resource-group"** listed.

### Using the Azure CLI

```bash
az group show --name my-resource-group
```

If the resource group exists, you'll see its details in the output.

## Step 12: Clean Up Resources

To avoid incurring costs, destroy the resources when they're no longer needed.

```bash
pulumi destroy
```

- Review the resources to be destroyed.
- Type **`yes`** to confirm.

## Conclusion

Congratulations! You've successfully:

- Registered for a Pulumi account
- Generated a Personal Access Token
- Created your first Pulumi project using TypeScript for Azure
- Deployed an Azure Resource Group

Pulumi streamlines the process of managing cloud resources by allowing you to use familiar programming languages and tools. From here, you can explore adding more complex resources and configurations to your project.

## Next Steps

- **Add More Resources:** Try adding Azure Storage Accounts, Virtual Machines, or Azure Functions.
- **Explore Configuration Options:** Learn how to manage different environments (dev, staging, production) using Pulumi stacks.
- **Integrate with CI/CD:** Automate your deployments using popular CI/CD tools like GitHub Actions or Azure Pipelines.
- **Learn More:** Visit the [Pulumi Azure Documentation](https://www.pulumi.com/docs/intro/cloud-providers/azure/) for more in-depth guides and examples.

## Resources

- [Pulumi Documentation](https://www.pulumi.com/docs/)
- [Pulumi GitHub Repository](https://github.com/pulumi/pulumi)
- [Azure Documentation](https://docs.microsoft.com/en-us/azure/)

---

Thank you for your time! If you have any further questions, feel free to ask. 🌟✨🎁

Steven
[GitHub](<[https://github.com/baoduy](https://github.com/baoduy)>)
