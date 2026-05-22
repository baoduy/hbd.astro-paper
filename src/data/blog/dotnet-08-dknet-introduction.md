---
author: Steven Hoang
pubDatetime: 2026-05-22T09:00:00Z
title: "Introducing DKNet: An Enterprise .NET Library for DDD and Clean Architecture"
postSlug: dotnet-08-dknet-introduction
featured: true
draft: false
tags:
  - dotnet
  - ddd
  - clean-architecture
  - efcore
  - cqrs
  - domain-events
  - repository-pattern
  - slimbus
description: "Discover DKNet, an enterprise-grade .NET 10 library collection that brings Domain-Driven Design patterns, clean Onion Architecture, CQRS via SlimMessageBus, and production-ready infrastructure abstractions to your applications — all in focused, composable NuGet packages."
---

Building enterprise .NET applications is hard. You find yourself wiring up the same patterns repeatedly: repositories, specifications, domain events, CQRS handlers, lifecycle hooks, idempotency filters. You end up with a mix of hand-rolled abstractions that drift across projects, differ between teams, and resist testing.

**DKNet** is an enterprise-grade .NET library collection that solves exactly this. It targets **.NET 10.0 / C# 14** and provides production-ready implementations of Domain-Driven Design (DDD) building blocks and Onion Architecture patterns — available as focused, composable NuGet packages that you pick and combine as needed.

This post walks through what DKNet is, the problems it solves, how its packages are organised, and how to get started with the key patterns.

## Table of Contents

