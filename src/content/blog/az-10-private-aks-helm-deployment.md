---
author: Steven Hoang
pubDatetime: 2025-01-01T12:00:00Z
title: "[Az] Day 10: Helm Deployment CI/CD Pipeline for a Private AKS Cluster."
featured: false
draft: false
tags:
  - AKS
  - Private
  - Pulumi
description: "In this article, we will dive deep into private AKS deployment using Helm, Key Vault and ACR for our private AKS cluster."
---

## Introduction

In the previous topic, We have successfully imported some docker images into pur private ACR. Based on that we will dive deep into the application Helm deployment for our private AKS.

## Table of Contents

## Prerequisites

- Have AzureDevOps permission to setup the service connection
- Have AKS admin permission to setup Service Account.

## AKS Service Account

Before dive into the helm deployment, We need to create an AKS service account that have permission on some of namespaces for deployment purposes.

