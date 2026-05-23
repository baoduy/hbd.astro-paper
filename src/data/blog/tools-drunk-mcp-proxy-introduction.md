---
author: Steven Hoang
pubDatetime: 2026-02-19T13:00:00Z
title: "[Tools] Introducing drunk-mcp-proxy: One Gateway for MCP, OpenAPI and LLM Backends"
postSlug: tools-drunk-mcp-proxy-introduction
featured: true
draft: true
tags:
  - mcp
  - proxy
  - fastmcp
  - python
  - openapi
  - llm
  - anthropic
  - docker
ogImage: ""
description: "drunk-mcp-proxy is a production-ready Python gateway that unifies multiple MCP servers, converts OpenAPI specs into MCP tools, and proxies OpenAI- and Anthropic-compatible LLM APIs from a single endpoint. Deploy it from Docker Hub (baoduy2412/mcp-proxy) in minutes."
---

The longer my team works with the Model Context Protocol, the more obvious one problem becomes: every new capability ships as yet another MCP server. One for internal docs, one for finance data, one wrapping a REST API, one for a private LLM in LM Studio. Each has its own URL, its own auth, its own client config — and the moment two of them expose a tool called `search`, everything falls over.

I built **drunk-mcp-proxy** to make that pain go away. It's a single Python gateway that sits in front of all your MCP backends, your OpenAPI services, and your LLM providers, and gives every client one URL to talk to. Tool names stay isolated, auth is handled centrally, and any OpenAPI 3.0 spec becomes a usable MCP toolset without writing code.

## Table of Contents

## Why You Need an MCP Gateway

As teams adopt MCP in production, the same pain points keep surfacing:

1. **Service sprawl** — five MCP servers means five connections in every client config.
2. **Tool name collisions** — two backends both expose `search` or `query`, and the LLM can't tell them apart.
3. **Authentication complexity** — one backend wants a JWT, another wants Azure AD, a third just wants a bearer token.
4. **Client churn** — every new backend forces a config push to every IDE, agent, or app.
5. **REST APIs are not MCP** — your existing OpenAPI services need wrapping before an LLM can use them.
6. **LLM provider fragmentation** — OpenAI, LM Studio, Ollama, OpenRouter and Anthropic all speak slightly different dialects.
7. **No central observability** — health, logs and token usage are scattered across services.

`drunk-mcp-proxy` addresses all of these with a single config file and a single container.

## What is drunk-mcp-proxy?

