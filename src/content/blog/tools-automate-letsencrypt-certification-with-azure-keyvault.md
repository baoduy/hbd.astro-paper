---
author: Steven Hoang
pubDatetime: 2024-08-26T12:00:00Z
title: "[Tools] Automating Let's Encrypt Certificate Management with Azure Key Vault and Cloudflare"
postSlug: tools-automate-letsencrypt-certification-with-azure-keyvault
featured: true
draft: false
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

Many services on Azure allow us to customize the domain name, which requires providing a trusted certificate.
For **development and sandbox environments** used by internal development teams, leveraging **Let's Encrypt** certificates provides a convenient and automated solution.
However, Let's Encrypt certificates have a short lifespan of only three months, necessitating frequent renewals.

To address this, I've developed a tool that automates the generation and renewal of Let's Encrypt certificates specifically for these dev and sandbox environments.
It detects expiring certificates and renews only those, ensuring efficient management.
The certificates are then securely imported into **Azure Key Vault** for seamless integration with Azure resources.
To further simplify the process, this tool runs as a monthly cron job on **Azure Kubernetes Service (AKS)**, eliminating the need for manual intervention.

## Why Automate Certificate Management?

Manually managing short-lived Let's Encrypt SSL certificates for Azure services like **Azure API Management** and **Azure Front Door** can be a cumbersome process, particularly when dealing with multiple resources across various environments.
Automating the certificate management process using Let's Encrypt certificates offers several significant advantages:

- **Cost Savings for Dev and Sandbox Environments**: Let's Encrypt provides a free alternative to paid certificates, making it an ideal solution for development and sandbox environments where cost optimization is paramount.
- **Eliminates Certificate Expiration Concerns**: This tool proactively identifies and renews certificates that are nearing expiration, ensuring your services remain secure without requiring manual intervention.
- **Seamless Handling of Multiple Domains**: With built-in support for managing multiple domains through **Cloudflare**, this tool streamlines the process of handling DNS challenges for certificate validation.
- **Secure Integration with Azure Key Vault**: Generated certificates are automatically imported into Azure Key Vault, providing a secure and centralized storage solution that seamlessly integrates with your Azure resources, enhancing overall security and ease of management.

## Resources

I have developed a small tool here that can help pus to automate this process.

- **GitHub Repository**: [az-keyvault-letsencrypt](https://github.com/baoduy/az-keyvault-letsencrypt)
- **Docker Image**: [baoduy2412/keyvault-letsencrypt](https://hub.docker.com/r/baoduy2412/keyvault-letsencrypt)

## How It Works

The tool is designed to run as a **monthly cron job** on AKS and automates the process of managing SSL certificates. It checks for certificates that are nearing expiration, generates new ones via **Let’s Encrypt**, and imports them into Azure Key Vault for secure use by resources like Azure API Management and Azure Front Door. Here’s the workflow:

1. **Check Expiration**: The tool scans all certificates in Azure Key Vault to check their expiration dates.
2. **Generate New Certificates**: For certificates nearing expiration, the tool generates a new SSL certificate using **Let’s Encrypt**.
3. **DNS Challenge via Cloudflare**: The tool integrates with **Cloudflare** to handle DNS challenges and validate ownership of each domain.
4. **Import to Azure Key Vault**: New certificates are imported into **Azure Key Vault**, replacing the old ones.
5. **Repeat Monthly**: The tool runs as a cron job on AKS every month, keeping your certificates up to date with minimal effort.

## Generate Cloudflare DNS Api Token

First, navigate to the Cloudflare profile and create an API token by following [this link](https://dash.cloudflare.com/profile/api-tokens). The API token should have permissions to manage DNS records for the domains.

Additionally, for enhanced security, specify the AKS public IP address under `Client IP Address Filtering` in Cloudflare. This ensures that the API token is only accessible from the AKS platform, preventing unauthorized access from other locations.
<img src="/assets/aks-cert-manager-with-private-aks/cf-dns-token.png">

## Configuration

The configuration is simple and managed via environment variables. Here’s an example `appsettings.json`:

```json
{
  "CertManager": {
    "ProductionEnabled": true,
    "CfEmail": "your-cf-email@example.com",
    "CfToken": "YOUR DNS ZONE TOKEN",
    "ZoneId": "YOUR CLOUDFLARE ZONE ID",
    "LetsEncryptEmail": "your-cf-email@example.com",
    "Domains": ["api.example.com", "*.example.com"],
    "CertInfo": {
      "CountryName": "SG",
      "State": "Singapore",
      "Locality": "Singapore",
      "Organization": "drunkcoding",
      "OrganizationUnit": "DC"
    },
    "KeyVaultUrl": "YOUR_AZURE_KEY_VAULT_URL",
    "KeyVaultUID": "optional: your user assigned id"
  }
}
```

## Deploy to AKS

Before go to deploy the tool to our AKS cluster. We need to provide the Key Vault Certificate Permission to the `AKS Agent Pool User Assigned Identity`, As you know for each AKS on Azure it should be there an `User Assigned Identity` (UAID) for the agent pool and all the pods using this UIAD for azure resources authentication. 
<img src="/assets/tools-automate-letsencrypt-certification-with-azure-keyvault/aks-uaid.png">

Navigate to the Key Vault where you would like to store the generation certificates and then go to `Access control(IAM)` add role assignment select `Key Vault Certificates Officer` click next and select member is the agent pool UAID above. then click Review + assign. Afte this steps we have siccessfully grant the permission to AKS UAID.

The next step is update the helm chart and deploy the tool
Here is the sample of the `value.yalm` file.

```yaml
services:
  cert-renewal:
    image: baoduy2412/keyvault-letsencrypt:latest
    environment:
      CertManager__ProductionEnabled: "true"
      CertManager__CfEmail: "your-cf-email@example.com"
      CertManager__CfToken: "YOUR DNS ZONE TOKEN"
      CertManager__ZoneId: "YOUR CLOUDFLARE ZONE ID"
      CertManager__LetsEncryptEmail: "your-cf-email@example.com"
      CertManager__Domains__0: "api.example.com"
      CertManager__Domains__1: "*.example.com"
      CertManager__CertInfo__CountryName: "SG"
      CertManager__CertInfo__State: "Singapore"
      CertManager__CertInfo__Locality: "Singapore"
      CertManager__CertInfo__Organization: "drunkcoding"
      CertManager__CertInfo__OrganizationUnit: "DC"
      CertManager__KeyVaultUrl: "YOUR_AZURE_KEY_VAULT_URL"
      CertManager__KeyVaultUID: "optional: your user assigned id"
    schedule: "0 0 1 * *" # Runs on the 1st of every month
```

## Conclusion

Managing SSL certificates for Azure resources such as Azure API Management and Azure Front Door with custom domains is made effortless with this tool. It automates the entire process of certificate generation using Let’s Encrypt, monitors for certificates nearing expiration, and securely imports them into Azure Key Vault. This not only saves time and reduces costs but also ensures that your certificates are always current, particularly in development and sandbox environments. By running as a monthly cron job on AKS, it eliminates the need for manual intervention.

Try it out and simplify your SSL certificate management!

<hr/>

Thank you for your time! If you have any further questions, feel free to ask. 🌟✨🎁

Steven
[GitHub](<[https://github.com/baoduy](https://github.com/baoduy)>)
