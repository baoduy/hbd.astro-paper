---
author: Steven Hoang
pubDatetime: 2024-10-12T12:00:00Z
title: "[Az] Day 11: Exposing a Private AKS Application via Cloudflare Tunnel."
featured: false
draft: false
tags:
  - AKS
  - Helm
  - CI/CD
  - AzureDevOps
  - Cloudflare
  - Tunnel
description: "
In this tutorial, We demonstrate how to securely expose an application running on a private AKS cluster to the internet using Cloudflare Tunnel, without the need for public IP addresses or open ports. We’ll also show how to apply authentication to all exposed applications and centralize access control using Azure Entra ID Groups, ensuring only authorized users have access.
"
---

## Introduction
In environments with stringent security policies, exposing applications hosted on private AKS clusters to the internet without compromising security can be challenging. These environments often have **no inbound internet access** and **no open ports**, limiting conventional methods of application exposure.

In this guide, we’ll walk through how to securely expose an application hosted on a private AKS cluster to the internet using **Cloudflare Tunnel**, a solution that eliminates the need for public IP addresses or open ports. Additionally, we’ll demonstrate how to secure the application with **Cloudflare Access** integrated with **Azure EntraID Single Sign-On (SSO)**.

## Table of Contents

## Setting Up Cloudflare Tunnel

*Cloudflare Tunnel** (formerly Argo Tunnel) provides a secure connection between your services and Cloudflare without the need for public IP addresses or inbound firewall rules.

### Generate Tunnel Token

To get started, follow these steps to create a Cloudflare Tunnel token:

