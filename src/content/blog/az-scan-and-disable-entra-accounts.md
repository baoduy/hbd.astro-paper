---
author: Steven Hoang
pubDatetime: 2024-07-29T12:00:00Z
title: "[AZ] How to Scan and Disable Inactive Accounts on Azure EntraID"
postSlug: az-scan-and-disable-entra-accounts
featured: true
draft: false
tags:
  - Azure
  - EntraID
  - Disable Account
ogImage: ""
description:
  Inactive accounts in Azure EntraID can pose significant security risks.
  This post discusses the importance of implementing a housekeeping strategy and introduces a streamlined approach using Azure DevOps.
---

## Introduction

Managing employee credentials and logins efficiently is crucial for maintaining the security of your company’s data. If your organization uses Azure EntraID, you might notice that inactive accounts can accumulate over time. These dormant accounts are a potential security risk, as they could be exploited by malicious actors to gain unauthorized access to sensitive information.

To mitigate this risk, it’s essential to develop an effective account housekeeping strategy. Various methods can be employed, such as utilizing Azure Automation with PowerShell scripts or deploying an Azure Function. In this post, I will introduce an alternative solution that is straightforward to implement and can be seamlessly integrated with Azure DevOps.

## 1. Creating an Azure EntraID Application

Before diving into the code, the first step is to create an **App registration** on Azure EntraID. This application will authenticate and manage accounts through the Microsoft Graph API.

### Steps to Create an App Registration

1. **Navigate to Azure EntraID**: Open the Azure portal and go to the Azure EntraID service.
2. **Create App Registration**: Click on “App registrations” and then “New registration”.
3. **Configure the App**: - Name the app `Azure-EntraID-Management`. - Set it to be available only for your organization (single tenant). - No Redirect URL is required.
   <img src="/assets/az-scan-and-disable-entra-accounts/app-registration.png" width="700px">

### Adding API Permissions

After creating the app registration, you need to add and grant admin consent for the following Microsoft Graph API permissions:

1. `AuditLog.Read.All`: Allows reading the sign-in activity information of all accounts in EntraID.
2. `User.Read.All`: Allows scanning and reading the basic information of all accounts in EntraID.
3. `User.EnableDisableAccount.All`: Allows disabling/enabling accounts in EntraID.
   <img src="/assets/az-scan-and-disable-entra-accounts/app-api-permission.png" width="700px">

## 2. Implementing a TypeScript Program

Now, let’s implement a TypeScript program to manage inactive accounts. This program will use the Microsoft Graph API to scan, disable, and report on inactive accounts.

### Overview of the Program

The TypeScript program consists of six methods:

1. **Setup Credentials and Microsoft Graph Client**: Initializes the necessary credentials and creates a Microsoft Graph client.
2. **Get Inactive Accounts**: Retrieves all accounts with their last login activity before a specified date.
3. **Disable Inactive Accounts**: Disables the identified inactive accounts, excluding those on an exclusion list.
4. **Retrieve Disabled Accounts**: Retrieves all disabled accounts for reporting purposes.
5. **Log Account Information**: Prints account information to the console with a message.
6. **Main Entry Method**: The main function that orchestrates the above methods, triggered by an `npm run` command.

### Sample Code Snippet

