---
author: Steven Hoang
pubDatetime: 2024-09-01T12:00:00Z
title: "[.NET] Automate EF Core DTOs with DKNet.EfCore.DtoGenerator"
postSlug: dotnet-05-efcore-dto-generator
featured: true
draft: false
tags:
  - dotnet
  - efcore
  - source-generator
description: "Stop hand-writing DTOs for every EF Core entity. DKNet.EfCore.DtoGenerator keeps contracts in sync with your DbContext and accelerates .NET 9 delivery."
---

Shipping modern .NET applications often means balancing a clean domain model with practical API contracts. Entity Framework Core lets us model the domain elegantly, but exposing those entities directly is usually a no-go—DTOs keep APIs slim, secure, and versionable. The trade-off? Hours of repetitive boilerplate every time the entity model shifts.

`DKNet.EfCore.DtoGenerator` changes that routine. Available as a NuGet package, it introspects an EF Core model at build time and emits strongly typed DTOs that mirror our entities while respecting the boundaries we define. I have been rolling it into several .NET 9 services to keep application layers clean without slowing the team down.

## Table of Contents

1. [Why automate DTO creation?](#why-automate-dto-creation)
2. [Install the NuGet package](#install-the-nuget-package)
3. [Add the generator to a DbContext](#add-the-generator-to-a-dbcontext)
4. [Fine-tune DTO output](#fine-tune-dto-output)
5. [Wire DTOs into Minimal APIs](#wire-dtos-into-minimal-apis)
6. [Bring it into CI/CD](#bring-it-into-cicd)
7. [Wrap up](#wrap-up)

## Why automate DTO creation?

When building APIs on EF Core, we typically face three persistent pain points:

- **Manual mapping churn** – Every new property or navigation on an entity requires touching DTOs and AutoMapper profiles.
- **Inconsistent contracts** – Small discrepancies creep in between entity and DTO definitions, causing runtime surprises and contract drift.
- **Slow iteration** – Refactoring an aggregate means revisiting dozens of DTO classes before the build succeeds again.

`DKNet.EfCore.DtoGenerator` addresses those pain points by reading the same metadata EF Core uses, so the generated DTOs stay aligned with the entity model on every build. The generator emits C# `record` types that are easy to consume in controllers, Minimal APIs, or background services. Better yet, it keeps our focus on domain logic instead of plumbing.

## Install the NuGet package

Add the package to the project that owns the EF Core model (usually the API or an application layer project):

```bash
# inside the project directory that references Microsoft.EntityFrameworkCore
 dotnet add package DKNet.EfCore.DtoGenerator
```

Because this is a source generator, there is no runtime dependency. The package runs at compile time and drops generated files into the build output that the IDE picks up automatically.

## Add the generator to a DbContext

The generator activates through an attribute placed on the DbContext class. It discovers every entity tracked by the context and produces DTO pairs by default: a request DTO for inbound operations and a response DTO for outbound contracts.

```csharp
using DKNet.EfCore.DtoGenerator;

namespace SampleApp.Data;

[GenerateDtos(
    Namespace = "SampleApp.Contracts",
    IncludeNavigationDtos = false)]
public sealed partial class AppDbContext : DbContext
{
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Order> Orders => Set<Order>();
}
```

During compilation, the generator emits types similar to the following inside the `SampleApp.Contracts` namespace:

```csharp
public sealed record CustomerDto(
    Guid Id,
    string Email,
    string? DisplayName,
    bool IsActive);

public sealed record CreateCustomerDto(
    string Email,
    string? DisplayName);
```

The properties mirror the entity while respecting visibility rules. Private setters or ignored properties stay out of the DTO surface.

## Fine-tune DTO output

Every project has different rules about what should flow across service boundaries. The generator offers a fluent configuration API through attributes so we can fine-tune the output without touching T4 files or scripts.

```csharp
[DtoFor(typeof(Customer))
    .Ignore(c => c.InternalNotes)
    .Rename(c => c.DisplayName, "Name")
    .Flatten(c => c.Address, prefix: "Address")
    .AddExtraProperty<string>("TenantId", source: ContextProperty.HttpHeader("X-Tenant"))]
public partial class CustomerEntityConfiguration { }
```

A few highlights:

- **Ignore** removes sensitive or internal properties entirely.
- **Rename** lets DTOs adopt API-friendly naming conventions.
- **Flatten** pulls value objects or owned types onto the root DTO.
- **AddExtraProperty** injects computed fields that never live on the entity but are useful on the wire.

For collections, the generator can produce dedicated child DTOs or project navigation IDs depending on our preference. Simply flip the `IncludeNavigationDtos` flag or override it per entity with `[NavigationStrategy(NavigationMode.IdsOnly)]`.

## Wire DTOs into Minimal APIs

Because the generator emits records with matching shapes, we can plug them straight into Minimal API route handlers. A quick example that maps generated DTOs to existing services:

```csharp
app.MapPost("/customers", async Task<IResult> (
        CreateCustomerDto request,
        ICustomerService service,
        CancellationToken token) =>
    {
        var id = await service.CreateAsync(request, token);
        var customer = await service.GetAsync(id, token);
        return Results.Created($"/customers/{id}", customer.ToDto());
    })
    .WithName("CreateCustomer")
    .Produces<CustomerDto>(StatusCodes.Status201Created)
    .ProducesValidationProblem();
```

The call to `customer.ToDto()` is also generated, reducing the need for AutoMapper in simple scenarios. When the domain model evolves, the DTO stays in lockstep, so this endpoint keeps compiling without additional manual updates.

## Bring it into CI/CD

Generated sources land inside the `obj` folder, meaning local builds, CI pipelines, and IDEs all see the same artifacts. To make sure DTOs stay current:

1. Enable deterministic builds in your project file so the generator output is consistent across machines.
2. Add a check to your pipeline that ensures no pending DTO files exist after a build:

   ```bash
   dotnet build
   git diff --exit-code
   ```

   If someone forgot to commit regenerated DTOs, the build will fail and point them to rerun `dotnet build` locally.

3. Package the generated contracts with your application by including the output assembly or publishing the DTO project as a standalone NuGet package for consumers.

## Wrap up

`DKNet.EfCore.DtoGenerator` has become a staple in my .NET 9 toolkit because it strikes the right balance between convention and control. I get strongly typed DTOs, consistent naming, and zero repetitive mapping work. If you are maintaining a layered architecture on top of EF Core, grab the package from NuGet, add the attribute to your DbContext, and let the generator keep your contracts honest while you focus on building features.

You can explore the full source, samples, and roadmap in the GitHub repository: [github.com/baoduy/DKNet](https://github.com/baoduy/DKNet/tree/dev/src/EfCore/DKNet.EfCore.DtoGenerator). Let me know how you wire it into your own pipelines—I am always curious about real-world automation stories.
