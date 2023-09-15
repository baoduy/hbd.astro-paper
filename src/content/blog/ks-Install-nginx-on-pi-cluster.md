---
author: Steven Hoang
pubDatetime: 2023-09-18T00:00:00Z
title: "Step-By-Step Guide: Installing Nginx Ingress on K3s Pi 4 Cluster"
postSlug: ks-install-nginx-on-k3s-raspberry-pi-cluster
featured: true
draft: false
tags:
  - k3s
  - kubernetes
  - raspberry cluster
  - pi cluster
  - nginx
ogImage: ""
description:
  This guide provides helpful tips for installing the Nginx Ingress on a K3s Raspberry Pi 4 cluster.
  Detailed and step-by-step instructions will ensure a seamless installation process. Let's get started!
---

# Step-By-Step Guide: Installing Nginx Ingress on K3s Pi 4 Cluster

In our [previous article](/posts/ks-install-k3s-on-raspberry-pi-cluster), we successfully set up a k3s Pi cluster. We will now build upon that foundation. Let's dive in!

![Cluster Diagram](/assets/ks-Install-k3s-on-pi-cluster/pi-cluster-diagram.svg)

- **pi-master**: 192.168.1.85 (Running Pi OS Lite 64Bit)
- **pi-node-1**: 192.168.1.86 (Running Pi OS Lite 64Bit)
- **pi-node-2**: 192.168.1.87 (Running Pi OS Lite 64Bit)

### Router Port Forwarding Setup.

In order to make the internal applications accessible via the internet, we need to set up port forwarding on our router.
This routing process will redirect internet requests coming to ports 80 and 443 to our master private IP node (192.168.1.85).

Please note, the configuration interface may vary among different routers. Nonetheless, most broadband routers should offer the same functionality pertaining to port forwarding.

![pi-cluster-port-forwarding-diagram.svg](/assets/ks-Install-nginx-on-pi-cluster/pi-cluster-port-forwarding-diagram.svg)

Here is my current configuration settings.

<img src="/assets/ks-Install-nginx-on-pi-cluster/router-port-forwarding-config.png" width="550px"/>

### Nginx installation

Thank you so much for your time, Really appreciate it!

Steven
[Github](<[https://github.com/baoduy](https://github.com/baoduy)>)
