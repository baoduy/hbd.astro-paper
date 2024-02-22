---
author: Steven Hoang
pubDatetime: 2024-02-29T00:00:00Z
title: "Step-By-Step Guide: Hosting Longhorn on K3s (ARM)"
postSlug: ks-hosting-longhorn-on-k3s-arm
featured: false
draft: false
tags:
  - k3s
  - kubernetes
  - longhorn
  - storage
ogImage: ""
description: "In this article, we will explore how to deploy Longhorn, a cloud-native distributed block storage system designed for Kubernetes on our K3s (ARM). 
Longhorn is known for its lightweight, reliable, and open-source nature, which simplifies the process of adding persistent storage to Kubernetes clusters, making it easier to run stateful applications."
---

As you know by default the kubernetes provide a **"local-path"** storage. However, this local storage has many limitation:

1. **Node Affinity**: When using local-path storage, the volume created is tied to the specific node where the pod runs.
   If that node goes down for maintenance or any other reason, the pods won’t be able to start on other nodes because they won’t find their volumes.

2. **Not Network Storage**: Local-path storage is not network-based. The volume remains local to the K3s node where the pod executes.
   It doesn't allow data sharing across nodes.

3. **Not Suitability for Production**: While local-path storage is suitable for small, single-node development clusters,
   it’s not recommended for production-grade multi-node clusters.

## What is Longhorn?

Longhorn, an innovative open-source project by **Rancher Labs**, offers a reliable, lightweight, and user-friendly distributed block storage system for Kubernetes.

1. **High Availability**: Longhorn replicates storage volumes across multiple nodes in the Kubernetes cluster,
   ensuring that data remains available even if a node fails.
2. **Cost-Effective**: Traditional external storage arrays can be expensive and non-portable. Longhorn offers a cost-effective,
   cloud-native solution that can run anywhere.
3. **Disaster Recovery**: Longhorn allows you to easily create a disaster recovery volume in another Kubernetes cluster and fail over to it in the event of an emergency.
   This ensures that your applications can quickly recover with a defined Recovery Point Objective (RPO) and Recovery Time Objective (RTO).

## Longhorn installation

Longhorn provides a straightforward method for installing the iSCSI driver and NFSv4 directly on all nodes. Follow the steps below to set up the necessary components.

1. **Installing open-iscsi**

   The open-iscsi package is a prerequisite for Longhorn to create distributed volumes that can be shared across nodes.
   Ensure that this driver is installed on all worker nodes within your cluster.

Execute the following command on your cluster to install the driver

```shell
# please check the latest release of the longhorn here https://github.com/longhorn/longhorn and update the version accordingly. Current version is v1.6.0
kubectl apply -f https://raw.githubusercontent.com/longhorn/longhorn/v1.6.0/deploy/prerequisite/longhorn-iscsi-installation.yaml
```

After deploying the iSCSI driver, confirm the status of the installer pods using the following command:

```shell
kubectl get pod | grep longhorn-iscsi-installation

# The result
longhorn-iscsi-installation-pdbgq   1/1     Running   0          21m
longhorn-iscsi-installation-qplbb   1/1     Running   0          39m
```

Additionally, review the installation logs to ensure successful deployment:

```shell
kubectl logs longhorn-iscsi-installation-pdbgq -c iscsi-installation

# The result
...
IProcessing triggers for libc-bin (2.35-0ubuntu3.6) ...
Processing triggers for man-db (2.10.2-1) ...
Processing triggers for initramfs-tools (0.140ubuntu13.1) ...
update-initramfs: Generating /boot/initrd.img-6.5.0-18-generic
iscsi install successfully
```

Once the iscsi installed successfully, Then you can safely uninstall the above with following command.

```shell
kubectl delete -f https://raw.githubusercontent.com/longhorn/longhorn/v1.6.0/deploy/prerequisite/longhorn-iscsi-installation.yaml
```

2. **Installing NFSv4 client**

   To enable Longhorn’s backup functionality and ensure proper operation, the NFSv4 client must be installed on the worker nodes within your cluster.

Follow these steps to set up the necessary components:

