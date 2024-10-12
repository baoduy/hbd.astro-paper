---
author: Steven Hoang
pubDatetime: 2024-08-26T12:00:00Z
title: "[Tools] Automating Let's Encrypt Certificate Management with Azure Key Vault and Cloudflare"
postSlug: tools-automate-letsencrypt-certification-with-azure-keyvault
featured: false
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

Custom domain names enhance the professionalism and credibility of applications hosted on Azure services.
However, associating a custom domain requires a trusted SSL/TLS certificate. For **development and sandbox environments**
used internally by development teams, leveraging **Let's Encrypt** certificates offers a convenient and automated solution.
Let's Encrypt provides free SSL certificates, but they have a short lifespan of only 90 days, necessitating frequent renewals.

To streamline this process, I've developed a tool that automates the generation and renewal of Let's Encrypt certificates specifically for development
and sandbox environments. The tool detects expiring certificates and renews only those that are nearing expiration, ensuring efficient management.
The new certificates are securely imported into **Azure Key Vault**, allowing seamless integration with Azure resources such as **Azure API Management**
and **Azure Front Door**. To eliminate manual intervention entirely, the tool runs as a monthly cron job on **Azure Kubernetes Service (AKS)**.

## Why Automate Certificate Management?

Manually managing short-lived Let's Encrypt SSL certificates can be time-consuming and error-prone, especially when dealing with multiple domains
and environments. Automating the certificate management process offers several significant advantages:

- **Cost Savings for Development and Sandbox Environments**: Let's Encrypt provides a free alternative to paid certificates,
  making it ideal for non-production environments where cost optimization is important.

- **Elimination of Certificate Expiration Concerns**: The tool proactively identifies and renews certificates nearing expiration,
  ensuring your services remain secure without requiring manual intervention.

- **Simplified Management of Multiple Domains**: With built-in support for handling multiple domains via **Cloudflare**,
  the tool streamlines the process of managing DNS challenges required for certificate validation.

- **Secure Integration with Azure Key Vault**: Automatically importing generated certificates into Azure Key Vault provides a secure
  and centralized storage solution, enhancing overall security and simplifying certificate management across your Azure resources.

## How It Works

The tool automates SSL certificate management by running as a **monthly cron job** on AKS. It handles the entire lifecycle of SSL certificates, from detection of impending expiration to deployment of new certificates. The workflow is as follows:

1. **Check Certificate Expiration**: The tool scans all certificates stored in Azure Key Vault to determine their expiration dates.

2. **Generate New Certificates**: For certificates nearing expiration, the tool requests new SSL certificates from **Let's Encrypt**.

3. **DNS Challenge via Cloudflare**: The tool integrates with **Cloudflare** to perform DNS challenges required by Let's Encrypt to validate domain ownership.

4. **Import Certificates to Azure Key Vault**: The newly obtained certificates are securely imported into **Azure Key Vault**, replacing the old certificates.

5. **Automated Monthly Execution**: The tool is scheduled to run monthly on AKS, ensuring that certificates are kept up-to-date with minimal manual effort.

## Setting Up Cloudflare DNS API Token

To enable the tool to perform DNS challenges for domain validation, you need to create a Cloudflare API token with permissions to manage DNS records.

