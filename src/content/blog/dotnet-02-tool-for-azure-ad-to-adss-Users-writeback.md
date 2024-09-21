---
author: Steven Hoang
pubDatetime: 2021-10-13T00:00:00Z
title: "[.NET] Small tool for Azure AD to AD User Write back"
postSlug: azure-ad-to-adss-users-write-back
featured: false
draft: false
tags:
  - dotnet
  - tools
  - azureAD
  - sync
ogImage: ""
description: Sharing a small tool-self developed to sync the users from AzureAD to on=premise Active Directory Service.
---

Azure AD Sync is an instrumental resource for forging a hybrid cloud model and facilitating password write-back.
However, if your organization requires user write-back functionality, Azure AD Sync alone will not suffice.

## Solution

To address this need, I have developed a tool that implements user write-back functionality. With this self-contained tool, you can specify which users in which Azure groups should be written back and determine the Organizational Unit (OU) and AD group where users should be assigned.

## Configuration

1. Create an Application Registration (e.g., named 'azure-adds-user-write-back') with Microsoft Graph API permission set to `Group.Read.All` and `User.Read.All`.
2. Update the information in `appsettings.json` as follows:

```json
{
  "AzAdSync": {
    "Authority": "https://login.microsoftonline.com/[TenantId]",
    "ClientId": "[ClientId]",
    "ClientSecret": "[ClientSecret]",
    "AzureAdGroups": ["The Azure AD groups would like to write back"],
    "AdOrgUnit": "The OU of ADDS for write-back users."
  }
}
```

## Tool Tech-stack

This application is developed using the .NET Core framework.
You can build the project as a Window-x64 single file, self-contained.
After that, you will be able to copy and run it on any domain-joined computer without needing the .NET runtime.

To install the app as a window service, run `sc.exe create "AADS Users WriteBack" binpath=[Path To]\Azure.ADDS.UserWriteBack.exe`.
Ensure that the Logon account is updated with a Windows account with permission to create ADDS objects,
and switch the start type to `Automatic`.

> Please note that the log files will be writing to the `C:\Windows\System32\Logs folder.`

The application will check and sync users from AzureAdGroups every 1 hour.
Upon successful write-back of the user account to ADDS,
the account owner must reset their password since the application generates a random password of 50 length characters.

> This password is just a temporary password as it will be overwritten with the latest password once users changed their password in Azure AD by the password write-back of AD-AAD Sync.

## Source Code

The source code is accessible at this Github repository: https://github.com/baoduy/Azure.ADDS.UserWriteBack.
Please adjust the steps and instructions to match your actual tool's requirements and behavior.

---

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven**
[GitHub](<[https://github.com/baoduy](https://github.com/baoduy)>)