A production-ready proxy server built with Python and [FastMCP](https://github.com/jlowin/fastmcp), running on the [Starlette](https://www.starlette.io/) ASGI stack. It acts as a central gateway for both MCP services and LLM providers, with three jobs:

1. **Aggregate MCP backends** behind one HTTP endpoint, optionally namespaced by path.
2. **Convert OpenAPI 3.0 specs** into MCP tools at startup — no code changes to your REST APIs.
3. **Proxy LLM traffic** through an OpenAI-compatible (and Anthropic-compatible) gateway, so any client can talk to any backend.

Core capabilities:

- **Unified interface** — single HTTP endpoint for multiple backend MCP servers, OpenAPI services, and LLM providers.
- **Dynamic routing** — path-based routing to configured backends (`/stock/mcp`, `/wiki/mcp`, `/api/mcp`).
- **Namespace isolation** — per-server namespaces prevent tool name conflicts.
- **OpenAPI → MCP conversion** — automatic, with method and tag filtering.
- **OpenAI-compatible LLM gateway** — `/api/v1/chat/completions`, `/embeddings`, `/images/generations`, and more.
- **Anthropic Messages API compatibility** — point a Claude client at the proxy and it just works.
- **WebSocket Responses API** — native WebSocket support for OpenAI's streaming Responses API.
- **14+ auth providers** — JWT, Bearer, Azure AD, GitHub, Google, Discord, Auth0, WorkOS, Scalekit, Descope, plus pass-through and custom.
- **Production-ready** — health checks, CORS, structured logging, OAuth token caching, Docker image.

The project is open source: [github.com/baoduy/drunk-mcp-proxy](https://github.com/baoduy/drunk-mcp-proxy).

## Quick Start with Docker Hub

The fastest path — no source build required. The image is published as **`baoduy2412/mcp-proxy`**.

### Step 1: Prepare the config directory

```bash
mkdir -p data/mcp data/openapi data/skills
```

### Step 2: Create `data/config.yaml`

A single unified YAML file defines auth, LLM providers, and MCP/OpenAPI services:

```yaml
auth:
  defaultProvider: basic
  basic:
    token: $API_KEY

llm:
  - enabled: true
    websocket: true
    provider: openai
    base_url: "https://api.openai.com/v1"
    api_key: $OPENAI_API_KEY

mcp:
  - path: /
    spec_type: mcp
    skill_dir: skills
    mcp_servers:
      playwright:
        enabled: true
        command: npx
        args: ["@playwright/mcp@0.0.64"]
        transport: stdio

  - path: /api
    spec_type: openapi
    spec_file: openapi/petstore.yaml
    base_url: "https://api.example.com"
```

A few things worth noting up front:

- Environment variables (`$API_KEY`, `$AZURE_TENANT_ID`, `${VAR}`) are resolved when the config is loaded — keep secrets out of the file.
- Services with `path: /` are mounted on the root MCP server and share one endpoint. Services with a specific path (`/api`, `/stock`) get their own isolated MCP server at that path.
- `mcp_servers` accepts inline server definitions (stdio or http). For larger setups, point `spec_file` at a separate JSON file under `data/mcp/`.

### Step 3: Run it

`docker-compose.yml`:

```yaml
services:
  mcp-proxy:
    image: baoduy2412/mcp-proxy:latest
    container_name: mcp-proxy-server
    ports:
      - "${FASTMCP_PORT:-9123}:${FASTMCP_PORT:-9123}"
    volumes:
      - ./data:/drunk-proxy/data
    env_file:
      - .env
    environment:
      - FASTMCP_HOST=0.0.0.0
      - FASTMCP_PORT=${FASTMCP_PORT:-9123}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9123/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

`.env`:

```bash
FASTMCP_PORT=9123
FASTMCP_LOG_LEVEL=INFO
FASTMCP_AUTH_ENABLED=false
API_KEY=your-api-key-here

# Required if you enable any OAuth provider
FASTMCP_OAUTH_STORAGE_ENCRYPTION_KEY=your-44-character-fernet-key
```

Bring it up:

```bash
docker-compose up -d
curl http://localhost:9123/health
# {"status": "healthy"}
```

That's it — clients can now point at `http://localhost:9123/mcp` for the root MCP server, and `http://localhost:9123/api/v1/chat/completions` for the LLM gateway.

### Building from source (optional)

If you'd rather run from source:

```bash
git clone https://github.com/baoduy/drunk-mcp-proxy.git
cd drunk-mcp-proxy

# Local Python
python -m venv venv
source venv/bin/activate
pip install -e ".[dev]"
python src/main.py

# Or build the Docker image yourself
docker build -t drunk-mcp-proxy .
docker run -d -p 9123:9123 -v $(pwd)/data:/drunk-proxy/data drunk-mcp-proxy
```

## Architecture Overview

```
   MCP Client       LLM Client       Anthropic Client
        \              |                   /
         \             |                  /
          v            v                 v
 ┌──────────────────────────────────────────────────────┐
 │              drunk-mcp-proxy Server                  │
 │  Starlette ASGI + Uvicorn                            │
 │  ┌────────────────────────────────────────────────┐ │
 │  │ CORS  •  Auth  •  Health (/health)             │ │
 │  └────────────────────────────────────────────────┘ │
 │  ┌────────────────────────────────────────────────┐ │
 │  │ MCP layer                                      │ │
 │  │   POST /mcp           → Root (aggregated)      │ │
 │  │   POST /stock/mcp     → Stock MCP backend      │ │
 │  │   POST /wiki/mcp      → Wiki MCP backend       │ │
 │  │   POST /api/mcp       → OpenAPI → MCP tools    │ │
 │  └────────────────────────────────────────────────┘ │
 │  ┌────────────────────────────────────────────────┐ │
 │  │ LLM gateway (/api/v1)                          │ │
 │  │   POST /chat/completions   (OpenAI)            │ │
 │  │   POST /messages           (Anthropic)         │ │
 │  │   WS   /responses          (OpenAI WS)         │ │
 │  │   POST /embeddings, /images/generations, ...   │ │
 │  │   GET  /models, /providers                     │ │
 │  └────────────────────────────────────────────────┘ │
 └──────────────────────────────────────────────────────┘
        |               |                |
        v               v                v
   [MCP backends]  [OpenAPI svcs]   [OpenAI / LM Studio / Ollama / ...]
```

### Key components

| Component | Purpose |
|-----------|---------|
| `MCPProxyServer` | Top-level orchestrator — loads config, creates proxy instances, starts uvicorn |
| `StarletteApp` | ASGI app factory — mounts MCP services, adds middleware, wires up the LLM gateway |
| `McpProxyProvider` | Creates FastMCP proxies from inline or external MCP spec definitions |
| `OpenApiMcpProvider` | Converts OpenAPI 3.0 specs into MCP tools with filtering |
| `LlmProvider` registry | Routes `/api/v1` traffic to the configured LLM backends by `{provider}_{model}` ID |
| `GlobalAuthProvider` | Pluggable client → proxy authentication (14+ implementations) |
| `CacheProvider` | OAuth token caching — memory, SQLite, or Redis |
| `AppLifespanManager` | Coordinates startup/shutdown for every mounted MCP and LLM sub-app |

## MCP Service Configuration

### Root path aggregation

Services with `path: /` are merged into a single root MCP server. Clients hit `POST /mcp` and see every tool from every aggregated backend:

- One endpoint, one connection per client.
- Centralised auth.
- Useful for "always-on" tools (skills, memory, browser automation).

### Namespaced services

Services with a specific path get their own isolated FastMCP instance:

```yaml
mcp:
  - path: /stock
    spec_file: mcp/stock.mcp.json
    spec_type: mcp
    tags: ["finance", "internal"]

  - path: /wiki
    spec_file: mcp/wiki.mcp.json
    spec_type: mcp
    tags: ["documentation"]
```

Each one is reachable at `POST /<path>/mcp` (e.g. `POST /stock/mcp`). Benefits:

- **No tool name conflicts** between domains.
- **Independent lifecycle** — restart one backend without affecting the others.
- **Service-specific auth** per namespace if you need it.

External spec files keep `config.yaml` readable when you have many backends. `data/mcp/stock.mcp.json`:

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

## OpenAPI to MCP Conversion

This is the feature that turned the proxy from "useful" into "I'm not deploying anything else":

1. Drop your OpenAPI 3.0 spec into `data/openapi/`.
2. Add a service entry with `spec_type: openapi`.
3. Every operation in the spec becomes an MCP tool, named from `operationId`.
4. Query, path and body parameters are mapped automatically; HTTP methods and content types are handled for you.

```yaml
mcp:
  - path: /api
    spec_type: openapi
    spec_file: openapi/api.yaml
    base_url: "https://api.example.com"
    filters:
      methods: ["GET", "POST"]
      tags: ["public", "v2"]
    auth:
      pass_through: true
```

Route filtering by method and tag keeps the tool list small and the attack surface narrow — exactly the endpoints you want exposed, nothing else.

## Enterprise Authentication

The proxy handles two layers separately: **client → proxy** and **proxy → backend**.

### Client → Proxy

Configured in the top-level `auth` block. The simplest option is bearer-token (API key) auth, which is what most teams want first:

```yaml
auth:
  defaultProvider: basic
  basic:
    token: $API_KEY
```

For OAuth, you can plug in any of the 14+ providers — Azure AD, GitHub, Google, Discord, Auth0, WorkOS, Scalekit, Descope, JWT-with-JWKS, and more:

```yaml
auth:
  defaultProvider: azure
  azure:
    client_id: $AZURE_CLIENT_ID
    client_secret: $AZURE_CLIENT_SECRET
    tenant_id: $AZURE_TENANT_ID
```

OAuth providers require `FASTMCP_OAUTH_STORAGE_ENCRYPTION_KEY` (a 44-character Fernet key) so cached tokens are encrypted at rest.

### Proxy → Backend

For per-service backend auth, configure it on the service entry itself.

**Pass-through** is the zero-trust friendly default — forward the client's token directly:

```yaml
- path: /api
  spec_type: openapi
  spec_file: openapi/api.yaml
  auth:
    pass_through: true
```

**Azure AD client credentials** lets the proxy acquire tokens for a private API on the client's behalf — the MCP client never sees Azure at all:

```yaml
- path: /finance
  spec_type: openapi
  spec_file: openapi/finance.yaml
  auth:
    azure:
      client_id: $AZURE_CLIENT_ID
      client_secret: $AZURE_CLIENT_SECRET
      tenant_id: $AZURE_TENANT_ID
      token_url: "https://login.microsoftonline.com/$AZURE_TENANT_ID/oauth2/v2.0/token"
      scopes: ["api://$AZURE_CLIENT_ID/.default"]
```

Tokens are cached (memory, SQLite or Redis) and refreshed automatically before expiry. Nice when you're running multiple replicas — point them at Redis and they share the cache.

## The LLM Gateway

If you configure any LLM provider, the proxy automatically exposes an OpenAI-compatible API at `/api/v1`. Models are addressed as `{provider}_{model_name}`, so routing is unambiguous:

- `openai_gpt-4o` → OpenAI's `gpt-4o`
- `lms_llama-3.2` → LM Studio's `llama-3.2`
- `oll_qwen2.5` → Ollama's `qwen2.5`
- `ort_claude-3-5-sonnet` → OpenRouter's `claude-3-5-sonnet`

### Endpoints

All mounted under `/api/v1` (configurable via `FASTMCP_LLM_ROUTE_PREFIX`):

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/chat/completions` | OpenAI-compatible chat |
| `POST` | `/messages` | Anthropic Messages API |
| `WS`   | `/responses` | OpenAI WebSocket Responses API |
| `POST` | `/embeddings` | Text embeddings |
| `POST` | `/images/generations` | Image generation |
| `POST` | `/audio/transcriptions` | Whisper-style transcription |
| `POST` | `/audio/translations` | Audio translation |
| `GET`  | `/models` | List models across all providers |
| `GET`  | `/providers` | List configured providers |

### Anthropic compatibility (the killer feature for Claude Code users)

The `/messages` endpoint speaks the Anthropic Messages API on the front, and any OpenAI-compatible backend on the back. That means you can point [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — or any Anthropic client — at a local LM Studio model, an Ollama model, or an OpenRouter model:

```bash
export ANTHROPIC_BASE_URL=http://localhost:9123/api/v1
export ANTHROPIC_AUTH_TOKEN=$API_KEY
claude --model lms_llama-3.2
```

The proxy handles the conversion in both directions: system prompts, multimodal content (text, base64 images, URL images), tool use, tool results, streaming SSE events, `stop_sequences` ↔ `stop`, and finish-reason mapping.

### WebSocket Responses API

The `/responses` WebSocket endpoint implements OpenAI's Responses API protocol. Native WebSocket is used when the upstream provider supports it (set `websocket: true` on the provider); otherwise the proxy falls back to the HTTP Responses API transparently.

```javascript
const ws = new WebSocket("ws://localhost:9123/api/v1/responses", {
  headers: { Authorization: "Bearer YOUR_API_KEY" }
});

ws.send(JSON.stringify({
  type: "response.create",
  response: {
    model: "openai_gpt-4o",
    instructions: "You are a helpful assistant.",
    input: [{ type: "message", role: "user", content: "Hello!" }]
  }
}));

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.type, data);
};
```

> The `previous_response_id` continuation feature only works for providers running on native WebSocket. HTTP-fallback providers will return an error if you try to use it.

## Skills Directory Provider

Skills are Markdown files that turn into MCP resources, so an LLM can read your code patterns and conventions as context. Point a service at a directory:

```yaml
mcp:
  - path: /
    spec_type: mcp
    skill_dir: skills
