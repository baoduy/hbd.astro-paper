---
author: Steven Hoang
pubDatetime: 2024-08-26T12:00:00Z
title: "[Tools] Automating Let's Encrypt Certificate Management with Azure Key Vault and Cloudflare"
postSlug: tools-automate-letsencrypt-certification-with-azure-keyvault
featured: true
draft: true
tags:
  - azure-key-vault
  - lets-encrypt
  - cloudflare
  - tools
description: "This post introduces a tool that automates the generation and renewal of Let's Encrypt certificates, importing them into Azure Key Vault. 
It detects certificates nearing expiration and only regenerates those, supporting multiple domains managed via Cloudflare. 
The tool runs as a monthly cron job on AKS, ensuring SSL certificates are always up to date without manual intervention."
---

## Introduction

Managing SSL certificates for Azure services like **Azure API Management** and **Azure Front Door** with custom domains can become complex and costly, especially in **development and sandbox environments**. To reduce these costs, I’ve developed a tool that leverages **Let’s Encrypt** certificates, which are free and automated, making them ideal for these non-production environments. This tool not only automates the generation of Let’s Encrypt certificates but also detects expiring certificates and renews only those, ensuring efficient management. The certificates are then securely imported into **Azure Key Vault** for use by Azure resources. Best of all, this tool runs as a monthly cron job on **Azure Kubernetes Service (AKS)**, simplifying the entire process.

## Why Automate Certificate Management?

SSL certificates are essential for securing Azure services like **Azure API Management** and **Azure Front Door** when using custom domains. However, managing certificates manually can be time-consuming and expensive, especially for non-production environments. Here’s why automating the process with Let’s Encrypt certificates makes sense:

- **Cost-Effective for Dev and Sandbox Environments**: Instead of paying for certificates in development environments, Let’s Encrypt offers a free solution that saves money while providing the same level of security.
- **Avoid Expired Certificates**: With this tool, you never have to worry about expired certificates, as it automatically renews those nearing expiration.
- **Multi-Domain Support**: This tool supports multiple domains managed via **Cloudflare**, handling DNS challenges seamlessly.
- **Seamless Integration with Azure Key Vault**: Newly generated certificates are automatically imported into Azure Key Vault for secure storage and integration with Azure resources.
- **Automated Monthly Renewal on AKS**: The tool runs as a cron job on **Azure Kubernetes Service (AKS)** every month, ensuring certificates are renewed automatically without manual intervention.

## How It Works

The tool is designed to run as a **monthly cron job** on AKS and automates the process of managing SSL certificates. It checks for certificates that are nearing expiration, generates new ones via **Let’s Encrypt**, and imports them into Azure Key Vault for secure use by resources like Azure API Management and Azure Front Door. Here’s the workflow:

1. **Check Expiration**: The tool scans all certificates in Azure Key Vault to check their expiration dates.
2. **Generate New Certificates**: For certificates nearing expiration, the tool generates a new SSL certificate using **Let’s Encrypt**.
3. **DNS Challenge via Cloudflare**: The tool integrates with **Cloudflare** to handle DNS challenges and validate ownership of each domain.
4. **Import to Azure Key Vault**: New certificates are imported into **Azure Key Vault**, replacing the old ones.
5. **Repeat Monthly**: The tool runs as a cron job on AKS every month, keeping your certificates up to date with minimal effort.

## Key Features

- **Cost-Efficient for Dev & Sandbox**: By using Let’s Encrypt certificates in development and sandbox environments, this tool helps save on certificate costs.
- **Automated Renewal**: The tool detects and renews only certificates that are close to expiration.
- **Multi-Domain Support**: Supports multiple domains managed by Cloudflare for DNS challenges.
- **Secure Storage**: All certificates are imported and stored securely in Azure Key Vault.
- **Monthly Cron Job on AKS**: The tool is deployed as a cron job on AKS, ensuring automated, regular certificate management.

## Configuration

The configuration is simple and managed via environment variables. Here’s an example `appsettings.json`:

```json
{
  "Cloudflare": {
    "Email": "your-cloudflare-email@example.com",
    "ApiToken": "your-cloudflare-api-token"
  },
  "AzureKeyVault": {
    "VaultUrl": "https://your-keyvault-url.vault.azure.net/",
    "ClientId": "your-azure-client-id",
    "TenantId": "your-azure-tenant-id",
    "ClientSecret": "your-azure-client-secret"
  },
  "Domains": [
    "example.com",
    "anotherdomain.com"
  ]
}
```

## Docker & AKS Deployment

This tool is containerized and easy to deploy as a **Docker image**. Here’s a sample `docker-compose.yml` for running the tool as a cron job on AKS:

```yaml
services:
  cert-renewal:
    image: baoduy2412/keyvault-letsencrypt:latest
    environment:
      Cloudflare__Email: "your-cloudflare-email@example.com"
      Cloudflare__ApiToken: "your-cloudflare-api-token"
      AzureKeyVault__VaultUrl: "https://your-keyvault-url.vault.azure.net/"
      AzureKeyVault__ClientId: "your-azure-client-id"
      AzureKeyVault__TenantId: "your-azure-tenant-id"
      AzureKeyVault__ClientSecret: "your-azure-client-secret"
    schedule: "0 0 1 * *" # Runs on the 1st of every month
```

## Resources

- **GitHub Repository**: [az-keyvault-letsencrypt](https://github.com/baoduy/az-keyvault-letsencrypt)
- **Docker Image**: [baoduy2412/keyvault-letsencrypt](https://hub.docker.com/r/baoduy2412/keyvault-letsencrypt)

## Conclusion

This tool simplifies the management of SSL certificates for Azure resources like Azure API Management and Azure Front Door with custom domains. By automating certificate generation with Let’s Encrypt, detecting certificates nearing expiration, and securely importing them into Azure Key Vault, it saves time and costs—especially in development and sandbox environments. Running as a monthly cron job on AKS, this tool ensures that your SSL certificates are always up to date without any manual intervention.

Give it a try and streamline your SSL certificate management!

<hr/>

Thank you for your time! If you have any further questions, feel free to ask. 🌟✨🎁

Steven
[GitHub](<[https://github.com/baoduy](https://github.com/baoduy)>)