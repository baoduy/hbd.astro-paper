---
author: Steven Hoang
pubDatetime: 2023-09-25T02:00:00Z
title: "How drunkcoding.net is hosting on kubernetes clusters."
postSlug: how-drunkcoding-is-being-hosted
featured: false
draft: false
tags:
  - blog
  - kubernetes
  - high-availability
  - multi-region
  - cloudflare-tunnel
ogImage: ""
description: Let's take a look, how the website `drunkcoding.net` is hosted in high-availability mode across multiple Kubernetes clusters with utilizing the capabilities of Cloudflare Tunnel.
---

In the process of digital transformation, high availability is one of the key factors to ensure uninterrupted service. With this in mind, let's delve into the architecture of `drunkcoding.net`, which embraces this principle by operating in a high-availability mode. The system's robust deployment involves multiple Kubernetes clusters, a renowned open-source system designed to automate deployment, scaling, and management of containerized applications.

However, the efficacy not only relies on Kubernetes but also extensively benefits from Cloudflare Tunnel. Cloudflare Tunnel, a feature of Cloudflare's reliable and visionary network services, securely connects applications, servers, and other resources to the Cloudflare network.

Thus, the combination of Kubernetes clusters for container orchestration and the security provided by Cloudflare Tunnel results in impressive high-availability hosting for `drunkcoding.net`.

Through this guide, we aim to explore the specifics of this effective system architecture, gain insights into its working, and comprehend the factors contributing to its high uptime and resilience.

<hr/>

Thank you so much for your time, Really appreciate it!

Steven
[GitHub](<[https://github.com/baoduy](https://github.com/baoduy)>)
