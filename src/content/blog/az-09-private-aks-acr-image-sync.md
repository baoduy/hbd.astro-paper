---
author: Steven Hoang
pubDatetime: 2025-01-01T12:00:00Z
title: "[Az] Day 09: Synchronizing Container Images to ACR for a Private AKS Cluster Using CI/CD Pipelines."
featured: false
draft: false
tags:
  - AKS
  - Private
  - Pulumi
description: "In this article, we explore the process of synchronizing container images with ACR for deployments in a private AKS cluster. We'll cover how to configure and automate this synchronization using CI/CD pipelines, ensuring seamless updates and secure image management for private AKS environments."
---

## Introduction

Deploying applications in a private AKS cluster presents unique challenges, especially when the cluster lacks direct internet access.
In such environments, the cluster cannot pull container images from public registries like Docker Hub or Quay.io.
Instead, all container images must be sourced from a private ACR accessible within the cluster's network.

To address this, we need a robust solution that not only synchronizes required images into the ACR but also integrates with Continuous Integration/Continuous Deployment (CI/CD) pipelines and adheres to Software Development Life Cycle (SDLC) best practices.
This ensures that all images are reviewed and approved before being imported, enhancing security and compliance.

## Implementation

By leveraging Azure DevOps CI/CD pipelines, we can automate the public image importing process as below.

### 1. Image Configuration File

The `images.txt` file lists all the container images that need to be imported into the private ACR.

Each line specifies the source image and the destination repository within the ACR, separated by `=>`. This format allows for easy maintenance and review of the images being imported.

<details><summary><em>Example <code>images.txt</code></em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/image-sync-pipeline/images.txt#1-7)

</details>

- **Source Image:** The full path to the image in the public registry, including the tag.
- **Destination Repository:** The repository path within the ACR where the image will be imported.
- **Comments:** Lines starting with `#` are treated as comments and ignored by the script.

### 2. Synchronization Script

The `sync-script.sh` script automates the process of importing images listed in `images.txt` into the ACR. It reads each line of the configuration file, processes the source and destination information, and uses the Azure CLI to import the images.

<details><summary><em>View code</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/image-sync-pipeline/sync-script.sh#1-55)

</details>

### 3. Azure Pipeline

To streamline the synchronization process, we utilize a CI/CD pipeline. This pipeline is designed to automatically execute the synchronization script whenever there are updates to the `images.txt` file, ensuring that all container images in the ACR remain current.

<details><summary><em>View code</em></summary>

[inline](https://github.com/baoduy/drunk-azure-pulumi-articles/blob/main/image-sync-pipeline/image-sync.azure-pipelines.yml#1-26)

</details>

**Important Considerations:**

- The `image-sync` variable group contains the `DOCKER_NAME` and `DOCKER_TOKEN`, which are essential for accessing Docker Hub and avoiding rate limits.
- Substitute `azureSubscription` with your specific Azure service connection name in Azure DevOps.
- Replace `acrName` with the actual name of your Azure Container Registry.
- Verify that the service principal linked to the Azure service connection has the necessary permissions to import images into the ACR.

![az-devops-sync-pipeline](/assets/az-09-private-aks-acr-image-sync/az-devops-sync-pipeline.png)

Once the pipeline completes successfully, you can verify that all images have been correctly imported into the ACR.
![acr-imported-images](/assets/az-09-private-aks-acr-image-sync/acr-imported-images.png)

## Conclusion

Synchronizing container images for a private AKS cluster without direct internet access requires careful planning and automation. By leveraging a combination of an image configuration file, a synchronization script, and an Azure DevOps CI/CD pipeline, we can:

- Automate the import of necessary images into a private ACR.
- Ensure that all images are reviewed and approved according to SDLC practices.
- Maintain a secure and compliant deployment environment within the private AKS cluster.

This approach not only streamlines the deployment process but also integrates seamlessly with existing development workflows, promoting efficiency and reliability in managing containerized applications.

## References

- [Image importing pipeline](https://github.com/baoduy/drunk-azure-pulumi-articles/tree/main/image-sync-pipeline)
- [Azure Container Registry Documentation](https://docs.microsoft.com/azure/container-registry/)

## Thank You

Thank you for taking the time to read this guide! We hope it has been helpful. Feel free to explore further, and happy coding! 🌟✨

**Steven** | _[GitHub](https://github.com/baoduy)_
