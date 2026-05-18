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
  - AI
description: "A deep dive into drunk-lib and drunk-app Helm charts — a library-first approach to Kubernetes deployments with OCI distribution and Claude Code AI plugins for values.yaml generation and validation."
---

## Introduction

If you've managed multiple microservices on Kubernetes, you've likely felt the pain of maintaining dozens of near-identical Helm charts — each with the same Deployment, Service, Ingress, and HPA templates copied and slightly tweaked. It's tedious, error-prone, and hard to keep consistent.

To solve this, I built **[drunk.charts](https://github.com/baoduy/drunk.charts)** — a set of Helm charts anchored by a **library chart** (`drunk-lib`) that provides standardized, reusable templates, and a thin **application chart** (`drunk-app`) that consumes it. Deploy any application by simply providing a `values.yaml` — no template duplication required.

All charts are published as **OCI artifacts** on GitHub Container Registry at `oci://ghcr.io/baoduy` and are available on [Artifact Hub](https://artifacthub.io/).

## Table of Contents

## Architecture

The design follows Helm's [library chart pattern](https://helm.sh/docs/topics/library_charts/):

```
drunk-lib (library chart — type: library)
  └── 19 named templates: drunk-lib.<resource-type>
  └── Published as OCI: oci://ghcr.io/baoduy/drunk-lib

drunk-app (application chart — type: application)
  └── Thin wrapper: each template is a single include of drunk-lib.<name>
  └── Declares drunk-lib as a dependency
  └── Published as OCI: oci://ghcr.io/baoduy/drunk-app
```

This separation means you fix a bug or add a feature in `drunk-lib` once, bump the version, and every `drunk-app` deployment inherits it on the next `helm dependency update`.

---

## drunk-lib: The Library Chart

`drunk-lib` (v1.3.0) is a Helm **library** chart — it produces no resources on its own. Instead, it provides named templates that other charts invoke via `{{ include "drunk-lib.<name>" . }}`.

### Available Templates

| Category | Template | Resource Generated |
|----------|----------|--------------------|
| **Core Workloads** | `drunk-lib.deployment` | `apps/v1 Deployment` |
| | `drunk-lib.statefulset` | `apps/v1 StatefulSet` |
| **Networking** | `drunk-lib.service` | `v1 Service` |
| | `drunk-lib.ingress` | `networking.k8s.io/v1 Ingress` |
| | `drunk-lib.gateway` | `gateway.networking.k8s.io/v1 Gateway` |
| | `drunk-lib.httproute` | `gateway.networking.k8s.io/v1 HTTPRoute` |
| | `drunk-lib.backendTlsPolicy` | `gateway.networking.k8s.io BackendTLSPolicy` |
| **Configuration** | `drunk-lib.configMap` | `v1 ConfigMap` |
| | `drunk-lib.secrets` | `v1 Secret` |
| | `drunk-lib.secretProviderClass` | `SecretProviderClass` (CSI Driver) |
| | `drunk-lib.tls-secrets` | `v1 Secret` (TLS type) |
| **Storage** | `drunk-lib.volumes` | `v1 PersistentVolumeClaim` |
| **Batch** | `drunk-lib.cronjob` | `batch/v1 CronJob` |
| | `drunk-lib.job` | `batch/v1 Job` |
| **Scaling** | `drunk-lib.hpa` | `autoscaling/v2 HorizontalPodAutoscaler` |
| **Security** | `drunk-lib.networkPolicy` | `networking.k8s.io/v1 NetworkPolicy` |
| | `drunk-lib.serviceAccount` | `v1 ServiceAccount` |
| | `drunk-lib.imagePull-secret` | `v1 Secret` (dockerconfigjson) |

### Helper Functions

The chart also provides shared helper templates:

- **`app.name`** / **`app.fullname`** — consistent naming across all resources
- **`app.labels`** — standard Kubernetes labels (app.kubernetes.io/*)
- **`app.selectorLabels`** — selector labels for pod matching
- **`app.checksums`** — annotations that trigger pod rollouts when ConfigMap/Secret content changes

### How Templates Work

Each template is self-contained and gate-controlled. For example, the Deployment template:

1. Checks `.Values.deployment.enabled` — no-op if false
2. Composes pod metadata using `app.labels` / `app.selectorLabels`
3. Attaches checksum annotations via `app.checksums` so ConfigMap/Secret changes trigger rollouts
4. Wires init containers from `.Values.global.initContainer`
5. Pulls environment from `configMap`, `secrets`, `configFrom[]`, `secretFrom[]`, and CSI `secretProvider`
6. Reads scheduling (`nodeSelector`, `affinity`, `tolerations`), security contexts, resources, and volumes from **root-level** values — shared with sibling resources (Jobs, CronJobs)
7. Hard-codes `automountServiceAccountToken: false` for security

### Deployment Template — Full Schema

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `deployment.enabled` | bool | `false` | Gate for the entire resource |
| `deployment.replicaCount` | int | `1` | Pod replicas |
| `deployment.strategy.type` | string | `RollingUpdate` | `RollingUpdate` or `Recreate` |
| `deployment.strategy.maxSurge` | int/string | `1` | Rolling update config |
| `deployment.strategy.maxUnavailable` | int/string | `0` | Rolling update config |
| `deployment.ports` | map | — | `name: containerPort` pairs |
| `deployment.command` | list | — | Container command override |
| `deployment.args` | list | — | Container args override |
| `deployment.liveness` | string | — | HTTP path for liveness probe |
| `deployment.readiness` | string | — | HTTP path for readiness probe |
| `deployment.podAnnotations` | map | — | Extra pod annotations |

### StatefulSet Template

For workloads requiring stable network identity and persistent storage. Same pod spec composition as Deployment, with added `volumeClaimTemplates` support and headless Service generation.

### Security Defaults

All templates enforce security best practices out of the box:

```yaml
podSecurityContext:
  fsGroup: 10000
  runAsUser: 10000
  runAsGroup: 10000

securityContext:
  capabilities:
    drop: ["ALL"]
  readOnlyRootFilesystem: true
  runAsNonRoot: true
```

### Using drunk-lib in Your Own Charts

To build a custom chart on top of `drunk-lib`:

```yaml
# Chart.yaml
apiVersion: v2
name: my-custom-chart
type: application
dependencies:
  - name: drunk-lib
    version: "1.3.0"
    repository: "oci://ghcr.io/baoduy"
```

Then in your templates:

```yaml
# templates/deployment.yaml
{{- include "drunk-lib.deployment" . -}}

# templates/service.yaml
{{- include "drunk-lib.service" . -}}
```

---

## drunk-app: The Application Chart

`drunk-app` (v1.3.5) is the ready-to-use chart for deploying applications. It's intentionally a **thin wrapper** — every template file is a single line:

```yaml
{{- include "drunk-lib.deployment" . -}}
```

This means you never write templates. You configure everything through `values.yaml`.

### Installation

```bash
# From OCI registry (recommended)
helm install my-app oci://ghcr.io/baoduy/drunk-app --version 1.3.5 -f values.yaml

# Or via Helm repo
helm repo add drunk-charts https://baoduy.github.io/drunk.charts/drunk-app
helm repo update
helm install my-app drunk-charts/drunk-app -f values.yaml
```

### Minimal Deployment

```yaml
global:
  image: my-registry.azurecr.io/my-app
  tag: "1.0.0"

deployment:
  enabled: true
  ports:
    http: 8080

service:
  type: ClusterIP

volumes:
  - name: tmp
    emptyDir: {}
    mountPath: /tmp
```

> **Note:** The `tmp` volume is essential because `readOnlyRootFilesystem: true` is the default — your app needs a writable `/tmp`.

### Environment Variables and Secrets

```yaml
# Inline environment variables
env:
  APP_ENV: production
  LOG_LEVEL: info

# Inline secrets (stored as K8s Secret)
secrets:
  DB_CONNECTION: "Server=db;Database=mydb;User=admin;Password=secret"

# Reference existing secrets
secretFrom:
  - name: existing-secret
    key: connection-string
    envName: DB_CONNECTION

# Reference existing configmaps
configFrom:
  - name: shared-config
    key: api-url
    envName: API_URL
```

### Health Checks and Autoscaling

```yaml
deployment:
  enabled: true
  ports:
    http: 8080
  liveness: /healthz
  readiness: /ready

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi

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
    - name: api-key
      type: secret
      envName: API_KEY
```

### TLS Secrets Management

Three modes supported:

```yaml
tlsSecrets:
  # Mode 1: Inline base64-encoded certificates
  - name: my-tls
    cert: <base64-encoded-cert>
    key: <base64-encoded-key>

  # Mode 2: File-based (populate via --set-file during helm install)
  - name: my-tls-file
    certFile: true
    cert: ""
    key: ""

  # Mode 3: CA certificate only (for backend TLS validation)
  - name: my-ca
    ca: <base64-encoded-ca>
```

### Gateway API with TLS Validation

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
  validation:
    enabled: true
    hostname: my-app.drunkcoding.net
    wellKnownCACertificates: System
```

### CronJobs and Jobs

```yaml
cronJobs:
  - name: nightly-cleanup
    enabled: true
    schedule: "0 2 * * *"
    command: ["./cleanup.sh"]
    resources:
      limits:
        cpu: 200m
        memory: 256Mi

jobs:
  - name: db-migration
    enabled: true
    command: ["dotnet", "ef", "database", "update"]
```

### Network Policies

```yaml
networkPolicies:
  - name: allow-ingress-only
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
    policyTypes:
      - Ingress
```

### Init Containers

```yaml
global:
  image: my-registry.azurecr.io/my-app
  tag: "1.0.0"
  initContainer:
    image: busybox
    tag: latest
    command: ["sh", "-c", "echo initializing"]
```

---

## Claude Code AI Plugins

Both charts ship with **Claude Code plugins** that provide AI-assisted configuration. These are available on the [Claude Code Plugin Marketplace](https://github.com/baoduy/drunk.charts).

### Installing the Plugins

```bash
# Add from marketplace
plugin marketplace add baoduy/drunk.charts
```

### drunk-app Plugin

The `drunk-app` plugin provides an AI assistant with three modes:

1. **Answer** — Ask "how does X work?" and get explanations with YAML snippets
2. **Generate** — Say "give me a values.yaml for [use case]" and get a complete, validated configuration
3. **Validate** — Paste a values.yaml and get a full validation report with fix instructions

Example interactions:

```
/drunk-app generate a values.yaml for a .NET API with health checks, 
autoscaling, and Azure Key Vault secrets

/drunk-app validate my values.yaml — is the probe configuration correct?

/drunk-app how do I configure multiple network policies?
```

### drunk-lib Plugin

The `drunk-lib` plugin provides **per-template expert skills** — 18 specialized assistants, one for each resource type:

| Skill | Expertise |
|-------|-----------|
| `drunk-lib-deployment` | Deployment workloads, rolling updates, pod spec |
| `drunk-lib-statefulset` | Stateful workloads, headless services, volume claims |
| `drunk-lib-service` | Service types, port mapping |
| `drunk-lib-ingress` | Nginx ingress, TLS, path routing |
| `drunk-lib-httproute` | Gateway API HTTPRoute configuration |
| `drunk-lib-gateway` | Gateway resource setup |
| `drunk-lib-backend-tls-policy` | Backend TLS validation |
| `drunk-lib-hpa` | Horizontal Pod Autoscaler tuning |
| `drunk-lib-cronjob` | Scheduled batch workloads |
| `drunk-lib-job` | One-off batch workloads |
| `drunk-lib-configmap` | ConfigMap from values |
| `drunk-lib-secrets` | Secret management |
| `drunk-lib-secretprovider` | CSI Secret Store (Azure Key Vault, AWS) |
| `drunk-lib-tls-secrets` | TLS certificate management |
| `drunk-lib-networkpolicy` | Network isolation rules |
| `drunk-lib-serviceaccount` | ServiceAccount configuration |
| `drunk-lib-imagepull-secret` | Private registry credentials |
| `drunk-lib-volumes` | PVC and volume management |

Each skill contains the **exact values schema** consumed by that template, the rendering logic, validation rules, and generation templates — so Claude can produce correct configurations without guessing.

---

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
5. **AI-ready** — Claude Code plugins understand the exact schema and can generate/validate configs

## OCI Distribution

All charts are published to GitHub Container Registry as OCI artifacts:

```bash
# Pull directly
helm pull oci://ghcr.io/baoduy/drunk-app --version 1.3.5
helm pull oci://ghcr.io/baoduy/drunk-lib --version 1.3.0

# Use as dependency
# Chart.yaml
dependencies:
  - name: drunk-lib
    version: "1.3.0"
    repository: "oci://ghcr.io/baoduy"
```

Published packages are visible at [github.com/baoduy?tab=packages&repo_name=drunk.charts](https://github.com/baoduy?tab=packages&repo_name=drunk.charts).

## Conclusion

`drunk.charts` eliminates the boilerplate of Kubernetes deployments while maintaining full flexibility. The `drunk-lib` library chart provides battle-tested templates with security-first defaults, and `drunk-app` makes them instantly usable with just a `values.yaml`. Combined with Claude Code AI plugins that understand the exact schema, you can generate and validate configurations with confidence.

The charts are open source and actively maintained. Contributions and feedback are welcome on [GitHub](https://github.com/baoduy/drunk.charts).