```

Directory layout:

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

Each `SKILL.md` is exposed as an MCP resource. This pairs nicely with the [DKNet libraries](/posts/dotnet-08-dknet-introduction <!-- verify slug -->) — drop your DDD or EF Core conventions into a skill folder and every connected agent can read them.

## Production Deployment

### Environment variables

The essentials (full list in `.env.sample`):

```bash
# Server
FASTMCP_PORT=9123
FASTMCP_HOST=0.0.0.0
FASTMCP_LOG_LEVEL=INFO
FASTMCP_CONFIG_DIR=/drunk-proxy/data
FASTMCP_AUTH_ENABLED=false

# CORS
FASTMCP_CORS_ALLOW_ORIGINS=https://app.example.com

# Bearer auth
API_KEY=your-api-key-here

# OAuth (required for any OAuth provider)
FASTMCP_OAUTH_STORAGE_ENCRYPTION_KEY=your-44-character-fernet-key

# Azure AD (when used)
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
AZURE_TENANT_ID=...
```

### Health monitoring

`GET /health` returns `{"status": "healthy"}`. Wire it into:

- Kubernetes readiness and liveness probes
- Docker healthchecks (already configured in the sample compose file)
- Your load balancer
- Your monitoring stack

### Kubernetes

The Docker Hub image works directly in a Deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-proxy
spec:
  replicas: 2
  selector:
    matchLabels:
      app: mcp-proxy
  template:
    metadata:
      labels:
        app: mcp-proxy
    spec:
      containers:
        - name: mcp-proxy
          image: baoduy2412/mcp-proxy:latest
          ports:
            - containerPort: 9123
          env:
            - name: FASTMCP_CONFIG_DIR
              value: /drunk-proxy/data
          readinessProbe:
            httpGet: { path: /health, port: 9123 }
          livenessProbe:
            httpGet: { path: /health, port: 9123 }
          volumeMounts:
            - name: config
              mountPath: /drunk-proxy/data
      volumes:
        - name: config
          configMap:
            name: mcp-proxy-config
```