```shell
# please check the latest release of the longhorn here https://github.com/longhorn/longhorn and update the version accordingly. Current version is v1.6.0
kubectl apply -f https://raw.githubusercontent.com/longhorn/longhorn/v1.6.0/deploy/prerequisite/longhorn-nfs-installation.yaml
```

After deploying the NFSv4 client, confirm the status of the installer pods using the following command:

```shell
kubectl get pod | grep longhorn-nfs-installation

# The results
NAME                                  READY   STATUS    RESTARTS   AGE
longhorn-nfs-installation-mt5p7   1/1     Running   0          143m
longhorn-nfs-installation-n6nnq   1/1     Running   0          143m
```

And also can check the log with the following command to see the installation result:

```shell
kubectl logs longhorn-nfs-installation-mt5p7 -c nfs-installation

# The results
...
rpc-svcgssd.service is a disabled or a static unit, not starting it.
rpc_pipefs.target is a disabled or a static unit, not starting it.
var-lib-nfs-rpc_pipefs.mount is a disabled or a static unit, not starting it.
Processing triggers for man-db (2.10.2-1) ...
Processing triggers for libc-bin (2.35-0ubuntu3.6) ...
nfs install successfully
```

Once the NFSv4 installed successfully, Then you can safely uninstall the above with following command.

```shell
kubectl delete -f https://raw.githubusercontent.com/longhorn/longhorn/v1.6.0/deploy/prerequisite/longhorn-nfs-installation.yaml
```

3. **Installing Longhorn**

- Preparing the configuration `value.yaml` file

```yaml
csi:
  kubeletRootDir: "/var/lib/kubelet"
defaultSettings:
  diskType: "flesystem"
```

- Install Longhorn in the `longhorn-system` namespace with configuration above.

```shell
# 1. added longhorn chart
helm repo add longhorn https://charts.longhorn.io
helm repo update

# 2. Installing
helm install longhorn longhorn/longhorn -f value.yaml --namespace longhorn-system --create-namespace
```

Once installed successfully and all the pods are up and running.
You should be able to access Longhorn UI through the `longhorn-frontend` service (needs port-forward or expose through nginx or cloudflare tunnel).
<img src="/assets/ks-hosting-longhorn-on-kubernetes/longhorn-ui.png" width="600px">

4. **Uninstalling Longhorn**

   If any reason we would like to uninstall Longhorn helm then the below commands will help.

```shell
# Update `deleting-confirmation-flag` to allows uninstall longhorn
kubectl -n longhorn-system patch -p '{"value": "true"}' --type=merge lhs deleting-confirmation-flag
# Uninstall longhorn
helm uninstall longhorn -n longhorn-system
# Delete namespace
kubectl delete namespace longhorn-system
```

### Using the Longhorn storage with Mariadb

To explore Longhorn storage capabilities, we’ll set up a MariaDB Galera multi-primary database cluster for synchronous replication and high availability. Follow these steps:

```shell
# Setup chart repo
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Install mariadb-ha
helm install mariadb-ha bitnami/mariadb-galera \
   --set global.storageClass=longhorn \
   --set rootUser.password=Pass@word1 \
   --set galera.mariabackup.password=Password1 \
   --set db.name=drunk_db \
   --namespace db --create-namespace

# Uninstall mariadb-ha
helm uninstall mariadb-ha -n db
```

After deployed successful, you should find three MariaDB pods running in the `db` namespace:

```shell
kubectl get pod -n db

# The results
NAME                          READY   STATUS    RESTARTS   AGE
mariadb-ha-mariadb-galera-0   1/1     Running   0          5m6s
mariadb-ha-mariadb-galera-1   1/1     Running   0          3m44s
mariadb-ha-mariadb-galera-2   1/1     Running   0          2m41s
```

You’ll also find three persistent volumes in the Longhorn UI portal. !Longhorn Volumes
<img src="/assets/ks-hosting-longhorn-on-kubernetes/longhorn-volumes.png" width="600px">

<hr/>
Thank you for your time! If you have any further questions, feel free to ask. 🌟✨🎁

Steven
[GitHub](<[https://github.com/baoduy](https://github.com/baoduy)>)