- [Table of Contents](#table-of-contents)
- [The Problem DKNet Solves](#the-problem-dknet-solves)
- [Architecture: Onion Architecture with DDD](#architecture-onion-architecture-with-ddd)
- [Package Overview](#package-overview)
- [Key Pattern 1: Entities and Abstractions](#key-pattern-1-entities-and-abstractions)
- [Key Pattern 2: Repository + Specification](#key-pattern-2-repository--specification)
  - [Defining Entities](#defining-entities)
  - [Using Repositories](#using-repositories)
  - [Building Specifications](#building-specifications)
- [Key Pattern 3: Lifecycle Hooks](#key-pattern-3-lifecycle-hooks)
- [Key Pattern 4: Domain Events](#key-pattern-4-domain-events)
- [Key Pattern 5: CQRS with SlimMessageBus](#key-pattern-5-cqrs-with-slimmessagebus)
  - [Commands and Handlers](#commands-and-handlers)
  - [The Auto-Save Interceptor](#the-auto-save-interceptor)
- [Service Layer: Blob Storage and PDF Generation](#service-layer-blob-storage-and-pdf-generation)
- [Idempotency at the API Boundary](#idempotency-at-the-api-boundary)
- [Quality Standards](#quality-standards)
- [Getting Started](#getting-started)
  - [Install Packages](#install-packages)
  - [Wire Up Your DbContext](#wire-up-your-dbcontext)
  - [Register Services](#register-services)
- [Real-World Example: An Order Service](#real-world-example-an-order-service)
- [Summary](#summary)

---

## The Problem DKNet Solves

Most enterprise teams hit the same wall:

- **Repeated boilerplate** — every project re-implements repositories, specifications, and audit fields slightly differently.
- **Infrastructure bleeding into the domain** — EF Core concerns creep into business entities.
- **Fragile event pipelines** — domain events get fired before `SaveChanges`, leading to state inconsistencies.
- **CQRS drift** — command handlers forget to call `SaveChangesAsync`, or do it twice.
- **No standard for cross-cutting concerns** — idempotency, blob storage, and PDF generation each get custom implementations.

DKNet addresses all of these by providing a consistent, well-tested foundation that follows DDD and Onion Architecture principles from the ground up.

---

## Architecture: Onion Architecture with DDD

DKNet is designed around a four-layer Onion Architecture:

```
┌─────────────────────────────────────────────────┐
│           🌐 Presentation Layer                  │
│         (API Endpoints, Controllers)             │
│  DKNet.AspCore.Idempotency                       │
└───────────────────┬─────────────────────────────┘
                    │
┌───────────────────┴─────────────────────────────┐
│           🎯 Application Layer                   │
│         (CQRS Handlers, Services)                │
│  DKNet.SlimBus.Extensions                        │
│  DKNet.Svc.*                                     │
└───────────────────┬─────────────────────────────┘
                    │
┌───────────────────┴─────────────────────────────┐
│           💼 Domain Layer                        │
│   (Entities, Aggregates, Domain Events)          │
│  DKNet.EfCore.Abstractions                       │
│  DKNet.EfCore.Events                             │
└───────────────────┬─────────────────────────────┘
                    │
┌───────────────────┴─────────────────────────────┐
│           🗄️ Infrastructure Layer                │
│      (Data Access, External Services)            │
│  DKNet.EfCore.Extensions, .Repos, .Hooks         │
│  DKNet.Fw.Extensions                             │
└─────────────────────────────────────────────────┘
```

The critical rule: **dependencies flow inward**. The domain layer has zero infrastructure dependencies. Business entities know nothing about EF Core, SlimBus, or blob storage.

---

## Package Overview

DKNet is modular — install only what you need:

| Package | Layer | Purpose |
|---|---|---|
| `DKNet.Fw.Extensions` | Core | Type/property/enum utilities |
| `DKNet.EfCore.Abstractions` | Domain | Entity interfaces (`IEntity<TKey>`, `IAuditedEntity`) |
| `DKNet.EfCore.Extensions` | Infrastructure | EF Core enhancements (`SnapshotContext`, navigation helpers) |
| `DKNet.EfCore.Repos` | Infrastructure | `Repository<T>`, `RepositorySpec<T>`, `RepositoryFactory` |
| `DKNet.EfCore.Repos.Abstractions` | Infrastructure | `IRepository<T>`, `IRepositorySpec` interfaces |
| `DKNet.EfCore.Specifications` | Infrastructure | `Specification<T>`, `PredicateBuilder`, composable queries |
| `DKNet.EfCore.Hooks` | Infrastructure | `IBeforeSaveHookAsync`, `IAfterSaveHookAsync` |
| `DKNet.EfCore.Events` | Domain/Infrastructure | `IEventEntity`, `EventHook`, `IEventPublisher` |
| `DKNet.SlimBus.Extensions` | Application | CQRS via SlimMessageBus, auto-save interceptor |
| `DKNet.Svc.BlobStorage.*` | Application | Blob storage (Azure, AWS S3, Local) |
| `DKNet.Svc.PdfGenerators` | Application | PDF generation (`IPdfGenerator`) |
| `DKNet.AspCore.Idempotency` | Presentation | Idempotent API endpoint filter |

---

## Key Pattern 1: Entities and Abstractions

The `DKNet.EfCore.Abstractions` package provides the base contracts that every domain entity implements. There are no EF Core references here — it is a pure abstractions package:

```csharp
// IEntity<TKey> — base for all entities
public interface IEntity<TKey>
{
    TKey Id { get; }
}

// IAuditedEntity — adds automatic audit tracking
public interface IAuditedEntity : IEntity<Guid>
{
    string CreatedBy { get; }
    DateTimeOffset CreatedOn { get; }
    string? UpdatedBy { get; }
    DateTimeOffset? UpdatedOn { get; }
}

// IEventEntity — marks an entity as capable of raising domain events
public interface IEventEntity
{
    IReadOnlyCollection<object> Events { get; }
    void AddEvent(object @event);
    void ClearEvents();
}
```

Your domain entities derive from the provided base classes:

```csharp
// Simple entity with a Guid key
public class Product : AuditedEntity<Guid>
{
    public Product(string createdBy) : base(Guid.NewGuid())
    {
        SetCreatedBy(createdBy);
    }

    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int StockQuantity { get; private set; }

    public void AdjustStock(int delta) => StockQuantity += delta;
}
```

The `AuditedEntity<TKey>` base class automatically tracks `CreatedBy`, `CreatedOn`, `UpdatedBy`, and `UpdatedOn` — wired up transparently by EF Core hooks (see below).

---

## Key Pattern 2: Repository + Specification

### Defining Entities

Here is a realistic domain model with navigation properties, following patterns from the DKNet test suite:

```csharp
public class Order : AuditedEntity<Guid>
{
    private readonly List<OrderLine> _lines = [];

    public Order(string createdBy) : base(Guid.NewGuid())
    {
        SetCreatedBy(createdBy);
        Status = OrderStatus.Pending;
    }

    public OrderStatus Status { get; private set; }
    public string CustomerId { get; set; } = string.Empty;
    public IReadOnlyList<OrderLine> Lines => _lines.AsReadOnly();

    public void AddLine(OrderLine line) => _lines.Add(line);
    public void Confirm() => Status = OrderStatus.Confirmed;
}

public class OrderLine : Entity<Guid>
{
    public OrderLine() : base(Guid.NewGuid()) { }

    public string ProductId { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
}
```

### Using Repositories

The recommended interface is `IRepositorySpec<T>`, which combines full CRUD with first-class `Specification<T>` support. It extends the base read/write split:

```csharp
// Read operations — always returns detached, non-tracked entities
public interface IReadRepository<T> where T : class
{
    IQueryable<T> Query();
    Task<T?> FindAsync(object id, CancellationToken cancellationToken = default);
    Task<T?> FindAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default);
}

// Write operations
public interface IWriteRepository<T> where T : class
{
    Task AddAsync(T entity, CancellationToken cancellationToken = default);
    Task AddRangeAsync(IEnumerable<T> entities, CancellationToken cancellationToken = default);
    Task UpdateAsync(T entity, CancellationToken cancellationToken = default);
    void Delete(T entity);
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

// Preferred: full CRUD + specification queries
public interface IRepositorySpec<T> : IReadRepository<T>, IWriteRepository<T> where T : class
{
    Task<T?> FindAsync(Specification<T> spec, CancellationToken cancellationToken = default);
    Task<IList<T>> ListAsync(Specification<T> spec, CancellationToken cancellationToken = default);
    Task<int> CountAsync(Specification<T> spec, CancellationToken cancellationToken = default);
}
```

In your application service or CQRS handler:

```csharp
public class OrderService(IRepositorySpec<Order> orders)
{
    public async Task<Order> PlaceOrderAsync(string customerId, string createdBy)
    {
        var order = new Order(createdBy) { CustomerId = customerId };
        await orders.AddAsync(order);
        await orders.SaveChangesAsync();
        return order;
    }

    public async Task<Order?> GetOrderAsync(Guid id)
        => await orders.FindAsync(id);

    public IQueryable<Order> GetPendingOrders()
        => orders.Query().Where(o => o.Status == OrderStatus.Pending);
}
```

### Building Specifications

`DKNet.EfCore.Specifications` leverages LinqKit to compose complex queries cleanly:

```csharp
public class ActiveOrdersForCustomerSpec : Specification<Order>
{
    public ActiveOrdersForCustomerSpec(string customerId)
    {
        // Composable predicate — translated to SQL by LinqKit
        AddCriteria(o => o.CustomerId == customerId
                      && o.Status != OrderStatus.Cancelled);

        // Include related data
        AddInclude(o => o.Lines);

        // Default ordering
        ApplyOrderBy(o => o.CreatedOn);
    }
}

// Using the specification with IRepositorySpec
public class OrderQueryService(IRepositorySpec<Order> orders)
{
    public async Task<IList<Order>> GetActiveOrdersAsync(string customerId)
    {
        var spec = new ActiveOrdersForCustomerSpec(customerId);
        return await orders.ListAsync(spec);
    }
}
```

Specifications are composable using `PredicateBuilder`:

```csharp
public class OrderSearchSpec : Specification<Order>
{
    public OrderSearchSpec(OrderSearchFilter filter)
    {
        var predicate = PredicateBuilder.New<Order>(true);

        if (!string.IsNullOrEmpty(filter.CustomerId))
            predicate = predicate.And(o => o.CustomerId == filter.CustomerId);

        if (filter.Status.HasValue)
            predicate = predicate.And(o => o.Status == filter.Status.Value);

        if (filter.CreatedAfter.HasValue)
            predicate = predicate.And(o => o.CreatedOn >= filter.CreatedAfter.Value);

        AddCriteria(predicate);
        AddInclude(o => o.Lines);
    }
}
```

---

## Key Pattern 3: Lifecycle Hooks

`DKNet.EfCore.Hooks` provides a clean extension point into EF Core's save pipeline using interceptors — without subclassing `DbContext`:

```csharp
// Runs BEFORE SaveChanges — ideal for validation, computed fields, audit stamps
public interface IBeforeSaveHookAsync
{
    Task ExecuteAsync(DbContext context, IEnumerable<EntityEntry> entries,
                      CancellationToken cancellationToken = default);
}

// Runs AFTER a successful SaveChanges
public interface IAfterSaveHookAsync
{
    Task ExecuteAsync(DbContext context, IEnumerable<EntityEntry> entries,
                      CancellationToken cancellationToken = default);
}
```

A real-world `BeforeSave` hook that stamps audit fields:

```csharp
public class AuditHook(ICurrentUserService currentUser) : IBeforeSaveHookAsync
{
    public Task ExecuteAsync(DbContext context, IEnumerable<EntityEntry> entries,
                             CancellationToken cancellationToken = default)
    {
        foreach (var entry in entries.Where(e => e.Entity is IAuditedEntity))
        {
            var entity = (IAuditedEntity)entry.Entity;
            if (entry.State == EntityState.Added)
                entity.SetCreatedBy(currentUser.UserId);
            else if (entry.State == EntityState.Modified)
                entity.SetUpdatedBy(currentUser.UserId);
        }
        return Task.CompletedTask;
    }
}
```

Register it in DI and the `HookRunnerInterceptor` calls it automatically on every save:

```csharp
services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString)
           .AddInterceptors(new HookRunnerInterceptor(serviceProvider)));

services.AddScoped<IBeforeSaveHookAsync, AuditHook>();
```

---

## Key Pattern 4: Domain Events

`DKNet.EfCore.Events` builds on top of hooks to deliver domain events reliably — **after** the database commit succeeds, preventing phantom events for rolled-back transactions:

```csharp
// Define a domain event — plain immutable record
public sealed record OrderConfirmedEvent
{
    public required Guid OrderId { get; init; }
    public required string CustomerId { get; init; }
    public required DateTimeOffset ConfirmedAt { get; init; }
}

// Entity raises events by calling AddEvent()
public class Order : AuditedEntity<Guid>, IEventEntity
{
    // ... (IEventEntity implementation provided by base class)

    public void Confirm()
    {
        Status = OrderStatus.Confirmed;
        // Queued until SaveChanges completes
        this.AddEvent(new OrderConfirmedEvent
        {
            OrderId = Id,
            CustomerId = CustomerId,
            ConfirmedAt = DateTimeOffset.UtcNow
        });
    }
}
```

Implement `IEventPublisher` to wire events to your messaging system:

```csharp
public class SlimBusEventPublisher(IMessageBus bus) : IEventPublisher
{
    public async Task PublishAsync(object eventObj, CancellationToken cancellationToken = default)
        => await bus.Publish(eventObj, cancellationToken);
}
```

The `EventHook` (an `IAfterSaveHookAsync`) automatically collects events from all tracked entities after a successful save and dispatches them through your registered `IEventPublisher` implementations. No manual wiring needed.

---

## Key Pattern 5: CQRS with SlimMessageBus

`DKNet.SlimBus.Extensions` integrates with [SlimMessageBus](https://github.com/zarusz/SlimMessageBus) to provide a first-class CQRS pipeline.

### Commands and Handlers

```csharp
// Command — no response
public record ConfirmOrderCommand(Guid OrderId) : ICommand;

// Handler
public class ConfirmOrderHandler(IRepositorySpec<Order> orders) 

// Query with response
public record GetOrderQuery(Guid OrderId) : IQuery<OrderDto>;

public class GetOrderHandler(IReadRepository<Order> orders)
    : IQueryHandler<GetOrderQuery, OrderDto>
{
    public async Task<OrderDto> OnHandle(GetOrderQuery query)
    {
        var order = await orders.FindAsync(query.OrderId)
            ?? throw new NotFoundException($"Order {query.OrderId} not found");

        return new OrderDto(order.Id, order.Status, order.CustomerId);
    }
}
```

### The Auto-Save Interceptor

`EfAutoSavePostInterceptor` is a `IRequestHandlerInterceptor<TRequest, TResponse>` that automatically calls `SaveChangesAsync()` after every command handler completes. It is smart enough to skip queries and event handlers by inspecting the response type:

```csharp
// Wire it up in SlimBus configuration
services.AddSlimMessageBus(mbb =>
{
    mbb.WithProviderMemory()
       .AutoDeclareFrom(typeof(Program).Assembly);

    // Add the auto-save interceptor — commands get SaveChanges for free
    mbb.AddInterceptor<EfAutoSavePostInterceptor>();
});
```

The result: your command handlers focus purely on business logic. `SaveChangesAsync` is called exactly once per command, after the handler succeeds.

---

## Service Layer: Blob Storage and PDF Generation

`DKNet.Svc.BlobStorage.*` provides a provider-agnostic `IBlobStorageService` interface with implementations for Azure, AWS S3, and local file system — swap providers by changing one DI registration:

```csharp
public interface IBlobStorageService
{
    Task<string> UploadAsync(string containerName, string fileName,
                             Stream content, string contentType,
                             CancellationToken cancellationToken = default);

    Task<Stream> DownloadAsync(string containerName, string fileName,
                               CancellationToken cancellationToken = default);

    Task DeleteAsync(string containerName, string fileName,
                     CancellationToken cancellationToken = default);
}

// Production: Azure
services.AddDKNetBlobStorage(b =>
    b.AddAzureStorage(o =>
    {
        o.ConnectionString = config.GetConnectionString("AzureStorage");
        o.ContainerName = "documents";
    }));

// Development: local file system
services.AddDKNetBlobStorage(b =>
    b.AddLocalStorage(o => o.RootPath = Path.Combine(env.ContentRootPath, "uploads")));
```

`DKNet.Svc.PdfGenerators` provides `IPdfGenerator` for creating PDFs from HTML templates, backed by a Chromium headless renderer:

```csharp
public class InvoiceService(IPdfGenerator pdf, IBlobStorageService storage)
{
    public async Task<string> GenerateInvoiceAsync(Order order)
    {
        var html = RenderInvoiceTemplate(order);
        var pdfBytes = await pdf.GenerateAsync(html);

        await storage.UploadAsync("invoices", $"{order.Id}.pdf",
            new MemoryStream(pdfBytes), "application/pdf");

        return $"invoices/{order.Id}.pdf";
    }
}
```

---

## Idempotency at the API Boundary

`DKNet.AspCore.Idempotency` prevents duplicate request processing with a minimal endpoint filter that checks an `Idempotency-Key` header:

```csharp
// Register in Program.cs
services.AddDKNetIdempotency(o =>
    o.UseDistributedCache()); // or .UseSqlServer()

// Apply to any endpoint
app.MapPost("/api/orders", async (PlaceOrderRequest req, IMessageBus bus) =>
{
    var result = await bus.Send(new PlaceOrderCommand(req.CustomerId, req.Lines));
    return Results.Created($"/api/orders/{result.OrderId}", result);
})
.AddEndpointFilter<IdempotencyEndpointFilter>();
```

The filter stores processed request keys in either:
- **`IdempotencyDistributedCacheStore`** — backed by `IDistributedCache` (Redis or in-memory)
- **`IdempotencyDistributedCacheStore`** — backed by SQL Server via EF Core, with unique constraints

Duplicate requests with the same key return the cached response immediately, without re-executing the handler.

---

## Quality Standards

DKNet enforces enterprise-grade quality across all packages:

```xml
<!-- src/Directory.Build.props (applies to all projects) -->
<PropertyGroup>
  <TargetFramework>net10.0</TargetFramework>
  <LangVersion>14</LangVersion>
  <Nullable>enable</Nullable>
  <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  <GenerateDocumentationFile>true</GenerateDocumentationFile>
</PropertyGroup>
```

- **Nullable reference types enabled** — null safety enforced at compile time
- **Warnings as errors** — zero tolerance; the build fails on any analyzer warning
- **XML documentation required** — all public APIs are documented (IntelliSense in your IDE)
- **SonarAnalyzer + Meziantou.Analyzer** — static analysis beyond the default .NET analyzers
- **TestContainers + xUnit** — integration tests run against a real SQL Server instance, not an in-memory fake
- **Centralized package management** — `ManagePackageVersionsCentrally=true` across 50+ projects, zero version drift

---

## Getting Started

### Install Packages

```bash
# Minimal: core extensions + EF Core
dotnet add package DKNet.Fw.Extensions
dotnet add package DKNet.EfCore.Abstractions
dotnet add package DKNet.EfCore.Extensions
dotnet add package DKNet.EfCore.Repos
dotnet add package DKNet.EfCore.Hooks

# Add domain events
dotnet add package DKNet.EfCore.Events

# Add CQRS
dotnet add package DKNet.SlimBus.Extensions

# Add blob storage (choose one provider)
dotnet add package DKNet.Svc.BlobStorage.AzureStorage
# dotnet add package DKNet.Svc.BlobStorage.AwsS3
# dotnet add package DKNet.Svc.BlobStorage.Local

# Add idempotency
dotnet add package DKNet.AspCore.Idempotency
```

### Wire Up Your DbContext

```csharp
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Order> Orders => Set<Order>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(GetType().Assembly);
    }
}
```

### Register Services

```csharp
var builder = WebApplication.CreateBuilder(args);

// EF Core with DKNet hooks and events
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddDKNetRepositories<AppDbContext>();  // registers IRepositorySpec<T>, IReadRepository<T>
builder.Services.AddDKNetHooks<AppDbContext>();         // registers HookRunnerInterceptor
builder.Services.AddDKNetEvents<AppDbContext>();        // registers EventHook + EventContext

// Hooks
builder.Services.AddScoped<IBeforeSaveHookAsync, AuditHook>();

// Event publisher (bridge to SlimBus)
builder.Services.AddScoped<IEventPublisher, SlimBusEventPublisher>();

// SlimMessageBus with auto-save interceptor
builder.Services.AddSlimMessageBus(mbb =>
{
    mbb.WithProviderMemory()
       .AutoDeclareFrom(typeof(Program).Assembly);
    mbb.AddInterceptor<EfAutoSavePostInterceptor>();
});

// Blob storage
builder.Services.AddDKNetBlobStorage(b =>
    b.AddLocalStorage(o => o.RootPath = "uploads"));

// Idempotency
builder.Services.AddDKNetIdempotency(o => o.UseDistributedCache());

var app = builder.Build();
app.MapControllers();
app.Run();
```

---

## Real-World Example: An Order Service

Putting it all together — a complete slice from API to domain event:

```csharp
// 1. Domain entity with event support
public class Order : AuditedEntity<Guid>, IEventEntity
{
    public Order(string createdBy) : base(Guid.NewGuid())
    {
        SetCreatedBy(createdBy);
        Status = OrderStatus.Pending;
    }

    public string CustomerId { get; set; } = string.Empty;
    public OrderStatus Status { get; private set; }

    public void Confirm()
    {
        if (Status != OrderStatus.Pending)
            throw new InvalidOperationException("Only pending orders can be confirmed.");

        Status = OrderStatus.Confirmed;
        this.AddEvent(new OrderConfirmedEvent
        {
            OrderId = Id,
            CustomerId = CustomerId,
            ConfirmedAt = DateTimeOffset.UtcNow
        });
    }
}

// 2. Command + handler
public record ConfirmOrderCommand(Guid OrderId, string UserId) : ICommand;

public class ConfirmOrderHandler(IRepositorySpec<Order> orders)
    : ICommandHandler<ConfirmOrderCommand>
{
    public async Task OnHandle(ConfirmOrderCommand command)
    {
        var order = await orders.FindAsync(command.OrderId)
            ?? throw new NotFoundException(command.OrderId);

        order.Confirm();
        // SaveChanges + domain event dispatch handled automatically
    }
}

// 3. Domain event handler (fires after SaveChanges)
public class OrderConfirmedEventHandler(IEmailService email)
    : IConsumer<OrderConfirmedEvent>
{
    public async Task OnHandle(OrderConfirmedEvent @event)
        => await email.SendOrderConfirmationAsync(@event.CustomerId, @event.OrderId);
}

// 4. API endpoint with idempotency
app.MapPost("/api/orders/{id}/confirm", async (
    Guid id,
    ClaimsPrincipal user,
    IMessageBus bus) =>
{
    await bus.Send(new ConfirmOrderCommand(id, user.GetUserId()));
    return Results.NoContent();
})
.AddEndpointFilter<IdempotencyEndpointFilter>()
.RequireAuthorization();
```

The flow:

1. API receives `POST /api/orders/{id}/confirm` with an `Idempotency-Key` header.
2. `IdempotencyEndpointFilter` checks for a duplicate key and returns the cached response if found.
3. `IMessageBus.Send` dispatches `ConfirmOrderCommand` to `ConfirmOrderHandler`.
4. The handler loads the order and calls `order.Confirm()`, queuing an `OrderConfirmedEvent`.
5. `EfAutoSavePostInterceptor` calls `SaveChangesAsync` — the `HookRunnerInterceptor` fires the `AuditHook` (before save) and the `EventHook` (after save).
6. `EventHook` collects the queued `OrderConfirmedEvent` and calls `IEventPublisher.PublishAsync`.
7. SlimBus routes the event to `OrderConfirmedEventHandler`, which sends the confirmation email.

All of this with zero manual wiring in the handler itself.

---

## Summary

DKNet gives .NET 10 teams a consistent, high-quality foundation for enterprise applications:

| What you get | Package |
|---|---|
| Clean entity contracts with audit fields | `DKNet.EfCore.Abstractions` |
| Repository + Specification pattern | `DKNet.EfCore.Repos` + `DKNet.EfCore.Specifications` |
| EF Core lifecycle hooks | `DKNet.EfCore.Hooks` |
| Reliable domain events (post-commit) | `DKNet.EfCore.Events` |
| CQRS with auto-save | `DKNet.SlimBus.Extensions` |
| Provider-agnostic blob storage | `DKNet.Svc.BlobStorage.*` |
| Idempotent API endpoints | `DKNet.AspCore.Idempotency` |

The library is opinionated about architecture but modular about adoption — start with just `DKNet.EfCore.Repos` in an existing project and add packages as you need them.

**GitHub**: [https://github.com/baoduy/DKNet](https://github.com/baoduy/DKNet)  
**Documentation**: [https://deepwiki.com/baoduy/DKNet](https://deepwiki.com/baoduy/DKNet)

---

> 💡 **Prior art**: If you have used the individual packages for EF Core hooks ([dotnet-06-efcore-hooks](/posts/dotnet-06-efcore-hooks)) or domain events ([dotnet-07-efcore-domain-events](/posts/dotnet-07-efcore-domain-events)), this post shows how they all fit together as a coherent framework.
