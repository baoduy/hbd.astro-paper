---
author: Steven Hoang
pubDatetime: 2024-10-12T12:00:00Z
title: "[Az] A Comprehensive Series of Articles on Setting Up a Private AKS Environment on Azure with Pulumi."
featured: true
draft: false
tags:
  - AKS
  - Helm
  - CI/CD
  - AzureDevOps
  - Cloudflare
  - Tunnel
description: "In these series, Embark on a comprehensive journey to set up a fully private Azure Kubernetes Service (AKS) environment using Pulumi. This series guides you through the creation of Virtual Networks, configuration of Azure Firewalls, deployment of private AKS clusters, and integration with private Azure DevOps agents and a private CloudPC environment. Additionally, learn how to securely expose select applications to the public internet via Cloudflare Tunnels. Ideal for those aiming to build secure, scalable, and consistent environments across development, sandbox, and production stages."
---

## Introduction

Setting up a completely private environment in the cloud is a complex, especially when striving to maintain consistency across DEV, SANDBOX, and PRODUCTION environments. 
In this comprehensive series, I will share insights and strategies on how to establish an entirely private AKS environment on Azure using Pulumi.

We'll delve into:

- **Virtual Network Creation**: Building a secure network foundation for the environment.
- **Azure Firewall Configuration**: Implementing robust security measures to control network traffic.
- **Private AKS Cluster Deployment**: Setting up Kubernetes clusters that are isolated from the public internet.
- **Private Azure DevOps Agents**: Integrating continuous integration and deployment pipelines within a secure environment.
- **Private CloudPC Environment**: Establishing secure virtual desktop infrastructure for remote development using Windows 365 Enterprise.
- **Secure Application Exposure**: Using Cloudflare Tunnels to expose select internal applications to the public internet without compromising security.

This series aims to provide a step-by-step guide to help to build secure, scalable, and consistent private cloud environments on Azure. 
Whether you're a cloud architect, DevOps engineer, or developer, these articles will equip you with the knowledge to tackle the challenges of private cloud infrastructure.

## Table of Contents

## Pulumi Account Setup

**[Day 01: Setup pulumi account and project](/posts/az-01-pulumi-setup-developer-account)**

Start the cloud journey with Pulumi by setting up a developer account and deploying the first Azure resources.
This guide walks you through creating a Pulumi account, installing the necessary CLI tools, and using TypeScript to manage Azure infrastructure as code.

## Private AKS Environments

**[Day 02: Designing the Private AKS Environment Architecture](/posts/az-02-pulumi-private-ask-env-architecture)**

In this tutorial, We will explore the design of a private AKS environment on Azure. We'll use multiple subnets, Azure Firewall, and other critical cloud services to construct a secure architecture.
This setup is designed to keep sensitive workloads isolated and shielded from exposure to the public internet.

**[Day 03: Secret Management and Centralized Log Monitoring on Azure](/posts/az-03-pulumi-private-ask-credential-log-management)**

In this tutorial, walk us through the process of establishing a secure and automated system for secret management using Azure Key Vault. 
Additionally, we will cover how to implement centralized log monitoring using Azure Log Analytics and Application Insights, enhancing observability and operational efficiency.

**[Day 04: Develops a Virtual Network Hub for Private AKS on Azure](/posts/az-04-pulumi-private-aks-hub-vnet-development)**

In this tutorial, We'll walk through the process of developing the first Hub VNet for a private AKS environment using Pulumi.
We will demonstrate how to seamlessly integrate a VNet with an Azure Firewall, along with configuring outbound public IP addresses.

**[Day 05: Implementing Private AKS Clusters with Advanced Networking](/posts/az-05-pulumi-private-aks-cluster-env)**

In this tutorial, We'll build a private AKS cluster with advanced networking features.
We'll explore how to integrate the AKS cluster with the Hub VNet and apply the firewall policies we've created.

**[Day 06: Implements a private CloudPC and DevOps Agent Hub with Pulumi](/posts/az-06-pulumi-private-aks-cloudpc-hub)**

In this tutorial, guide us through setting up a secure CloudPC and DevOps agent hub, aimed at improving the management and operational capabilities of the private AKS environment using Pulumi.

## Progress Review After 06 Days

Let's take a moment to review our achievements. After completing six tutorials, we have successfully deployed our private AKS environment.
The illustration below provides a visual representation of our current environment after 6 days:
![aks-env](/assets/az-02-pulumi-private-ask-env-architecture/private-aks-day-06.png)
<p class="ml-44"><em>The illustration private AKS env</em></p>

## CloudPC environment (Windows 365 enterprise)

**[Day 07: Setup Windows 365 Enterprise as a private VDI](/posts/az-07-setup-cloudpc-windows365-enterprise)**

In this tutorial, We will explore how to configure a CloudPC with Windows 365 Enterprise to establish a secure and efficient Virtual Desktop Infrastructure (VDI) for accessing a private AKS environment.

## Azure DevOps Pipelines

**[Day 08: Setting Up a Deployment Pipeline for Pulumi Projects.](/posts/az-08-pulumi-setup-deploy-cicd-pipeline)**

In this tutorial, We will walk through creating a Continuous Integration and Continuous Deployment (CI/CD) pipeline on Azure DevOps for our Pulumi projects.