For Helm-managed deployments, the same image plugs straight into the [drunk-charts library](/posts/tools-drunk-helm-charts-library <!-- verify slug -->) — drop it in as a deployment, mount a ConfigMap for `data/`, expose `9123`, and you're done.

## Real-World Use Cases

- **Unified gateway for internal services.** HR, Finance and Docs MCP servers behind one URL. Clients configure once.
- **Secure API gateway with Azure AD.** Wrap a private REST API protected by Azure AD; the proxy handles token acquisition and refresh, MCP clients never touch Azure.
- **Multi-tenant SaaS.** Per-tenant namespaces (`/tenant-a/mcp`, `/tenant-b/mcp`) with independent config and auth.
- **Legacy API integration.** Existing OpenAPI services become MCP tools with zero code changes.
- **BYO-LLM for Claude Code.** Run Claude Code against a local LM Studio model via the Anthropic compatibility shim.
- **Hybrid LLM routing.** Send embeddings to a cheap provider, code generation to a beefy one, and image work to a third — all through the same `/api/v1`.

## Best Practices

1. **Use namespaces for distinct domains.** Independent paths prevent tool conflicts and let you redeploy services in isolation.
2. **Filter OpenAPI routes.** Use `methods` and `tags` filters to expose only what an LLM should touch.
3. **Never commit secrets.** Use `$VAR` substitution everywhere; keep real values in `.env` or a secrets manager.
4. **Pin CORS origins in production.** Wildcards are a debugging tool, not a deployment.
5. **Enable health checks.** Required for sensible behaviour in Docker, Kubernetes, and behind a load balancer.
6. **Cache OAuth tokens externally.** Redis or SQLite when you scale beyond one replica — otherwise each pod stampedes the token endpoint.
7. **Set provider-specific `websocket: true` only when it's supported.** Wrong here and the streaming experience degrades silently to HTTP polling.
8. **Use the Docker Hub image.** `baoduy2412/mcp-proxy` is the supported deployment path; build from source only when you're hacking on the proxy itself.

