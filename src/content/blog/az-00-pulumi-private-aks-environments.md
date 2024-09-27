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
description: ""
---

## Introduction

As you know setting entire private environments on Cloud is not a easy jobs and especially to mange the consistence between the environments (DEV, SANDBOX and PRD) is challenging.
In these series I would like to share an ideas/options how to setup the entire private AKS environments on Azure using pulumi includes Virtual Network, Firewall, Private AKS to private Azure DevOps agents
and Private CloudPC environment and How to expose some public applications through Cloudflare Tunnels

---

## Pulumi Account Setup

### [Day 01: Setup pulumi account and project](/posts/az-01-pulumi-setup-developer-account)

Start your cloud journey with Pulumi by setting up your developer account and deploying your first Azure resources.
This guide walks you through creating a Pulumi account, installing the necessary CLI tools, and using TypeScript to manage Azure infrastructure as code.

## Private AKS Environments

### [Day 02: Private AKS Environment Architecture.](/posts/az-02-pulumi-private-ask-env-architecture)

This post explains a the architecture of private AKS that we are going to setup on Azure, leveraging multiple subnets, Azure Firewall, and other essential cloud services.
This architecture ensures that sensitive workloads remain isolated and protected from public internet exposure.

## Azure DevOps Private Agent and Pipeline

## Public Apps with Cloudflare Tunnels

## CloudPC environment (Windows 365 enterprise)

## Remote Development Environments with Intune (MDM) and Cloudflare

## Conclusions

---

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven**
[GitHub](<[https://github.com/baoduy](https://github.com/baoduy)>)
