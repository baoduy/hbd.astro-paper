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
description: "In this article, we explore the process of synchronizing container images with Azure Container Registry (ACR) for deployments in a private Azure Kubernetes Service (AKS) cluster. We'll cover how to configure and automate this synchronization using CI/CD pipelines, ensuring seamless updates and secure image management for private AKS environments."
---

## Introduction

Deploying applications in a private Azure Kubernetes Service (AKS) cluster presents unique challenges, especially when the cluster lacks direct internet access. In such environments, the cluster cannot pull container images from public registries like Docker Hub or Quay.io. Instead, all container images must be sourced from a private Azure Container Registry (ACR) accessible within the cluster's network.

To address this, we need a robust solution that not only synchronizes required images into the ACR but also integrates with Continuous Integration/Continuous Deployment (CI/CD) pipelines and adheres to Software Development Life Cycle (SDLC) best practices. This ensures that all images are reviewed and approved before being imported, enhancing security and compliance.

## Solution Overview

The solution combines a clear understanding of the challenges with practical steps to automate image synchronization. By leveraging Azure DevOps CI/CD pipelines, we can automate the import process, maintain version control, and integrate code reviews and approvals into our workflow. This aligns with SDLC principles, ensuring that only authorized images are imported into our private ACR.

### **Key Components:**

- **Image Configuration File (`images.txt`):** Defines the source and destination of images to be synchronized.
- **Synchronization Script (`sync-script.sh`):** Automates the import of images from public registries to the private ACR.
- **Azure Pipeline Configuration (`azure-pipelines.yml`):** Orchestrates the execution of the synchronization script within a CI/CD pipeline.

By integrating these components, we can create a repeatable and auditable process for managing container images in a private AKS environment.

## Implementation

### 1. Image Configuration File (`images.txt`)

The `images.txt` file lists all the container images that need to be imported into the private ACR. Each line specifies the source image and the destination repository within the ACR, separated by `=>`. This format allows for easy maintenance and review of the images being imported.

**Example `images.txt`:**

```plaintext
registry.k8s.io/ingress-nginx/controller:v1.11.1 => ingress-nginx/controller
registry.k8s.io/ingress-nginx/kube-webhook-certgen:v1.4.1 => ingress-nginx/kube-webhook-certgen
quay.io/jetstack/cert-manager-controller:v1.15.2 => jetstack/cert-manager-controller
quay.io/jetstack/cert-manager-webhook:v1.15.2 => jetstack/cert-manager-webhook
quay.io/jetstack/cert-manager-cainjector:v1.15.2 => jetstack/cert-manager-cainjector
# docker.io/cloudflare/cloudflared:latest => cloudflare/cloudflared
```

**Key Points:**

- **Source Image:** The full path to the image in the public registry, including the tag.
- **Destination Repository:** The repository path within the ACR where the image will be imported.
- **Comments:** Lines starting with `#` are treated as comments and ignored by the script.

### **2. Synchronization Script (`sync-script.sh`)**

The `sync-script.sh` script automates the process of importing images listed in `images.txt` into the ACR. It reads each line of the configuration file, processes the source and destination information, and uses the Azure CLI to import the images.

**Contents of `sync-script.sh`:**

```bash
#!/bin/bash

# Usage: ./sync-script.sh <ACR_NAME> <IMAGE_LIST_PATH> [DOCKER_USERNAME] [DOCKER_PASSWORD]

# Define variables from script arguments
ACR_NAME="$1"
IMAGE_LIST_PATH="$2"
DOCKER_USERNAME="$3"
DOCKER_PASSWORD="$4"

# Validate required arguments
if [[ -z "$ACR_NAME" || -z "$IMAGE_LIST_PATH" ]]; then
  echo "Usage: $0 <ACR_NAME> <IMAGE_LIST_PATH> [DOCKER_USERNAME] [DOCKER_PASSWORD]"
  exit 1
fi

# Get the directory of the script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Resolve the full path to the image list file
IMAGE_LIST_FULL_PATH="$SCRIPT_DIR/$IMAGE_LIST_PATH"

# Check if the image list file exists
if [[ ! -f "$IMAGE_LIST_FULL_PATH" ]]; then
  echo "Error: Image list file not found at $IMAGE_LIST_FULL_PATH"
  exit 1
fi

# Retrieve the ACR login server
ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query "loginServer" --output tsv 2>/dev/null)

if [[ -z "$ACR_LOGIN_SERVER" ]]; then
  echo "Error: Failed to retrieve the ACR login server for $ACR_NAME"
  exit 1
fi

# Read and process each image from the image list file
while IFS= read -r IMAGE; do
  # Skip comments and empty lines
  if [[ $IMAGE == \#* ]] || [[ -z $IMAGE ]]; then
    continue
  fi

  # Extract source and destination from the line
  SOURCE="${IMAGE%%=>*}"
  DESTINATION="${IMAGE##*=>}"

  # Trim whitespace
  SOURCE=$(echo "$SOURCE" | xargs)
  DESTINATION=$(echo "$DESTINATION" | xargs)

  # Extract tag from the source image
  if [[ "$SOURCE" == *:* ]]; then
    TAG="${SOURCE##*:}"
    SOURCE_IMAGE="${SOURCE%%:*}"
  else
    TAG="latest"
    SOURCE_IMAGE="$SOURCE"
  fi

  # Construct the full destination image path
  DESTINATION_WITH_TAG="$DESTINATION:$TAG"
  FULL_DESTINATION="$ACR_LOGIN_SERVER/$DESTINATION_WITH_TAG"

  # Display import information
  echo "Importing $SOURCE into $FULL_DESTINATION..."

  # Import the image into ACR
  if [[ $SOURCE == docker.io* ]] && [[ -n "$DOCKER_USERNAME" && -n "$DOCKER_PASSWORD" ]]; then
    az acr import --name "$ACR_NAME" --source "$SOURCE" --image "$DESTINATION_WITH_TAG" \
      --username "$DOCKER_USERNAME" --password "$DOCKER_PASSWORD" --force
  else
    az acr import --name "$ACR_NAME" --source "$SOURCE" --image "$DESTINATION_WITH_TAG" --force
  fi

  # Confirm import completion
  echo "Successfully imported $FULL_DESTINATION."
  echo

  # Optional pause between imports
  sleep 5
done < "$IMAGE_LIST_FULL_PATH"
```

