---
author: Steven Hoang
pubDatetime: 2025-01-01T12:00:00Z
title: "[Az] A Comprehensive Series of Articles on Setting Up a Private AKS Environment on Azure with Pulumi"
featured: true
draft: false
tags:
  - aks
  - private
  - pulumi
description: "In these series, I would like to share an ideas/options how to setup the entire private AKS environments on Azure using pulumi includes Virtual Network, Firewall, Private AKS to private Azure DevOps agents and Private CloudPC environment and How to expose some public applications through Cloudflare Tunnels."
---

## Introduction

As you know, setting entire private environments on Cloud is not an easy job and especially to manage the consistence between the environments (DEV, SANDBOX and PRD) are challenging.
In these series, I would like to share an ideas/options how to set up the entire private AKS environments on Azure using pulumi includes Virtual Network, Firewall, Private AKS to private Azure DevOps agents
and Private CloudPC environment and How to expose some public applications through Cloudflare Tunnels.

## Pulumi Account Setup

**[Day 01: Setup pulumi account and project](/posts/az-01-pulumi-setup-developer-account)**

Start your cloud journey with Pulumi by setting up your developer account and deploying your first Azure resources.
This guide walks you through creating a Pulumi account, installing the necessary CLI tools, and using TypeScript to manage Azure infrastructure as code.

## Private AKS Environments

**[Day 02: Designing the Private AKS Environment Architecture](/posts/az-02-pulumi-private-ask-env-architecture)**

In this tutorial, we will explore the design of a private AKS environment on Azure. We'll utilize multiple subnets, Azure Firewall, and other critical cloud services to construct a secure architecture.
This setup is designed to keep sensitive workloads isolated and shielded from exposure to the public internet.

**[Day 03: Secret Management and Centralized Log Monitoring on Azure](/posts/az-03-pulumi-private-ask-credential-log-management)**

In this guide, we’ll walk you through setting up a secure and scalable infrastructure on Azure by automating secret management using Azure Key Vault and centralized log monitoring with Log Analytics and Application Insights.

**[Day 04: Develops a Virtual Network Hub for Private AKS on Azure](/posts/az-04-pulumi-private-aks-hub-vnet-development)**

In this article, We'll walk through the process of developing the first Hub VNet for a private AKS environment using Pulumi.
We will demonstrate how to seamlessly integrate a VNet with an Azure Firewall, along with configuring outbound public IP addresses.

**[Day 05: Implementing Private AKS Clusters with Advanced Networking](/posts/az-05-pulumi-private-aks-cluster-env)**

In this tutorial, We'll build a private AKS cluster with advanced networking features.
We'll explore how to integrate the AKS cluster with the Hub VNet and apply the firewall policies we've created.

**[Day 06: Implements a private CloudPC and DevOps Agent Hub with Pulumi](/posts/az-06-pulumi-private-aks-cloudpc-hub)**

This tutorial guides us through setting up a secure CloudPC and DevOps agent hub, aimed at improving the management and operational capabilities of your private AKS environment using Pulumi.

## Progress Review

Let's take a moment to review our achievements. After completing six tutorials, we have successfully deployed our private AKS environment.
The illustration below provides a visual representation of our setup:
![aks-env](/assets/az-02-pulumi-private-ask-env-architecture/private-aks.png)
_Overview of private AKS env._

## CloudPC environment (Windows 365 enterprise)

**[Day 07: Setup Windows 365 Enterprise as a private VDI](/posts/az-07-setup-cloudpc-windows365-enterprise)**

In the next article, we will explore how to configure a CloudPC with Windows 365 Enterprise to establish a secure and efficient Virtual Desktop Infrastructure (VDI) for accessing a private AKS environment.

## Azure DevOps Pipelines

**[Day 08: Setting Up a Deployment Pipeline for Pulumi Projects.](/posts/az-08-pulumi-setup-deploy-cicd-pipeline)**

In the next article, We'll walk through creating a Continuous Integration and Continuous Deployment (CI/CD) pipeline on Azure DevOps for our Pulumi projects

**[Day 09: Docker Image Sync-up](/posts/az-06-pulumi-private-aks-cloudpc-hub)**

**[Day 10: Helm Deployment Pipeline](/posts/az-06-pulumi-private-aks-cloudpc-hub)**

## Public Apps with Cloudflare Tunnels

## Remote Development Environments with Microsoft Intune (MDM) and Cloudflare

## Conclusions

## Improvement

### Architect Improvement

### Project improvement

- Move some component to share the project
- Build the share project locally and commit the bin folder to Git repository for saving deployment time.

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven** | _[GitHub](https://github.com/baoduy)_
