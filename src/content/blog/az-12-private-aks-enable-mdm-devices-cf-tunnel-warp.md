---
author: Steven Hoang
pubDatetime: 2024-10-12T12:00:00Z
title: "[Az] Day 12: Enabling MDM Devices by leverage Cloudflare Tunnel and WARP."
featured: false
draft: false
tags:
  - AKS
  - private cluster
  - Cloudflare
  - Tunnel
  - warp
description: "
In this tutorial, We'll explore other alternative ways to access to private AKS cluster and Applications to the internet using Cloudflare Tunnel and WARP.
"
---
## Introduction

In the final stretch of our series on establishing a private AKS environment on Azure with Pulumi, we confront a critical balancing act: ensuring secure access for developers and users without compromising the environment's integrity. 

While stringent security is paramount for compliance, excessive restrictions can hinder developer productivity by obstructing access to essential tools. This challenge is compounded by the rise of remote work, which necessitates robust solutions for managing devices and enforcing security policies beyond traditional network boundaries.

This is where Cloudflare WARP and its Zero Trust model come into play. WARP empowers us to grant secure, private access to corporate applications while meticulously verifying device health before connection. By routing traffic through Cloudflare's global network, the WARP client allows for granular web filtering and robust security measures enforced by Cloudflare Gateway.

This approach offers a compelling solution for organizations with remote workforces, enhancing security while minimizing friction for users. By integrating Cloudflare Tunnel and WARP into our private AKS environment, we can strike a balance: enabling seamless developer access while upholding the integrity and security of our corporate network. 

## Table of Contents

## WARP Configuration

To begin, log into the [Cloudflare Zero Trust](https://one.dash.cloudflare.com) dashboard and navigate to **Settings** > **WARP Client** and configure the following settings:

1. **Device Enrollment Permissions:**
    - **Device Enrollment Rules**: Click the "Manage" button under the Device enrollment permissions section to add the necessary _Device enrollment rules_ as depicted below.
      ![cf-device-onboarding-rules](/assets/az-12-private-aks-enable-mdm-devices-cf-tunnel-warp/cf-device-onboarding-rules.png)
    
    - **Authentication**: Ensure that the authentication tab exclusively enables the _Azure AD_ provider, with both _WARP authentication identity_ and _Apply to all Access applications_ activated.
      ![cf-device-onboarding-auth](/assets/az-12-private-aks-enable-mdm-devices-cf-tunnel-warp/cf-device-onboarding-auth.png)

2. **Global Settings**: Activate the Admin override feature, setting the timeout appropriately—6 hours is a recommended.
      ![cf-warp-global-settings](/assets/az-12-private-aks-enable-mdm-devices-cf-tunnel-warp/cf-warp-global-settings.png)

3. **Device Posture:** This section is crucial for defining device validation rules.
    - **WARP Client Check**: Activate both the _Gateway_ and _WARP_ checking rules.
    - **Third-Party Service Providers**: Click the "Add new" button and select _Microsoft Endpoint Manager_. Follow the provided instructions to implement the Microsoft Intune MDM validation check.
    - **Service Provider Check**: Create a new rule named `Device-Compliant`, assigning it a value of `Compliant`. Avoid selecting an operation unless the rule is intended for a specific OS.
     ![cf-warp-device-posture](/assets/az-12-private-aks-enable-mdm-devices-cf-tunnel-warp/cf-warp-device-posture.png)

4. **Network Locations**: Click on "Virtual Network" to create two virtual networks:
    - **default-internal-net:** This network is the default for organizational access, permitting connection to internal applications.
    - **it-internal-net:** A specialized network for the IT department, granting access to select internal services (e.g., SSH access to DevOps agent VMs).
     ![cf-warp-network](/assets/az-12-private-aks-enable-mdm-devices-cf-tunnel-warp/cf-warp-network.png)

## WARP Profile Configuration

Upon navigating to Device Settings, you'll find a default profile. This profile can be enhanced with the following customizations:

1. **Configuration Options:**
   Adjust the settings as outlined below:
    - **Captive Portal Detection:** Enable with a 3-minute timeout. This feature allows the WARP client to temporarily deactivate when encountering a captive portal, facilitating connection to networks like those in hotels, airplanes, or other public environments.
    - **Lock WARP Switch:** Ensure that users cannot disable the WARP switch, preventing them from disconnecting the client.
    - **Allow Updates:** Permit local administrators to receive update notifications for the client and initiate the updates.
    - **Automatic Reconnection:** Set to enable with a 3-minute timeout. This ensures the WARP client automatically reconnects after the specified duration.
    - **Service Mode:** Default to **Gateway with WARP**. This should not be altered.
      ![cf-warp-profile-config-settings](/assets/az-12-private-aks-enable-mdm-devices-cf-tunnel-warp/cf-warp-profile-config-settings.png)

2. **Split Tunneling:**
   It should be in **Exclude IPs and Domains** mode, configure traffic routing preferences within Cloudflare Zero Trust.
    
    By default, all private IP address spaces are excluded. To allow remote devices to access AKS and DevOps subnets, adjust the exclusion rules. Click the "Manage" button to ensure these subnets are included for access.
    ![cf-warp-profile-split-tunnel](/assets/az-12-private-aks-enable-mdm-devices-cf-tunnel-warp/cf-warp-profile-split-tunnel.png)
    
3. **Microsoft 365 Traffic Routing:** 
   If your organization uses Microsoft 365, it's advisable to enable direct routing for its traffic to ensure optimal performance.


## WARP Team Domain Management

Upon registering for Cloudflare Zero Trust, you will need to specify a **Team Domain**. If you do not recall your current team domain or wish to modify it, head over to **Settings** > **Custom Pages**. Here, you can view and update your team domain, as well as customize the appearance of login and error pages to better fit your organization’s branding needs.
![cf-warp-custom-pages](/assets/az-12-private-aks-enable-mdm-devices-cf-tunnel-warp/cf-warp-custom-pages.png)

## WARP Client App Rollout

1. **Intune App Rollout:** To facilitate the mass deployment of the WARP Client across all devices, follow the [detailed instructions provided here](https://developers.cloudflare.com/cloudflare-one/connections/connect-devices/warp/deployment/mdm-deployment/partners/intune/). This guide outlines the steps to integrate the WARP client app with Intune for efficient rollout to the designated target devices.

2. **WARP Activation**:

## Private Resources Accessing

## Improve Exposing Application Security Policy

## Conclusion

## Reference
 
 - [The Cloudflare WARP client](https://developers.cloudflare.com/cloudflare-one/connections/connect-devices/warp/)
 - [Download WARP](https://developers.cloudflare.com/cloudflare-one/connections/connect-devices/warp/download-warp/)

## Thank You

Thank you for taking the time to read this guide! We hope it has been helpful. Feel free to explore further, and happy coding! 🌟✨

**Steven** | _[GitHub](https://github.com/baoduy)_