## Conclusion

`drunk-mcp-proxy` collapses the moving parts of a real-world MCP setup into one container with one config file. You get:

- One endpoint for many MCP backends, with proper namespace isolation.
- Automatic OpenAPI → MCP conversion, so existing REST APIs become first-class tools.
- An OpenAI-compatible LLM gateway with Anthropic and WebSocket Responses API support — enough to let Claude Code, an OpenAI client and a custom agent all talk to the same backend pool.
- Enterprise auth with 14+ providers and per-backend token handling.
- A production-ready Docker image with health checks, CORS and structured logging built in.

If you're hand-rolling MCP client configs across half a dozen backends, or wrapping OpenAPI services by hand, pull the image and try it:

```bash
docker run -d -p 9123:9123 -v $(pwd)/data:/drunk-proxy/data baoduy2412/mcp-proxy
```

## References

- **GitHub repo**: [github.com/baoduy/drunk-mcp-proxy](https://github.com/baoduy/drunk-mcp-proxy)
- **Docker Hub**: [baoduy2412/mcp-proxy](https://hub.docker.com/r/baoduy2412/mcp-proxy)
- **Project docs**: [baoduy.github.io/drunk-mcp-proxy](https://baoduy.github.io/drunk-mcp-proxy/)
- **DeepWiki**: [deepwiki.com/baoduy/drunk-mcp-proxy](https://deepwiki.com/baoduy/drunk-mcp-proxy)
- **Model Context Protocol**: [modelcontextprotocol.io](https://modelcontextprotocol.io)
- **FastMCP**: [github.com/jlowin/fastmcp](https://github.com/jlowin/fastmcp)
- **Starlette**: [starlette.io](https://www.starlette.io/)

## Related Articles

- [[Tools] Drunk Charts: A Reusable Helm Library for Kubernetes Deployments](/posts/tools-drunk-helm-charts-library <!-- verify slug -->)
- [[.NET] DKNet: An Opinionated DDD + EF Core Toolkit](/posts/dotnet-08-dknet-introduction <!-- verify slug -->)
- [[Az] Day 11: Exposing a Private AKS Application via Cloudflare Tunnel](/posts/az-11-private-aks-expose-public-app-with-cloudflare-tunnel <!-- verify slug -->)

## Thank You

Thanks for reading — if `drunk-mcp-proxy` saves you from yet another bespoke MCP gateway, that's exactly what it's for. Feedback, issues and PRs are very welcome on the [GitHub repo](https://github.com/baoduy/drunk-mcp-proxy).

**Steven** | _[GitHub](https://github.com/baoduy)_

---

### Reviewer checklist

1. Verify the related-article slugs (`tools-drunk-helm-charts-library`, `dotnet-08-dknet-introduction`, `az-11-private-aks-expose-public-app-with-cloudflare-tunnel`) match the live posts and drop the `<!-- verify slug -->` markers.
2. Confirm the Docker Hub image tag strategy — `latest` here, but pin a version (`baoduy2412/mcp-proxy:1.x.y`) if you're recommending production use at publish time.
3. Double-check the LLM provider example versions (`@playwright/mcp@0.0.64`, etc.) still match the current `.env.sample` and `data/` samples in the repo on publish day.
4. Confirm the `FASTMCP_OAUTH_STORAGE_ENCRYPTION_KEY` length (44 chars / Fernet key) and the `FASTMCP_LLM_ROUTE_PREFIX` default haven't changed.
5. Update `pubDatetime` to the actual publish time and flip `draft: false` once happy.
6. Consider adding a hero image (architecture diagram from the repo's `diagram.svg`) as `ogImage`.