1. **Create an API Token**:

   - Log in to your Cloudflare account and navigate to your profile.
   - Go to the **API Tokens** section or directly via [this link](https://dash.cloudflare.com/profile/api-tokens).
   - Click on **"Create Token"**.

2. **Configure Token Permissions**:

   - **Permissions**: Grant **Zone** > **DNS** > **Edit** permissions.
   - **Zone Resources**: Select **Specific Zone** and choose the domain(s) you want to manage.

3. **Client IP Address Filtering (Optional but Recommended)**:

   - For enhanced security, specify the AKS cluster's public IP address under **"Client IP Address Filtering"** in the token settings.
   - This restricts API token usage to requests originating from your AKS cluster, preventing unauthorized access.

4. **Save the Token**:

   - Generate the token and copy it. You'll need it for the tool's configuration.

![Cloudflare API Token Creation](/assets/tools-aks-cert-manager-with-private-aks/cf-dns-token.png)

## Configuration

The tool is configured using environment variables or a JSON configuration file. Here's an example `appsettings.json` file:

```json
{
  "CertManager": {
    "ProductionEnabled": true,
    "CfEmail": "your-cloudflare-email@example.com",
    "CfToken": "YOUR_CLOUDFLARE_API_TOKEN",
    "ZoneId": "YOUR_CLOUDFLARE_ZONE_ID",
    "LetsEncryptEmail": "your-email@example.com",
    "Domains": ["api.example.com", "*.example.com"],
    "CertInfo": {
      "CountryName": "SG",
      "State": "Singapore",
      "Locality": "Singapore",
      "Organization": "YourOrganization",
      "OrganizationUnit": "YourUnit"
    },
    "KeyVaultUrl": "https://your-keyvault-name.vault.azure.net/",
    "KeyVaultUID": "OPTIONAL_USER_ASSIGNED_IDENTITY_CLIENT_ID"
  }
}
```

**Configuration Parameters Explained**:

- **ProductionEnabled**: Set to `true` to use Let's Encrypt production environment. Set to `false` for testing purposes.

- **CfEmail**: Your Cloudflare account email address.

- **CfToken**: The Cloudflare API token created earlier.

- **ZoneId**: The ID of your Cloudflare DNS zone. You can find this in your Cloudflare dashboard under the domain's **Overview** section.

- **LetsEncryptEmail**: An email address for Let's Encrypt notifications.

- **Domains**: An array of domains and subdomains for which you want to generate certificates.

- **CertInfo**: Certificate subject information.

- **KeyVaultUrl**: The URL of your Azure Key Vault where certificates will be stored.

- **KeyVaultUID**: The Client ID of the User Assigned Managed Identity (UAMI) used by your AKS cluster (optional if using the default identity).

## Deploying to AKS

### Prerequisites

- An AKS cluster where the tool will run.

- The AKS cluster's agent pool has a User Assigned Managed Identity (UAMI) for Azure resource authentication.

- Access to the Azure Key Vault where certificates will be stored.

### Granting Key Vault Access to AKS UAMI

Before deploying the tool, you need to grant your AKS cluster's UAMI the necessary permissions to access Azure Key Vault:

1. **Identify the AKS Agent Pool UAMI**:

   - In the Azure portal, navigate to your AKS cluster.
   - Under **Settings**, select **Identity**.
   - Note the **Client ID** of the **User Assigned** identity associated with your node pools.

![AKS User Assigned Managed Identity](/assets/tools-automate-letsencrypt-certification-with-azure-keyvault/aks-uaid.png)

2. **Grant Key Vault Permissions**:

   - Navigate to your Azure Key Vault.
   - Select **Access control (IAM)**.
   - Click on **"Add role assignment"**.
   - In the **Role** dropdown, select **"Key Vault Certificates Officer"**.
   - Click **Next** and select the AKS UAMI as the **Member**.
   - Review and assign the role.

By granting the **Key Vault Certificates Officer** role to your AKS UAMI, you allow the tool running on AKS to manage certificates within the Key Vault.

### Deploying the Tool Using Helm

Assuming you are using Helm for deployment, you can update your Helm chart values file with the necessary configurations.

Here's an example `values.yaml` file:

```yaml
services:
  cert-renewal:
    image: baoduy2412/keyvault-letsencrypt:latest
    environment:
      CertManager__ProductionEnabled: "true"
      CertManager__CfEmail: "your-cloudflare-email@example.com"
      CertManager__CfToken: "YOUR_CLOUDFLARE_API_TOKEN"
      CertManager__ZoneId: "YOUR_CLOUDFLARE_ZONE_ID"
      CertManager__LetsEncryptEmail: "your-email@example.com"
      CertManager__Domains__0: "api.example.com"
      CertManager__Domains__1: "*.example.com"
      CertManager__CertInfo__CountryName: "SG"
      CertManager__CertInfo__State: "Singapore"
      CertManager__CertInfo__Locality: "Singapore"
      CertManager__CertInfo__Organization: "YourOrganization"
      CertManager__CertInfo__OrganizationUnit: "YourUnit"
      CertManager__KeyVaultUrl: "https://your-keyvault-name.vault.azure.net/"
      CertManager__KeyVaultUID: "OPTIONAL_USER_ASSIGNED_IDENTITY_CLIENT_ID"
    schedule: "0 0 1 * *" # Runs on the 1st of every month at midnight
```

**Notes**:

- **Image**: Ensure you're using the correct Docker image.

- **Environment Variables**: Update all placeholders with your actual configuration values.

- **Schedule**: The cron expression `"0 0 1 * *"` schedules the job to run at midnight on the first day of every month.

### Deploying the Helm Chart

1. **Update Helm Repositories**:

   ```bash
   helm repo update
   ```

2. **Deploy or Upgrade the Chart**:

   ```bash
   helm upgrade --install cert-renewal ./path-to-your-chart -f values.yaml
   ```

Replace `./path-to-your-chart` with the path to your Helm chart.

## Conclusion

Managing SSL certificates for Azure resources with custom domains can be challenging due to the frequent renewal requirements of Let's Encrypt certificates. This tool automates the entire process of certificate generation, validation, and deployment, significantly simplifying SSL certificate management for development and sandbox environments.

By running as a monthly cron job on AKS, it ensures that your certificates are always up-to-date without manual intervention. The integration with Azure Key Vault enhances security by providing centralized and secure storage of your certificates, which can be accessed by other Azure services as needed.

**Leveraging Infrastructure as Code for Deployment**

Once the certificates are stored in Azure Key Vault, you can further automate the deployment process by using infrastructure as code (IaC) tools like Pulumi or Terraform.
These tools can retrieve the certificates from Key Vault and deploy them to your Azure resources automatically.
By incorporating this into your IaC pipelines, you ensure that any updates to the certificates are seamlessly propagated to services like Azure API Management, Azure Front Door, or Azure Application Gateway, maintaining consistent and secure configurations across your infrastructure.

**Key Benefits**:

- **Automated Renewal**: Eliminates the manual effort required to renew Let's Encrypt certificates every 90 days.

- **Cost Efficiency**: Uses free Let's Encrypt certificates, reducing costs for non-production environments.

- **Scalability**: Easily manages multiple domains and environments.

- **Security**: Securely stores certificates in Azure Key Vault and restricts Cloudflare API access to your AKS cluster.

Give it a try and simplify your SSL certificate management process!

---

**Resources**:

- **GitHub Repository**: [az-keyvault-letsencrypt](https://github.com/baoduy/az-keyvault-letsencrypt)
- **Docker Image**: [baoduy2412/keyvault-letsencrypt](https://hub.docker.com/r/baoduy2412/keyvault-letsencrypt)

---

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven** | *[GitHub](https://github.com/baoduy)*
