---
author: Steven Hoang
pubDatetime: 2026-02-17T13:00:00Z
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
description: "Discover drunk-mcp-proxy, a powerful production-ready dynamic proxy server for the Model Context Protocol (MCP) that enables unified access to multiple backend MCP servers and OpenAPI services with enterprise authentication, CORS support, and namespace isolation."
---

The Model Context Protocol (MCP) has revolutionized how AI applications interact with external tools and services. However, as your infrastructure grows with multiple MCP servers and REST APIs, managing connections, authentication, and namespacing becomes increasingly complex. How do you provide a unified interface while maintaining security, isolation, and scalability?

**drunk-mcp-proxy** is a sophisticated, production-ready dynamic proxy server built with Python and FastMCP that solves these challenges. It acts as a central gateway for MCP services, providing a unified interface for multiple backend MCP servers and automatic conversion of OpenAPI specifications to MCP tools, all with enterprise-grade authentication and monitoring capabilities.

## Table of Contents

- [Table of Contents](#table-of-contents)
- [The Challenge with Multiple MCP Services](#the-challenge-with-multiple-mcp-services)
- [What is drunk-mcp-proxy?](#what-is-drunk-mcp-proxy)
- [Key Features](#key-features)
- [Quick Start](#quick-start)
  - [Using Docker Compose (Recommended)](#using-docker-compose-recommended)
  - [Using Docker](#using-docker)
  - [Local Development](#local-development)
- [Architecture Overview](#architecture-overview)
  - [High-Level Architecture](#high-level-architecture)
  - [Component Architecture](#component-architecture)
- [Feature 1: Dynamic MCP Service Management](#feature-1-dynamic-mcp-service-management)
  - [Root Path Aggregation](#root-path-aggregation)
  - [Namespaced Services](#namespaced-services)
  - [Configuration Example](#configuration-example)
- [Feature 2: OpenAPI to MCP Conversion](#feature-2-openapi-to-mcp-conversion)
  - [Automatic Tool Generation](#automatic-tool-generation)
  - [Route Filtering](#route-filtering)
  - [Configuration Example](#configuration-example-1)
- [Feature 3: Enterprise Authentication](#feature-3-enterprise-authentication)
  - [Supported Authentication Methods](#supported-authentication-methods)
  - [Pass-Through Authentication](#pass-through-authentication)
  - [Azure OAuth2 Integration](#azure-oauth2-integration)
- [Skills Directory Provider](#skills-directory-provider)
  - [Configuration](#configuration)
  - [Use Cases](#use-cases)
- [Production Deployment](#production-deployment)
  - [Docker Deployment](#docker-deployment)
  - [Health Monitoring](#health-monitoring)
  - [Environment Configuration](#environment-configuration)
- [Real-World Use Cases](#real-world-use-cases)
  - [Use Case 1: Unified Gateway for Multiple Internal Services](#use-case-1-unified-gateway-for-multiple-internal-services)
  - [Use Case 2: Secure API Gateway with Azure AD](#use-case-2-secure-api-gateway-with-azure-ad)
  - [Use Case 3: Multi-Tenant SaaS Architecture](#use-case-3-multi-tenant-saas-architecture)
- [Best Practices](#best-practices)
- [Conclusion](#conclusion)
- [References](#references)

## The Challenge with Multiple MCP Services

As organizations adopt MCP, several challenges emerge:

1. **Service Proliferation**: Multiple backend MCP servers serving different domains (finance, documentation, internal tools)
2. **Tool Name Conflicts**: Different services may expose tools with identical names
3. **Authentication Complexity**: Each service may require different authentication methods
4. **Client Configuration**: MCP clients need to manage connections to multiple endpoints
5. **API Integration**: REST APIs need to be wrapped or converted to MCP-compatible tools
6. **Monitoring & Observability**: Tracking health and performance across distributed services

Traditional approaches require clients to maintain complex configurations and handle each service independently, leading to maintenance overhead and potential security gaps.

## What is drunk-mcp-proxy?

drunk-mcp-proxy is a sophisticated proxy server that acts as a central gateway for Model Context Protocol services. Built with Python and FastMCP, it provides:

- **Unified Interface**: Single endpoint for multiple backend MCP servers
- **Dynamic Routing**: Automatic routing to configured backend services
- **Namespace Isolation**: Prevent tool name conflicts with per-server namespaces
- **OpenAPI Integration**: Automatic conversion of OpenAPI specs to MCP tools
- **Enterprise Authentication**: Pluggable auth providers (JWT, OAuth, GitHub, etc.)
- **Production Ready**: Health checks, CORS, structured logging, Docker support

The project is open-source and available at: [github.com/baoduy/drunk-mcp-proxy](https://github.com/baoduy/drunk-mcp-proxy)

## Key Features

### 🚀 Dynamic Proxy Management

Configure multiple MCP and OpenAPI services via JSON with hot-reloading support and environment variable resolution.

### 🐳 Docker Support

Multi-stage production Docker image with health checks and optimized runtime.

### 🔌 Multiple Transports

Supports HTTP, SSE, and stdio transport protocols for maximum flexibility.

### 🔐 Enterprise Authentication

Built-in support for JWT, GitHub, Google, Discord, Azure AD, and custom auth providers with token caching.

### 🌐 CORS Ready

Full CORS middleware for web client integration with configurable origins and methods.

### 🎨 OpenAPI Support

Automatically convert OpenAPI 3.0 specifications to MCP tools with route filtering and authentication.

### 🔍 Health Monitoring

Built-in health check endpoint for container orchestration and monitoring systems.

### 📊 Structured Logging

Configurable log levels with comprehensive logging for debugging and production monitoring.

### 🛡️ JSON Schema Validation

Automatic configuration validation against schemas to catch errors early.

## Quick Start

### Using Docker Compose (Recommended)

1. **Clone the repository**:

```bash
git clone https://github.com/baoduy/drunk-mcp-proxy.git
cd drunk-mcp-proxy
```

2. **Configure your services** in `data/config.json`:

```json
[
  {
    "path": "/",
    "spec_file": "mcp/mcp.json",
    "spec_type": "mcp",
    "base_url": null
  }
]
```

3. **Start the services**:

```bash
docker-compose up -d
```

4. **Verify it's running**:

```bash
curl http://localhost:9123/health
```

### Using Docker

```bash
# Build the image
docker build -t drunk-mcp-proxy .

# Run the container
docker run -d \
  -p 9123:9123 \
  -v $(pwd)/data:/mcp_proxy/data \
  --name mcp-proxy \
  drunk-mcp-proxy
```

### Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables (optional)
export FASTMCP_CONFIG_DIR=./data
export FASTMCP_LOG_LEVEL=DEBUG

# Run the server
python src/main.py
```

The server will start on `http://0.0.0.0:9123` by default.

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MCP Client (e.g., Claude Desktop)             │
│                    HTTP/SSE Request with Authorization Header           │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 v
┌─────────────────────────────────────────────────────────────────────────┐
│                        drunk-mcp-proxy Server                           │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │              Starlette ASGI Application                         │    │
│  │  ┌──────────────────────────────────────────────────────┐     │    │
│  │  │           CORS Middleware (Optional)                  │     │    │
│  │  └──────────────────────────────────────────────────────┘     │    │
│  │  ┌──────────────────────────────────────────────────────┐     │    │
│  │  │            Health Check Endpoint                      │     │    │
│  │  │              GET /health                              │     │    │
│  │  └──────────────────────────────────────────────────────┘     │    │
│  │  ┌──────────────────────────────────────────────────────┐     │    │
│  │  │           Root MCP Server (/)                         │     │    │
│  │  │         POST /mcp (Mounted Services)                  │     │    │
│  │  └──────────────────────────────────────────────────────┘     │    │
│  │  ┌──────────────────────────────────────────────────────┐     │    │
│  │  │      Namespaced MCP Services                          │     │    │
│  │  │      POST /stock/mcp                                  │     │    │
│  │  │      POST /wiki/mcp                                   │     │    │
│  │  │      POST /api/mcp (OpenAPI)                          │     │    │
│  │  └──────────────────────────────────────────────────────┘     │    │
│  └────────────────────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────┬──────────────────────────────┘
                       │                  │
        ┌──────────────┼──────────────────┼────────────────┐
        v              v                  v                v
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  MCP Server  │ │  MCP Server  │ │   OpenAPI    │ │   OpenAPI    │
│   (HTTP)     │ │   (stdio)    │ │   Service    │ │   Service    │
│  Stock API   │ │  Wiki Docs   │ │  + Azure     │ │  + Pass-     │
│              │ │              │ │    OAuth     │ │    Through   │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### Component Architecture

The proxy is built with a modular architecture:

```
src/
├── main.py                          # Application entry point
├── app/
│   ├── server.py                    # MCPProxyServer - Server orchestration
│   ├── starlette_app.py             # StarletteApp - ASGI app factory
│   ├── lifespan.py                  # Lifecycle management
│   ├── auth_provider.py             # GlobalAuthProvider - Auth factory
│   └── middleware/
│       └── cros_middleware.py       # CORS middleware
├── proxies/
│   ├── config_provider.py           # ProxyConfigProvider - Config loader
│   ├── mcp_proxy_provider.py        # McpProxyProvider - MCP proxy
│   └── openapi_mcp_provider.py      # OpenApiMcpProvider - OpenAPI converter
├── auth_providers/
│   ├── azure_oauth.py               # AzureOauth - Azure AD OAuth2
│   └── auth_pass_through.py         # AuthPassThrough - Token forwarding
└── tools/
    ├── spec_config.py               # Configuration models
    ├── auth_config.py               # Auth configuration models
    └── env_resolver.py              # Environment variable substitution
```

## Feature 1: Dynamic MCP Service Management

drunk-mcp-proxy provides comprehensive management for proxying MCP services, aggregating multiple MCP servers into a unified interface with namespace isolation to prevent tool name conflicts.

### Root Path Aggregation

Services configured with `path="/"` are mounted on a single root MCP server, allowing clients to access all tools via a single endpoint:

```json
{
  "path": "/",
  "spec_file": "mcp/root-services.json",
  "spec_type": "mcp"
}
```

**Benefits:**

- Single endpoint for multiple services
- Simplified client configuration
- Automatic tool aggregation
- Centralized authentication

### Namespaced Services

Services configured with specific paths (e.g., `path="/stock"`) get their own isolated MCP server instance:

```json
{
  "path": "/stock",
  "spec_file": "mcp/stock.mcp.json",
  "spec_type": "mcp"
}
```

**Benefits:**

- Prevent tool name conflicts
- Independent lifecycle management
- Service-specific authentication
- Logical service grouping

### Configuration Example

**config.json:**

```json
[
  {
    "path": "/",
    "spec_file": "mcp/mcp.json",
    "spec_type": "mcp",
    "base_url": null
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
    "tags": ["documentation", "internal"]
  }
]
```

**mcp/stock.mcp.json:**

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

## Feature 2: OpenAPI to MCP Conversion

One of the most powerful features of drunk-mcp-proxy is its ability to automatically convert OpenAPI 3.0 specifications into MCP tools, enabling seamless integration of RESTful APIs into the MCP ecosystem.

### Automatic Tool Generation

Each OpenAPI endpoint is automatically converted to an MCP tool:

- Tool names derived from `operationId` or auto-generated
- Tool descriptions from OpenAPI `summary` or `description`
- Parameters automatically mapped from query params, path params, and request body
- HTTP methods and content types handled automatically

### Route Filtering

Control which endpoints are exposed as MCP tools:

**By HTTP Method:**

```json
{
  "filters": {
    "methods": ["GET", "POST", "PUT"]
  }
}
```

**By Tags:**

```json
{
  "filters": {
    "tags": ["public", "v1"]
  }
}
```

This reduces tool clutter and improves security by limiting exposed endpoints.

### Configuration Example

```json
{
  "path": "/api",
  "spec_file": "openapi/api.openapi.json",
  "spec_type": "openapi",
  "base_url": "http://api.example.com",
  "filters": {
    "methods": ["GET", "POST"],
    "tags": ["public"]
  },
  "auth": {
    "pass_through": true
  }
}
```

**Request Flow:**

1. MCP client calls tool (e.g., `getCurrencyPairs`)
2. Proxy converts MCP call to HTTP request
3. Authentication is applied (pass-through or Azure OAuth)
4. HTTP request sent to backend API
5. Response converted back to MCP format
6. Result returned to client

## Feature 3: Enterprise Authentication

drunk-mcp-proxy provides flexible authentication mechanisms for both client-to-proxy and proxy-to-backend authentication.

### Supported Authentication Methods

1. **JWT**: Token-based authentication with JWKS validation
2. **GitHub OAuth**: GitHub user authentication
3. **Google OAuth**: Google user authentication
4. **Discord OAuth**: Discord user authentication
5. **Azure AD OAuth2**: Enterprise SSO with Azure Active Directory
6. **Custom Providers**: Extensible authentication framework

### Pass-Through Authentication

The simplest authentication method where the client's token is forwarded to backend services:

```json
{
  "auth": {
    "pass_through": true
  }
}
```

**How it works:**

1. Client sends request with `Authorization: Bearer <token>`
2. Proxy validates token (if configured)
3. Token is forwarded to backend API
4. No token management or caching required

**Use cases:**

- Backend services handle their own authentication
- Zero-trust architecture
- Multi-tenant applications

### Azure OAuth2 Integration

For services protected by Azure AD, the proxy can automatically obtain and manage access tokens:

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

**Features:**

- Automatic token acquisition using client credentials flow
- In-memory token caching with expiry detection
- Automatic token refresh
- Transparent to MCP clients

**Use cases:**

- Internal services protected by Azure AD
- Enterprise applications with Azure SSO
- Services requiring application-level authentication

## Skills Directory Provider

The Skills Directory Provider allows you to expose Markdown-based skill documentation as MCP resources, providing LLMs with structured knowledge about code patterns and best practices.

### Configuration

```json
{
  "path": "/",
  "spec_type": "mcp",
  "skill_dir": "skills",
  "mcpServers": {
    "memory": {
      "enabled": true,
      "command": "npx",
      "args": ["@modelcontextprotocol/server-memory"],
      "transport": "stdio"
    }
  }
}
```

**Directory Structure:**

```
data/skills/
├── architecture/
│   ├── patterns/
│   │   └── SKILL.md
│   └── guidelines/
│       └── SKILL.md
└── dknet/
    ├── efcore-repos/
    │   └── SKILL.md
    └── slimbus-messaging/
        └── SKILL.md
```

### Use Cases

1. **Code Patterns**: Document common patterns and best practices
2. **Domain Knowledge**: Provide context about business logic
3. **API Documentation**: Expose internal API documentation
4. **Troubleshooting Guides**: Help AI assistants solve common issues

## Production Deployment

### Docker Deployment

The project includes a multi-stage Dockerfile optimized for production:

```dockerfile
# Build stage
FROM python:3.12-slim as builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Runtime stage
FROM python:3.12-slim
WORKDIR /mcp_proxy
COPY --from=builder /root/.local /root/.local
COPY src/ ./src/
COPY data/ ./data/

ENV PATH=/root/.local/bin:$PATH
ENV FASTMCP_CONFIG_DIR=/mcp_proxy/data
EXPOSE 9123

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:9123/health || exit 1

CMD ["python", "src/main.py"]
```

### Health Monitoring

The proxy exposes a health check endpoint at `/health`:

```bash
curl http://localhost:9123/health
# Response: {"status": "healthy"}
```

**Use for:**

- Docker/Kubernetes health checks
- Load balancer health probes
- Monitoring system integrations

### Environment Configuration

Key environment variables:

```bash
# Server Configuration
FASTMCP_PORT=9123
FASTMCP_HOST=0.0.0.0
FASTMCP_LOG_LEVEL=INFO

# Config Directory
FASTMCP_CONFIG_DIR=./data

# CORS Configuration
CORS_ALLOW_ORIGINS=http://localhost:3000,https://app.example.com
CORS_ALLOW_METHODS=GET,POST,PUT,DELETE
CORS_ALLOW_HEADERS=*

# Authentication (for Azure OAuth)
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=your-tenant-id
```

## Real-World Use Cases

### Use Case 1: Unified Gateway for Multiple Internal Services

**Scenario**: Organization has multiple internal MCP services (HR, Finance, Documentation) that need to be accessible through a single endpoint.

**Solution**:

```json
[
  {
    "path": "/",
    "spec_type": "mcp",
    "spec_file": "mcp/root.json"
  }
]
```

**Benefits**:

- Single endpoint for all services
- Centralized authentication
- Simplified client configuration
- Reduced network complexity

### Use Case 2: Secure API Gateway with Azure AD

**Scenario**: External REST API protected by Azure AD needs to be exposed as MCP tools.

**Solution**:

```json
{
  "path": "/api",
  "spec_type": "openapi",
  "spec_file": "openapi/api.json",
  "base_url": "https://api.internal.com",
  "auth": {
    "azure": {
      "client_id": "$AZURE_CLIENT_ID",
      "client_secret": "$AZURE_CLIENT_SECRET",
      "tenant_id": "$AZURE_TENANT_ID",
      "scopes": ["api://api-id/.default"]
    }
  }
}
```

**Benefits**:

- Automatic token management
- No client-side Azure integration needed
- Token caching for performance
- Transparent authentication

### Use Case 3: Multi-Tenant SaaS Architecture

**Scenario**: SaaS application with tenant-specific MCP services.

**Solution**:

```json
[
  {
    "path": "/tenant-a",
    "spec_type": "mcp",
    "spec_file": "mcp/tenant-a.json"
  },
  {
    "path": "/tenant-b",
    "spec_type": "mcp",
    "spec_file": "mcp/tenant-b.json"
  }
]
```

**Benefits**:

- Namespace isolation per tenant
- Independent configuration
- Simplified routing
- Enhanced security

## Best Practices

1. **Use Namespace Isolation**:
   - Use separate paths for logically distinct services
   - Prevents tool name conflicts
   - Enables independent lifecycle management

2. **Implement Health Checks**:
   - Always configure health check endpoints
   - Monitor proxy and backend service health
   - Set up alerting for failures

3. **Secure with Authentication**:
   - Always use authentication in production
   - Prefer pass-through auth for zero-trust architectures
   - Use Azure OAuth for enterprise integrations

4. **Filter OpenAPI Routes**:
   - Use method and tag filters to limit exposed endpoints
   - Reduces attack surface
   - Improves performance

5. **Enable CORS Properly**:
   - Configure specific allowed origins
   - Avoid wildcard origins in production
   - Set appropriate allowed methods

6. **Use Environment Variables**:
   - Never commit secrets in config files
   - Use environment variable substitution
   - Leverage secret management systems

7. **Monitor and Log**:
   - Configure appropriate log levels
   - Use structured logging
   - Integrate with monitoring systems

8. **Container Best Practices**:
   - Use multi-stage Docker builds
   - Set resource limits
   - Configure proper health checks

## Conclusion

drunk-mcp-proxy solves the complexity of managing multiple MCP services and integrating REST APIs into the MCP ecosystem. With its powerful features including dynamic routing, namespace isolation, OpenAPI conversion, and enterprise authentication, it provides a production-ready solution for organizations building AI-powered applications.

Key takeaways:

- **Unified Interface**: Single gateway for multiple backend services
- **OpenAPI Integration**: Automatic conversion of REST APIs to MCP tools
- **Enterprise Ready**: Production-grade authentication, monitoring, and deployment
- **Flexible Architecture**: Support for multiple transports and authentication methods
- **Easy to Deploy**: Docker support with comprehensive documentation

Whether you're building internal tools, integrating external APIs, or creating a multi-tenant SaaS platform, drunk-mcp-proxy provides the foundation for scalable, secure, and maintainable MCP infrastructure.

## References

- **GitHub Repository**: [github.com/baoduy/drunk-mcp-proxy](https://github.com/baoduy/drunk-mcp-proxy)
- **Docker Hub**: Available via GitHub Container Registry
- **Model Context Protocol**: [modelcontextprotocol.io](https://modelcontextprotocol.io)
- **FastMCP**: Python framework for building MCP servers
- **Documentation**: See README.md in the repository for detailed configuration options
