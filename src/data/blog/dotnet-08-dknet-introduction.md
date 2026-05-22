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
- [Projecting with ModelSpecification](#projecting-with-modelspecification)
- [Working with Multiple Aggregates: RepositoryFactory](#working-with-multiple-aggregates-repositoryfactory)
- [Validation Hooks with FluentValidation](#validation-hooks-with-fluentvalidation)
- [Testing with TestContainers](#testing-with-testcontainers)
- [When DKNet Might Not Be the Right Fit](#when-dknet-might-not-be-the-right-fit)
- [Summary](#summary)
- [References](#references)
- [Related Articles](#related-articles)

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
| `DKNet.EfCore.Repos` | Infrastructure | `Repository<T>`, `RepositorySpec<TDbContext>`, `RepositoryFactory` |
| `DKNet.EfCore.Repos.Abstractions` | Infrastructure | `IRepository<T>` (strongly-typed CRUD) |
| `DKNet.EfCore.Specifications` | Infrastructure | `IRepositorySpec` (non-generic, spec-driven), `Specification<T>`, `ModelSpecification<T,M>` |
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

DKNet ships two complementary repository abstractions. `IRepository<T>` (from `DKNet.EfCore.Repos.Abstractions`) is the strongly-typed per-entity repository — useful when a service really does work in a single aggregate. `IRepositorySpec` (from `DKNet.EfCore.Specifications`) is **non-generic** and is the one you reach for when you want to query through `Specification<T>` objects across any entity in the same `DbContext`:

```csharp
// Strongly-typed, single-aggregate CRUD (DKNet.EfCore.Repos.Abstractions)
public interface IRepository<TEntity> : IReadRepository<TEntity>, IWriteRepository<TEntity>
    where TEntity : class;

public interface IReadRepository<TEntity> where TEntity : class
{
    ValueTask<TEntity?> FindAsync(object keyValue, CancellationToken cancellationToken = default);
    Task<TEntity?> FindAsync(Expression<Func<TEntity, bool>> filter, CancellationToken cancellationToken = default);
    Task<int> CountAsync(Expression<Func<TEntity, bool>> filter, CancellationToken cancellationToken = default);
    Task<bool> ExistsAsync(Expression<Func<TEntity, bool>> filter, CancellationToken cancellationToken = default);
    IQueryable<TEntity> Query();
    IQueryable<TEntity> Query(Expression<Func<TEntity, bool>> filter);
    IQueryable<TModel> Query<TModel>(Expression<Func<TEntity, bool>> filter) where TModel : class;
}

public interface IWriteRepository<TEntity> where TEntity : class
{
    ValueTask AddAsync(TEntity entity, CancellationToken cancellationToken = default);
    ValueTask AddRangeAsync(IEnumerable<TEntity> entities, CancellationToken cancellationToken = default);
    Task<int> UpdateAsync(TEntity entity, CancellationToken cancellationToken = default);
    void Delete(TEntity entity);
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

// Specification-driven, multi-entity (DKNet.EfCore.Specifications)
public interface IRepositorySpec
{
    ValueTask AddAsync<TEntity>(TEntity entity, CancellationToken cancellationToken = default) where TEntity : class;
    Task<int> UpdateAsync<TEntity>(TEntity entity, CancellationToken cancellationToken = default) where TEntity : class;
    void Delete<TEntity>(TEntity entity) where TEntity : class;

    IQueryable<TEntity> Query<TEntity>(ISpecification<TEntity> spec) where TEntity : class;
    IQueryable<TModel> Query<TEntity, TModel>(ISpecification<TEntity> spec)
        where TEntity : class where TModel : class;

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
```

The async helpers — `FirstAsync`, `FirstOrDefaultAsync`, `ToListAsync`, `AnyAsync`, `CountAsync`, `ToPagedListAsync` — live as **extension methods** on `IRepositorySpec` in `DKNet.EfCore.Specifications.Extensions`, both for raw entities and for projected models. That keeps the interface tiny (just `Query`) while the call sites read naturally.

In your application service or CQRS handler:

```csharp
public sealed class OrderService(IRepository<Order> orders)
{
    public async Task<Order> PlaceOrderAsync(string customerId, string createdBy)
    {
        var order = new Order(createdBy) { CustomerId = customerId };
        await orders.AddAsync(order);
        await orders.SaveChangesAsync();
        return order;
    }

    public ValueTask<Order?> GetOrderAsync(Guid id) => orders.FindAsync(id);

    public IQueryable<Order> GetPendingOrders()
        => orders.Query(o => o.Status == OrderStatus.Pending);
}
```

### Building Specifications

`Specification<T>` is an abstract base class that exposes a small set of protected builder methods you call from the constructor. The shape that appears throughout the `DKNet.Templates` reference solution — and that you should mirror — is `internal sealed`, constructor-only configuration, and a single `WithFilter(predicator)` call at the end:

```csharp
using DKNet.EfCore.Specifications;
using LinqKit;

namespace OrderApp.AppServices.Orders.V1.Specs;

internal sealed class SpecGetOrder : Specification<Order>
{
    public SpecGetOrder(Guid? byId = null, string? byCustomerId = null)
    {
        // CreatePredicate() returns a LinqKit ExpressionStarter<Order>
        // seeded with `true`, so subsequent .And(...) calls compose cleanly.
        var predicator = CreatePredicate();

        if (byId is not null)
        {
            predicator = predicator.And(o => o.Id == byId);
        }

        if (!string.IsNullOrEmpty(byCustomerId))
        {
            predicator = predicator.And(o => o.CustomerId == byCustomerId);
        }

        WithFilter(predicator);
    }
}
```

The protected surface on `Specification<T>` is intentionally small:

| Method | Purpose |
| --- | --- |
| `CreatePredicate(expression?)` | Returns a LinqKit `ExpressionStarter<T>` to compose with `.And(...)` / `.Or(...)` |
| `WithFilter(expression)` | Sets the final filter predicate |
| `AddInclude(expression)` | Adds an `Include(...)` for a navigation property |
| `AddOrderBy(expression)` / `AddOrderBy(string, ListSortDirection)` | Ascending order |
| `AddOrderByDescending(expression)` | Descending order |
| `IgnoreQueryFilters()` | Bypasses EF global filters (soft delete, multi-tenancy) for this query |

A richer spec with includes and ordering looks like this:

```csharp
internal sealed class SpecActiveOrdersForCustomer : Specification<Order>
{
    public SpecActiveOrdersForCustomer(string customerId)
    {
        var predicator = CreatePredicate()
            .And(o => o.CustomerId == customerId)
            .And(o => o.Status != OrderStatus.Cancelled);

        WithFilter(predicator);
        AddInclude(o => o.Lines);
        AddOrderBy(o => o.CreatedOn);
    }
}
```

And the handler that uses it — note the **non-generic** `IRepositorySpec` and the extension methods from `DKNet.EfCore.Specifications.Extensions`:

```csharp
using DKNet.EfCore.Specifications;
using DKNet.EfCore.Specifications.Extensions;

internal sealed class OrderQueryService(IRepositorySpec repo)
{
    public Task<IList<Order>> GetActiveOrdersAsync(string customerId, CancellationToken ct = default)
        => repo.ToListAsync(new SpecActiveOrdersForCustomer(customerId), ct);
}
```

The same `CreatePredicate()` pattern handles dynamic search criteria — there is no need to reach for `PredicateBuilder.New<T>(true)` directly:

```csharp
internal sealed class SpecOrderSearch : Specification<Order>
{
    public SpecOrderSearch(OrderSearchFilter filter)
    {
        var predicator = CreatePredicate();

        if (!string.IsNullOrEmpty(filter.CustomerId))
        {
            predicator = predicator.And(o => o.CustomerId == filter.CustomerId);
        }

        if (filter.Status.HasValue)
        {
            predicator = predicator.And(o => o.Status == filter.Status.Value);
        }

        if (filter.CreatedAfter.HasValue)
        {
            predicator = predicator.And(o => o.CreatedOn >= filter.CreatedAfter.Value);
        }

        WithFilter(predicator);
        AddInclude(o => o.Lines);
        AddOrderByDescending(o => o.CreatedOn);
    }
}
```

A few conventions worth copying from the reference template:

1. **`internal sealed`** — specs are an implementation detail of the application module; nothing outside the module should new them up.
2. **Configure in the constructor** — no fluent post-construction mutation. The spec is immutable once built.
3. **Name with a `Spec` prefix** (`SpecGetOrder`, `SpecOrderSearch`) and keep each spec in its own file under a `Specs/` folder. This makes them easy to discover and grep for.
4. **One predicate, one `WithFilter` call** — keep all filtering through the `predicator` so the SQL stays composable.

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

public sealed class ConfirmOrderHandler(IRepository<Order> orders)
    : ICommandHandler<ConfirmOrderCommand>
{
    public async Task OnHandle(ConfirmOrderCommand command)
    {
        var order = await orders.FindAsync(command.OrderId)
            ?? throw new NotFoundException($"Order {command.OrderId} not found");

        order.Confirm();
        // No explicit SaveChangesAsync — the auto-save interceptor handles it.
    }
}

// Query with response
public record GetOrderQuery(Guid OrderId) : IQuery<OrderDto>;

public sealed class GetOrderHandler(IReadRepository<Order> orders)
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

The filter stores processed request keys in one of the built-in `IIdempotencyKeyStore` implementations:

- **`IdempotencyDistributedCacheStore`** — backed by `IDistributedCache` (Redis or in-memory)
- **`IdempotencySqlServerStore`** — backed by SQL Server via EF Core with a unique index on the key column for cross-instance safety

Duplicate requests with the same key return the cached response immediately, without re-executing the handler. Implement `IIdempotencyKeyStore` yourself if you need a different backing store (Cosmos DB, DynamoDB, etc.).

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

builder.Services.AddDKNetRepositories<AppDbContext>();  // registers IRepository<T>, IReadRepository<T>, IRepositorySpec
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

public sealed class ConfirmOrderHandler(IRepository<Order> orders)
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

## Projecting with ModelSpecification

A pet peeve of the classic Repository pattern is over-fetching: you load full aggregates just to return a flat DTO. `DKNet.EfCore.Specifications` solves this with `ModelSpecification<TEntity, TModel>` — a specification that signals "this query is for projecting an entity to a model". The repository then routes it through Mapster's `ProjectToType<TModel>`, so EF Core emits a narrow `SELECT` and no entity tracking is done:

```csharp
// 1. Define the DTO and the Mapster mapping
public sealed record OrderListItem(
    Guid Id,
    string CustomerId,
    OrderStatus Status,
    int LineCount,
    decimal Total);

internal sealed class OrderListItemMapping : IRegister
{
    public void Register(TypeAdapterConfig config) =>
        config.NewConfig<Order, OrderListItem>()
              .Map(d => d.LineCount, s => s.Lines.Count)
              .Map(d => d.Total, s => s.Lines.Sum(l => l.Quantity * l.UnitPrice));
}

// 2. Define a spec that targets that projection
internal sealed class SpecListOrders : ModelSpecification<Order, OrderListItem>
{
    public SpecListOrders(OrderStatus? status)
    {
        var predicator = CreatePredicate();

        if (status.HasValue)
        {
            predicator = predicator.And(o => o.Status == status.Value);
        }

        WithFilter(predicator);
        AddOrderByDescending(o => o.CreatedOn);
    }
}

// 3. Call it through IRepositorySpec — the second generic arg picks the projecting overload
internal sealed class OrderQueryService(IRepositorySpec repo)
{
    public Task<IList<OrderListItem>> ListAsync(OrderStatus? status, CancellationToken ct = default)
        => repo.ToListAsync<Order, OrderListItem>(new SpecListOrders(status), ct);
}
```

Under the hood the repository pipes the query through `AsNoTracking().ProjectToType<TModel>(_mapper.Config)`, so EF Core fetches only the columns Mapster needs to build the DTO — no `Include`, no eager-loaded line entities sitting unused in the change tracker. This pattern is the single biggest performance win for read-heavy CQRS queries.

---

## Working with Multiple Aggregates: RepositoryFactory

`IRepositorySpec` already lets a handler touch any entity in the `DbContext`, which usually removes the need for multiple `IRepository<T>` injections. But when you prefer the strongly-typed per-aggregate API, `DKNet.EfCore.Repos` provides `IRepositoryFactory` so you can resolve `IRepository<T>` instances on demand without injecting four of them:

```csharp
public sealed class TransferStockHandler(IRepositoryFactory factory)
    : ICommandHandler<TransferStockCommand>
{
    public async Task OnHandle(TransferStockCommand cmd)
    {
        var products  = factory.Create<Product>();
        var movements = factory.Create<StockMovement>();
        var audit     = factory.Create<AuditLog>();

        var product = await products.FindAsync(cmd.ProductId)
            ?? throw new NotFoundException(cmd.ProductId);

        product.AdjustStock(-cmd.Quantity);

        await movements.AddAsync(new StockMovement(product.Id, -cmd.Quantity, cmd.Reason));
        await audit.AddAsync(new AuditLog($"Transferred {cmd.Quantity} of {product.Id}"));

        // Auto-save interceptor commits all three in one transaction.
    }
}
```

Use it sparingly — if a handler routinely touches more than three aggregates, that is usually a hint that you have a missing aggregate boundary, not that you need a bigger factory.

---

## Validation Hooks with FluentValidation

DKNet does not ship its own validator, but the `IBeforeSaveHookAsync` pipeline is the perfect place to plug in [FluentValidation 12](https://docs.fluentvalidation.net/) — every entity is validated **once** at the persistence boundary, not scattered across every command handler:

```csharp
public class OrderValidator : AbstractValidator<Order>
{
    public OrderValidator()
    {
        RuleFor(o => o.CustomerId).NotEmpty();
        RuleFor(o => o.Lines).NotEmpty().WithMessage("Order must have at least one line.");
        RuleForEach(o => o.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.Quantity).GreaterThan(0);
            line.RuleFor(l => l.UnitPrice).GreaterThanOrEqualTo(0);
        });
    }
}

public class FluentValidationHook(IServiceProvider services) : IBeforeSaveHookAsync
{
    public async Task ExecuteAsync(DbContext context, IEnumerable<EntityEntry> entries,
                                   CancellationToken cancellationToken = default)
    {
        foreach (var entry in entries.Where(e => e.State is EntityState.Added or EntityState.Modified))
        {
            var validatorType = typeof(IValidator<>).MakeGenericType(entry.Entity.GetType());
            if (services.GetService(validatorType) is not IValidator validator)
                continue;

            var ctx    = new ValidationContext<object>(entry.Entity);
            var result = await validator.ValidateAsync(ctx, cancellationToken);
            if (!result.IsValid)
                throw new ValidationException(result.Errors);
        }
    }
}
```

Register it once and every aggregate gets validated transparently:

```csharp
services.AddValidatorsFromAssemblyContaining<OrderValidator>();
services.AddScoped<IBeforeSaveHookAsync, FluentValidationHook>();
```

---

## Testing with TestContainers

DKNet itself is tested against a real SQL Server instance using **TestContainers.MsSql**, and the same pattern works beautifully for your application code. The integration suite spins up a SQL Server container per fixture, runs migrations, and tears it down at the end:

```csharp
public class OrderServiceTests : IAsyncLifetime
{
    private readonly MsSqlContainer _sql = new MsSqlBuilder()
        .WithImage("mcr.microsoft.com/mssql/server:2022-latest")
        .WithPassword("Y0urStrong!Pwd")
        .Build();

    private ServiceProvider _services = default!;

    public async Task InitializeAsync()
    {
        await _sql.StartAsync();

        var services = new ServiceCollection();
        services.AddDbContext<AppDbContext>(o => o.UseSqlServer(_sql.GetConnectionString()));
        services.AddDKNetRepositories<AppDbContext>();
        services.AddDKNetHooks<AppDbContext>();
        services.AddDKNetEvents<AppDbContext>();

        _services = services.BuildServiceProvider();

        await using var scope = _services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
    }

    [Fact]
    public async Task PlaceOrder_PersistsAndRaisesEvent()
    {
        await using var scope = _services.CreateAsyncScope();
        var orders = scope.ServiceProvider.GetRequiredService<IRepository<Order>>();

        var order = new Order("tester") { CustomerId = "cust-42" };
        await orders.AddAsync(order);
        await orders.SaveChangesAsync();

        var stored = await orders.FindAsync(order.Id);
        stored.ShouldNotBeNull();
        stored!.CreatedBy.ShouldBe("tester"); // AuditHook ran
    }

    public Task DisposeAsync() => _sql.DisposeAsync().AsTask();
}
```

This is the model DKNet uses internally — no in-memory provider, no SQLite stand-in, just the real database. The container spins up in ~2 seconds and catches the dialect-specific bugs that in-memory providers happily silence.

---

## When DKNet Might Not Be the Right Fit

DKNet is opinionated, and that is mostly a good thing — but it is honest about its scope:

- **Tiny CRUD apps.** If your service is genuinely "API → EF Core → database" with no business rules, the abstractions cost more than they save. Use `DbContext` directly.
- **Non-EF data stores.** The repository, hooks, and events packages are designed around EF Core's change tracker. If you are on Dapper, Cosmos DB SDK, or Marten, DKNet's EF Core layers do not apply (the `DKNet.Svc.*` and `DKNet.AspCore.Idempotency` packages are still useful, though).
- **Event sourcing.** DKNet's domain events are "post-commit notification" events, not an event-sourced write model. If you are storing events as the source of truth, look at [Marten](https://martendb.io/) or [EventStoreDB](https://eventstore.com/).
- **Pre-.NET 10 codebases.** The 1.x line targets `net10.0` and uses C# 14 features. There is no plan to backport to LTS .NET 8.

In short: DKNet is for teams that have already converged on DDD + Onion + EF Core + CQRS and want to stop hand-rolling the plumbing.

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

---

## References

- **DKNet GitHub repository**: [https://github.com/baoduy/DKNet](https://github.com/baoduy/DKNet)
- **DKNet DeepWiki (architecture & package docs)**: [https://deepwiki.com/baoduy/DKNet](https://deepwiki.com/baoduy/DKNet)
- **DKNet on NuGet** (search prefix): [https://www.nuget.org/packages?q=DKNet](https://www.nuget.org/packages?q=DKNet)
- **SlimMessageBus** (CQRS bus used by `DKNet.SlimBus.Extensions`): [https://github.com/zarusz/SlimMessageBus](https://github.com/zarusz/SlimMessageBus)
- **LinqKit** (predicate composition used by `DKNet.EfCore.Specifications`): [https://github.com/scottksmith95/LINQKit](https://github.com/scottksmith95/LINQKit)
- **FluentValidation 12**: [https://docs.fluentvalidation.net/](https://docs.fluentvalidation.net/)
- **TestContainers for .NET**: [https://dotnet.testcontainers.org/](https://dotnet.testcontainers.org/)
- **Onion Architecture (Jeffrey Palermo, 2008)**: [https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/)

---

## Related Articles

If you want to go deeper on the patterns DKNet packages up, these earlier drunkcoding.net posts are good companions:

- [Day 06 — Cleaner EF Core Side Effects with Save-Time Hooks](/posts/dotnet-06-efcore-hooks) — the standalone story behind `DKNet.EfCore.Hooks`.
- [Day 07 — Simplify Domain Events with DKNet.EfCore.Events](/posts/dotnet-07-efcore-domain-events) — the post-commit event pipeline this post integrates with CQRS.
- [Day 05 — Generating DTOs from EF Core Entities](/posts/dotnet-05-efcore-dto-generator) — pairs nicely with `ModelSpecification` for read-side projections.

---

## Thank You

Thanks for reading — and for sticking with the longer format. If you try DKNet on a real project, I would love to hear which packages fit and which ones got in your way; the friction reports are the most useful contribution you can make. Steven.
