---
author: Steven Hoang
pubDatetime: 2023-09-16T00:00:00Z
title: "[k8s] Step-By-Step Guide: Installing Nginx Ingress on K3s Pi 4 Cluster"
featured: false
draft: false
tags:
  - k3s
  - kubernetes
  - picluster
  - nginx
ogImage: ""
description:
  This guide provides helpful tips for installing the Nginx Ingress on a K3s Raspberry Pi 4 cluster.
  Detailed and step-by-step instructions will ensure a seamless installation process. Let's get started!
---

In our [previous article](/posts/ks-install-k3s-on-raspberry-pi-cluster), we successfully set up a k3s Pi cluster. We will now build upon that foundation. Let's dive in!

<img src="/assets/ks-Install-k3s-on-pi-cluster/pi-cluster-diagram.png" width="600px">

- **pi-master**: 192.168.1.85 (Running Pi OS Lite 64Bit)
- **pi-node-1**: 192.168.1.86 (Running Pi OS Lite 64Bit)
- **pi-node-2**: 192.168.1.87 (Running Pi OS Lite 64Bit)

### Router Port Forwarding Setup.

In order to make the internal applications accessible via the internet, we need to set up port forwarding on our router.
This routing process will redirect internet requests coming to ports 80 and 443 to our master private IP node (192.168.1.85).

Please note, the configuration interface may vary among different routers. Nonetheless, most broadband routers should offer the same functionality pertaining to port forwarding.

<img src="/assets/ks-Install-nginx-on-pi-cluster/pi-cluster-port-forwarding-diagram.png" width="600px">

Here are my current router settings.

<img src="/assets/ks-Install-nginx-on-pi-cluster/router-port-forwarding-config.png" width="550px"/>

---

### Nginx installation

We're going to start by installing Nginx on our cluster. In the following guide, we will illustrate how to set up and run Nginx on K3s.
At its core, Nginx will listen to inbound requests on the master node's IP address and subsequently forward these requests to the services operating within our cluster.

<img src="/assets/ks-Install-nginx-on-pi-cluster/pi-cluster-nginx-diagram.png" width="600px">

**1. Config Ip address**

Helm charts come with a file called `values.yaml` which contains the default configuration values.
We can override these values by creating your own values.yaml file. Here is an example:

```yaml
# Refer to line 434 here for details
# https://github.com/kubernetes/ingress-nginx/blob/main/charts/ingress-nginx/values.yaml

controller:
  service:
    # Our primary node ip address here.
    # Do remember replacing this ip address with your once accordingly.
    loadBalancerIP: "192.168.1.85"
```

**2. Download the Helm chart:**

Download the Nginix helm chart. You can do this by adding the Nginx repo to the Helm. Run the following commands:

```shell
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
```

**3. Create namespace**

```shell
kubectl create namespace nginx-ingress
```

**4. Install the Helm chart:**

Now you can install the Helm chart using your custom values.yaml file to override the default configuration values. Run the following command:

```shell
helm install nginx ingress-nginx/ingress-nginx --values values.yaml -n nginx-ingress
```

**5. Verify nginx pod:**

After installed successfully, we should be able to find a pod running there:
![nginx-installed-successfully.png](/assets/ks-Install-nginx-on-pi-cluster/nginx-installed-successfully.png)

### Nginx Verification

**1. Deploy the echo application:**

You can deploy an echo server application using a simple Kubernetes deployment and service.
The echo server will respond with the same request it receives.

Here is a sample YAML file you can use:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: echo-deployment
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: echo
  template:
    metadata:
      labels:
        app: echo
    spec:
      containers:
        - name: echo
          image: ealen/echo-server
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: echo-service
  namespace: default
spec:
  ports:
    - port: 80
  selector:
    app: echo
```

Save this YAML into a file, let's say `echo-app.yaml`, and apply it to `default` namespace (_using `default` namespace in Production is not recommended_):

```shell
kubectl apply -f echo-app.yaml -n default
```

2. Create an ingress rule:

Now that your echo server is running, you can create an ingress rule to route traffic to it.

Here is a sample ingress YAML:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: echo-ingress
  namespace: default
spec:
  ingressClassName: nginx
  rules:
    # Replace the domain below with your domain accordingly.
    - host: echo.drunkcoding.net
      http:
        paths:
          - pathType: Prefix
            path: "/"
            backend:
              service:
                name: echo-service
                port:
                  number: 80
```

**3. Update your domain DNS**

To ensure you can access from the internet, you need to point a domain to your public address.

Here is my `drunkcoding.net` DNS configuration on Cloudflare for reference purposes.
![drunkcoding-cloudflare-dns.png](/assets/ks-Install-nginx-on-pi-cluster/drunkcoding-cloudflare-dns.png)

After all these configurations now we should be able to access your application hosting on our k3s cluster from the internet.
When accessing to `http://echo.drunkcoding.net` you able to see the JSON response from the echo pod as below.

![echo-app-response.png](/assets/ks-Install-nginx-on-pi-cluster/echo-app-response.png)

---

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven**
[GitHub](<[https://github.com/baoduy](https://github.com/baoduy)>)
