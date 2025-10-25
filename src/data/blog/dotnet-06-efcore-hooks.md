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

**DKNet.EfCore.Hooks** is a powerful lifecycle hooks system for Entity Framework Core that provides pre and post-save interceptors, enabling you to implement cross-cutting concerns in a clean, maintainable, and testable manner. It seamlessly integrates with .NET dependency injection and supports full async/await operations, making it perfect for modern cloud-native applications.

## Table of Contents

1. [The Challenge with Cross-Cutting Concerns](#the-challenge-with-cross-cutting-concerns)
2. [What is DKNet.EfCore.Hooks?](#what-is-dknetefcorehooks)
3. [Getting Started](#getting-started)
4. [Basic Hook Implementation](#basic-hook-implementation)
5. [Understanding the Snapshot Context](#understanding-the-snapshot-context)
6. [Real-World Use Cases](#real-world-use-cases)
7. [Advanced Features](#advanced-features)
8. [Hook Execution Order and Performance](#hook-execution-order-and-performance)
9. [Error Handling and Resilience](#error-handling-and-resilience)
10. [Testing Hooks](#testing-hooks)
11. [Best Practices](#best-practices)
12. [Conclusion](#conclusion)

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
- A project with **Microsoft.Extensions.DependencyInjection**

### Installation

Add the NuGet package to your project:

```bash
dotnet add package DKNet.EfCore.Hooks
```

Or add it directly to your `.csproj` file:

```xml
<ItemGroup>
  <PackageReference Include="DKNet.EfCore.Hooks" Version="1.0.0" />
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

### Use Case 1: Soft Delete Implementation

Implement soft deletes where records are marked as deleted instead of physically removed:

```csharp
public interface ISoftDeletable
{
    bool IsDeleted { get; set; }
    DateTimeOffset? DeletedOn { get; set; }
    string? DeletedBy { get; set; }
}

public class SoftDeleteHook : IBeforeSaveHookAsync
{
    private readonly ICurrentUserService _currentUserService;

    public SoftDeleteHook(ICurrentUserService currentUserService)
    {
        _currentUserService = currentUserService;
    }

    public Task RunBeforeSaveAsync(SnapshotContext context, CancellationToken cancellationToken = default)
    {
        var deletedEntries = context.Entries
            .Where(e => e.State == EntityState.Deleted && e.Entity is ISoftDeletable);

        foreach (var entry in deletedEntries)
        {
            var softDeletable = (ISoftDeletable)entry.Entity;

            // Change state from Deleted to Modified
            entry.State = EntityState.Modified;

            // Mark as soft deleted
            softDeletable.IsDeleted = true;
            softDeletable.DeletedOn = DateTimeOffset.UtcNow;
            softDeletable.DeletedBy = _currentUserService.UserId;
        }

        return Task.CompletedTask;
    }
}
```

### Use Case 2: Cache Invalidation

Automatically invalidate caches when entities are modified:

```csharp
public interface ICacheable
{
    string GetCacheKey();
    string[] GetRelatedCacheKeys();
}

public class CacheInvalidationHook : IAfterSaveHookAsync
{
    private readonly ICacheManager _cacheManager;
    private readonly ILogger<CacheInvalidationHook> _logger;

    public CacheInvalidationHook(ICacheManager cacheManager, ILogger<CacheInvalidationHook> logger)
    {
        _cacheManager = cacheManager;
        _logger = logger;
    }

    public async Task RunAfterSaveAsync(SnapshotContext context, CancellationToken cancellationToken = default)
    {
        var cacheKeysToInvalidate = new HashSet<string>();

        foreach (var entry in context.Entries)
        {
            if (entry.Entity is not ICacheable cacheable)
                continue;

            // Add entity's own cache key
            cacheKeysToInvalidate.Add(cacheable.GetCacheKey());

            // Add related cache keys
            foreach (var relatedKey in cacheable.GetRelatedCacheKeys())
            {
                cacheKeysToInvalidate.Add(relatedKey);
            }
        }

        if (cacheKeysToInvalidate.Any())
        {
            _logger.LogInformation("Invalidating {Count} cache keys", cacheKeysToInvalidate.Count);
            await _cacheManager.RemoveAsync(cacheKeysToInvalidate, cancellationToken);
        }
    }
}
```

### Use Case 3: Search Index Synchronization

Keep external search indexes synchronized with database changes:

```csharp
public interface ISearchable
{
    string Id { get; }
    string GetSearchDocument();
}

public class SearchIndexHook : IAfterSaveHookAsync
{
    private readonly ISearchService _searchService;
    private readonly ILogger<SearchIndexHook> _logger;

    public SearchIndexHook(ISearchService searchService, ILogger<SearchIndexHook> logger)
    {
        _searchService = searchService;
        _logger = logger;
    }

    public async Task RunAfterSaveAsync(SnapshotContext context, CancellationToken cancellationToken = default)
    {
        var indexingTasks = new List<Task>();

        foreach (var entry in context.Entries)
        {
            if (entry.Entity is not ISearchable searchable)
                continue;

            var task = entry.State switch
            {
                EntityState.Added or EntityState.Modified =>
                    _searchService.IndexDocumentAsync(searchable.GetSearchDocument(), cancellationToken),

                EntityState.Deleted =>
                    _searchService.DeleteDocumentAsync(searchable.Id, cancellationToken),

                _ => Task.CompletedTask
            };

            indexingTasks.Add(task);
        }

        await Task.WhenAll(indexingTasks);
        _logger.LogInformation("Synchronized {Count} documents with search index", indexingTasks.Count);
    }
}
```

### Use Case 4: Multi-Tenant Data Isolation

Automatically set tenant information on entities:

```csharp
public interface ITenantEntity
{
    string TenantId { get; set; }
}

public class TenantHook : IBeforeSaveHookAsync
{
    private readonly ITenantContext _tenantContext;

    public TenantHook(ITenantContext tenantContext)
    {
        _tenantContext = tenantContext;
    }

    public Task RunBeforeSaveAsync(SnapshotContext context, CancellationToken cancellationToken = default)
    {
        var currentTenantId = _tenantContext.TenantId
            ?? throw new InvalidOperationException("Tenant context not set");

        foreach (var entry in context.Entries.Where(e => e.State == EntityState.Added))
        {
            if (entry.Entity is ITenantEntity tenantEntity)
            {
                tenantEntity.TenantId = currentTenantId;
            }
        }

        return Task.CompletedTask;
    }
}
```

## Advanced Features

### Multiple Hooks Registration

You can register multiple hooks for the same DbContext. They will execute in the order they were registered:

```csharp
services.AddHook<AppDbContext, TenantHook>();        // Executes first
services.AddHook<AppDbContext, AuditHook>();          // Executes second
services.AddHook<AppDbContext, ValidationHook>();     // Executes third
services.AddHook<AppDbContext, EventPublishingHook>(); // Executes fourth (after save)
services.AddHook<AppDbContext, CacheInvalidationHook>(); // Executes fifth (after save)
```

### Conditional Hook Execution

Implement conditional logic to skip unnecessary processing:

```csharp
public class ConditionalHook : IBeforeSaveHookAsync
{
    private readonly IFeatureManager _featureManager;

    public ConditionalHook(IFeatureManager featureManager)
    {
        _featureManager = featureManager;
    }

    public async Task RunBeforeSaveAsync(SnapshotContext context, CancellationToken cancellationToken = default)
    {
        // Only execute if feature is enabled
        if (!await _featureManager.IsEnabledAsync("AuditingFeature"))
            return;

        // Only process specific entity types
        var relevantEntries = context.Entries
            .Where(e => e.Entity is Product || e.Entity is Order);

        foreach (var entry in relevantEntries)
        {
            // Process entry
        }
    }
}
```

### Batch Operations Optimization

Optimize hooks for better performance with batch operations:

```csharp
public class BatchOptimizedHook : IAfterSaveHookAsync
{
    private readonly INotificationService _notificationService;
    private readonly int _batchSize = 100;

    public BatchOptimizedHook(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    public async Task RunAfterSaveAsync(SnapshotContext context, CancellationToken cancellationToken = default)
    {
        var entities = context.Entries
            .Where(e => e.State == EntityState.Added && e.Entity is INotifiable)
            .Select(e => e.Entity)
            .Cast<INotifiable>()
            .ToList();

        // Process in batches for better performance
        for (int i = 0; i < entities.Count; i += _batchSize)
        {
            var batch = entities.Skip(i).Take(_batchSize);
            await _notificationService.SendBatchNotificationsAsync(batch, cancellationToken);
        }
    }
}
```

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

## Error Handling and Resilience

Proper error handling is critical for maintaining data integrity and system reliability.

### Before Save Hook Error Handling

Errors in before-save hooks should **abort** the save operation:

```csharp
public class CriticalValidationHook : IBeforeSaveHookAsync
{
    private readonly ILogger<CriticalValidationHook> _logger;

    public CriticalValidationHook(ILogger<CriticalValidationHook> logger)
    {
        _logger = logger;
    }

    public async Task RunBeforeSaveAsync(SnapshotContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            // Critical validation that must pass
            foreach (var entry in context.Entries)
            {
                await ValidateCriticalRulesAsync(entry.Entity, cancellationToken);
            }
        }
        catch (ValidationException ex)
        {
            _logger.LogError(ex, "Critical validation failed. Aborting save operation.");
            throw; // Re-throw to abort save
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error in pre-save validation.");
            throw; // Re-throw to abort save
        }
    }

    private Task ValidateCriticalRulesAsync(object entity, CancellationToken cancellationToken)
    {
        // Validation logic
        return Task.CompletedTask;
    }
}
```

### After Save Hook Error Handling

Errors in after-save hooks should **NOT** abort the transaction (data is already saved):

```csharp
public class ResilientAfterSaveHook : IAfterSaveHookAsync
{
    private readonly ILogger<ResilientAfterSaveHook> _logger;
    private readonly INotificationService _notificationService;

    public ResilientAfterSaveHook(
        ILogger<ResilientAfterSaveHook> logger,
        INotificationService notificationService)
    {
        _logger = logger;
        _notificationService = notificationService;
    }

    public async Task RunAfterSaveAsync(SnapshotContext context, CancellationToken cancellationToken = default)
    {
        foreach (var entry in context.Entries)
        {
            try
            {
                // Non-critical operations that shouldn't fail the save
                await _notificationService.NotifyAsync(entry.Entity, cancellationToken);
            }
            catch (Exception ex)
            {
                // Log error but don't re-throw
                _logger.LogError(ex,
                    "Failed to send notification for {EntityType} {EntityId}. Data was saved successfully.",
                    entry.Entity.GetType().Name,
                    GetEntityId(entry.Entity));
            }
        }
    }

    private static object? GetEntityId(object entity)
    {
        return entity.GetType().GetProperty("Id")?.GetValue(entity);
    }
}
```

### Retry Logic with Polly

Implement retry logic for transient failures:

```csharp
using Polly;
using Polly.Retry;

public class RetryableHook : IAfterSaveHookAsync
{
    private readonly IExternalService _externalService;
    private readonly ILogger<RetryableHook> _logger;
    private readonly AsyncRetryPolicy _retryPolicy;

    public RetryableHook(IExternalService externalService, ILogger<RetryableHook> logger)
    {
        _externalService = externalService;
        _logger = logger;

        // Configure retry policy
        _retryPolicy = Policy
            .Handle<HttpRequestException>()
            .Or<TimeoutException>()
            .WaitAndRetryAsync(
                retryCount: 3,
                sleepDurationProvider: retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)),
                onRetry: (exception, timeSpan, retryCount, context) =>
                {
                    _logger.LogWarning(exception,
                        "Retry {RetryCount} after {Delay}s", retryCount, timeSpan.TotalSeconds);
                });
    }

    public async Task RunAfterSaveAsync(SnapshotContext context, CancellationToken cancellationToken = default)
    {
        foreach (var entry in context.Entries)
        {
            try
            {
                await _retryPolicy.ExecuteAsync(async () =>
                {
                    await _externalService.SyncAsync(entry.Entity, cancellationToken);
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to sync entity after retries");
                // Handle failure appropriately (e.g., queue for later retry)
            }
        }
    }
}
```

## Testing Hooks

Hooks are easy to test in isolation since they're just regular classes with dependencies.

### Unit Testing Example

```csharp
using Xunit;
using Moq;
using Microsoft.EntityFrameworkCore;

public class AuditHookTests
{
    [Fact]
    public async Task RunBeforeSaveAsync_SetsCreatedByForNewEntities()
    {
        // Arrange
        var mockUserService = new Mock<ICurrentUserService>();
        mockUserService.Setup(x => x.UserId).Returns("test-user");

        var mockLogger = new Mock<ILogger<AuditHook>>();
        var hook = new AuditHook(mockUserService.Object, mockLogger.Object);

        var entity = new TestEntity();
        var mockEntry = CreateMockEntry(entity, EntityState.Added);
        var context = CreateSnapshotContext(mockEntry);

        // Act
        await hook.RunBeforeSaveAsync(context);

        // Assert
        Assert.Equal("test-user", entity.CreatedBy);
        Assert.NotEqual(default, entity.CreatedOn);
    }

    [Fact]
    public async Task RunBeforeSaveAsync_SetsUpdatedByForModifiedEntities()
    {
        // Arrange
        var mockUserService = new Mock<ICurrentUserService>();
        mockUserService.Setup(x => x.UserId).Returns("test-user");

        var mockLogger = new Mock<ILogger<AuditHook>>();
        var hook = new AuditHook(mockUserService.Object, mockLogger.Object);

        var entity = new TestEntity
        {
            CreatedBy = "original-user",
            CreatedOn = DateTimeOffset.UtcNow.AddDays(-1)
        };
        var mockEntry = CreateMockEntry(entity, EntityState.Modified);
        var context = CreateSnapshotContext(mockEntry);

        // Act
        await hook.RunBeforeSaveAsync(context);

        // Assert
        Assert.Equal("test-user", entity.UpdatedBy);
        Assert.NotNull(entity.UpdatedOn);
    }

    private SnapshotEntry CreateMockEntry(object entity, EntityState state)
    {
        // Create mock entry
        // Implementation depends on your test infrastructure
        throw new NotImplementedException();
    }

    private SnapshotContext CreateSnapshotContext(params SnapshotEntry[] entries)
    {
        // Create mock snapshot context
        // Implementation depends on your test infrastructure
        throw new NotImplementedException();
    }

    private class TestEntity : IAuditedEntity
    {
        public string CreatedBy { get; set; } = string.Empty;
        public DateTimeOffset CreatedOn { get; set; }
        public string? UpdatedBy { get; set; }
        public DateTimeOffset? UpdatedOn { get; set; }
    }
}
```

### Integration Testing Example

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

public class HookIntegrationTests : IDisposable
{
    private readonly ServiceProvider _serviceProvider;
    private readonly AppDbContext _dbContext;

    public HookIntegrationTests()
    {
        var services = new ServiceCollection();

        // Setup in-memory database
        services.AddDbContext<AppDbContext>((provider, options) =>
        {
            options.UseInMemoryDatabase("TestDb")
                   .AddHookInterceptor<AppDbContext>(provider);
        });

        // Register hooks and dependencies
        services.AddHook<AppDbContext, AuditHook>();
        services.AddSingleton<ICurrentUserService, TestUserService>();
        services.AddLogging();

        _serviceProvider = services.BuildServiceProvider();
        _dbContext = _serviceProvider.GetRequiredService<AppDbContext>();
    }

    [Fact]
    public async Task SaveChanges_ExecutesAuditHook()
    {
        // Arrange
        var product = new Product { Name = "Test Product", Price = 99.99m };

        // Act
        _dbContext.Products.Add(product);
        await _dbContext.SaveChangesAsync();

        // Assert
        var savedProduct = await _dbContext.Products.FindAsync(product.Id);
        Assert.NotNull(savedProduct);
        Assert.Equal("test-user", savedProduct.CreatedBy);
        Assert.NotEqual(default, savedProduct.CreatedOn);
    }

    public void Dispose()
    {
        _dbContext?.Dispose();
        _serviceProvider?.Dispose();
    }

    private class TestUserService : ICurrentUserService
    {
        public string UserId => "test-user";
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

### 6. Document Hook Behavior

```csharp
/// <summary>
/// Automatically sets audit fields (CreatedBy, CreatedOn, UpdatedBy, UpdatedOn)
/// for entities implementing IAuditedEntity.
/// Executes before SaveChanges to ensure audit data is included in the save.
/// </summary>
public class AuditHook : IBeforeSaveHookAsync
{
    // Implementation
}
```

### 7. Consider Hook Order

Register hooks in the order they should execute:

```csharp
// ✅ Good: Logical order
services.AddHook<AppDbContext, TenantHook>();      // Set tenant first
services.AddHook<AppDbContext, AuditHook>();       // Then audit
services.AddHook<AppDbContext, ValidationHook>();  // Then validate

// ❌ Avoid: Illogical order
services.AddHook<AppDbContext, ValidationHook>();  // Validates before tenant is set!
services.AddHook<AppDbContext, TenantHook>();
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
