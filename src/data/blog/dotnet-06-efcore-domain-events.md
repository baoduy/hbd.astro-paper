---
author: Steven Hoang
pubDatetime: 2025-10-25T09:30:00Z
title: "[.NET] Simplify Domain Events with DKNet.EfCore.Events"
postSlug: dotnet-06-efcore-domain-events
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

In Domain-Driven Design (DDD), domain events are a powerful pattern for making implicit side effects explicit. When an order is placed, you might need to send a confirmation email, update inventory, and notify the shipping department. But how do you handle these cross-cutting concerns cleanly without tangling business logic with infrastructure code? What if there was a library that seamlessly integrates domain events into Entity Framework Core's transaction lifecycle?

**DKNet.EfCore.Events** is a lightweight library that brings elegant domain event management to EF Core applications. It automatically captures and publishes domain events as part of your database transactions, ensuring consistency and reliability while maintaining clean separation of concerns.

## Table of Contents

1. [Understanding Domain Events](#understanding-domain-events)
2. [The Challenge with EF Core Domain Events](#the-challenge-with-ef-core-domain-events)
3. [What is DKNet.EfCore.Events?](#what-is-dknetefcoreevents)
4. [Getting Started](#getting-started)
5. [Basic Usage](#basic-usage)
6. [Event Handlers](#event-handlers)
7. [Practical Example: E-Commerce Order System](#practical-example-e-commerce-order-system)
8. [Advanced Features](#advanced-features)
9. [Best Practices](#best-practices)
10. [Conclusion](#conclusion)

## Understanding Domain Events

Domain events are objects that capture something significant that happened in your domain. They represent facts about state changes in your business domain that other parts of your application might care about.

### Why Domain Events Matter

In traditional applications, side effects are often directly coded into business logic:

```csharp
public class OrderService
{
    private readonly IEmailService _emailService;
    private readonly IInventoryService _inventoryService;
    private readonly IShippingService _shippingService;
    
    public async Task CreateOrderAsync(Order order)
    {
        // Save order
        await _dbContext.Orders.AddAsync(order);
        await _dbContext.SaveChangesAsync();
        
        // Direct coupling to multiple services
        await _emailService.SendConfirmationAsync(order);
        await _inventoryService.ReserveItemsAsync(order);
        await _shippingService.NotifyAsync(order);
    }
}
```

This approach has several problems:

- **Tight Coupling**: `OrderService` depends on every service that needs to react to order creation
- **Difficult Testing**: You must mock all dependent services
- **Poor Scalability**: Adding new side effects requires modifying existing code
- **Transaction Boundaries**: What if email sending fails? Should we rollback the order?

### Domain Events to the Rescue

With domain events, you can decouple side effects from the core business logic:

```csharp
public class Order
{
    public Guid Id { get; private set; }
    public string OrderNumber { get; private set; } = string.Empty;
    public decimal Total { get; private set; }
    
    // Queue domain events
    private readonly List<object> _domainEvents = new();
    public IReadOnlyCollection<object> DomainEvents => _domainEvents.AsReadOnly();
    
    public static Order Create(string orderNumber, decimal total)
    {
        var order = new Order
        {
            Id = Guid.NewGuid(),
            OrderNumber = orderNumber,
            Total = total
        };
        
        // Raise domain event instead of directly calling services
        order._domainEvents.Add(new OrderPlacedEvent(order.Id, order.OrderNumber, order.Total));
        
        return order;
    }
}
```

Now your `OrderService` only needs to focus on order creation:

```csharp
public class OrderService
{
    public async Task CreateOrderAsync(string orderNumber, decimal total)
    {
        var order = Order.Create(orderNumber, total);
        await _dbContext.Orders.AddAsync(order);
        await _dbContext.SaveChangesAsync();
        // Events are automatically published by the framework
    }
}
```

Multiple handlers can react independently:

```csharp
public class OrderConfirmationEmailHandler : IEventHandler<OrderPlacedEvent>
{
    public Task HandleAsync(OrderPlacedEvent @event, CancellationToken ct)
    {
        // Send confirmation email
    }
}

public class InventoryReservationHandler : IEventHandler<OrderPlacedEvent>
{
    public Task HandleAsync(OrderPlacedEvent @event, CancellationToken ct)
    {
        // Reserve inventory
    }
}
```

## The Challenge with EF Core Domain Events

While domain events are conceptually simple, implementing them correctly with EF Core presents several challenges:

### 1. Transaction Consistency

Events should only be published if the database transaction succeeds. If the transaction rolls back, events should not be published.

### 2. Event Collection and Storage

Where do you store domain events? How do you collect them from entities before saving?

### 3. Event Publishing Timing

Should events be published before or after `SaveChanges`? Different scenarios require different timing.

### 4. Boilerplate Code

Implementing a complete domain event infrastructure involves significant plumbing code:

- Event collection mechanism in entities
- Event discovery during SaveChanges
- Event publisher infrastructure
- Event handler registration
- Transaction coordination

### 5. Testing Complexity

Testing domain events requires mocking the entire event infrastructure.

## What is DKNet.EfCore.Events?

**DKNet.EfCore.Events** is a comprehensive library that solves all these challenges with minimal configuration. Here's what makes it special:

### Key Features

- **Automatic Event Discovery**: Automatically collects domain events from tracked entities
- **Transaction Integration**: Events are published only after successful database transactions
- **Flexible Event Publishing**: Supports both pre-save and post-save event handlers
- **Simple Entity Interface**: Single `IEventEntity` interface to implement
- **DI-Friendly**: Seamless integration with .NET dependency injection
- **Type-Safe**: Full compiler checking for events and handlers
- **Minimal Boilerplate**: Get started with just a few lines of configuration
- **Testing Support**: Easy to test with mock event publishers

### How It Works

```
┌─────────────┐
│   Entity    │
│  (Domain)   │──┐
└─────────────┘  │
                 │ Raises Events
                 ▼
         ┌──────────────┐
         │ IEventEntity │
         │  Interface   │
         └──────────────┘
                 │
                 │ Collected by
                 ▼
         ┌──────────────┐
         │  DbContext   │
         │ SaveChanges  │
         └──────────────┘
                 │
                 │ Published via
                 ▼
        ┌────────────────┐
        │ EventPublisher │
        └────────────────┘
                 │
                 │ Dispatched to
                 ▼
        ┌────────────────┐
        │ Event Handlers │
        └────────────────┘
```

## Getting Started

### Prerequisites

Before using DKNet.EfCore.Events, ensure you have:

- **.NET 9.0 SDK** or later
- **Entity Framework Core** configured in your project

### Installation

Add the NuGet package to your project:

```bash
dotnet add package DKNet.EfCore.Events
```

Or add it directly to your `.csproj` file:

```xml
<ItemGroup>
  <PackageReference Include="DKNet.EfCore.Events" Version="9.0.*" />
</ItemGroup>
```

### Configuration

Register the event publisher in your `Program.cs` or `Startup.cs`:

```csharp
using DKNet.EfCore.Events;

var builder = WebApplication.CreateBuilder(args);

// Register DbContext with event support
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString));

// Register event publisher and handlers
builder.Services.AddEventPublisher<AppDbContext>();

// Register your event handlers
builder.Services.AddScoped<IEventHandler<OrderPlacedEvent>, OrderConfirmationEmailHandler>();
builder.Services.AddScoped<IEventHandler<OrderPlacedEvent>, InventoryReservationHandler>();

var app = builder.Build();
```

That's all you need to get started!

## Basic Usage

### Step 1: Define Your Domain Event

Create a simple class to represent your domain event:

```csharp
public record OrderPlacedEvent(
    Guid OrderId,
    string OrderNumber,
    decimal Total,
    DateTime PlacedAt);
```

Domain events should be immutable (use `record` or readonly properties) to prevent modification after creation.

### Step 2: Implement IEventEntity

Make your entity implement the `IEventEntity` interface:

```csharp
using DKNet.EfCore.Events;

public class Order : IEventEntity
{
    private readonly List<object> _domainEvents = new();
    
    public Guid Id { get; private set; }
    public string OrderNumber { get; private set; } = string.Empty;
    public decimal Total { get; private set; }
    public OrderStatus Status { get; private set; }
    public DateTime PlacedAt { get; private set; }
    
    // IEventEntity implementation
    public IReadOnlyCollection<object> DomainEvents => _domainEvents.AsReadOnly();
    
    public void AddDomainEvent(object eventItem)
    {
        _domainEvents.Add(eventItem);
    }
    
    public void RemoveDomainEvent(object eventItem)
    {
        _domainEvents.Remove(eventItem);
    }
    
    public void ClearDomainEvents()
    {
        _domainEvents.Clear();
    }
    
    // Business logic
    public static Order Create(string orderNumber, decimal total)
    {
        var order = new Order
        {
            Id = Guid.NewGuid(),
            OrderNumber = orderNumber,
            Total = total,
            Status = OrderStatus.Pending,
            PlacedAt = DateTime.UtcNow
        };
        
        // Raise domain event
        order.AddDomainEvent(new OrderPlacedEvent(
            order.Id,
            order.OrderNumber,
            order.Total,
            order.PlacedAt));
        
        return order;
    }
}
```

### Step 3: Configure DbContext

Update your `DbContext` to enable event publishing:

```csharp
public class AppDbContext : DbContext
{
    private readonly IEventPublisher _eventPublisher;
    
    public AppDbContext(
        DbContextOptions<AppDbContext> options,
        IEventPublisher eventPublisher) : base(options)
    {
        _eventPublisher = eventPublisher;
    }
    
    public DbSet<Order> Orders => Set<Order>();
    
    public override async Task<int> SaveChangesAsync(
        CancellationToken cancellationToken = default)
    {
        // Collect events from entities
        var events = this.GetDomainEvents();
        
        // Save changes
        var result = await base.SaveChangesAsync(cancellationToken);
        
        // Publish events after successful save
        await _eventPublisher.PublishAsync(events, cancellationToken);
        
        return result;
    }
}
```

The `GetDomainEvents()` extension method automatically collects events from all tracked entities implementing `IEventEntity`.

## Event Handlers

Event handlers contain the logic that responds to domain events. They implement the `IEventHandler<TEvent>` interface:

```csharp
using DKNet.EfCore.Events;

public class OrderConfirmationEmailHandler : IEventHandler<OrderPlacedEvent>
{
    private readonly IEmailService _emailService;
    private readonly ILogger<OrderConfirmationEmailHandler> _logger;
    
    public OrderConfirmationEmailHandler(
        IEmailService emailService,
        ILogger<OrderConfirmationEmailHandler> logger)
    {
        _emailService = emailService;
        _logger = logger;
    }
    
    public async Task HandleAsync(
        OrderPlacedEvent @event,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "Sending confirmation email for order {OrderNumber}",
            @event.OrderNumber);
        
        await _emailService.SendOrderConfirmationAsync(
            @event.OrderId,
            @event.OrderNumber,
            @event.Total,
            cancellationToken);
        
        _logger.LogInformation(
            "Confirmation email sent for order {OrderNumber}",
            @event.OrderNumber);
    }
}
```

### Multiple Handlers

Multiple handlers can respond to the same event:

```csharp
public class InventoryReservationHandler : IEventHandler<OrderPlacedEvent>
{
    private readonly IInventoryService _inventoryService;
    
    public async Task HandleAsync(
        OrderPlacedEvent @event,
        CancellationToken cancellationToken)
    {
        await _inventoryService.ReserveItemsForOrderAsync(
            @event.OrderId,
            cancellationToken);
    }
}

public class OrderMetricsHandler : IEventHandler<OrderPlacedEvent>
{
    private readonly IMetricsService _metricsService;
    
    public async Task HandleAsync(
        OrderPlacedEvent @event,
        CancellationToken cancellationToken)
    {
        await _metricsService.RecordOrderPlacedAsync(
            @event.Total,
            @event.PlacedAt,
            cancellationToken);
    }
}
```

Register all handlers in your DI container:

```csharp
services.AddScoped<IEventHandler<OrderPlacedEvent>, OrderConfirmationEmailHandler>();
services.AddScoped<IEventHandler<OrderPlacedEvent>, InventoryReservationHandler>();
services.AddScoped<IEventHandler<OrderPlacedEvent>, OrderMetricsHandler>();
```

## Practical Example: E-Commerce Order System

Let's build a complete e-commerce order system to see DKNet.EfCore.Events in action.

### Domain Events

```csharp
// Order lifecycle events
public record OrderPlacedEvent(
    Guid OrderId,
    Guid CustomerId,
    string OrderNumber,
    decimal Total,
    DateTime PlacedAt);

public record OrderConfirmedEvent(
    Guid OrderId,
    DateTime ConfirmedAt);

public record OrderShippedEvent(
    Guid OrderId,
    string TrackingNumber,
    DateTime ShippedAt);

public record OrderCancelledEvent(
    Guid OrderId,
    string Reason,
    DateTime CancelledAt);
```

### Order Entity

```csharp
public class Order : IEventEntity
{
    private readonly List<object> _domainEvents = new();
    private readonly List<OrderItem> _items = new();
    
    public Guid Id { get; private set; }
    public Guid CustomerId { get; private set; }
    public string OrderNumber { get; private set; } = string.Empty;
    public OrderStatus Status { get; private set; }
    public DateTime PlacedAt { get; private set; }
    public DateTime? ConfirmedAt { get; private set; }
    public DateTime? ShippedAt { get; private set; }
    public string? TrackingNumber { get; private set; }
    
    public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();
    public decimal Total => _items.Sum(i => i.Price * i.Quantity);
    
    // IEventEntity implementation
    public IReadOnlyCollection<object> DomainEvents => _domainEvents.AsReadOnly();
    public void AddDomainEvent(object eventItem) => _domainEvents.Add(eventItem);
    public void RemoveDomainEvent(object eventItem) => _domainEvents.Remove(eventItem);
    public void ClearDomainEvents() => _domainEvents.Clear();
    
    // Factory method
    public static Order Create(Guid customerId, string orderNumber, List<OrderItem> items)
    {
        var order = new Order
        {
            Id = Guid.NewGuid(),
            CustomerId = customerId,
            OrderNumber = orderNumber,
            Status = OrderStatus.Pending,
            PlacedAt = DateTime.UtcNow
        };
        
        order._items.AddRange(items);
        
        order.AddDomainEvent(new OrderPlacedEvent(
            order.Id,
            order.CustomerId,
            order.OrderNumber,
            order.Total,
            order.PlacedAt));
        
        return order;
    }
    
    // Business methods
    public void Confirm()
    {
        if (Status != OrderStatus.Pending)
            throw new InvalidOperationException("Only pending orders can be confirmed");
        
        Status = OrderStatus.Confirmed;
        ConfirmedAt = DateTime.UtcNow;
        
        AddDomainEvent(new OrderConfirmedEvent(Id, ConfirmedAt.Value));
    }
    
    public void Ship(string trackingNumber)
    {
        if (Status != OrderStatus.Confirmed)
            throw new InvalidOperationException("Only confirmed orders can be shipped");
        
        Status = OrderStatus.Shipped;
        ShippedAt = DateTime.UtcNow;
        TrackingNumber = trackingNumber;
        
        AddDomainEvent(new OrderShippedEvent(Id, trackingNumber, ShippedAt.Value));
    }
    
    public void Cancel(string reason)
    {
        if (Status == OrderStatus.Shipped || Status == OrderStatus.Delivered)
            throw new InvalidOperationException("Cannot cancel shipped or delivered orders");
        
        Status = OrderStatus.Cancelled;
        
        AddDomainEvent(new OrderCancelledEvent(Id, reason, DateTime.UtcNow));
    }
}

public class OrderItem
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Quantity { get; set; }
}

public enum OrderStatus
{
    Pending,
    Confirmed,
    Shipped,
    Delivered,
    Cancelled
}
```

### Event Handlers

```csharp
// Send confirmation email when order is placed
public class OrderPlacedEmailHandler : IEventHandler<OrderPlacedEvent>
{
    private readonly IEmailService _emailService;
    private readonly AppDbContext _dbContext;
    
    public async Task HandleAsync(OrderPlacedEvent @event, CancellationToken ct)
    {
        var customer = await _dbContext.Customers.FindAsync(@event.CustomerId);
        
        await _emailService.SendAsync(
            customer.Email,
            "Order Confirmation",
            $"Your order {@event.OrderNumber} has been placed. Total: {@event.Total:C}",
            ct);
    }
}

// Reserve inventory when order is placed
public class OrderPlacedInventoryHandler : IEventHandler<OrderPlacedEvent>
{
    private readonly IInventoryService _inventoryService;
    
    public async Task HandleAsync(OrderPlacedEvent @event, CancellationToken ct)
    {
        await _inventoryService.ReserveItemsForOrderAsync(@event.OrderId, ct);
    }
}

// Update analytics when order is placed
public class OrderPlacedAnalyticsHandler : IEventHandler<OrderPlacedEvent>
{
    private readonly IAnalyticsService _analyticsService;
    
    public async Task HandleAsync(OrderPlacedEvent @event, CancellationToken ct)
    {
        await _analyticsService.TrackOrderPlacedAsync(
            @event.CustomerId,
            @event.Total,
            @event.PlacedAt,
            ct);
    }
}

// Send tracking email when order is shipped
public class OrderShippedEmailHandler : IEventHandler<OrderShippedEvent>
{
    private readonly IEmailService _emailService;
    private readonly AppDbContext _dbContext;
    
    public async Task HandleAsync(OrderShippedEvent @event, CancellationToken ct)
    {
        var order = await _dbContext.Orders
            .Include(o => o.Items)
            .FirstAsync(o => o.Id == @event.OrderId, ct);
        
        var customer = await _dbContext.Customers.FindAsync(order.CustomerId);
        
        await _emailService.SendAsync(
            customer.Email,
            "Order Shipped",
            $"Your order {order.OrderNumber} has been shipped. Tracking: {@event.TrackingNumber}",
            ct);
    }
}

// Release inventory when order is cancelled
public class OrderCancelledInventoryHandler : IEventHandler<OrderCancelledEvent>
{
    private readonly IInventoryService _inventoryService;
    
    public async Task HandleAsync(OrderCancelledEvent @event, CancellationToken ct)
    {
        await _inventoryService.ReleaseItemsForOrderAsync(@event.OrderId, ct);
    }
}
```

### Service Layer

```csharp
public class OrderService
{
    private readonly AppDbContext _dbContext;
    private readonly ILogger<OrderService> _logger;
    
    public OrderService(AppDbContext dbContext, ILogger<OrderService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }
    
    public async Task<Guid> CreateOrderAsync(
        Guid customerId,
        List<OrderItem> items,
        CancellationToken ct = default)
    {
        var orderNumber = GenerateOrderNumber();
        var order = Order.Create(customerId, orderNumber, items);
        
        await _dbContext.Orders.AddAsync(order, ct);
        await _dbContext.SaveChangesAsync(ct);
        // Events are automatically published here
        
        _logger.LogInformation("Order {OrderNumber} created", orderNumber);
        
        return order.Id;
    }
    
    public async Task ConfirmOrderAsync(Guid orderId, CancellationToken ct = default)
    {
        var order = await _dbContext.Orders.FindAsync(new object[] { orderId }, ct);
        if (order == null)
            throw new NotFoundException($"Order {orderId} not found");
        
        order.Confirm();
        await _dbContext.SaveChangesAsync(ct);
        // OrderConfirmedEvent is automatically published
        
        _logger.LogInformation("Order {OrderId} confirmed", orderId);
    }
    
    public async Task ShipOrderAsync(
        Guid orderId,
        string trackingNumber,
        CancellationToken ct = default)
    {
        var order = await _dbContext.Orders.FindAsync(new object[] { orderId }, ct);
        if (order == null)
            throw new NotFoundException($"Order {orderId} not found");
        
        order.Ship(trackingNumber);
        await _dbContext.SaveChangesAsync(ct);
        // OrderShippedEvent is automatically published
        
        _logger.LogInformation("Order {OrderId} shipped with tracking {TrackingNumber}",
            orderId, trackingNumber);
    }
    
    private static string GenerateOrderNumber() =>
        $"ORD-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid():N}"[..20];
}
```

### API Controller

```csharp
[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private readonly OrderService _orderService;
    
    public OrdersController(OrderService orderService)
    {
        _orderService = orderService;
    }
    
    [HttpPost]
    public async Task<ActionResult<Guid>> CreateOrder(
        [FromBody] CreateOrderRequest request,
        CancellationToken ct)
    {
        var orderId = await _orderService.CreateOrderAsync(
            request.CustomerId,
            request.Items,
            ct);
        
        return CreatedAtAction(nameof(GetOrder), new { id = orderId }, orderId);
    }
    
    [HttpPost("{id}/confirm")]
    public async Task<IActionResult> ConfirmOrder(Guid id, CancellationToken ct)
    {
        await _orderService.ConfirmOrderAsync(id, ct);
        return NoContent();
    }
    
    [HttpPost("{id}/ship")]
    public async Task<IActionResult> ShipOrder(
        Guid id,
        [FromBody] ShipOrderRequest request,
        CancellationToken ct)
    {
        await _orderService.ShipOrderAsync(id, request.TrackingNumber, ct);
        return NoContent();
    }
}
```

### Flow Diagram

Here's how it all works together:

```
User Request → Controller → Service → Entity (raises event) → DbContext.SaveChanges()
                                                                      ↓
                                            ┌─────────────────────────┘
                                            ▼
                                     Event Publisher
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
            Email Handler          Inventory Handler         Analytics Handler
                    │                       │                       │
                    └───────────────────────┴───────────────────────┘
                                            │
                                    All handlers execute
                                    (in parallel or sequence)
```

## Advanced Features

### Pre-Save Events

Sometimes you need to execute logic before saving to the database. Create a custom event publisher that handles pre-save events:

```csharp
public class CustomEventPublisher : IEventPublisher
{
    private readonly IServiceProvider _serviceProvider;
    
    public async Task PublishAsync(
        IEnumerable<object> events,
        CancellationToken cancellationToken)
    {
        foreach (var @event in events)
        {
            var eventType = @event.GetType();
            var handlerType = typeof(IEventHandler<>).MakeGenericType(eventType);
            
            var handlers = _serviceProvider.GetServices(handlerType);
            
            foreach (var handler in handlers)
            {
                var handleMethod = handlerType.GetMethod(nameof(IEventHandler<object>.HandleAsync));
                await (Task)handleMethod!.Invoke(handler, new[] { @event, cancellationToken })!;
            }
        }
    }
}
```

### Event Metadata

Add metadata to your events for auditing and tracing:

```csharp
public record OrderPlacedEvent(
    Guid OrderId,
    Guid CustomerId,
    string OrderNumber,
    decimal Total,
    DateTime PlacedAt)
{
    public Guid EventId { get; init; } = Guid.NewGuid();
    public DateTime EventTimestamp { get; init; } = DateTime.UtcNow;
    public string EventSource { get; init; } = "OrderService";
}
```

### Conditional Event Handling

Handle events conditionally based on business rules:

```csharp
public class HighValueOrderHandler : IEventHandler<OrderPlacedEvent>
{
    private readonly INotificationService _notificationService;
    
    public async Task HandleAsync(OrderPlacedEvent @event, CancellationToken ct)
    {
        // Only handle orders over $1000
        if (@event.Total < 1000)
            return;
        
        await _notificationService.NotifyManagerAsync(
            $"High value order placed: {@event.OrderNumber} - {@event.Total:C}",
            ct);
    }
}
```

### Event Filtering

Create a base event handler that provides filtering capabilities:

```csharp
public abstract class FilteredEventHandler<TEvent> : IEventHandler<TEvent>
{
    protected abstract Task HandleEventAsync(TEvent @event, CancellationToken ct);
    protected abstract bool ShouldHandle(TEvent @event);
    
    public Task HandleAsync(TEvent @event, CancellationToken ct)
    {
        return ShouldHandle(@event)
            ? HandleEventAsync(@event, ct)
            : Task.CompletedTask;
    }
}

public class WeekendOrderHandler : FilteredEventHandler<OrderPlacedEvent>
{
    protected override bool ShouldHandle(OrderPlacedEvent @event)
    {
        return @event.PlacedAt.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
    }
    
    protected override Task HandleEventAsync(OrderPlacedEvent @event, CancellationToken ct)
    {
        // Special handling for weekend orders
        return Task.CompletedTask;
    }
}
```

### Integration with MediatR

DKNet.EfCore.Events works seamlessly with MediatR for more advanced scenarios:

```csharp
public class MediatREventPublisher : IEventPublisher
{
    private readonly IMediator _mediator;
    
    public MediatREventPublisher(IMediator mediator)
    {
        _mediator = mediator;
    }
    
    public async Task PublishAsync(
        IEnumerable<object> events,
        CancellationToken cancellationToken)
    {
        foreach (var @event in events)
        {
            await _mediator.Publish(@event, cancellationToken);
        }
    }
}
```

### Outbox Pattern for Reliability

For critical scenarios, implement the Outbox pattern to ensure events are never lost:

```csharp
public class OutboxEventPublisher : IEventPublisher
{
    private readonly AppDbContext _dbContext;
    
    public async Task PublishAsync(
        IEnumerable<object> events,
        CancellationToken cancellationToken)
    {
        // Store events in outbox table instead of publishing immediately
        foreach (var @event in events)
        {
            var outboxMessage = new OutboxMessage
            {
                Id = Guid.NewGuid(),
                EventType = @event.GetType().FullName!,
                EventData = JsonSerializer.Serialize(@event),
                CreatedAt = DateTime.UtcNow,
                ProcessedAt = null
            };
            
            await _dbContext.OutboxMessages.AddAsync(outboxMessage, cancellationToken);
        }
        
        // Events will be published by a background worker
    }
}

public class OutboxMessage
{
    public Guid Id { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string EventData { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
}
```

## Best Practices

### 1. Keep Events Immutable

Always use records or readonly properties for domain events:

```csharp
// ✅ Good: Immutable record
public record OrderPlacedEvent(Guid OrderId, decimal Total);

// ✅ Good: Immutable class
public class OrderPlacedEvent
{
    public Guid OrderId { get; init; }
    public decimal Total { get; init; }
}

// ❌ Avoid: Mutable properties
public class OrderPlacedEvent
{
    public Guid OrderId { get; set; }
    public decimal Total { get; set; }
}
```

### 2. Name Events in Past Tense

Events represent facts that have already occurred:

```csharp
// ✅ Good
OrderPlacedEvent
OrderConfirmedEvent
PaymentProcessedEvent

// ❌ Avoid
PlaceOrderEvent
ConfirmOrderEvent
ProcessPaymentEvent
```

### 3. Keep Handlers Small and Focused

Each handler should do one thing:

```csharp
// ✅ Good: Single responsibility
public class OrderPlacedEmailHandler : IEventHandler<OrderPlacedEvent>
{
    public Task HandleAsync(OrderPlacedEvent @event, CancellationToken ct)
    {
        // Only send email
    }
}

// ❌ Avoid: Multiple responsibilities
public class OrderPlacedHandler : IEventHandler<OrderPlacedEvent>
{
    public async Task HandleAsync(OrderPlacedEvent @event, CancellationToken ct)
    {
        // Send email
        // Reserve inventory
        // Update analytics
        // Notify shipping
    }
}
```

### 4. Handle Failures Gracefully

Event handlers should handle exceptions appropriately:

```csharp
public class OrderPlacedEmailHandler : IEventHandler<OrderPlacedEvent>
{
    private readonly ILogger<OrderPlacedEmailHandler> _logger;
    
    public async Task HandleAsync(OrderPlacedEvent @event, CancellationToken ct)
    {
        try
        {
            await _emailService.SendAsync(...);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Failed to send order confirmation email for order {OrderId}",
                @event.OrderId);
            
            // Consider: Retry logic, dead letter queue, or compensation
            throw; // Or return if failure is acceptable
        }
    }
}
```

### 5. Test Event Handlers Independently

Write unit tests for individual handlers:

```csharp
public class OrderPlacedEmailHandlerTests
{
    [Fact]
    public async Task HandleAsync_SendsConfirmationEmail()
    {
        // Arrange
        var emailService = new Mock<IEmailService>();
        var handler = new OrderPlacedEmailHandler(emailService.Object);
        var @event = new OrderPlacedEvent(Guid.NewGuid(), "ORD-001", 100m, DateTime.UtcNow);
        
        // Act
        await handler.HandleAsync(@event, CancellationToken.None);
        
        // Assert
        emailService.Verify(x => x.SendOrderConfirmationAsync(
            @event.OrderId,
            @event.OrderNumber,
            @event.Total,
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
```

### 6. Use Strongly-Typed Events

Avoid using dictionaries or dynamic objects:

```csharp
// ✅ Good: Strongly-typed
public record OrderPlacedEvent(Guid OrderId, decimal Total);

// ❌ Avoid: Weak typing
public record GenericEvent(string EventType, Dictionary<string, object> Data);
```

### 7. Consider Event Versioning

Plan for event schema evolution:

```csharp
// Version 1
public record OrderPlacedEventV1(Guid OrderId, decimal Total);

// Version 2 with additional field
public record OrderPlacedEventV2(
    Guid OrderId,
    decimal Total,
    string Currency);  // New field

// Handler that supports both versions
public class OrderPlacedHandler :
    IEventHandler<OrderPlacedEventV1>,
    IEventHandler<OrderPlacedEventV2>
{
    public Task HandleAsync(OrderPlacedEventV1 @event, CancellationToken ct)
    {
        // Handle V1 event
    }
    
    public Task HandleAsync(OrderPlacedEventV2 @event, CancellationToken ct)
    {
        // Handle V2 event with currency
    }
}
```

### 8. Document Event Contracts

Document what each event represents and when it's raised:

```csharp
/// <summary>
/// Raised when a customer successfully places an order.
/// This event is published after the order is persisted to the database.
/// </summary>
/// <param name="OrderId">Unique identifier of the order</param>
/// <param name="CustomerId">Unique identifier of the customer</param>
/// <param name="OrderNumber">Human-readable order number</param>
/// <param name="Total">Total order amount in USD</param>
/// <param name="PlacedAt">UTC timestamp when the order was placed</param>
public record OrderPlacedEvent(
    Guid OrderId,
    Guid CustomerId,
    string OrderNumber,
    decimal Total,
    DateTime PlacedAt);
```

## Conclusion

DKNet.EfCore.Events transforms how you implement domain events in .NET applications by:

- **Simplifying Implementation**: No more boilerplate event infrastructure code
- **Ensuring Consistency**: Events are automatically tied to database transactions
- **Improving Maintainability**: Clean separation between business logic and side effects
- **Enhancing Testability**: Event handlers are independently testable
- **Enabling Scalability**: Easily add new event handlers without modifying existing code
- **Supporting DDD**: First-class support for Domain-Driven Design principles

The library seamlessly integrates into your existing EF Core applications with minimal configuration. It handles all the complexity of event collection, transaction coordination, and event publishing, letting you focus on building robust domain models and event handlers.

Whether you're building a simple application or a complex microservices architecture, DKNet.EfCore.Events provides the foundation for reliable, maintainable event-driven systems.

### Benefits Summary

| Benefit | Description |
|---------|-------------|
| **Reduced Coupling** | Business logic doesn't depend on implementation details |
| **Better Organization** | Side effects are explicitly modeled as events |
| **Easier Testing** | Mock event handlers instead of multiple services |
| **Improved Scalability** | Add new handlers without changing existing code |
| **Transaction Safety** | Events only published on successful commits |
| **Type Safety** | Full compiler checking for events and handlers |

## References

- [DKNet.EfCore.Events Source Code](https://github.com/baoduy/DKNet/tree/dev/src/EfCore/DKNet.EfCore.Events)
- [NuGet Package](https://www.nuget.org/packages/DKNet.EfCore.Events)
- [Domain Events - Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/domain-events-design-implementation)
- [Entity Framework Core Documentation](https://learn.microsoft.com/en-us/ef/core/)
- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
- [DKNet Framework Documentation](https://baoduy.github.io/DKNet/EfCore/)

## Thank You

Thank you for taking the time to read this comprehensive guide! I hope it helps you build better event-driven applications with Entity Framework Core. Feel free to explore the DKNet.EfCore.Events library, contribute to the project, and share your feedback! 🌟✨

**Steven** | [GitHub](https://github.com/baoduy)