1. **Sign in to Cloudflare**  
   Log in to your Cloudflare account and navigate to the [Zero Trust dashboard](https://one.dash.cloudflare.com).

2. **Create a Tunnel**  
   Go to **Network** and select **Tunnels**. Click **Create a tunnel** and choose the `cloudflared` option.
   ![cloudflare-tunnel-creation](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/cloudflare-tunnel-creation.png)

3. **Name and Save the Tunnel**  
   Name your tunnel `private-aks-tunnel` and click **Save**.

4. **Copy Tunnel Token**  
   Once the tunnel is created, a token will be generated. Copy the tunnel token and securely store it in **Azure Key Vault** as a secret named `cf-tunnel-token`.
   ![key-vault-secret-cf-tunnel](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/key-vault-secret-cf-tunnel.png)
   > Ensure that the token is accurately stored in the Key Vault. This token will be used when deploying the `cloudflared` Helm chart.

### Deploying **Cloudflared** with Helm

With the secure storage of the tunnel token in Key Vault, follow these refined steps to deploy **cloudflared** on the AKS cluster using Helm:

1. **Cloudflared Chart:**

   I crafted the [cloudflared Helm chart](https://github.com/baoduy/drunk-azure-pulumi-articles/tree/main/pipeline/cf-tunnel-helm), expanding upon the previous chart template. 
   This implementation establishes an AKS network policy that blocks inbound traffic to the namespace while allowing only the necessary outbound traffic to the internal Nginx Ingress using the private IP `192.168.31.250`.

    <details><summary><em>Explore the <code>values-dev.yaml</code> configuration file</em></summary>
    
    [Access File](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/pipeline/cf-tunnel-helm/values-dev.yaml#1-1000)
    
    </details>

2. **Cloudflared Deployment Pipeline:**
   
   This pipeline mirrors the previous setup, with an additional enhancement. It incorporates a step to directly retrieve secrets from the Key Vault, bypassing the need for a Variable Group.

    <details><summary><em>Explore the <code>network-rule.yaml</code> configuration file</em></summary>
    
    [Access File](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/pipeline/cf-tunnel-helm/templates/network-rule.yaml#1-1000)
    
    </details>

> **Important:**
> - To optimize the Cloudflare Tunnel's outbound operations, adjust the AKS firewall settings in accordance with [Cloudflare's recommendations](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/deploy-tunnels/tunnel-with-firewall).
> - These settings are required for the tunnel's ability to establish and maintain effective communication with Cloudflare servers, handling inbound requests seamlessly.

### Deploying the Cloudflare Tunnel

1. Create a new pipeline named `cf-tunnel-helm` is configured to link with the `cf-tunnel-helm.azure-pipelines.yml` file, enabling the deployment
of this Helm chart to AKS.

   ![Cloudflare Tunnel Deployment Pipeline](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/cf-system-helm-pipeline.png)

2. Once deployment is successful, the Cloudflare Tunnel pods should be running within the `cf-system` namespace.
   ![cf-system Namespace Pods](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/cf-system-pods.png)

3. Return to the [Cloudflare Zero Trust](https://one.dash.cloudflare.com) dashboard to verify the tunnel status, which should display as healthy.
   ![Cloudflare Tunnel Dashboard Status](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/cf-dashboard-tunnel-status.png)

## Exposing the Application

With all preparations complete, we can now expose the application to the internet. Follow these steps to finalize the setup:

1. Go to the Cloudflare Tunnel created previously and click "Edit."
2. Navigate to the "Public Hostname" section and configure it as follows:
   - **Subdomain**: The subdomain of the app. in this example, `hello` is used.
   - **Domain**: Choose any available domain; in this example, `st24.dev` is used.
   - **Service Type**: HTTP
   - **URL**: Enter the internal Nginx ingress IP address and application port, e.g., `192.168.31.250:80`.
   - **HTTP Host Header**: This should match the internal ingress domain associated with the application, e.g., `hello.drunkcoding.net`.

   ![cf-tunnel-public-hello-app](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/cf-tunnel-public-hello-app.png)

3. Save the configuration. After saving, The application should be able to access publicly via `hello.st24.dev`.

   ![hello-app-with-st24](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/hello-app-with-st24.png)

## Securing the Application with Authentication

Once the application is exposed to the internet, it becomes accessible to everyone, posing security concerns. 
To enhance security, we need to restrict access to authorized personnel only, such as company staff or specific group members. 

Cloudflare provides a robust solution for securing applications accessible via tunnels. Let's explore how to implement this.

### Configuring Cloudflare SSO with EntraID

Logging into the [Cloudflare Zero Trust](https://one.dash.cloudflare.com) dashboard, Navigate to **Settings** > **Authentication**, and select "Add New" under the **Login methods** section.

1. **Login providers:** Cloudflare offers multiple login providers; choose **Azure AD** for this configuration.
  ![cloudflare-login-providers](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/cloudflare-login-providers.png)

2. **EntraID SSO:** Follow the provided instructions to integrate Azure AD (EntraID) authentication.
  ![cloudflare-azure-ad-login](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/cloudflare-azure-ad-login.png)

3. **Verification:** Test the configuration to verify that authentication can successfully retrieve the `name` and `id` of EntraID groups.
  ![cloudflare-azure-ad-login-test](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/cloudflare-azure-ad-login-test.png)

### Creating a New EntraID Group

Log into the Azure Portal and create a new EntraID group named `DRUNK CF APPS` with the ID `f8863b0f-3376-4d14-85ba-b376a7d5aeca`. This group will be used to control access to the exposed application.
![entra-drunk-app-group](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/entra-drunk-app-group.png)

### The `hello` App Access Policy

Return to the [Cloudflare Zero Trust](https://one.dash.cloudflare.com) dashboard and go to **Access** > **Applications**. Click "Add an Application" and select the `Self-hosted` type.

1. **App Configuration**: Ensure the domain matches the application you wish to protect. In this example, we'll protect the `hello.st24.dev` application previously exposed.
    ![cf-app-config](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/cf-app-config.png)

2. **App Identity**: Choose the login provider configured earlier.
    ![cf-app-identity-providers](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/cf-app-identity-providers.png)

3. **App Policy**: Configure a policy that requires authentication via required provider and restricts access to users in the specified EntraID group ids.
    ![cf-app-policy](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/cf-app-policy.png)
    > The list of permitted Azure Groups should include the EntraID Group IDs that are allowed access to this app. Without this configuration, the app would be accessible to anyone with an EntraID account in the organization.

4. **Testing the App Policy**: After creating the application, click "Test Your Policy" to ensure it functions as intended using a specific account.
    ![cf-app-policy-test](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/cf-app-policy-test.png)

## Accessing the Protected App

1. Visit `hello.st24.dev`, and you should encounter a login dialog requesting Azure AD authentication before accessing the application.
  ![cf-apps-login-dialog](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/cf-apps-login-dialog.png)

2. With the correct permissions, users will gain normal access to the application.
  ![hello-app-with-st24](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/hello-app-with-st24.png)

## Conclusion

In this guide, we've explored how to securely expose an application running on a private AKS cluster to the internet without relying on public IP addresses or open ports. By leveraging **Cloudflare Tunnel**, we established a secure outbound-only connection that adheres to stringent security policies. This method eliminates the risks associated with inbound internet access while providing a seamless way to make internal services accessible externally.

We also implemented **Cloudflare Access** integrated with **Azure Entra ID Single Sign-On (SSO)** to add an authentication layer to all exposed applications. This integration ensures that only authorized users within your organization can access the applications, enhancing security by centralizing access control through Entra ID Groups. By doing so, we simplified user management and strengthened compliance with organizational policies.

This approach not only maintains the security integrity of your infrastructure but also offers a scalable solution for exposing multiple applications securely. It demonstrates how modern cloud services can be combined to meet complex security requirements without compromising accessibility or user experience.

## Reference

- [Cloudflared Helm Chart](https://github.com/baoduy/drunk-azure-pulumi-articles/tree/main/pipeline/cf-tunnel-helm)
- [Tunnel with firewall](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/deploy-tunnels/tunnel-with-firewall)
- [Configure Cloudflare with Microsoft Entra ID](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/cloudflare-integration)


## Next

**[Day 12: Exposing a Private AKS Application via Cloudflare Tunnel.](/posts/az-12-private-aks-enable-mdm-devices-cf-tunnel-warp)**

In the next and final tutorial, We'll discover how to safely expose the private AKS cluster and applications to the internet with Cloudflare. 
It'll delve into the benefits of using Cloudflare Tunnel and WARP, exploring alternative ways to provide secure access while maintaining the integrity of the corporate network.

## Thank You

Thank you for taking the time to read this guide! We hope it has been helpful. Feel free to explore further, and happy coding! 🌟✨

**Steven** | _[GitHub](https://github.com/baoduy)_
