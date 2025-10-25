---
author: Steven Hoang
pubDatetime: 2025-10-25T04:46:00Z
title: "[.NET] Simplify EF Core Lifecycle Management with DKNet.EfCore.Hooks"
postSlug: dotnet-06-efcore-hooks
featured: true
draft: false
tags:
  - dotnet
  - efcore
  - hooks
  - entity-framework
  - lifecycle
description: "Discover how DKNet.EfCore.Hooks revolutionizes Entity Framework Core development by providing pre and post-save hooks for implementing cross-cutting concerns like auditing, validation, event publishing, and caching in a clean, maintainable way."
---

Managing cross-cutting concerns in Entity Framework Core applications has always been a challenge. How do you cleanly implement auditing, validation, event publishing, or caching without cluttering your DbContext or business logic? Traditional approaches often lead to scattered code, tight coupling, and maintenance headaches. What if there was a better way to handle these concerns systematically?

**DKNet.EfCore.Hooks** is leveraging a powerful lifecycle interceptors of Entity Framework Core that provides pre and post-save hook, enabling you to implement cross-cutting concerns in a clean, maintainable, and testable manner. It seamlessly integrates with .NET dependency injection and supports full async/await operations, making it perfect for modern cloud-native applications.

## Table of Contents

- [Table of Contents](#table-of-contents)
- [The Challenge with Cross-Cutting Concerns](#the-challenge-with-cross-cutting-concerns)
- [What is DKNet.EfCore.Hooks?](#what-is-dknetefcorehooks)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Basic Setup](#basic-setup)
- [Basic Hook Implementation](#basic-hook-implementation)
  - [Before Save Hook Example](#before-save-hook-example)
  - [After Save Hook Example](#after-save-hook-example)
  - [Combined Hook Example](#combined-hook-example)
- [Understanding the Snapshot Context](#understanding-the-snapshot-context)
  - [Using Snapshot Context](#using-snapshot-context)
- [Real-World Use Cases](#real-world-use-cases)
  - [Use Case 1: Automatic Change Tracking and Logging](#use-case-1-automatic-change-tracking-and-logging)
  - [Use Case 2: Soft Delete with Cache Invalidation](#use-case-2-soft-delete-with-cache-invalidation)
- [Hook Execution Order and Performance](#hook-execution-order-and-performance)
  - [Execution Flow](#execution-flow)
  - [Performance Considerations](#performance-considerations)
  - [Performance Example](#performance-example)
- [Best Practices](#best-practices)
  - [1. Keep Hooks Focused](#1-keep-hooks-focused)
  - [2. Use Appropriate Hook Types](#2-use-appropriate-hook-types)
  - [3. Handle Errors Appropriately](#3-handle-errors-appropriately)
  - [4. Optimize for Performance](#4-optimize-for-performance)
  - [5. Use Dependency Injection](#5-use-dependency-injection)
- [Conclusion](#conclusion)
- [References](#references)
- [Related Articles](#related-articles)
- [Thank You](#thank-you)

## The Challenge with Cross-Cutting Concerns

Consider a typical enterprise application that needs to:

- **Audit Changes**: Track who created or modified entities and when
- **Publish Events**: Notify other systems when data changes
- **Validate Business Rules**: Ensure complex validation rules before saving
- **Invalidate Caches**: Clear cached data when entities change
- **Soft Delete**: Mark records as deleted instead of removing them
- **Update Search Indexes**: Synchronize with external search engines

Traditionally, you might handle these concerns directly in your DbContext:

```csharp
public class AppDbContext : DbContext
{
    private readonly ICurrentUserService _currentUserService;
    private readonly IEventPublisher _eventPublisher;
    private readonly ICacheManager _cacheManager;

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        // Auditing logic
        foreach (var entry in ChangeTracker.Entries<IAuditedEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedBy = _currentUserService.UserId;
                entry.Entity.CreatedOn = DateTime.UtcNow;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedBy = _currentUserService.UserId;
                entry.Entity.UpdatedOn = DateTime.UtcNow;
            }
        }

        // Validation logic
        foreach (var entry in ChangeTracker.Entries())
        {
            ValidateEntity(entry.Entity);
        }

        var result = await base.SaveChangesAsync(cancellationToken);

        // Event publishing logic
        foreach (var entry in ChangeTracker.Entries<IEventEntity>())
        {
            var events = entry.Entity.GetEvents();
            foreach (var evt in events)
            {
                await _eventPublisher.PublishAsync(evt, cancellationToken);
            }
        }

        // Cache invalidation
        await _cacheManager.InvalidateAsync();

        return result;
    }
}
```

This approach has several critical problems:

- **Tight Coupling**: Your DbContext becomes tightly coupled to multiple services
- **Testing Difficulty**: Hard to test individual concerns in isolation
- **Poor Maintainability**: All logic is crammed into one method
- **Limited Reusability**: Can't easily reuse logic across different DbContexts
- **Violation of SRP**: DbContext has too many responsibilities
- **Error Handling**: Difficult to handle errors for different concerns appropriately

## What is DKNet.EfCore.Hooks?

DKNet.EfCore.Hooks is a **lifecycle hooks system** that solves these problems by providing a clean, extensible architecture for Entity Framework Core interceptors. Here's what makes it special:

- **Pre and Post-Save Hooks**: Execute logic before and after SaveChanges
- **Snapshot Context**: Track entity changes with before/after state comparison
- **Dependency Injection Integration**: Seamlessly works with .NET DI
- **Full Async Support**: Non-blocking hook execution with async/await
- **Multiple Hooks Support**: Register multiple hooks with execution ordering
- **Change Tracking**: Access to entity state and property changes
- **Type Safety**: Strongly typed hook interfaces
- **Performance Optimized**: Minimal overhead with efficient execution
- **Error Handling**: Robust error handling capabilities

## Getting Started

### Prerequisites

Before using DKNet.EfCore.Hooks, ensure you have:

- **.NET 9.0 SDK** or later
- **Entity Framework Core 9.0+**

### Installation

Add the NuGet package to your project:

```bash
dotnet add package DKNet.EfCore.Hooks
```

Or add it directly to your `.csproj` file:

```xml
<ItemGroup>
  <PackageReference Include="DKNet.EfCore.Hooks" Version="latest" />
</ItemGroup>
```

### Basic Setup

Configure your DbContext and register hooks in your dependency injection container:

```csharp
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using DKNet.EfCore.Hooks;

public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        // Register your hooks
        services.AddHook<AppDbContext, AuditHook>();
        services.AddHook<AppDbContext, EventPublishingHook>();
        services.AddHook<AppDbContext, CacheInvalidationHook>();

        // Configure DbContext with hook interceptor
        services.AddDbContext<AppDbContext>((provider, options) =>
        {
            options.UseSqlServer(connectionString)
                   .AddHookInterceptor<AppDbContext>(provider);
        });
    }
}
```

That's it! Your hooks are now registered and will automatically execute during save operations.

## Basic Hook Implementation

DKNet.EfCore.Hooks provides three main hook interfaces:

- **IBeforeSaveHookAsync**: Executes before SaveChanges
- **IAfterSaveHookAsync**: Executes after SaveChanges
- **IHookAsync**: Implements both before and after hooks

### Before Save Hook Example

Let's implement an auditing hook that automatically tracks creation and modification metadata:

```csharp
using DKNet.EfCore.Hooks;
using DKNet.EfCore.Extensions.Snapshots;
using Microsoft.EntityFrameworkCore;

public interface IAuditedEntity
{
    string CreatedBy { get; set; }
    DateTimeOffset CreatedOn { get; set; }
    string? UpdatedBy { get; set; }
    DateTimeOffset? UpdatedOn { get; set; }
}

public class AuditHook : IBeforeSaveHookAsync
{
    private readonly ICurrentUserService _currentUserService;
    private readonly ILogger<AuditHook> _logger;

    public AuditHook(ICurrentUserService currentUserService, ILogger<AuditHook> logger)
    {
        _currentUserService = currentUserService;
        _logger = logger;
    }

    public Task RunBeforeSaveAsync(SnapshotContext context, CancellationToken cancellationToken = default)
    {
        var currentUser = _currentUserService.UserId;
        var now = DateTimeOffset.UtcNow;

        foreach (var entry in context.Entries)
        {
            if (entry.Entity is not IAuditedEntity auditedEntity)
                continue;

            switch (entry.State)
            {
                case EntityState.Added:
                    auditedEntity.CreatedBy = currentUser;
                    auditedEntity.CreatedOn = now;
                    _logger.LogInformation("Entity {EntityType} created by {User}",
                        entry.Entity.GetType().Name, currentUser);
                    break;

                case EntityState.Modified:
                    auditedEntity.UpdatedBy = currentUser;
                    auditedEntity.UpdatedOn = now;
                    _logger.LogInformation("Entity {EntityType} updated by {User}",
                        entry.Entity.GetType().Name, currentUser);
                    break;
            }
        }

        return Task.CompletedTask;
    }
}
```

### After Save Hook Example

Here's a hook that publishes domain events after entities are successfully saved:

```csharp
public interface IEventEntity
{
    IReadOnlyCollection<IDomainEvent> GetEvents();
    void ClearEvents();
}

public class EventPublishingHook : IAfterSaveHookAsync
{
    private readonly IEventPublisher _eventPublisher;
    private readonly ILogger<EventPublishingHook> _logger;

    public EventPublishingHook(IEventPublisher eventPublisher, ILogger<EventPublishingHook> logger)
    {
        _eventPublisher = eventPublisher;
        _logger = logger;
    }

    public async Task RunAfterSaveAsync(SnapshotContext context, CancellationToken cancellationToken = default)
    {
        var eventTasks = new List<Task>();

        foreach (var entry in context.Entries)
        {
            if (entry.Entity is not IEventEntity eventEntity)
                continue;

            var events = eventEntity.GetEvents();
            foreach (var domainEvent in events)
            {
                _logger.LogInformation("Publishing event {EventType} for entity {EntityType}",
                    domainEvent.GetType().Name, entry.Entity.GetType().Name);

                eventTasks.Add(_eventPublisher.PublishAsync(domainEvent, cancellationToken));
            }

            eventEntity.ClearEvents();
        }

        // Execute all event publishing concurrently
        await Task.WhenAll(eventTasks);
    }
}
```

### Combined Hook Example

For scenarios where you need both pre and post-save logic, use `IHookAsync`:

```csharp
public class ValidationHook : IHookAsync
{
    private readonly IValidator _validator;
    private readonly ILogger<ValidationHook> _logger;
    private readonly List<ValidationResult> _validationResults = new();

    public ValidationHook(IValidator validator, ILogger<ValidationHook> logger)
    {
        _validator = validator;
        _logger = logger;
    }

    public async Task RunBeforeSaveAsync(SnapshotContext context, CancellationToken cancellationToken = default)
    {
        _validationResults.Clear();

        foreach (var entry in context.Entries)
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified))
                continue;

            var result = await _validator.ValidateAsync(entry.Entity, cancellationToken);
            if (!result.IsValid)
            {
                _validationResults.AddRange(result.Errors);
                _logger.LogWarning("Validation failed for {EntityType}: {Errors}",
                    entry.Entity.GetType().Name,
                    string.Join(", ", result.Errors.Select(e => e.ErrorMessage)));
            }
        }

        if (_validationResults.Any())
        {
            throw new ValidationException(_validationResults);
        }
    }

    public Task RunAfterSaveAsync(SnapshotContext context, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Validation completed successfully for {Count} entities",
            context.Entries.Count());
        return Task.CompletedTask;
    }
}
```

## Understanding the Snapshot Context

The `SnapshotContext` is a powerful feature that provides comprehensive information about entity changes. It captures the state of entities before and after save operations, allowing you to:

- **Track Changes**: See what properties changed and their old/new values
- **Access State**: Know whether entities were added, modified, or deleted
- **Query Entries**: Filter entries by entity type or state
- **Compare Values**: Compare before and after snapshots

### Using Snapshot Context

```csharp
public class ChangeTrackingHook : IHookAsync
{
    private readonly IChangeHistoryService _historyService;

    public ChangeTrackingHook(IChangeHistoryService historyService)
    {
        _historyService = historyService;
    }

    public Task RunBeforeSaveAsync(SnapshotContext context, CancellationToken cancellationToken = default)
    {
        // Capture state before save
        foreach (var entry in context.Entries.Where(e => e.State == EntityState.Modified))
        {
            var originalValues = entry.OriginalValues;
            var currentValues = entry.CurrentValues;

            foreach (var property in entry.Properties)
            {
                var originalValue = originalValues[property.Name];
                var currentValue = currentValues[property.Name];

                if (!Equals(originalValue, currentValue))
                {
                    Console.WriteLine($"Property {property.Name} changed from {originalValue} to {currentValue}");
                }
            }
        }

        return Task.CompletedTask;
    }

    public async Task RunAfterSaveAsync(SnapshotContext context, CancellationToken cancellationToken = default)
    {
        // Log changes after successful save
        foreach (var entry in context.Entries)
        {
            await _historyService.RecordChangeAsync(new ChangeRecord
            {
                EntityType = entry.Entity.GetType().Name,
                EntityId = GetEntityId(entry.Entity),
                Operation = entry.State.ToString(),
                Timestamp = DateTimeOffset.UtcNow
            }, cancellationToken);
        }
    }

    private static object? GetEntityId(object entity)
    {
        return entity.GetType().GetProperty("Id")?.GetValue(entity);
    }
}
```

## Real-World Use Cases

### Use Case 1: Automatic Change Tracking and Logging

This example demonstrates how to automatically track and log all entity changes for compliance and debugging purposes:

```csharp
public interface IAuditedEntity
{
    string CreatedBy { get; set; }
    DateTimeOffset CreatedOn { get; set; }
    string? UpdatedBy { get; set; }
    DateTimeOffset? UpdatedOn { get; set; }
}

public class AuditLoggingHook : IHookAsync
{
    private readonly ICurrentUserService _currentUserService;
    private readonly ILogger<AuditLoggingHook> _logger;
    private readonly List<string> _changeLog = new();

    public AuditLoggingHook(ICurrentUserService currentUserService, ILogger<AuditLoggingHook> logger)
    {
        _currentUserService = currentUserService;
        _logger = logger;
    }

    public Task RunBeforeSaveAsync(SnapshotContext context, CancellationToken cancellationToken = default)
    {
        var currentUser = _currentUserService.UserId;
        var now = DateTimeOffset.UtcNow;
        _changeLog.Clear();

        foreach (var entry in context.Entries)
        {
            if (entry.Entity is not IAuditedEntity auditedEntity)
                continue;

            switch (entry.State)
            {
                case EntityState.Added:
                    auditedEntity.CreatedBy = currentUser;
                    auditedEntity.CreatedOn = now;
                    _changeLog.Add($"Created {entry.Entity.GetType().Name}");
                    break;

                case EntityState.Modified:
                    auditedEntity.UpdatedBy = currentUser;
                    auditedEntity.UpdatedOn = now;

                    // Track which properties changed
                    var changedProperties = entry.Properties
                        .Where(p => p.IsModified)
                        .Select(p => p.Metadata.Name)
                        .ToList();

                    if (changedProperties.Any())
                    {
                        _changeLog.Add($"Modified {entry.Entity.GetType().Name}: {string.Join(", ", changedProperties)}");
                    }
                    break;

                case EntityState.Deleted:
                    _changeLog.Add($"Deleted {entry.Entity.GetType().Name}");
                    break;
            }
        }

        return Task.CompletedTask;
    }

    public Task RunAfterSaveAsync(SnapshotContext context, CancellationToken cancellationToken = default)
    {
        // Log all changes after successful save
        if (_changeLog.Any())
        {
            _logger.LogInformation("User {UserId} made {ChangeCount} changes: {Changes}",
                _currentUserService.UserId,
                _changeLog.Count,
                string.Join("; ", _changeLog));
        }

        return Task.CompletedTask;
    }
}
```

### Use Case 2: Soft Delete with Cache Invalidation

This example shows how to implement soft deletes while automatically invalidating related cache entries:

```csharp
public interface ISoftDeletable
{
    bool IsDeleted { get; set; }
    DateTimeOffset? DeletedOn { get; set; }
    string? DeletedBy { get; set; }
}

public class SoftDeleteCacheHook : IHookAsync
{
    private readonly ICurrentUserService _currentUserService;
    private readonly IMemoryCache _cache;
    private readonly ILogger<SoftDeleteCacheHook> _logger;
    private readonly List<string> _invalidatedCacheKeys = new();

    public SoftDeleteCacheHook(
        ICurrentUserService currentUserService,
        IMemoryCache cache,
        ILogger<SoftDeleteCacheHook> logger)
    {
        _currentUserService = currentUserService;
        _cache = cache;
        _logger = logger;
    }

    public Task RunBeforeSaveAsync(SnapshotContext context, CancellationToken cancellationToken = default)
    {
        _invalidatedCacheKeys.Clear();

        foreach (var entry in context.Entries)
        {
            // Convert physical deletes to soft deletes
            if (entry.State == EntityState.Deleted && entry.Entity is ISoftDeletable softDeletable)
            {
                entry.State = EntityState.Modified;
                softDeletable.IsDeleted = true;
                softDeletable.DeletedOn = DateTimeOffset.UtcNow;
                softDeletable.DeletedBy = _currentUserService.UserId;

                _logger.LogInformation("Soft deleting {EntityType} by user {UserId}",
                    entry.Entity.GetType().Name, _currentUserService.UserId);
            }

            // Track cache keys to invalidate for any changed entity
            if (entry.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            {
                var entityType = entry.Entity.GetType().Name;
                var cacheKey = $"{entityType}_{GetEntityId(entry.Entity)}";
                _invalidatedCacheKeys.Add(cacheKey);
            }
        }

        return Task.CompletedTask;
    }

    public Task RunAfterSaveAsync(SnapshotContext context, CancellationToken cancellationToken = default)
    {
        // Invalidate cache after successful save
        foreach (var cacheKey in _invalidatedCacheKeys)
        {
            _cache.Remove(cacheKey);
        }

        if (_invalidatedCacheKeys.Any())
        {
            _logger.LogInformation("Invalidated {Count} cache entries after save",
                _invalidatedCacheKeys.Count);
        }

        return Task.CompletedTask;
    }

    private static object? GetEntityId(object entity)
    {
        return entity.GetType().GetProperty("Id")?.GetValue(entity);
    }
}
```

**Registration Example:**

```csharp
public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        // Register the hooks
        services.AddHook<AppDbContext, AuditLoggingHook>();
        services.AddHook<AppDbContext, SoftDeleteCacheHook>();

        // Configure DbContext
        services.AddDbContext<AppDbContext>((provider, options) =>
        {
            options.UseSqlServer(connectionString)
                   .UseHooks(provider);
        });

        // Register dependencies
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddMemoryCache();
    }
}

// Example entity
public class Product : IAuditedEntity, ISoftDeletable
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }

    // IAuditedEntity
    public string CreatedBy { get; set; } = string.Empty;
    public DateTimeOffset CreatedOn { get; set; }
    public string? UpdatedBy { get; set; }
    public DateTimeOffset? UpdatedOn { get; set; }

    // ISoftDeletable
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedOn { get; set; }
    public string? DeletedBy { get; set; }
}
```

These examples demonstrate practical, focused use cases for hooks that handle common requirements like auditing, logging, soft deletes, and cache management without unnecessary complexity.

## Hook Execution Order and Performance

### Execution Flow

Understanding the hook execution flow is crucial for designing your hooks:

1. **Before Save Hooks** execute in registration order
2. **DbContext.SaveChanges()** is called
3. **After Save Hooks** execute in registration order
4. Changes are committed to the database

```
┌─────────────────────────────────────────┐
│ Application calls SaveChangesAsync()    │
└────────────────┬────────────────────────┘
                 │
         ┌───────▼────────┐
         │ TenantHook     │ (Before Save Hook 1)
         └───────┬────────┘
                 │
         ┌───────▼────────┐
         │ AuditHook      │ (Before Save Hook 2)
         └───────┬────────┘
                 │
         ┌───────▼────────┐
         │ ValidationHook │ (Before Save Hook 3)
         └───────┬────────┘
                 │
         ┌───────▼────────────────────┐
         │ EF Core SaveChanges()      │
         └───────┬────────────────────┘
                 │
         ┌───────▼───────────────────┐
         │ EventPublishingHook       │ (After Save Hook 1)
         └───────┬───────────────────┘
                 │
         ┌───────▼──────────────────┐
         │ CacheInvalidationHook    │ (After Save Hook 2)
         └───────┬──────────────────┘
                 │
         ┌───────▼──────────────────┐
         │ SearchIndexHook          │ (After Save Hook 3)
         └───────┬──────────────────┘
                 │
         ┌───────▼──────────────────┐
         │ Transaction Complete     │
         └──────────────────────────┘
```

### Performance Considerations

**Do's:**

- ✅ Use async/await for I/O operations
- ✅ Process entries in batches for large datasets
- ✅ Use `Task.WhenAll` for concurrent operations
- ✅ Minimize database calls within hooks
- ✅ Use efficient LINQ queries
- ✅ Cache expensive lookups

**Don'ts:**

- ❌ Make additional SaveChanges calls in before-save hooks (causes recursion)
- ❌ Perform long-running synchronous operations
- ❌ Load unnecessary related entities
- ❌ Execute complex business logic in hooks
- ❌ Block on async operations

### Performance Example

```csharp
public class PerformantHook : IAfterSaveHookAsync
{
    private readonly IMessageBus _messageBus;
    private readonly IMemoryCache _cache;

    public PerformantHook(IMessageBus messageBus, IMemoryCache cache)
    {
        _messageBus = messageBus;
        _cache = cache;
    }

    public async Task RunAfterSaveAsync(SnapshotContext context, CancellationToken cancellationToken = default)
    {
        // ✅ Good: Concurrent processing
        var tasks = context.Entries
            .Where(e => e.Entity is IPublishable)
            .Select(e => PublishMessageAsync((IPublishable)e.Entity, cancellationToken))
            .ToList();

        await Task.WhenAll(tasks);
    }

    private Task PublishMessageAsync(IPublishable entity, CancellationToken cancellationToken)
    {
        // ✅ Good: Use cached configuration
        var config = _cache.GetOrCreate("PublishConfig", _ => LoadConfig());

        return _messageBus.PublishAsync(entity.ToMessage(), cancellationToken);
    }

    private PublishConfig LoadConfig()
    {
        // Load configuration once and cache
        return new PublishConfig();
    }
}
```

## Best Practices

### 1. Keep Hooks Focused

Each hook should have a single, well-defined responsibility:

```csharp
// ✅ Good: Single responsibility
public class AuditHook : IBeforeSaveHookAsync { /* ... */ }
public class EventPublishingHook : IAfterSaveHookAsync { /* ... */ }

// ❌ Avoid: Multiple responsibilities
public class MegaHook : IHookAsync
{
    // Does auditing, validation, event publishing, caching...
}
```

### 2. Use Appropriate Hook Types

- Use **IBeforeSaveHookAsync** for operations that must complete before save (validation, data enrichment)
- Use **IAfterSaveHookAsync** for operations that depend on saved data (event publishing, notifications)
- Use **IHookAsync** only when you genuinely need both phases

### 3. Handle Errors Appropriately

```csharp
// ✅ Good: Let critical errors abort the save
public class ValidationHook : IBeforeSaveHookAsync
{
    public async Task RunBeforeSaveAsync(SnapshotContext context, CancellationToken ct)
    {
        if (!await IsValid(context))
            throw new ValidationException(); // Abort save
    }
}

// ✅ Good: Don't let non-critical errors abort the save
public class NotificationHook : IAfterSaveHookAsync
{
    public async Task RunAfterSaveAsync(SnapshotContext context, CancellationToken ct)
    {
        try
        {
            await SendNotifications(context, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Notification failed"); // Don't abort
        }
    }
}
```

### 4. Optimize for Performance

```csharp
// ✅ Good: Concurrent processing
public async Task RunAfterSaveAsync(SnapshotContext context, CancellationToken ct)
{
    var tasks = context.Entries.Select(e => ProcessAsync(e, ct));
    await Task.WhenAll(tasks);
}

// ❌ Avoid: Sequential processing
public async Task RunAfterSaveAsync(SnapshotContext context, CancellationToken ct)
{
    foreach (var entry in context.Entries)
    {
        await ProcessAsync(entry, ct); // Slow!
    }
}
```

### 5. Use Dependency Injection

Leverage DI for testability and maintainability:

```csharp
// ✅ Good: Uses DI
public class MyHook : IBeforeSaveHookAsync
{
    private readonly IService _service;

    public MyHook(IService service) => _service = service;
}

// ❌ Avoid: Hard dependencies
public class MyHook : IBeforeSaveHookAsync
{
    private readonly IService _service = new ServiceImplementation();
}
```

## Conclusion

DKNet.EfCore.Hooks revolutionizes how we handle cross-cutting concerns in Entity Framework Core applications by:

- **Promoting Clean Architecture**: Separates concerns from your DbContext
- **Enhancing Maintainability**: Each concern is isolated and testable
- **Improving Reusability**: Hooks can be shared across multiple DbContexts
- **Ensuring Consistency**: Centralized logic prevents scattered implementations
- **Supporting Best Practices**: Leverages DI, async/await, and SOLID principles
- **Boosting Productivity**: Write less boilerplate code
- **Enabling Flexibility**: Easy to add, remove, or modify hooks

Whether you're building a small API or a large enterprise application with complex cross-cutting concerns, DKNet.EfCore.Hooks provides the infrastructure you need to keep your code clean, maintainable, and testable. The library seamlessly integrates into your existing EF Core applications and scales from simple auditing to complex multi-tenant scenarios with event sourcing and distributed caching.

By adopting DKNet.EfCore.Hooks, you're not just adding a library—you're embracing a better way to structure your data access layer that will pay dividends in maintainability, testability, and developer productivity for years to come.

## References

- [DKNet.EfCore.Hooks Source Code](https://github.com/baoduy/DKNet/tree/dev/src/EfCore/DKNet.EfCore.Hooks)
- [NuGet Package](https://www.nuget.org/packages/DKNet.EfCore.Hooks)
- [Entity Framework Core Documentation](https://learn.microsoft.com/en-us/ef/core/)
- [DKNet Framework](https://github.com/baoduy/DKNet)
- [.NET Dependency Injection](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection)
- [Polly Resilience Library](https://github.com/App-vNext/Polly)

## Related Articles

- [Streamline Your DTOs with DKNet.EfCore.DtoGenerator](/posts/dotnet-05-efcore-dto-generator/)

## Thank You

Thank you for taking the time to read this comprehensive guide! I hope it has inspired you to implement cleaner, more maintainable Entity Framework Core applications. Feel free to explore the source code, contribute to the project, and happy coding! 🌟✨

**Steven** | [GitHub](https://github.com/baoduy)
