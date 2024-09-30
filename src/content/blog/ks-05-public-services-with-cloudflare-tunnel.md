---
author: Steven Hoang
pubDatetime: 2023-09-18T00:00:00Z
title: "[k8s] Step-By-Step Guide: Nginx Alternative with Cloudflare Tunnel, Enables services to internet a public static IP address"
featured: false
draft: false
tags:
  - k3s
  - kubernetes
  - cloudflare
  - tunnel
ogImage: ""
description:
  This robust solution provides a feasible alternative to Nginx when there's no public static IP address or port forwarding required.
  This guide walks us through the process step by step, enabling the services online more efficiently.
---

In the previous articles we successfully:

1. [Install kubernetes cluster](/posts/ks-install-k3s-on-raspberry-pi-cluster).
2. [Install Ngix on cluster](/posts/ks-install-nginx-on-k3s-raspberry-pi-cluster).
3. [Install SSL for Ingress with Cert-Manager](/posts/ks-install-cert-manager-free-ssl-kubernetes-cluster) or with [Cloudflare SSL](/posts/ks-cert-manager-alternative-with-cloudflare).

However, to expose our services to the internet, it's essential to obtain a **Static Public IP Address** and configure the **router/firewall to open ports 80 and 443**.
If for any reason we're unable to meet these requirements, we won't be able to expose our services online.

In addition, if our organization relies on private Kubernetes on cloud platforms such as AKS, EKS, or GKS, and we wish to expose a select set of services to the internet
without jeopardizing security, we might consider using [Cloudflare Tunnel](https://www.cloudflare.com/products/tunnel/).

Let's delve into this topic further.

<img src="/assets/ks-public-services-with-cloudflare-tunnel/argo-tunnel-network-diagram-1024x491.png" width="600px">

## Cloudflare Tunnel Configuration

1. This guide assumes that we have followed the instructions from our [previous post](/posts/ks-install-cert-manager-free-ssl-kubernetes-cluster), and configured Cloudflare account with at least one onboarded domain.

2. The next step is to create a [Cloudflare Zero Trust Account](https://one.dash.cloudflare.com). While creating this account might require adding a payment method, please note that there are no charges for the first 50 users. You can proceed to register without any hesitation.

<img src="/assets/ks-public-services-with-cloudflare-tunnel/cloudflare-zero-trust-dashboard.png" width="600px">

2. Once logged in, navigate to **Access => Tunnel** and create a new tunnel. For the purposes of this guide, we'll name it `pi-k3s`. After creating the tunnel, make sure to copy the tunnel token that appears (similar to the one below):

```textmate
eyJhIjoiYWVlMGFjYzZiYejTkz....yzCfgm7oqfnhz2DrJDKyL8PBDr9hR5FvYgDR45TxPiAxbmVW=
```

3. Finally, ensure we click the Save button to confirm the creation of the tunnel.

## Kubernetes Tunnel Installation

1. Create cloudflare Namespace. It's a good practice to install the tunnel in its own namespace. Use this command:

```shell
kubectl create namespace cloudflare
```

2. Create the `cloudflare-tunnel.yaml` deployment file as below:

```shell
apiVersion: v1
kind: Secret
metadata:
  name: cloudflare-tunnel
  namespace: cloudflare
  labels:
    app: cloudflare-tunnel
type: Opaque
stringData:
  # the cloudflare tunnel token here
  token: 'eyJhIjoiYWVlMGFjYzZiYejTkz....yzCfgm7oqfnhz2DrJDKyL8PBDr9hR5FvYgDR45TxPiAxbmVW='
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cloudflare-tunnel
  namespace: cloudflare
  labels:
    app: tunnel
spec:
  replicas: 2
  selector:
    matchLabels:
      app: cloudflare-tunnel
  template:
    metadata:
      labels:
        app: cloudflare-tunnel
    spec:
      containers:
        - name: cloudflare-tunnel
          image: cloudflare/cloudflared:latest
          args:
            - tunnel
            - '--no-autoupdate'
            - run
            - '--token'
            - $(token)
          envFrom:
            - secretRef:
                name: cloudflare-tunnel
          resources:
            limits:
              cpu: 500m
              memory: 512Mi
            requests:
              cpu: 1m
              memory: 10Mi
          imagePullPolicy: Always
          securityContext:
            readOnlyRootFilesystem: true
      restartPolicy: Always
      terminationGracePeriodSeconds: 30
      dnsPolicy: ClusterFirst
      automountServiceAccountToken: false
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 25%
      maxSurge: 25%
  revisionHistoryLimit: 1
  progressDeadlineSeconds: 600
```

3. Install Cloudflare tunnel:

```shell
kubectl apply -f cloudflare-tunnel.yaml
```

4. Verify running pods after deployed.

![cloudflare-tunnel-pods.png](/assets/ks-public-services-with-cloudflare-tunnel/cloudflare-tunnel-pods.png)

5. Back to the Cloudflare Zero Trust the tunnel status should be in `Health` also.

![cloudflare-tunnel-status.png](/assets/ks-public-services-with-cloudflare-tunnel/cloudflare-tunnel-status.png)

## Exposing the Application to the Internet

1. Navigate to the tunnel configuration page. Under the 'Public Host' section, add a public host name to expose our `echo service` to the internet. See the example below.

Note: Kubernetes internal service URLs follow the convention: `http://{service-name}.{namespace}.svc.cluster.local`.

![Cloudflare Public Host Configuration](/assets/ks-public-services-with-cloudflare-tunnel/cloudflare-echo-service-config.png)

2. Verify the performance of the application by visiting `https://echo.drunkcoding.net`. The service should be accessible without any constraints.

3. I have established two endpoints as follows and conducted a load test using Postman.
   The results were astonishing as the Cloudflare tunnel delivered speeds even greater than direct access via Nginx.

- **echo-nginx.drunkcoding.net**: This endpoint provides access to the echo application through Nginx ingress and with a public IP address.
- **echo.drunkcoding.net**: This endpoint offers access to the echo application through the Cloudflare tunnel.

Please see the results in the attached image.
![load-test.png](/assets/ks-public-services-with-cloudflare-tunnel/load-test.png)

> Note: The cluster hosting this application is based in Singapore, while the test was conducted from a terminal in Vietnam.

## Concluding Remarks

Leveraging Cloudflare tunnels simplifies application exposure to the internet without the necessity of below:

- A public IP Address.
- Port forwarding.
- Firewall whitelisting.
- Nginx proxy/ingress.
- A Cert-manager or Cloudflare origin server certificate.

This results in a significantly simplified infrastructure setup.

---

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven**
[GitHub](https://github.com/baoduy)