**[Day 09: Synchronizing Container Images to ACR for a Private AKS Cluster Using CI/CD Pipelines.](/posts/az-09-private-aks-acr-image-sync)**

In this tutorial, We explore the process of synchronizing container images with ACR for deployments in a private AKS cluster. 
We'll cover how to configure and automate this synchronization using CI/CD pipelines, ensuring seamless updates and secure image management for private AKS environments.

**[Day 10: Implementing a Helm Deployment CI/CD AzureDevOps Pipeline for a Private AKS Cluster.](/posts/az-10-private-aks-helm-deployment)**

In this tutorial, We will create Helm charts for nginx-ingress and cert-manager, and set up a robust CI/CD pipeline using Azure DevOps for Helm deployments to a private AKS cluster.

## Progress Review After 10 Days

Let's take a moment to review our achievements. After completing 10 tutorials, we have successfully deployed our internal ingress, cert-manager and private DNS Zone.
The illustration below provides a visual representation of our current environment:
![aks-env](/assets/az-02-pulumi-private-ask-env-architecture/private-aks-day-10.png)
<p class="ml-14"><em>The illustration of AKS env with private ingress and DNS Zone</em></p>

## Public Apps with Cloudflare Tunnels

**[Day 11: Exposing a Private AKS Application via Cloudflare Tunnel.](/posts/az-11-private-aks-expose-public-app-with-cloudflare-tunnel)**

In this tutorial, We demonstrate how to securely expose an application running on a private AKS cluster to the internet using Cloudflare Tunnel, without the need for public IP addresses or open ports. We'll also show how to apply authentication to all exposed applications and centralize access control using Azure Entra ID Groups, ensuring only authorized users have access.

## Microsoft Intune (MDM) Devices and Cloudflare Tunnel

_tobe continue..._

## Conclusions

Throughout this comprehensive series, we've journeyed through the intricate process of setting up a private AKS environment on Azure using Pulumi. 

Starting with the Pulumi account setup, we've built a secure and scalable infrastructure that includes Virtual Networks, Azure Firewall, private AKS clusters, and private Azure DevOps agents. 

Additionally, we delved into the integration of a private CloudPC environment and demonstrated secure application exposure through Cloudflare Tunnels.

- Upon completing all 12 tutorials, we have effectively established a unified private infrastructure. This setup includes private AKS clusters, Azure DevOps agents, and a CloudPC environment, all seamlessly integrated with Cloudflare Tunnels and Entra ID SSO. This ensures secure access for MDM Intune devices.
  ![private-aks-day-12](/assets/az-02-pulumi-private-ask-env-architecture/private-aks-day-12.png)

- Throughout this series, we developed a total of six Azure DevOps pipelines, as shown below:
   ![azure-devops-pipelines-overview](/assets/az-00-pulumi-private-aks-environments/azure-devops-pipelines-overview.png)

- In terms of expenses, we incurred approximately $200 in Azure resource costs, detailed in the analytics below:
    ![az-cost-analytics](/assets/az-00-pulumi-private-aks-environments/az-cost-analytics.png)

## Future Enhancements

As we reflect on our journey to establish a private AKS environment on Azure, there are several crucial areas that offer opportunities for enhancing performance, security, and scalability.

### Architectural Enhancements

- **Implement a Secure DMZ Network**: Establish a Demilitarized Zone (DMZ) to bolster security by isolating public-facing services like the Cloudflare Tunnel. Relocating the Cloudflare Tunnel outside the private AKS cluster and into the DMZ allows for better traffic management and monitoring, while protecting internal networks from direct exposure. Utilizing Azure Virtual Machine Scale Sets for services in the DMZ will enable automatic scaling of workloads, ensuring efficient resource utilization and enhanced security.

- **Refine Firewall Rules**: Enhance the firewall configurations with more granular rules, specifically tailored for the services operating within the DMZ. Restrict access by employing precise IP ranges and protocols, ensuring that only legitimate and necessary traffic is permitted, thereby improving security.

- **Leverage Auto-Scaling for Private Agents**: Optimize resource usage by employing Azure Virtual Machine Scale Sets to automatically adjust the number of private Azure DevOps agents based on demand. This approach not only ensures high availability during peak workloads but also conserves resources during periods of inactivity.

### Project Enhancements

- **Modularize Shared Components**: Increase maintainability and reusability by extracting shared components into separate, modular projects. This strategy fosters consistency and streamlines updates across various environments, reducing the complexity and risk of manual changes.

- **Optimize Build Processes with Pre-Built Binaries**: Accelerate deployment by pre-building shared components' binaries locally and committing them to the repository. This practice minimizes deployment times by avoiding repeated builds in CI/CD pipelines, leading to faster and more reliable integration and delivery processes.

By pursuing these enhancements, we aim to strengthen the security, efficiency, and scalability of our private AKS environment. Implementing these improvements will better prepare our infrastructure to meet emerging challenges and support continued business growth.

## References

The complete source code for this series is available on my [GitHub repository](https://github.com/baoduy/drunk-azure-pulumi-articles). 
Feel free to clone the repository and contribute by submitting pull requests or raising issues.

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven** | _[GitHub](https://github.com/baoduy)_
