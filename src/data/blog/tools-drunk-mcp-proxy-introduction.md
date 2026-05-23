---
author: Steven Hoang
pubDatetime: 2026-02-19T13:00:00Z
title: "Introducing drunk-mcp-proxy: A Production-Ready Dynamic Proxy for Model Context Protocol"
postSlug: tools-drunk-mcp-proxy-introduction
featured: true
draft: true
tags:
  - mcp
  - proxy
  - fastmcp
  - python
  - openapi
  - authentication
  - docker
description: "Discover drunk-mcp-proxy, a production-ready dynamic proxy server for the Model Context Protocol (MCP). Deploy instantly from Docker Hub (baoduy2412/mcp-proxy) to unify multiple MCP backends, convert OpenAPI specs to MCP tools, and secure everything with enterprise authentication."
---

As AI tooling matures, teams inevitably end up running multiple MCP servers — one for internal docs, another for finance data, a third wrapping a REST API. Each needs its own connection, its own auth, its own client config. It doesn't scale.

I built **drunk-mcp-proxy** to solve this. It's a single gateway that sits in front of all your MCP backends and OpenAPI services, giving clients one endpoint to talk to. No more juggling connections. No more tool-name collisions. No more auth headaches.

## Table of Contents

## Why You Need an MCP Gateway

As organizations adopt MCP, several pain points emerge:

1. **Service Sprawl** — Multiple MCP servers serving different domains (finance, docs, internal tools) each requiring separate client connections
2. **Tool Name Conflicts** — Different services exposing tools with identical names, causing confusion and errors
3. **Authentication Complexity** — Each backend may require different auth methods (JWT, OAuth, API keys)
4. **Client Configuration Overhead** — Every MCP client needs to know about every backend endpoint
5. **REST API Integration** — Existing REST APIs need manual wrapping to become MCP-compatible
6. **Operational Blind Spots** — No centralized health monitoring or logging across services

drunk-mcp-proxy addresses all of these with a clean, config-driven approach.

## What is drunk-mcp-proxy?