**Script Breakdown:**

- **Argument Parsing:** The script accepts the ACR name, path to `images.txt`, and optional Docker credentials.
- **File Path Resolution:** Ensures that `images.txt` is correctly located relative to the script.
- **Import Process:** Uses `az acr import` to import each image, handling authentication if necessary.
- **Logging:** Provides console output to track progress and confirm successful imports.

### 3. Azure Pipeline Configuration (`azure-pipelines.yml`)

To automate the synchronization process within a CI/CD pipeline, we use an Azure Pipelines YAML configuration. This pipeline will execute the synchronization script whenever changes are made to the `images.txt` file, ensuring that all images are up to date in the ACR.

**Example `azure-pipelines.yml`:**

```yaml
trigger:
  branches:
    include:
      - main
  paths:
    include:
      - images.txt
      - sync-script.sh

pool:
  vmImage: "ubuntu-latest"

steps:
  - task: AzureCLI@2
    inputs:
      azureSubscription: "<AzureServiceConnection>"
      scriptType: "bash"
      scriptLocation: "inlineScript"
      inlineScript: |
        # Install Azure CLI ACR extension if not already installed
        az extension add --name acr

        # Make the sync script executable
        chmod +x sync-script.sh

        # Execute the sync script
        ./sync-script.sh <ACR_NAME> images.txt

    displayName: "Synchronize Container Images"
```

**Pipeline Explanation:**

- **Trigger Configuration:**
  - Triggers the pipeline when changes are made to `main` branch, specifically to `images.txt` or `sync-script.sh`.
- **Pool Specification:**
  - Uses an Ubuntu agent for compatibility with the Bash script.
- **Steps:**
  - **AzureCLI Task:** Executes the synchronization script within the Azure CLI context.
  - **Script Execution:**
    - Installs the ACR extension if needed.
    - Makes the script executable.
    - Runs the `sync-script.sh` script with the ACR name and path to `images.txt`.

**Notes:**

- Replace `<AzureServiceConnection>` with the name of your Azure service connection in Azure DevOps.
- Replace `<ACR_NAME>` with the actual name of your Azure Container Registry.
- Ensure that the service principal associated with the Azure service connection has permissions to import images into the ACR.

## Integrating CI/CD and SDLC Practices

By incorporating the synchronization process into a CI/CD pipeline, we align with SDLC principles:

- **Code Review:** Changes to `images.txt` and `sync-script.sh` can be reviewed through pull requests before being merged into `main`.
- **Audit Trail:** All changes are tracked in version control, providing an audit trail of image imports.
- **Automation:** Reduces manual intervention, minimizing the risk of human error.
- **Security Compliance:** Ensures that only approved images are imported, enhancing the security posture of the cluster.

## Conclusion

Synchronizing container images for a private AKS cluster without direct internet access requires careful planning and automation. By leveraging a combination of an image configuration file, a synchronization script, and an Azure DevOps CI/CD pipeline, we can:

- Automate the import of necessary images into a private ACR.
- Ensure that all images are reviewed and approved according to SDLC practices.
- Maintain a secure and compliant deployment environment within the private AKS cluster.

This approach not only streamlines the deployment process but also integrates seamlessly with existing development workflows, promoting efficiency and reliability in managing containerized applications.

## References

- [Azure Container Registry Documentation](https://docs.microsoft.com/azure/container-registry/)
- [Azure DevOps Pipelines Documentation](https://docs.microsoft.com/azure/devops/pipelines/)
- [Best Practices for Private AKS Clusters](https://docs.microsoft.com/azure/aks/private-clusters)

## Thank You

Thank you for taking the time to read this guide! We hope it has been helpful. Feel free to explore further, and happy coding! 🌟✨

**Steven** | _[GitHub](https://github.com/baoduy)_
