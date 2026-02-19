---
title: "DrunkBlog: A Production-Ready MCP Gateway for AI Tooling"
author: "DrunkBlog (Steven Hoang)"
datetime: 2026-02-19
slug: drunkblog-mcp-proxy-improved
description: "A production-ready MCP gateway article rewrite featuring Docker Hub deployment (baoduy2412/mcp-proxy), concrete deployment steps, and OpenAPI integration."
tags: [MCP, API gateway, OpenAPI, AI tooling, DevOps]
---

DrunkBlog introduces drunk-mcp-proxy, a production-ready gateway for the Model Context Protocol (MCP). This post emphasizes Docker Hub deployment (baoduy2412/mcp-proxy) to simplify adoption without building from source.

## What is drunk-mcp-proxy?
- A Python 3.11+ based proxy using FastMCP and Starlette
- Unifies multiple MCP backends behind a single HTTP endpoint
- Automatically converts OpenAPI specs to MCP tools
- Supports enterprise authentication, CORS, token caching, and structured logging
- Docker-ready; no local build required when using the Docker Hub image

## Docker Hub deployment (no local build required)
- Image: baoduy2412/mcp-proxy
- Run:
  
- Compose:
  

## Configuration layout (no local build required)
- data/config.json
- data/mcp/*.json
- data/openapi/*.json

Root example:


Namespaced example (e.g., stock):


## Article structure and features
- Hook → problem → solution → features → setup → usage → architecture → security → conclusion
- Concrete code blocks from the repo (Docker, config layouts, and OpenAPI conversion)
- SEO-friendly front matter with title, description, and tags

## Changelog (summary of changes)
- Replaced generic content with Docker Hub deployment emphasis
- Added Docker Run and Docker Compose blocks
- Added Docker Hub path and production-readiness guidance
- Improved structure and SEO metadata
