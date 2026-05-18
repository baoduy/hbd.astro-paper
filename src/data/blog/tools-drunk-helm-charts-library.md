---
author: Steven Hoang
pubDatetime: 2025-05-18T12:00:00Z
title: "[Tools] Drunk Charts: A Reusable Helm Library for Kubernetes Deployments"
featured: false
draft: true
tags:
  - Kubernetes
  - Helm
  - DevOps
  - OpenSource
description: "An introduction to drunk-lib and drunk-app Helm charts — a reusable library approach that eliminates repetitive Kubernetes templates while maintaining flexibility and consistency across deployments."
---

## Introduction

If you've managed multiple microservices on Kubernetes, you've likely felt the pain of maintaining dozens of near-identical Helm charts — each with the same Deployment, Service, Ingress, and HPA templates copied and slightly tweaked. It's tedious, error-prone, and hard to keep consistent.

To solve this, I built **[drunk.charts](https://github.com/baoduy/drunk.charts)** — a set of Helm charts anchored by a **library chart** (`drunk-lib`) that provides standardized, reusable templates, and a thin **application chart** (`drunk-app`) that consumes it. Deploy any application by simply providing a `values.yaml` — no template duplication required.

## Table of Contents

## Architecture

The design follows Helm's [library chart pattern](https://helm.sh/docs/topics/library_charts/):

```
drunk-lib (library chart)
  └── Reusable named templates for all K8s resource types

drunk-app (application chart)
  └── Thin wrapper: each template calls drunk-lib.<resource-type>
  └── Depends on drunk-lib via OCI registry
```

**drunk-lib** contains the logic — 19 template files covering everything from Deployments to NetworkPolicies. **drunk-app** contains zero logic — each of its templates is a single-line `include` of the corresponding `drunk-lib` template. You configure everything through `values.yaml`.

## What's Included

### Resource Templates

| Category | Resources |
|----------|-----------|
| **Core** | Deployment, StatefulSet, Service, Ingress, Gateway, HTTPRoute |
| **Config** | ConfigMap, Secret, SecretProviderClass (CSI), TLS Secrets |
| **Storage** | PersistentVolumeClaim |
| **Batch** | CronJob, Job |
| **Scaling & Security** | HPA, ServiceAccount, ImagePullSecret, NetworkPolicy, BackendTLSPolicy |

### Key Features

- **Security-first defaults** — non-root user (UID 10000), read-only root filesystem, drop ALL capabilities
- **Azure Key Vault CSI** integration via `secretProvider`
- **Gateway API** support (HTTPRoute + BackendTLSPolicy) alongside traditional Ingress
- **Multiple network policies** per deployment
- **StatefulSet** support with headless service
- **CronJobs and Jobs** with per-entry enable/disable flags

## Getting Started

### Installation

```bash
# Add the Helm repository
helm repo add drunk https://baoduy.github.io/drunk.charts/drunk-app
helm repo update

# Install with your values
helm install my-app drunk/drunk-app -f values.yaml
```

### Minimal Deployment

A basic web application needs just this:

```yaml
global:
  image: my-registry.azurecr.io/my-app
  tag: "1.0.0"

deployment:
  ports:
    http: 8080

service:
  type: ClusterIP

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: my-app.drunkcoding.net
      paths:
        - path: /
          pathType: Prefix
```

That's it. The chart generates a Deployment, Service, and Ingress with secure defaults — no template files to maintain.

### Adding Environment Variables and Secrets

```yaml
env:
  APP_ENV: production
  LOG_LEVEL: info

secrets:
  DB_CONNECTION: "Server=db;Database=mydb;User=admin;Password=secret"

# Or reference existing secrets
secretFrom:
  - name: existing-secret
    key: connection-string
    envName: DB_CONNECTION
```

### Health Checks and Autoscaling

```yaml
deployment:
  ports:
    http: 8080
  liveness:
    path: /healthz
  readiness:
    path: /ready

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80
```

### Azure Key Vault Integration (CSI Driver)

```yaml
secretProvider:
  enabled: true
  tenantId: "your-tenant-id"
  vaultName: "my-keyvault"
  useWorkloadIdentity: true
  objects:
    - name: db-connection-string
      type: secret
      envName: DB_CONNECTION
```

### Gateway API with TLS

For clusters using the Gateway API instead of traditional Ingress:

```yaml
httpRoute:
  enabled: true
  hostnames:
    - my-app.drunkcoding.net
  rules:
    - backendRefs:
        - name: my-app
          port: 8080
  parentRefs:
    - name: main-gateway
      namespace: gateway-system

  # Backend TLS validation
  validation:
    enabled: true
    hostname: my-app.drunkcoding.net
    wellKnownCACertificates: System
```

### CronJobs

```yaml
cronJobs:
  - name: cleanup
    enabled: true
    schedule: "0 2 * * *"
    command: ["./cleanup.sh"]
    resources:
      limits:
        cpu: 200m
        memory: 256Mi
```

### Network Policies

```yaml
networkPolicies:
  - name: allow-ingress
    podSelector:
      matchLabels:
        app: my-app
    ingress:
      - from:
          - namespaceSelector:
              matchLabels:
                name: ingress-system
        ports:
          - port: 8080
```

## TLS Secrets Management

The chart supports three modes for TLS secrets:

```yaml
tlsSecrets:
  # Mode 1: Inline base64
  - name: my-tls
    cert: <base64-encoded-cert>
    key: <base64-encoded-key>

  # Mode 2: File-based (use with --set-file)
  - name: my-tls-file
    certFile: true
    cert: ""  # populated via --set-file
    key: ""

  # Mode 3: CA certificate only
  - name: my-ca
    ca: <base64-encoded-ca>
```

## Why a Library Chart?

| Approach | Pros | Cons |
|----------|------|------|
| Copy-paste templates per service | Full control | Drift, maintenance nightmare |
| Umbrella chart with subcharts | Organized | Heavy, complex dependency management |
| **Library chart + thin wrapper** | DRY, consistent, flexible | Slightly opinionated defaults |

The library chart pattern gives you:

1. **Single source of truth** — fix a bug in `drunk-lib`, all apps get it on next upgrade
2. **Consistency** — every service follows the same security, labeling, and resource patterns
3. **Speed** — new services need only a `values.yaml`, no template work
4. **Flexibility** — disable any resource by setting `enabled: false`

## Repository & Resources

- **GitHub**: [baoduy/drunk.charts](https://github.com/baoduy/drunk.charts)
- **Artifact Hub**: Published for discoverability
- **OCI Registry**: `oci://ghcr.io/baoduy` for chart dependencies
- **AI-Assisted Config**: Claude Code plugin available for `values.yaml` generation

## Conclusion

If you're deploying multiple services to Kubernetes and tired of maintaining duplicate templates, give `drunk-app` a try. It encapsulates production-ready defaults while remaining fully configurable — from a simple single-container deployment to a complex setup with StatefulSets, CronJobs, Gateway API routing, and Azure Key Vault integration.

The charts are open source and actively maintained. Contributions and feedback are welcome on [GitHub](https://github.com/baoduy/drunk.charts).