```typescript
import { DefaultAzureCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import dayjs, { Dayjs } from "dayjs";

const numberOfMonths = -2;
/** Exclude some important global admin accounts here */
const excludedAccounts = ["drunkcoding"];

type AzResult<T> = { value: Array<T> };
type AdUser = {
  userPrincipalName: string;
  id: string;
  accountEnabled: boolean;
};

/** 1. Setup Credentials and Microsoft Graph client */
const client = Client.initWithMiddleware({
  debugLogging: false,
  authProvider: new TokenCredentialAuthenticationProvider(
    new DefaultAzureCredential(),
    {
      scopes: ["https://graph.microsoft.com/.default"],
    }
  ),
});

/** 2. Get all accounts that has last login activity before expected date */
const getAllAccountsLastLoginBefore = async (date: Dayjs) => {
  /** Query all the accounts that has signInActivity date before the expected parameter date */
  const accounts = (await client
    .api("/users/")
    .filter(`signInActivity/lastSignInDateTime lt ${date.toISOString()}`)
    .select("id,userPrincipalName,accountEnabled")
    .get()) as AzResult<AdUser>;

  /** Filter the enabled account only here
   * as the API filter has limitation that not allows to query based on both signInActivity and accountEnabled */
  return accounts.value.filter(m => m.accountEnabled);
};

/** 3. Perform the disabled accounts except the accounts in the excluded list above. */
const disableAccounts = async (accounts: AdUser[]) => {
  return await Promise.all(
    accounts.map(async u => {
      /* Check and keep the account if found in the excludedAccounts */
      if (
        excludedAccounts.filter(a =>
          u.userPrincipalName.toLowerCase().includes(a.toLowerCase())
        )
      ) {
        console.log(
          `User account ${u.userPrincipalName} has been excluded from disabling.`
        );
        return;
      }

      // Perform the account disabling
      await client.api(`/users/${u.id}`).update({
        accountEnabled: false,
      });

      console.log(
        `User account with ID ${u.userPrincipalName} has been disabled.`
      );
    })
  );
};

/** 4. Get all disabled account on Azure Entra for report purposes. */
const getAllDisabledAccounts = async () => {
  /** Query all the accounts that has accountEnabled is false */
  const rs = (await client
    .api("/users/")
    .filter(`accountEnabled eq false`)
    .select("id,userPrincipalName,accountEnabled")
    .get()) as AzResult<AdUser>;

  return rs.value;
};

/** 5. Print accounts info into console log with a message */
const printAccounts = (message: string, accounts: AdUser[]) =>
  console.log(
    message,
    accounts
      .map((m, i) => `${i + 1}.\t ${m.userPrincipalName} ${m.accountEnabled}`)
      .join("\n\t ")
  );

/** 6. The main method*/
(async () => {
  //1. Find inactive accounts on Azure
  console.log(`1. Finding inactive login accounts on Azure AD...`);
  const lastLogin = dayjs().add(numberOfMonths, "M");
  const accounts = await getAllAccountsLastLoginBefore(lastLogin);
  // Log the information here
  printAccounts(
    `Found ${accounts.length} users were inactive before '${lastLogin.toISOString()}'\n\t`,
    accounts
  );

  //2. Disable inactive accounts on Azure
  if (accounts.length > 0) {
    console.log(`\n\n2. Disabling inactive accounts on Azure AD...`);
    await disableAccounts(accounts);
  } else console.log(`\n\n2. There is no accounts found for disabling.`);

  //3. Find and log all disabled accounts on Azure Entra
  printAccounts(
    `\n\t3. Here are all disabled Accounts on Azure Entra. It should be deleted if no longer needed. \n\t`,
    await getAllDisabledAccounts()
  );
})();
```

> You should able to download the entire NodeJs from here: https://dev.azure.com/drunk24/drunkcoding-public/_git/az.account-management

## 3. Schedule the Script with Azure DevOps

To automate this process, we will schedule the script to run regularly using Azure DevOps.

### Setting Up Azure DevOps Pipeline

1. Create a Variable Group:
   Navigate to Azure DevOps/Pipelines/Library and Add a new variable group with the following variables: - `AZURE_TENANT_ID`: The tenant ID of the app registration. - `AZURE_CLIENT_ID`: The client ID of the app registration. - `AZURE_CLIENT_SECRET`: The client secret of the app registration.

<img src="/assets/az-scan-and-disable-entra-accounts/variable-group.png" width="700px">

2. **Define the Pipeline**:
   - **Create a New Pipeline**: In Azure DevOps, create a new pipeline and ensure it has access to the variable group created in the previous step.
   - **Schedule the Pipeline**: In the same pipeline YAML file. We can setup the schedule to trigger at midnight every Sunday.

```yaml
schedules:
  - cron: "0 0 * * 0" # Runs at midnight every Sunday
    displayName: "Weekly Sunday Run"
    branches:
      include:
        - main
    always: true # Always run the pipeline regardless of source code changes
    batch: false # Do not run if the previous scheduled run is still in progress

pool:
  vmImage: ubuntu-latest

variables:
  - group: az-management

steps:
  - task: Bash@3
    inputs:
      targetType: "inline"
      script: |
        npm ci
        npm run run
      workingDirectory: "az-entraID-scan"
    env:
      AZURE_TENANT_ID: $(AZURE_TENANT_ID)
      AZURE_CLIENT_ID: $(AZURE_CLIENT_ID)
      AZURE_CLIENT_SECRET: $(AZURE_CLIENT_SECRET)
```

> **Note:** You need a Microsoft Entra ID P2 license to run this program, as the AuditLog Graph API requires a premium license.

<hr/>
Thank you for your time! If you have any further questions, feel free to ask. 🌟✨🎁

Steven
[GitHub](<[https://github.com/baoduy](https://github.com/baoduy)>)
