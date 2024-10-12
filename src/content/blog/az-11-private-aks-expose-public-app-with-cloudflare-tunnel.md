---
author: Steven Hoang
pubDatetime: 2025-01-01T12:00:00Z
title: "[Az] Day 11: Exposing a Private AKS Application via Cloudflare Tunnel."
featured: false
draft: false
tags:
  - AKS
  - Helm
  - CI/CD
  - AzureDevOps
description: "In this article, We'll explore How to expose an application on private AKS to internet through Cloudflare Tunnel with no inbound internet access and no open ports to the internet."
---

## Introduction

In environments with strict security requirements, such as a private AKS cluster with no **inbound internet access** and **no open ports** to the
internet, exposing applications securely becomes a challenge.

This guide will walk you through leveraging Cloudflare Tunnel to expose our application to the internet without opening any ports and while
maintaining the highest level of security.

We'll also secure the application with Cloudflare Access using Azure EntraID Single Sign-On (SSO).

## Table of Contents

## Setting Up Cloudflare Tunnel

Cloudflare Tunnel offers a secure way to connect to Cloudflare, eliminating the necessity for a public IP address. Follow these detailed steps to set
it up effectively:

### Generate Tunnel Token

1. Sign in to the Cloudflare account and open the ["Zero Trust"](https://one.dash.cloudflare.com) dashboard.
2. Navigate to "Network" and select "Tunnels." Then, click "Create a tunnel" using the `Cloudflared` type.
   ![cloudflare-tunnel-creation](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/cloudflare-tunnel-creation.png)
3. Assign the name `private-aks-tunnel` to the tunnel and click "Save tunnel."
4. Copy the generated tunnel token and store it in the Key Vault as a secret named `cf-tunnel-token`. This token will be used when deploying the Helm
   chart later.
   ![key-vault-secret-cf-tunnel](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/key-vault-secret-cf-tunnel.png)
   > Ensure the token is accurately stored in the Key Vault. An example of the token format is `eyJhIjoiYWVl......VkzTkdJMyJ9`.

### Developing the Helm Chart

The Helm chart below is designed to deploy the Cloudflare Tunnel into a dedicated `cf-system` namespace.

<details><summary><em>View the <code>values-dev.yaml</code> configuration</em></summary>

[View File](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/pipeline/cf-tunnel-helm/values-dev.yaml#1-1000)

</details>

Additionally, an AKS network policy is established to prevent inbound traffic to this namespace, permitting only outbound traffic to the internal
Nginx Ingress with the private IP `192.168.31.250`.
<details><summary><em>View the <code>network-rule.yaml</code> configuration</em></summary>

[View File](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/pipeline/cf-tunnel-helm/templates/network-rule.yaml#1-1000)

</details>

> **Important:**
> - To facilitate the Cloudflare Tunnel's outbound connections, the AKS firewall settings need to be adjusted
    following [Cloudflare's guidelines](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/deploy-tunnels/tunnel-with-firewall).
> - This adjustment ensures that the tunnel, running within the cluster, can communicate effectively with Cloudflare servers to manage inbound
    requests.

### Deploying the Cloudflare Tunnel

In line with the previous pipeline, a new pipeline is configured to link with the `cf-tunnel-helm.azure-pipelines.yml` file, enabling the deployment
of this Helm chart to AKS.

![Cloudflare Tunnel Deployment Pipeline](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/cf-system-helm-pipeline.png)

Once deployment is successful, the Cloudflare Tunnel pod should be operational within the `cf-system` namespace.
![cf-system Namespace Pods](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/cf-system-pods.png)

Return to the Zero Trust dashboard to verify the tunnel status, which should display as healthy.
![Cloudflare Tunnel Dashboard Status](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/cf-dashboard-tunnel-status.png)

> This deployment process also illustrates how secrets can be fetched from the Key Vault for deployment purposes, negating the need to include them in
> the AzureDevOps Library Variable group.

## Exposing the Application

With all preparations complete, we can now expose the application to the internet. Follow these steps to finalize the setup:

1. Go to your Cloudflare Tunnel and click "Edit."
2. Navigate to the "Public Hostname" section and configure it as follows:
- **Subdomain**: hello
   - **Domain**: Choose any available domain; in this example, `st24.dev` is used.
   - **Service Type**: HTTP
   - **URL**: Enter the internal Nginx ingress IP address and application port, e.g., `192.168.31.250:80`.
   - **HTTP Host Header**: This should match the internal ingress domain associated with your application, e.g., `hello.drunkcoding.net`.

![cf-tunnel-public-hello-app](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/cf-tunnel-public-hello-app.png)

3. Save the configuration. After saving, you should be able to access the **hello** application publicly via `hello.st24.dev`.

![hello-app-with-st24](/assets/az-11-private-aks-expose-public-app-with-cloudflare-tunnel/hello-app-with-st24.png)

## Secure The Application with EntraID SSO

### Config Cloudflare SSO with EntraID

### Create App Policy

## Conclusion

## Reference

- [Tunnel with firewall](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/deploy-tunnels/tunnel-with-firewall)

## Thank You

Thank you for taking the time to read this guide! We hope it has been helpful. Feel free to explore further, and happy coding! 🌟✨

**Steven** | _[GitHub](https://github.com/baoduy)_
