---
author: Steven Hoang
pubDatetime: 2025-10-25T09:30:00Z
title: "[.NET] Simplify Domain Events with DKNet.EfCore.Events"
postSlug: dotnet-07-efcore-domain-events
featured: true
draft: false
tags:
  - dotnet
  - efcore
  - domain-events
  - ddd
  - event-driven
description: "Learn how DKNet.EfCore.Events brings elegant domain event management to Entity Framework Core, enabling clean separation of concerns and reliable event-driven architectures in your .NET applications."
---

Domain events are a powerful pattern for making implicit side effects explicit in Domain-Driven Design (DDD). When an order is placed, you might need to send emails, update inventory, and notify shipping. How do you handle these concerns cleanly without tangling business logic with infrastructure code?

**DKNet.EfCore.Events** builds on **[DKNet.EfCore.Hooks](/posts/dotnet-06-efcore-hooks)** to bring elegant domain event management to EF Core applications. It automatically captures and publishes domain events as part of your database transactions, ensuring consistency while maintaining clean separation of concerns.

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Understanding Domain Events](#understanding-domain-events)
- [The Challenge with Domain Events](#the-challenge-with-domain-events)
- [What is DKNet.EfCore.Events?](#what-is-dknetefcoreevents)
  - [Key Features](#key-features)
  - [How It Works](#how-it-works)
- [Getting Started](#getting-started)
  - [Installation](#installation)
  - [Configuration](#configuration)
- [Basic Usage](#basic-usage)
  - [Define Domain Events](#define-domain-events)
  - [Create Entities](#create-entities)
  - [DbContext](#dbcontext)
- [Practical Example: E-Commerce Order System](#practical-example-e-commerce-order-system)
  - [Domain Events](#domain-events)
  - [Order Entity](#order-entity)
  - [MediatR Event Handlers](#mediatr-event-handlers)
  - [Service Layer](#service-layer)
- [Advanced Features](#advanced-features)
  - [Event Type Mapping with Mapster](#event-type-mapping-with-mapster)
  - [Conditional Event Handling](#conditional-event-handling)
  - [Integration with MediatR](#integration-with-mediatr)
- [Best Practices](#best-practices)
  - [1. Keep Events Immutable](#1-keep-events-immutable)
  - [2. Name Events in Past Tense](#2-name-events-in-past-tense)
  - [3. Keep Handlers Focused](#3-keep-handlers-focused)
  - [4. Handle Failures Gracefully](#4-handle-failures-gracefully)
  - [5. Use Strongly-Typed Events](#5-use-strongly-typed-events)
- [Conclusion](#conclusion)
  - [Key Benefits](#key-benefits)
- [References](#references)
- [Related Articles](#related-articles)
- [Thank You](#thank-you)

## Understanding Domain Events

Domain events capture significant business occurrences that other parts of your application might care about. They represent facts about state changes in your business domain.

Without domain events, side effects are often directly coded into business logic:

```csharp
public class OrderService(AppDbContext dbContext, IEmailService emailService,
    IInventoryService inventoryService, IShippingService shippingService)
{
    public async Task CreateOrderAsync(Order order)
    {
        await dbContext.Orders.AddAsync(order);
        await dbContext.SaveChangesAsync();

        // Tightly coupled to multiple services
        await emailService.SendConfirmationAsync(order);
        await inventoryService.ReserveItemsAsync(order);
        await shippingService.NotifyAsync(order);
    }
}
```

This creates several problems:

- **Tight Coupling**: `OrderService` depends on every service that needs to react to order creation
- **Testing Difficulties**: You must mock all dependent services
- **Poor Scalability**: Adding new side effects requires modifying existing code
- **Transaction Boundaries**: What if email sending fails? Should we rollback the order?

A traditional approach to domain events might look like this:

```csharp
public sealed record OrderPlacedEvent(
    Guid OrderId,
    string OrderNumber,
    decimal Total,
    DateTime PlacedAt);

public class Order
{
    private readonly List<object> _domainEvents = new();

    public Guid Id { get; private set; }
    public string OrderNumber { get; private set; } = string.Empty;
    public decimal Total { get; private set; }

    public IReadOnlyCollection<object> DomainEvents => _domainEvents.AsReadOnly();

    public static Order Create(string orderNumber, decimal total)
    {
        var order = new Order
        {
            Id = Guid.NewGuid(),
            OrderNumber = orderNumber,
            Total = total
        };

        // Manually add domain event
        order._domainEvents.Add(new OrderPlacedEvent(
            order.Id, order.OrderNumber, order.Total, DateTime.UtcNow));

        return order;
    }

    public void ClearDomainEvents() => _domainEvents.Clear();
}
```

But then you'd need to manually handle event collection and publishing:

```csharp
public class OrderService(AppDbContext dbContext, IMediator mediator)
{
    public async Task CreateOrderAsync(string orderNumber, decimal total)
    {
        var order = Order.Create(orderNumber, total);
        await dbContext.Orders.AddAsync(order);

        // Manual event collection
        var events = order.DomainEvents.ToList();
        order.ClearDomainEvents();

        await dbContext.SaveChangesAsync();

        // Manual event publishing
        foreach (var @event in events)
        {
            await mediator.Publish(@event);
        }
    }
}
```

This traditional approach requires significant boilerplate code and manual coordination between entity state, event collection, and publishing.

## The Challenge with Domain Events

Implementing domain events correctly with EF Core presents several challenges:

- **Transaction Consistency**: Events should only be published if the database transaction succeeds
- **Event Collection**: Where to store and collect domain events from entities
- **Publishing Timing**: When to publish events (before/after SaveChanges)
- **Boilerplate Code**: Significant plumbing code for event infrastructure
- **Testing Complexity**: Mocking the entire event infrastructure

## What is DKNet.EfCore.Events?

**DKNet.EfCore.Events** solves these challenges with minimal configuration:

### Key Features

- **Base Entity Class**: Inherit from `Entity` or `Entity<TKey>` - no manual implementation needed
- **Simple Event API**: Just call `AddEvent(eventObject)` or `AddEvent<TEvent>()`
- **Hook-Based Architecture**: Uses EF Core Hooks to automatically intercept SaveChanges
- **Zero DbContext Changes**: No need to override SaveChangesAsync
- **Transaction Safety**: Events published only after successful commits
- **DI-Friendly**: Seamless integration with .NET dependency injection

### How It Works

The `EventHook` intercepts EF Core's `SaveChanges` lifecycle, automatically collecting and publishing events through MediatR:

```
┌─────────────┐    AddEvent()    ┌──────────────┐
│   Entity    │ ───────────────► │ Event Queue  │
│  (Domain)   │                  │  (In Memory) │
└─────────────┘                  └──────────────┘
                                         │
                                         │ Collect Events
                                         ▼
                                ┌──────────────┐
                                │  EventHook   │◄─── SaveChanges()
                                │ (Intercept)  │
                                └──────────────┘
                                         │
                                         │ After Successful Commit
                                         ▼
                                ┌──────────────┐
                                │ EventPublisher│
                                │  (MediatR)   │
                                └──────────────┘
                                         │
                                         │ Publish Events
                                         ▼
                                ┌──────────────┐
                                │   MediatR    │
                                │ Notification │
                                └──────────────┘
                                         │
                        ┌────────────────┼────────────────┐
                        │                │                │
                        ▼                ▼                ▼
                ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
                │Email Handler│  │Inventory    │  │Analytics    │
                │             │  │Handler      │  │Handler      │
                └─────────────┘  └─────────────┘  └─────────────┘
```

## Getting Started

### Installation

```bash
dotnet add package DKNet.EfCore.Abstractions
dotnet add package DKNet.EfCore.Events
dotnet add package DKNet.EfCore.Hooks
dotnet add package MediatR
```

### Configuration

Register the hooks, MediatR, and event publisher in `Program.cs`:

```csharp
builder.Services.AddDbContext<AppDbContext>((sp, options) =>
{
    options.UseSqlServer(connectionString)
           .UseHooks(sp); // Enable EF Core Hooks
});

// Register MediatR
builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(Program).Assembly));

// Register the Event Publisher with MediatR
builder.Services.AddScoped<IEventPublisher, MediatREventPublisher>();
builder.Services.AddEventPublisher<AppDbContext, MediatREventPublisher>();
```

## Basic Usage

### Define Domain Events

```csharp
public record OrderPlacedEvent(
    Guid OrderId,
    string OrderNumber,
    decimal Total,
    DateTime PlacedAt);
```

### Create Entities

Inherit from `Entity` base class:

```csharp
using DKNet.EfCore.Abstractions.Entities;

public class Order : Entity
{
    public string OrderNumber { get; private set; } = string.Empty;
    public decimal Total { get; private set; }

    public static Order Create(string orderNumber, decimal total)
    {
        var order = new Order
        {
            OrderNumber = orderNumber,
            Total = total
        };

        // Add domain event
        order.AddEvent(new OrderPlacedEvent(
            order.Id, order.OrderNumber, order.Total, DateTime.UtcNow));

        return order;
    }
}
```

### DbContext

Your DbContext requires no modifications:

```csharp
public class AppDbContext : DbContext
{
    public DbSet<Order> Orders => Set<Order>();

    // No event-specific code needed!
    // EventHook handles everything automatically
}
```

## Practical Example: E-Commerce Order System

### Domain Events

```csharp
public record OrderPlacedEvent(Guid OrderId, Guid CustomerId, string OrderNumber, decimal Total);
public record OrderConfirmedEvent(Guid OrderId, DateTime ConfirmedAt);
public record OrderShippedEvent(Guid OrderId, string TrackingNumber);
```

### Order Entity

```csharp
public class Order : Entity
{
    private readonly List<OrderItem> _items = new();

    public Guid CustomerId { get; private set; }
    public string OrderNumber { get; private set; } = string.Empty;
    public OrderStatus Status { get; private set; }
    public string? TrackingNumber { get; private set; }

    public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();
    public decimal Total => _items.Sum(i => i.Price * i.Quantity);

    public static Order Create(Guid customerId, string orderNumber, List<OrderItem> items)
    {
        var order = new Order
        {
            CustomerId = customerId,
            OrderNumber = orderNumber,
            Status = OrderStatus.Pending
        };

        order._items.AddRange(items);
        order.AddEvent(new OrderPlacedEvent(order.Id, customerId, orderNumber, order.Total));
        return order;
    }

    public void Confirm()
    {
        if (Status != OrderStatus.Pending)
            throw new InvalidOperationException("Only pending orders can be confirmed");

        Status = OrderStatus.Confirmed;
        AddEvent(new OrderConfirmedEvent(Id, DateTime.UtcNow));
    }

    public void Ship(string trackingNumber)
    {
        if (Status != OrderStatus.Confirmed)
            throw new InvalidOperationException("Only confirmed orders can be shipped");

        Status = OrderStatus.Shipped;
        TrackingNumber = trackingNumber;
        AddEvent(new OrderShippedEvent(Id, trackingNumber));
    }
}
```

### MediatR Event Handlers

With MediatR, you can create notification handlers for your domain events:

```csharp
// Send confirmation email when order is placed
public class OrderPlacedEmailHandler(IEmailService emailService) : INotificationHandler<OrderPlacedEvent>
{
    public async Task Handle(OrderPlacedEvent notification, CancellationToken ct)
    {
        await emailService.SendOrderConfirmationAsync(
            notification.CustomerId, notification.OrderNumber, notification.Total, ct);
    }
}

// Update inventory when order is placed
public class OrderPlacedInventoryHandler(IInventoryService inventoryService) : INotificationHandler<OrderPlacedEvent>
{
    public async Task Handle(OrderPlacedEvent notification, CancellationToken ct)
    {
        await inventoryService.ReserveItemsForOrderAsync(notification.OrderId, ct);
    }
}
```

### Service Layer

```csharp
public class OrderService(AppDbContext dbContext)
{
    public async Task<Guid> CreateOrderAsync(
        Guid customerId, List<OrderItem> items, CancellationToken ct = default)
    {
        var orderNumber = GenerateOrderNumber();
        var order = Order.Create(customerId, orderNumber, items);

        await dbContext.Orders.AddAsync(order, ct);
        await dbContext.SaveChangesAsync(ct);
        // Events are automatically published via MediatR

        return order.Id;
    }

    public async Task ConfirmOrderAsync(Guid orderId, CancellationToken ct = default)
    {
        var order = await dbContext.Orders.FindAsync(new object[] { orderId }, ct);
        order?.Confirm();
        await dbContext.SaveChangesAsync(ct);
        // OrderConfirmedEvent automatically published via MediatR
    }

    private static string GenerateOrderNumber() =>
        $"ORD-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid():N}"[..20];
}
```

## Advanced Features

### Event Type Mapping with Mapster

Add event types instead of instances for automatic mapping:

```csharp
//The Entity is an abstract class from DKNet.EfCore.Abstractions.Entities
public class Order : Entity
{
    public static Order Create(string orderNumber, decimal total)
    {
        var order = new Order { OrderNumber = orderNumber, Total = total };

        // Add event TYPE instead of instance
        order.AddEvent<OrderPlacedEvent>();
        return order;
    }
}
```

Configure Mapster for automatic mapping:

```csharp
// Map Order entity to OrderPlacedEvent
TypeAdapterConfig.GlobalSettings.NewConfig<Order, OrderPlacedEvent>()
    .Map(dest => dest.OrderId, src => src.Id)
    .Map(dest => dest.OrderNumber, src => src.OrderNumber);
```

### Conditional Event Handling

Handle events based on business rules:

```csharp
public class HighValueOrderHandler(INotificationService notificationService) : INotificationHandler<OrderPlacedEvent>
{
    public async Task Handle(OrderPlacedEvent notification, CancellationToken ct)
    {
        if (notification.Total < 1000) return; // Only handle orders over $1000

        await notificationService.NotifyManagerAsync(
            $"High value order: {notification.OrderNumber} - {notification.Total:C}", ct);
    }
}
```

### Integration with MediatR

The library integrates seamlessly with MediatR through the `IEventPublisher` interface:

```csharp
//The IEventPublisher interface is from DKNet.EfCore.Abstractions.Events
public class MediatREventPublisher(IMediator mediator) : IEventPublisher
{
    public async Task PublishAsync(object eventObj, CancellationToken cancellationToken = default)
    {
        // MediatR will automatically find and invoke all INotificationHandler<T> implementations
        await mediator.Publish(eventObj, cancellationToken);
    }
}
```

Then create MediatR notification handlers:

```csharp
public class OrderPlacedNotificationHandler(IEmailService emailService, IInventoryService inventoryService)
    : INotificationHandler<OrderPlacedEvent>
{
    public async Task Handle(OrderPlacedEvent notification, CancellationToken ct)
    {
        // Send email confirmation
        await emailService.SendOrderConfirmationAsync(notification, ct);

        // Reserve inventory items
        await inventoryService.ReserveItemsAsync(notification.OrderId, ct);
    }
}
```

## Best Practices

### 1. Keep Events Immutable

Always use records or readonly properties:

```csharp
// ✅ Good
public record OrderPlacedEvent(Guid OrderId, decimal Total);

// ❌ Avoid
public class OrderPlacedEvent
{
    public Guid OrderId { get; set; }
    public decimal Total { get; set; }
}
```

### 2. Name Events in Past Tense

Events represent facts that already occurred:

```csharp
// ✅ Good: OrderPlacedEvent, PaymentProcessedEvent
// ❌ Avoid: PlaceOrderEvent, ProcessPaymentEvent
```

### 3. Keep Handlers Focused

Each MediatR notification handler should have a single responsibility:

```csharp
// ✅ Good: One responsibility
public class OrderPlacedEmailHandler(IEmailService emailService) : INotificationHandler<OrderPlacedEvent>
{
    public Task Handle(OrderPlacedEvent notification, CancellationToken ct)
        => emailService.SendConfirmationAsync(notification, ct);
}
```

### 4. Handle Failures Gracefully

```csharp
public class OrderPlacedEmailHandler(IEmailService emailService, ILogger<OrderPlacedEmailHandler> logger)
    : INotificationHandler<OrderPlacedEvent>
{
    public async Task Handle(OrderPlacedEvent notification, CancellationToken ct)
    {
        try
        {
            await emailService.SendAsync(notification, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send email for order {OrderId}", notification.OrderId);
            // Consider retry logic or dead letter queue
        }
    }
}
```

### 5. Use Strongly-Typed Events

```csharp
// ✅ Good
public record OrderPlacedEvent(Guid OrderId, decimal Total);

// ❌ Avoid
public record GenericEvent(string EventType, Dictionary<string, object> Data);
```

## Conclusion

DKNet.EfCore.Events simplifies domain event implementation in .NET applications by providing:

- **Easy Setup**: Inherit from `Entity`, call `AddEvent()`, configure hooks and MediatR
- **Zero DbContext Changes**: Hook-based architecture handles everything automatically
- **Transaction Safety**: Events published only after successful database commits
- **MediatR Integration**: Seamless integration with MediatR for powerful event handling
- **Clean Architecture**: Decouples business logic from side effects
- **DDD Support**: First-class domain-driven design with base entity classes

The library integrates seamlessly into existing EF Core applications with MediatR, making it perfect for building scalable, event-driven architectures.

### Key Benefits

| Benefit                  | Description                                                     |
| ------------------------ | --------------------------------------------------------------- |
| **Reduced Coupling**     | Business logic independent of implementation details            |
| **Better Organization**  | Side effects explicitly modeled as events                       |
| **Easier Testing**       | Mock MediatR notification handlers instead of multiple services |
| **Improved Scalability** | Add handlers without changing existing code                     |
| **Transaction Safety**   | Events only published on successful commits                     |
| **MediatR Integration**  | Leverage MediatR's powerful notification system                 |

## References

- [DKNet.EfCore.Events GitHub](https://github.com/baoduy/DKNet/tree/dev/src/EfCore/DKNet.EfCore.Events)
- [DKNet.EfCore.Hooks GitHub](https://github.com/baoduy/DKNet/tree/dev/src/EfCore/DKNet.EfCore.Hooks)
- [Usage Examples & Tests](https://github.com/baoduy/DKNet/tree/dev/src/EfCore/EfCore.Events.Tests)
- [NuGet Packages](https://www.nuget.org/packages/DKNet.EfCore.Events)
- [DKNet Framework Docs](https://baoduy.github.io/DKNet/EfCore/)
- [Domain Events - Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/domain-events-design-implementation)

## Related Articles

- [Simplify EF Core Lifecycle Management with DKNet.EfCore.Hooks](/posts/dotnet-06-efcore-hooks/)

## Thank You

Thank you for reading! I hope this guide helps you build better event-driven applications with Entity Framework Core. Feel free to explore the DKNet.EfCore.Events library and share your feedback! 🌟

**Steven** | [GitHub](https://github.com/baoduy)
