---
author: Steven Hoang
pubDatetime: 2024-09-25T12:00:00Z
title: "[K8s] A Complete Series of Articles on Kubernetes Environment Locally"
featured: true
draft: false
tags:
  - k3s
  - kubernetes
  - picluster
description: "A concise series guiding you through setting up a local Kubernetes environment using K3s on Raspberry Pi 4 clusters. Learn how to install K3s, configure Nginx Ingress, implement SSL certificates with Cert-Manager and Cloudflare, and host applications like Outline VPN and Longhorn."
---

## Introduction

Welcome to our complete series of articles on building a local Kubernetes environment using K3s on Raspberry Pi 4 clusters. This series is designed to provide us with step-by-step guidance through practical examples.

We'll start by installing K3s, a lightweight version of Kubernetes that's perfect for devices like the Raspberry Pi. Then, we'll set up Nginx Ingress to manage network traffic and explore two ways to implement SSL certificates: using Cert-Manager and leveraging Cloudflare for a simpler approach.

Additionally, we'll learn how to expose our services to the internet without a static IP by using Cloudflare Tunnel. We'll also host applications like Outline VPN for secure connections and Longhorn for reliable, cloud-native storage solutions.

By the end of this series, we'll have a fully functional Kubernetes environment capable of running and managing complex applications, all from our local setup. Let's dive in and start this exciting journey together!


## Series of Articles

**[Day 01: Step-By-Step Guide: Installing K3s on a Raspberry Pi 4 Cluster](/posts/ks-01-install-k3s-on-pi-cluster/)**

In this guide, sharing some useful tips to help you seamlessly install K3s on a Raspberry Pi 4 cluster.
Let's dive in and start the installation process.

**[Day 02: Step-By-Step Guide: Installing Nginx Ingress on K3s Pi 4 Cluster](/posts/ks-02-install-nginx-on-pi-cluster/)**

This guide provides helpful tips for installing the Nginx Ingress on a K3s Raspberry Pi 4 cluster.
Detailed and step-by-step instructions will ensure a seamless installation process. Let's get started!

**[Day 03: Step-By-Step Guide: Installation of Cert-Manager, Implementing Free SSL Certificates for Kubernetes Clusters](/posts/ks-03-install-cert-manager-free-ssl-kubernetes-cluster)**

This comprehensive guide will help you to smoothly install Cert-Manager and implement free SSL certificates for Kubernetes clusters.
It is designed with step-by-step instructions to facilitate a seamless installation process. Dive in and let's begin this journey for enhanced security!

**[Day 04: Step-By-Step Guide: Cert-Manager Alternative with Cloudflare, Implementing Free SSL Certificates for Kubernetes Clusters](/posts/ks-04-cert-manager-alternative-with-cloudflare)**

We explore the concept of using a Cert-Manager Alternative with Cloudflare to implement free SSL Certificates for Kubernetes clusters.
This strategy leverages Cloudflare SSL certificates conjunction with the Kubernetes setup to provide a secure environment, replacing the need of Cert-Manager.
Discover how this approach simplifies the process, and enhances the security of our Kubernetes clusters.

**[Day 05: Step-By-Step Guide: Nginx Alternative with Cloudflare Tunnel, Enables services to internet a public static IP address](/posts/ks-05-public-services-with-cloudflare-tunnel)**

This robust solution provides a feasible alternative to Nginx when there's no public static IP address or port forwarding required.
This guide walks us through the process step by step, enabling the services online more efficiently.

**[Day 06: Step-By-Step Guide: Hosting Outline VPN on Kubernetes](/posts/ks-06-hosting-outline-vpn-kubernetes)**

Outline VPN, a comprehensive server and client software tool, is a free and open-source system developed by Google.
In this article, we will delve into the process of hosting Outline VPN on Kubernetes and outlining the steps to expose connection ports via NGINX.

**[Day 07: Step-By-Step Guide: Hosting Longhorn on K3s (ARM)](/posts/ks-07-hosting-longhorn-on-kubernetes)**

In this article, we will explore how to deploy Longhorn, a cloud-native distributed block storage system designed for Kubernetes on our K3s (ARM).
Longhorn is known for its lightweight, reliable, and open-source nature, which simplifies the process of adding persistent storage to Kubernetes clusters, making it easier to run stateful applications.

**[Day 08: To be continue...](/posts/ks-00-series-k8s-setup-local-env-pi-cluster)**

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven** | *[GitHub](https://github.com/baoduy)*
