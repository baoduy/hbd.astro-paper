---
author: Steven Hoang
pubDatetime: 2025-01-01T12:00:00Z
title: "[Az] Day 07: Setting Up a CloudPC with Windows 365 Enterprise."
featured: false
draft: false
tags:
  - AKS
  - Private
  - Pulumi
description: "In this article, We will discover how to configure a CloudPC with Windows 365 Enterprise to establish a secure and efficient Virtual Desktop Infrastructure (VDI) for accessing a private AKS environment."

---

## Introduction

In this article, We will  will learn how to set up a CloudPC with Windows 365 Enterprise to create a secure and efficient Virtual Desktop Infrastructure (VDI) for accessing a private AKS environment. 

We will cover the essential steps, including configuring network settings, setting up provisioning profiles and policies with Microsoft Intune, and creating an Entra ID group to streamline the provisioning process.

---

## Table of Contents

---

## Obtaining a Windows 365 License

Before beginning the configuration, ensure you have a Windows 365 Enterprise license. You can purchase a new license or obtain a trial license through the [Microsoft 365 Admin Center](https://admin.microsoft.com).

![windows365-license](/assets/az-07-pulumi-setup-cloudPC-windows365-enterprise/windows365-license.png)

> Note: A trial license is available, typically lasting one month, with the possibility of extending it for an additional month.

## Intune Configuration for Window 365

Since most companies already utilize Microsoft Intune for device management, we will not cover its configuration here. Instead, we will focus on setting up Windows 365 Enterprise.

### Entra Provision Group

- In the [Microsoft Endpoint Manager Admin Center](https://intune.microsoft.com/#home), navigate to **Groups** and create a new group named `MDM - IT Windows 365`.
  <img alt="entra-window365-group" src="/assets/az-07-pulumi-setup-cloudPC-windows365-enterprise/entra-window365-group.png" width="550px">

- Next, log back into the Windows 365 admin center and assign the license to this group. This will automate the license assignment and provisioning process whenever users are added to this group.
  <img alt="entra-id-group-license" src="/assets/az-07-pulumi-setup-cloudPC-windows365-enterprise/entra-group-license.png" width="550px">

### Configuring Azure Network for Windows 365

- Access the [Microsoft Endpoint Manager Admin Center](https://intune.microsoft.com/#home) and go to **Devices** > **Windows 365** > **Azure network connection**. Here, set up a new *Microsoft Entra Join* using the subnet established in the `az-04-CloudPC` with the default scope.
  <img alt="intune-windows365-vnet-config" src="/assets/az-07-pulumi-setup-cloudPC-windows365-enterprise/intune-windown365-vnet-config.png" width="600px">

- Once the VNET is created, it will undergo validation. If successful, the outcome should resemble the screenshot below:
![intune-windows365-vnet-validation-results](/assets/az-07-pulumi-setup-cloudPC-windows365-enterprise/intue-windown365-vnet-validation-results.png)

### Configuring Provisioning Policy for Windows 365

To set up a provisioning policy, navigate to the **Provisioning policies** tab and create a new policy named `CloudPC-Policy` with the following configurations:

1. **General Settings**: Configure the basic settings for the policy.
   ![General Settings](/assets/az-07-pulumi-setup-cloudPC-windows365-enterprise/intune-windown365-policy-01.png)

2. **Gallery Image**: Select the Windows 11 Enterprise 23H2 image for deployment.
   ![Gallery Image](/assets/az-07-pulumi-setup-cloudPC-windows365-enterprise/intune-windown365-policy-02.png)

3. **Windows Auto-Patch Configuration**: Set up the auto-patch feature.
   ![Auto-Patch Configuration](/assets/az-07-pulumi-setup-cloudPC-windows365-enterprise/intune-windown365-policy-03.png)
   > Note: Windows auto-patch is not enabled by default. Refer to [this guide](https://learn.microsoft.com/en-us/windows/deployment/windows-autopatch/prepare/windows-autopatch-feature-activation) to activate auto-patching for Windows.

4. **Policy Assignment**: Assign the policy to the `MDM - IT Windows 365` group created earlier.
   ![Policy Assignment](/assets/az-07-pulumi-setup-cloudPC-windows365-enterprise/intune-windown365-policy-04.png)

5. **Policy Overview**: Review the policy overview. Once the policy is created, the VM provisioning process will begin. It should be ready for use within a few minutes.
   ![Policy Overview](/assets/az-07-pulumi-setup-cloudPC-windows365-enterprise/intune-windown365-policy-overview.png)

---

## Window App For Remote Desktop

 Once the provisioning is done the VM should be ready for use. To access to windows 365 we have 2 options:
![windows365](https://windows365.microsoft.com/)

 1. Access through [Windows 365 online portal here](windows365) we can login and launch the remote desktop window directly on browser.
![windows365](https://windows365.microsoft.com/)

2. Access through [Windows App]() 

## Conclusion

---

## Reference

- [Overview of Windows 365 deployment](https://learn.microsoft.com/en-us/windows-365/enterprise/deployment-overview)
- [Start using Windows Autopatch](https://learn.microsoft.com/en-us/windows/deployment/windows-autopatch/prepare/windows-autopatch-feature-activation)
  
---

## Next Topic

**[Day 08: Setting Up a Deployment Pipeline for Pulumi Projects.](/posts/az-08-pulumi-setup-deploy-cicd-pipeline)**

In the next article, We'll walk through creating a Continuous Integration and Continuous Deployment (CI/CD) pipeline on Azure DevOps for our Pulumi projects.

---

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven** | _[GitHub](https://github.com/baoduy)_