A production-ready proxy server built with Python and [FastMCP](https://github.com/jlowin/fastmcp) that acts as a central gateway for MCP services. Think of it as an API gateway, but purpose-built for the Model Context Protocol.

**Core capabilities:**

- **Unified Interface** — Single HTTP endpoint for multiple backend MCP servers
- **Dynamic Routing** — Path-based routing to configured backends (`/stock/mcp`, `/wiki/mcp`, etc.)
- **Namespace Isolation** — Per-server namespaces prevent tool name conflicts
- **OpenAPI → MCP Conversion** — Automatically convert any OpenAPI 3.0 spec into MCP tools
- **Enterprise Authentication** — Pluggable auth providers (JWT, GitHub, Google, Azure AD, and more)
- **Production Ready** — Health checks, CORS, structured logging, token caching, Docker support

The project is open-source and available at [github.com/baoduy/drunk-mcp-proxy](https://github.com/baoduy/drunk-mcp-proxy).

## Quick Start with Docker Hub

The fastest way to get started — no building from source required. The image is published on Docker Hub as **baoduy2412/mcp-proxy**.

### Docker Run

```bash
docker run -d \
  --name mcp-proxy \
  -p 9123:9123 \
  -v $(pwd)/data:/mcp_proxy/data \
  -e FASTMCP_CONFIG_DIR=/mcp_proxy/data \
  baoduy2412/mcp-proxy
```

### Docker Compose (Recommended)

Create a `docker-compose.yml`:

```yaml
version: "3"
services:
  mcp-proxy:
    image: baoduy2412/mcp-proxy:latest
    ports:
      - "9123:9123"
    volumes:
      - ./data:/mcp_proxy/data
    environment:
      - FASTMCP_CONFIG_DIR=/mcp_proxy/data
      - FASTMCP_LOG_LEVEL=INFO
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9123/health"]
      interval: 30s
      timeout: 3s
      retries: 3
```

Then start it:

```bash
docker-compose up -d
curl http://localhost:9123/health
# Response: {"status": "healthy"}
```

That's it. Point your MCP clients at `http://localhost:9123/mcp` and you're connected.

### Building from Source (Optional)

If you prefer to build locally:

```bash
git clone https://github.com/baoduy/drunk-mcp-proxy.git
cd drunk-mcp-proxy

# Using Docker
docker build -t drunk-mcp-proxy .
docker run -d -p 9123:9123 -v $(pwd)/data:/mcp_proxy/data drunk-mcp-proxy

# Or local development
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export FASTMCP_CONFIG_DIR=./data
python src/main.py
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MCP Client (e.g., Claude Desktop)                     │
│                 HTTP/SSE Request with Authorization Header               │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 v
┌─────────────────────────────────────────────────────────────────────────┐
│                        drunk-mcp-proxy Server                            │
│                                                                          │
│   ┌─────────────┐  ┌──────────────┐  ┌───────────────────────────┐     │
│   │ CORS        │  │ Health Check │  │ Auth Provider             │     │
│   │ Middleware   │  │ GET /health  │  │ (JWT/GitHub/Google/Azure) │     │
│   └─────────────┘  └──────────────┘  └───────────────────────────┘     │
│                                                                          │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │  Root MCP Server (/)           POST /mcp                      │     │
│   │  ├── Wiki MCP Proxy                                           │     │
│   │  ├── Memory MCP Proxy                                         │     │
│   │  └── Skills Directory Provider                                │     │
│   └──────────────────────────────────────────────────────────────┘     │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │  Namespaced MCP Services                                      │     │
│   │  ├── POST /stock/mcp  → Stock MCP Server (HTTP)              │     │
│   │  ├── POST /wiki/mcp   → Wiki MCP Server (HTTP)               │     │
│   │  └── POST /api/mcp    → OpenAPI Service (converted)          │     │
│   └──────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

The proxy is built on **Starlette** (ASGI) with **Uvicorn** as the server. Each configured service gets its own FastMCP instance, either mounted on the root path or under a dedicated namespace.

### Key Components

| Component | Purpose |
|-----------|---------|
| **MCPProxyServer** | Main orchestrator — loads config, creates proxy instances, starts uvicorn |
| **StarletteApp** | ASGI app factory — mounts MCP services, adds middleware |
| **McpProxyProvider** | Creates FastMCP proxies from MCP spec files |
| **OpenApiMcpProvider** | Converts OpenAPI specs into MCP tools |
| **GlobalAuthProvider** | Manages client-to-proxy authentication |
| **AppLifespanManager** | Handles startup/shutdown of all mounted MCP apps |
| **CacheProvider** | Token caching (memory, SQLite, or Redis) |

## Configuration

All configuration is driven by JSON files in the `data/` directory.

### Service Configuration (`data/config.json`)

```json
[
  {
    "path": "/",
    "spec_file": "mcp/mcp.json",
    "spec_type": "mcp",
    "skill_dir": "skills"
  },
  {
    "path": "/stock",
    "spec_file": "mcp/stock.mcp.json",
    "spec_type": "mcp",
    "tags": ["finance", "internal"]
  },
  {
    "path": "/wiki",
    "spec_file": "mcp/wiki.mcp.json",
    "spec_type": "mcp",
    "tags": ["documentation"]
  },
  {
    "path": "/api",
    "spec_file": "openapi/api.openapi.json",
    "spec_type": "openapi",
    "base_url": "https://api.example.com",
    "filters": {
      "methods": ["GET", "POST"],
      "tags": ["public"]
    },
    "auth": {
      "pass_through": true
    }
  }
]
```

### MCP Spec Files

Each MCP service references a spec file that defines how to connect to the backend:

**`data/mcp/stock.mcp.json`:**

```json
{
  "mcpServers": {
    "stock": {
      "url": "http://stock-service.internal:8080/mcp",
      "transport": "http"
    }
  }
}
```

**`data/mcp/wiki.mcp.json`:**

```json
{
  "mcpServers": {
    "wiki": {
      "url": "https://mcp.deepwiki.com/mcp",
      "transport": "http"
    }
  }
}
```

### Environment Variable Resolution

Configuration values support `$VAR` and `${VAR}` syntax for environment variable substitution — keep secrets out of config files:

```json
{
  "auth": {
    "azure": {
      "client_id": "$AZURE_CLIENT_ID",
      "client_secret": "$AZURE_CLIENT_SECRET",
      "tenant_id": "$AZURE_TENANT_ID"
    }
  }
}
```

## Dynamic MCP Service Management

### Root Path Aggregation

Services with `path="/"` are mounted on a single root MCP server. Clients access all tools through one endpoint (`POST /mcp`):

- Single endpoint for multiple services
- Simplified client configuration
- Automatic tool aggregation
- Centralized authentication

### Namespaced Services

Services with specific paths (e.g., `/stock`, `/wiki`) get isolated MCP server instances at their own endpoints (`POST /stock/mcp`, `POST /wiki/mcp`):

- **No tool name conflicts** — each namespace is independent
- **Independent lifecycle** — update one service without affecting others
- **Service-specific auth** — different authentication per namespace
- **Logical grouping** — organize services by domain

## OpenAPI to MCP Conversion

One of the most powerful features: automatically convert any OpenAPI 3.0 specification into MCP tools. No code changes to your existing REST APIs.

**How it works:**

1. Point to an OpenAPI spec file in your config
2. The proxy reads every endpoint and creates an MCP tool for it
3. Tool names come from `operationId` (or are auto-generated)
4. Parameters are mapped from query params, path params, and request body
5. HTTP methods and content types are handled automatically

**Route filtering** lets you control which endpoints are exposed:

```json
{
  "path": "/api",
  "spec_type": "openapi",
  "spec_file": "openapi/api.json",
  "base_url": "https://api.example.com",
  "filters": {
    "methods": ["GET", "POST"],
    "tags": ["public", "v2"]
  }
}
```

This reduces tool clutter and limits the attack surface by only exposing the endpoints you choose.

## Enterprise Authentication

The proxy supports two layers of authentication:

### Client → Proxy Authentication

Control who can access the proxy. Configured via `FASTMCP_SERVER_AUTH` environment variable. Supported providers:

- **JWT** with JWKS validation
- **GitHub OAuth**
- **Google OAuth**
- **Discord OAuth**
- **Custom providers** via the extensible auth framework

### Proxy → Backend Authentication

#### Pass-Through

The simplest approach — forward the client's token directly to the backend:

```json
{
  "auth": {
    "pass_through": true
  }
}
```

Use when backends handle their own auth validation. Zero-trust friendly.

#### Azure AD OAuth2

For services protected by Azure AD, the proxy handles the entire OAuth2 client credentials flow automatically:

```json
{
  "auth": {
    "azure": {
      "client_id": "$AZURE_CLIENT_ID",
      "client_secret": "$AZURE_CLIENT_SECRET",
      "tenant_id": "$AZURE_TENANT_ID",
      "token_url": "https://login.microsoftonline.com/$AZURE_TENANT_ID/oauth2/v2.0/token",
      "scopes": ["api://$AZURE_CLIENT_ID/.default"]
    }
  }
}
```

Features:
- Automatic token acquisition via client credentials flow
- In-memory token caching with expiry detection (also supports SQLite and Redis)
- Automatic token refresh
- Completely transparent to MCP clients

## Skills Directory Provider

Expose Markdown-based skill documentation as MCP resources. This gives LLMs structured knowledge about your code patterns, best practices, and domain-specific information.

```json
{
  "path": "/",
  "spec_type": "mcp",
  "skill_dir": "skills"
}
```

Directory structure:

```
data/skills/
├── architecture/
│   └── patterns/
│       └── SKILL.md
└── dknet/
    ├── efcore-repos/
    │   └── SKILL.md
    └── slimbus-messaging/
        └── SKILL.md
```

Each `SKILL.md` becomes an MCP resource that AI assistants can read and use as context.

## Production Deployment

### Environment Variables

```bash
# Server
FASTMCP_PORT=9123
FASTMCP_HOST=0.0.0.0
FASTMCP_LOG_LEVEL=INFO
FASTMCP_CONFIG_DIR=./data

# CORS
CORS_ALLOW_ORIGINS=https://app.example.com
CORS_ALLOW_METHODS=GET,POST
CORS_ALLOW_HEADERS=*

# Auth (Azure AD example)
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=your-tenant-id

# Token caching
OAUTH_STORAGE_TYPE=memory  # or sqlite, redis
```

### Health Monitoring

The `/health` endpoint returns `{"status": "healthy"}` — use it for:

- Docker/Kubernetes readiness and liveness probes
- Load balancer health checks
- Monitoring system integrations

### Kubernetes

The Docker Hub image (`baoduy2412/mcp-proxy`) works directly in Kubernetes deployments:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-proxy
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: mcp-proxy
          image: baoduy2412/mcp-proxy:latest
          ports:
            - containerPort: 9123
          env:
            - name: FASTMCP_CONFIG_DIR
              value: /mcp_proxy/data
          readinessProbe:
            httpGet:
              path: /health
              port: 9123
          livenessProbe:
            httpGet:
              path: /health
              port: 9123
          volumeMounts:
            - name: config
              mountPath: /mcp_proxy/data
      volumes:
        - name: config
          configMap:
            name: mcp-proxy-config
```

## Real-World Use Cases

### Unified Gateway for Internal Services

Multiple internal MCP services (HR, Finance, Documentation) accessible through one endpoint. Clients configure a single URL instead of managing N connections.

### Secure API Gateway with Azure AD

Expose an internal REST API (protected by Azure AD) as MCP tools. The proxy handles token acquisition and refresh — MCP clients never need Azure credentials.

### Multi-Tenant SaaS

Namespace isolation per tenant (`/tenant-a/mcp`, `/tenant-b/mcp`). Each tenant gets independent configuration, authentication, and tool sets.

### Legacy API Integration

Wrap existing REST/OpenAPI services as MCP tools without modifying the original APIs. The proxy handles protocol translation automatically.

## Best Practices

1. **Use namespace isolation** for logically distinct services — prevents conflicts and enables independent updates
2. **Filter OpenAPI routes** with method and tag filters — reduces attack surface and tool clutter
3. **Never commit secrets** — use environment variable substitution (`$VAR`) in all config files
4. **Configure specific CORS origins** — avoid wildcards in production
5. **Enable health checks** — critical for container orchestration and monitoring
6. **Use token caching** — Redis or SQLite for distributed deployments to avoid token storms
7. **Set appropriate log levels** — `INFO` for production, `DEBUG` for troubleshooting
8. **Use the Docker Hub image** (`baoduy2412/mcp-proxy`) for consistent, reproducible deployments

## Conclusion

drunk-mcp-proxy simplifies the complexity of managing multiple MCP services and integrating REST APIs into the MCP ecosystem. With dynamic routing, namespace isolation, automatic OpenAPI conversion, and enterprise authentication, it provides a solid foundation for organizations building AI-powered applications at scale.

Whether you're connecting internal tools, exposing external APIs, or building a multi-tenant platform — pull the image from Docker Hub and have a production-ready MCP gateway running in minutes:

```bash
docker run -d -p 9123:9123 -v $(pwd)/data:/mcp_proxy/data baoduy2412/mcp-proxy
```

## References

- **GitHub Repository**: [github.com/baoduy/drunk-mcp-proxy](https://github.com/baoduy/drunk-mcp-proxy)
- **Docker Hub**: [baoduy2412/mcp-proxy](https://hub.docker.com/r/baoduy2412/mcp-proxy)
- **Technical Documentation**: [deepwiki.com/baoduy/drunk-mcp-proxy](https://deepwiki.com/baoduy/drunk-mcp-proxy)
- **Model Context Protocol**: [modelcontextprotocol.io](https://modelcontextprotocol.io)
- **FastMCP**: [github.com/jlowin/fastmcp](https://github.com/jlowin/fastmcp)
