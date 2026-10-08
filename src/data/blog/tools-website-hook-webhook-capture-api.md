---
author: Steven Hoang
pubDatetime: 2026-08-18T12:00:00Z
title: "[Tools] website-hook: A Disposable Webhook Capture API for Developers and Testers"
featured: true
draft: false
tags:
  - tools
  - webhook
  - testing
  - api
  - docker
  - cloudflare
  - dotnet
  - testcontainers
  - OpenSource
ogImage: ""
description: "website-hook gives us a throwaway URL that records every HTTP request an external system sends to it — method, path, query, headers, and body — with no account and no setup. This post covers the hosted inspector at webhook.lik.is, the full REST API, the .NET Testcontainers module, and how to self-host it on Docker or Cloudflare Workers."
---

Every integration we build eventually ends with the same sentence: "but what exactly is that system sending us?" A payment provider promises a callback. A CI server offers a notification hook. An AI agent claims it posts a result somewhere. The documentation describes one payload, and the real traffic looks like something else entirely.

**website-hook** is a small service that answers that question. We create a disposable webhook, we get back a unique URL, and every request that arrives at that URL is recorded in full — method, path, query string, headers, and raw body. No account, no signup, no configuration. When we stop using it, it deletes itself.

The hosted instance runs at [webhook.lik.is](https://webhook.lik.is/) and the source is at [github.com/baoduy/website-hook](https://github.com/baoduy/website-hook).

## Table of Contents

## The Problem We Keep Hitting

Debugging inbound traffic is awkward because the interesting part happens on someone else's machine. The usual workarounds all cost us something:

1. **Add logging to our own endpoint.** This only works after the endpoint exists, and it usually logs what our framework parsed, not the raw bytes that arrived.
2. **Run a tunnel to localhost.** Useful, but it means our laptop has to be online, reachable, and running the right branch at the right moment.
3. **Read the vendor's documentation.** Documentation describes the intended payload. It rarely mentions the extra header, the odd content type, or the trailing slash that breaks our router.
4. **Ask the other team.** This turns a five-minute question into a two-day thread.

What we actually want is a URL that accepts anything, remembers everything, and requires nothing from us. That is the whole idea behind website-hook.

## What website-hook Is

A stateful HTTP capture service with two faces:

- A **browser inspector** at the site root, where we click once to create a webhook and watch requests appear as they land.
- A **REST management API**, so the same workflow can run inside a test suite, a shell script, or a CI job.

Both talk to the same storage. Anything we create in the browser can be read through the API, and the other way around.

Two design decisions are worth pointing out early, because they shape how the service behaves:

- **The capture endpoint always answers `200`.** If storage fails for any reason, the failure is logged on the server and never shown to the sender. We are inspecting traffic, not gating it — a capture URL must never be the reason someone's retry loop starts firing.
- **Bodies are stored as opaque bytes.** The service does not try to parse JSON, XML, or form data. It keeps what arrived and gives it back to us verbatim, base64-encoded over the API.

## Quick Start

### In the browser

Open [webhook.lik.is](https://webhook.lik.is/), create a webhook, and copy the URL. Point anything at it and the requests show up in the list — the inspector polls for new arrivals every four seconds, so we do not need to refresh.

The inspector keeps our recent webhook IDs in the browser's `localStorage` (up to five of them), which is how it can offer a history without asking us to log in. That list lives only in our browser: clearing site data loses the IDs, so it is worth saving the URL somewhere if we plan to come back to it tomorrow.

### From the terminal

The same flow with `curl`. First, create a webhook:

```bash
curl -s -X POST https://webhook.lik.is/api/webhooks
```

```json
{
  "id": "0f2c4c50-9a1f-4b1d-9c33-3a2b8f0f1c77",
  "url": "https://webhook.lik.is/0f2c4c50-9a1f-4b1d-9c33-3a2b8f0f1c77",
  "createdAt": "2026-08-18T09:00:00.000Z",
  "expiresAt": "2026-08-25T09:00:00.000Z"
}
```

Now send it something. Any method, any path under the webhook ID, any body:

```bash
curl -X POST "https://webhook.lik.is/0f2c4c50-9a1f-4b1d-9c33-3a2b8f0f1c77/orders/created?source=demo" \
  -H "Content-Type: application/json" \
  -H "X-Signature: t=1755500000,v1=abc123" \
  -d '{"orderId":"A-1001","total":42.5}'
```

And read back what the server actually received:

```bash
curl -s "https://webhook.lik.is/api/webhooks/0f2c4c50-9a1f-4b1d-9c33-3a2b8f0f1c77/requests?limit=5"
```

The response is a page of captured requests, newest first. Bodies come back base64-encoded, so decoding one is a single extra step:

```bash
curl -s ".../requests?limit=1" | jq -r '.items[0].body' | base64 -d
# {"orderId":"A-1001","total":42.5}
```

That last detail matters more than it looks. Because the body is stored as bytes and handed back untouched, we can see a payload that our own parser would have rejected — a malformed JSON document, an unexpected `charset`, a gzip stream, an empty body where we expected content.

## The Management API

The full surface is small enough to fit in one table:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/webhooks` | Create a webhook — returns `201` with `id`, `url`, `createdAt`, `expiresAt` |
| `GET` | `/api/webhooks/:id` | Metadata — `createdAt`, `lastActivityAt`, `requestCount`, `expiresAt` |
| `DELETE` | `/api/webhooks/:id` | Delete the webhook and its requests — `204`, idempotent |
| `GET` | `/api/webhooks/:id/requests` | List captured requests, newest first, cursor-paginated |
| `GET` | `/api/webhooks/:id/requests/:requestId` | One captured request in full |
| `*` | `/:id/*path` | The capture route — accepts every method and any sub-path |

A few behaviours to keep in mind:

- **Pagination** uses `?limit=` (default 20, maximum 100) and `?cursor=`. Each page returns `{ items, nextCursor }`; we pass `nextCursor` back to fetch the page after it, and omit it for the first page.
- **Missing, expired, or deleted webhooks** return `404 { "error": "not_found" }` from every endpoint that references them — including the capture route.
- **`DELETE` is idempotent.** Deleting a webhook that is already gone still returns `204`, so cleanup code in a test teardown never needs a guard.

A single captured request looks like this:

```json
{
  "id": "1b7d...",
  "method": "POST",
  "path": "/orders/created",
  "query": "source=demo",
  "headers": "{\"content-type\":\"application/json\",\"x-signature\":\"t=1755500000,v1=abc123\"}",
  "body": "eyJvcmRlcklkIjoiQS0xMDAxIiwidG90YWwiOjQyLjV9",
  "truncated": false,
  "createdAt": "2026-08-18T09:01:12.000Z"
}
```

Rather than repeating every schema here, the service publishes its own: the OpenAPI document is generated at build time and served at [`/openapi.json`](https://webhook.lik.is/openapi.json), with an interactive reference UI at [`/api/reference`](https://webhook.lik.is/api/reference). That is the authoritative description, and it is generated from the routes themselves — so it cannot drift from the implementation the way a hand-written table can.

There is also a small [status page](https://webhook.lik.is/status) backed by `/api/statistics/*`, showing traffic and storage over rolling windows. Handy when we want to know whether the instance is healthy before blaming it for a missing request.

## Limits and Lifecycle

The service is deliberately bounded. Knowing the numbers saves us from misreading a result as a bug:

| Limit | Value | What happens at the boundary |
|-------|-------|------------------------------|
| Request body size | 1 MiB | The first 1 MiB is stored, the rest is drained so the connection still closes cleanly, and the request is flagged `truncated: true` |
| Stored requests per webhook | 1,000 | The oldest rows are trimmed as new ones arrive |
| Idle expiry | 7 days | The webhook and all of its requests are deleted |

The expiry clock is based on **activity, not creation**. Every captured request updates the webhook's `lastActivityAt`, which pushes the 7-day window forward. A webhook we keep using stays alive; one we forget about cleans itself up. That is why there is no account system — there is nothing to accumulate.

The `truncated` flag deserves a note. When we see a body that looks cut off, that flag tells us whether the sender really sent a partial payload or whether we simply hit the 1 MiB ceiling. Without it, a truncated capture is indistinguishable from a genuinely broken request.

## Using It in Automated Tests

Manual inspection is the obvious use. The more valuable one, in our experience, is asserting on webhook traffic inside a test suite — proving that our code sent the callback it claims to send, with the headers and body we expect.

The pattern is the same in any language:

1. `POST /api/webhooks` in the test setup, and take the returned `url`.
2. Configure the system under test to call that URL.
3. Trigger the behaviour.
4. Poll `GET /api/webhooks/:id/requests` until the expected request appears.
5. Assert on the method, path, headers, and decoded body.
6. `DELETE /api/webhooks/:id` in teardown.

For .NET, the repository ships a [Testcontainers](https://testcontainers.com/) module so step 1 does not need any network at all — the test spins up a real website-hook container locally:

```bash
dotnet add package DKNet.Tests.WebsiteHook
```

```csharp
var container = new WebsiteHookBuilder().Build();

await container.StartAsync();

var uri = container.GetServiceUri();
using var client = new HttpClient();
var response = await client.GetAsync(uri);

await container.DisposeAsync();
```

The builder defaults to the `ghcr.io/baoduy/website-hook:latest` image on internal port `3000`, and its wait strategy simply issues an HTTP request to an unknown webhook ID — any response, including the resulting `404`, proves the server is routing and therefore ready. It requires .NET 10 or later and a reachable Docker endpoint.

Customising it follows the usual Testcontainers style:

```csharp
var container = new WebsiteHookBuilder("ghcr.io/baoduy/website-hook:latest")
    .WithPortBinding(8080, 3000)
    .WithEnvironment("DB_PATH", "/data/webhook.db")
    .WithLabel("test", "example")
    .Build();
```

Running the capture service inside the test process is a real improvement over pointing tests at a shared public instance: the tests stay hermetic, they work offline, and one developer's run cannot see another's traffic.

## Self-Hosting

Anything sensitive should not be flowing through a public capture service, so self-hosting is a first-class path. There are two supported ones.

### Docker

```bash
docker run -p 3000:3000 -v website-hook-data:/data ghcr.io/baoduy/website-hook:latest
```

The image runs the Next.js standalone output under a non-root user and provisions its database schema on startup. Data lives in SQLite at `DB_PATH`, which defaults to `/data/webhook.db` inside the container — mounting `/data` as a volume is what makes captures survive a restart. For a longer-lived setup, the repository's `docker-compose.yml` wires the same thing up declaratively:

```bash
docker compose up -d
```

### Cloudflare Workers

The same application also deploys to Cloudflare Workers, using D1 instead of a SQLite file. The interesting part is how little of the code knows about it: a single Prisma client factory probes the Cloudflare context for a `DB` binding and picks the driver from what it finds. If a D1 binding is present, it uses the Prisma D1 adapter; otherwise it opens a SQLite file. The routes are identical in both modes.

One implementation note from that factory is worth borrowing for our own projects: it deliberately does **not** trust `process.env.NEXT_RUNTIME`, because the bundler statically replaces that value with `"nodejs"` at build time. Probing for the actual binding is the honest check.

### Configuration

| Variable | Default | Effect |
|----------|---------|--------|
| `DB_PATH` | `./data/webhook.db` (`/data/webhook.db` in the container) | SQLite file location in Node/Docker mode. Ignored on Workers, where D1 is used. |
| `DISABLE_RATE_LIMIT` | unset — the creation rate limit is **off** | Set it to `"false"`, `"0"`, or `"no"` to enable the 20-creations-per-minute-per-IP limit. Any other value keeps it off. |
| `DISABLE_WEBHOOK_QUOTA` | unset — the per-IP quota is **off** | Same inverted switch: `"false"`, `"0"`, or `"no"` enables the quota. |
| `WEBHOOK_QUOTA` | `5` when the quota is enabled | Maximum active webhooks per IP. Set to `0` or `"disabled"` to turn it off. |

The two `DISABLE_*` switches read backwards on first encounter, so it is worth restating plainly: **a fresh deployment has no rate limiting and no quota**, and we enable them by setting the disable-flag to `"false"`. For an instance exposed to the internet, that is usually the first thing to change.

One caveat if we plan to scale out: the rate limiter is an in-memory sliding window per instance. Behind a load balancer with several replicas, each replica counts separately, so the effective limit is multiplied by the number of instances. A shared store would be needed for accurate limiting across replicas.

## How It Works Inside

The whole capture path is short enough to describe in a paragraph, which is a good sign for a service we are trusting with debugging:

```
external sender
      │  HTTP (any method)
      ▼
/:id/*path
      │
      ├─ 404 if the webhook is missing or expired
      ▼
read the body, up to 1 MiB (flag `truncated` if larger)
      ▼
store method, path, query, headers, body
      ▼
trim to the newest 1,000 requests · update lastActivityAt
      ▼
SQLite file (Node/Docker)  or  Cloudflare D1 (Workers)
```

Expiry runs on a schedule rather than waiting for someone to visit the URL again: in Node and Docker an hourly in-process timer calls the purge routine, and on Workers a cron trigger fires the same logic at the top of every hour. Reads also re-check expiry as a second line of defence, so a webhook that is past its window returns `404` even in the gap before the next purge.

Full details are in the repository's [`docs/architecture.md`](https://github.com/baoduy/website-hook/blob/main/docs/architecture.md).

## Where It Fits in Day-to-Day Work

- **Integrating a third-party service.** Register the capture URL as the callback while building. We learn the real payload shape before writing a single line of parsing code.
- **Testing our own outbound webhooks.** Point our application's notification URL at a capture webhook and confirm what we actually send — including the headers we thought our HTTP client was adding.
- **Debugging a signature mismatch.** Signature checks fail over invisible differences: a header name in the wrong case, a body re-serialised by a proxy, an extra newline. Raw bytes plus raw headers make the difference visible.
- **QA and manual test runs.** A tester needs no local environment, no credentials, and no developer help — just a URL and a browser tab.
- **Verifying an AI agent or automation.** When a tool claims it posted a result to an endpoint, a capture webhook is the cheapest way to check whether it did, and what it sent.
- **Reproducing an incident.** Capture the traffic once, then replay the stored request against a local build as many times as needed.

## Practical Notes

1. **Treat public capture URLs as public.** Anyone holding the ID can read every request stored under it. Never point production traffic, real tokens, or personal data at a shared instance — self-host for anything that matters.
2. **Save the URL, not just the browser tab.** The remembered-webhook list lives in `localStorage` and holds five entries; clearing site data loses them.
3. **Poll, do not sleep.** In automated tests, poll the requests endpoint until the expected request appears rather than waiting a fixed number of seconds. Capture is fast, but a fixed sleep is either slow or flaky, and often both.
4. **Check `truncated` before debugging a "corrupt" body.** A 1 MiB payload is truncated by design, not damaged in transit.
5. **Delete webhooks in test teardown.** `DELETE` is idempotent and cascades to captured requests, so cleanup is one unconditional call.
6. **Enable the limits on an exposed instance.** Set `DISABLE_RATE_LIMIT=false` and `DISABLE_WEBHOOK_QUOTA=false` — they are off by default.
7. **Read `/api/reference` rather than any blog post — including this one — for exact schemas.** The spec is generated from the code and will always be more current.

## Conclusion

website-hook does one thing: it makes inbound HTTP traffic visible, with the smallest possible amount of ceremony. One `POST` gives us a URL. Everything sent there is recorded exactly as it arrived. Seven idle days later it is gone, and we never had to create an account to make any of that happen.

For a quick look, the hosted instance is ready right now:

```bash
curl -s -X POST https://webhook.lik.is/api/webhooks
```

For anything sensitive, one container gives us the same service on our own infrastructure:

```bash
docker run -p 3000:3000 -v website-hook-data:/data ghcr.io/baoduy/website-hook:latest
```

## References

- **Live instance**: [webhook.lik.is](https://webhook.lik.is/)
- **GitHub repo**: [github.com/baoduy/website-hook](https://github.com/baoduy/website-hook)
- **API reference (Scalar)**: [webhook.lik.is/api/reference](https://webhook.lik.is/api/reference)
- **OpenAPI spec**: [webhook.lik.is/openapi.json](https://webhook.lik.is/openapi.json)
- **Container image**: `ghcr.io/baoduy/website-hook:latest`
- **NuGet package**: `DKNet.Tests.WebsiteHook`
- **Testcontainers**: [testcontainers.com](https://testcontainers.com/)

## Related Articles

- [[.NET] Aspire, Simplifying Local Development Environment and Testing.](/posts/dotnet-04-aspire-local-env-tests)
- [Introducing DKNet: An Enterprise .NET Library for DDD and Clean Architecture](/posts/dotnet-08-dknet-introduction)
- [[Tools] Drunk Charts: A Reusable Helm Library for Kubernetes Deployments](/posts/tools-drunk-helm-charts-library)

## Thank You

Thanks for reading. If website-hook saves us from one more round of "can you paste what you actually sent?", it has paid for itself. Issues and pull requests are welcome on the [GitHub repo](https://github.com/baoduy/website-hook).

**Steven** | _[GitHub](https://github.com/baoduy)_
