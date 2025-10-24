---
author: Steven Hoang
pubDatetime: 2025-10-24T09:30:00Z
title: "[.NET] Streamline Your DTOs with DKNet.EfCore.DtoGenerator"
postSlug: dotnet-05-efcore-dto-generator
featured: true
draft: false
tags:
  - dotnet
  - efcore
  - source-generator
  - dto
  - roslyn
description: "Discover how DKNet.EfCore.DtoGenerator uses Roslyn Source Generators to automatically create immutable DTOs from EF Core entities, eliminating boilerplate code while preserving validation attributes and type safety."
---

Writing Data Transfer Objects (DTOs) is one of those repetitive tasks that every developer encounters when building applications with Entity Framework Core. While DTOs are essential for separating your domain models from your API contracts, manually creating and maintaining them can be tedious, error-prone, and time-consuming. What if there was a way to automate this process while maintaining type safety and validation consistency?

**DKNet.EfCore.DtoGenerator** is a lightweight Roslyn Incremental Source Generator that automatically creates immutable DTO types from your EF Core entities at compile time. It eliminates the need to manually write repetitive DTO classes while preserving validation attributes, ensuring type safety, and reducing boilerplate code significantly.

## Table of Contents

1. [The Problem with Manual DTOs](#the-problem-with-manual-dtos)
2. [What is DKNet.EfCore.DtoGenerator?](#what-is-dknetefcoredtogenerator)
3. [Getting Started](#getting-started)
4. [Basic Usage](#basic-usage)
5. [Validation Attributes Support](#validation-attributes-support)
6. [Advanced Features](#advanced-features)
7. [Integration with Mapster](#integration-with-mapster)
8. [Viewing Generated Code](#viewing-generated-code)
9. [Best Practices](#best-practices)
10. [Conclusion](#conclusion)

## The Problem with Manual DTOs

Let's consider a typical scenario. You have an EF Core entity with validation attributes:

```csharp
public class Product
{
    public Guid Id { get; set; }

    [Required]
    [StringLength(100, MinimumLength = 3)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Sku { get; set; } = string.Empty;

    [Range(0.01, 999999.99)]
    public decimal Price { get; set; }

    [EmailAddress]
    public string ContactEmail { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
```

Traditionally, you would need to manually create a corresponding DTO:

```csharp
public record ProductDto
{
    public Guid Id { get; init; }

    [Required]
    [StringLength(100, MinimumLength = 3)]
    public required string Name { get; init; }

    [MaxLength(50)]
    public required string Sku { get; init; }

    [Range(0.01, 999999.99)]
    public decimal Price { get; init; }

    [EmailAddress]
    public required string ContactEmail { get; init; }

    public DateTime CreatedAt { get; init; }
    public DateTime? UpdatedAt { get; init; }
}
```

This approach has several issues:

- **Repetitive Code**: You're duplicating property definitions
- **Maintenance Burden**: When the entity changes, you must manually update the DTO
- **Validation Inconsistency**: Easy to forget copying validation attributes
- **Human Error**: Typos and mismatched types are common
- **Time Consuming**: Scales poorly with multiple entities

## What is DKNet.EfCore.DtoGenerator?

DKNet.EfCore.DtoGenerator is a **Roslyn Incremental Source Generator** that solves these problems by automatically generating DTOs at compile time. Here's what makes it special:

- **Zero Runtime Overhead**: Code generation happens at compile time
- **Type Safety**: Generated DTOs are fully typed and checked by the compiler
- **Validation Preservation**: Automatically copies all validation attributes from entities
- **Immutable by Default**: Uses `init` properties for immutability
- **Mapster Integration**: Provides efficient mapping when Mapster is available
- **Customizable**: Support for property inclusion, exclusion, and custom extensions
- **Incremental**: Only regenerates when needed, keeping builds fast

## Getting Started

### Prerequisites

Before using DKNet.EfCore.DtoGenerator, ensure you have:

- **.NET 9.0 SDK** or later
- A project using **Entity Framework Core**

### Installation

Add the NuGet package to your project:

```bash
dotnet add package DKNet.EfCore.DtoGenerator
```

Or add it directly to your `.csproj` file:

```xml
<ItemGroup>
  <PackageReference Include="DKNet.EfCore.DtoGenerator" Version="1.0.0"
                    PrivateAssets="all"
                    OutputItemType="Analyzer" />
</ItemGroup>
```

**Optional but Recommended**: Add Mapster for enhanced mapping capabilities:

```bash
dotnet add package Mapster
```

### Project Configuration

To enable the source generator and view generated files, add the following properties to your `.csproj` file:

```xml
<PropertyGroup>
  <EmitCompilerGeneratedFiles>true</EmitCompilerGeneratedFiles>
  <CompilerGeneratedFilesOutputPath>$(BaseIntermediateOutputPath)Generated</CompilerGeneratedFilesOutputPath>
  <!-- Force analyzer to reload on every build -->
  <EnforceExtendedAnalyzerRules>true</EnforceExtendedAnalyzerRules>
</PropertyGroup>
```

These settings ensure:

- Generated files are emitted to the `obj/Generated` directory
- The analyzer runs correctly on every build
- You can inspect the generated code when needed

## Basic Usage

Using DKNet.EfCore.DtoGenerator is incredibly simple. Here's a complete example:

### Step 1: Define Your Entity

```csharp
public class MerchantBalance
{
    public Guid Id { get; set; }

    [MaxLength(100)]
    public string MerchantId { get; set; } = string.Empty;

    [Range(0, double.MaxValue)]
    public decimal Balance { get; set; }

    public DateTime LastUpdated { get; set; }
}
```

### Step 2: Declare the DTO

Create an empty partial record with the `[GenerateDto]` attribute:

```csharp
using DKNet.EfCore.DtoGenerator;

[GenerateDto(typeof(MerchantBalance))]
public partial record BalanceDto;
```

That's it! The generator will automatically create `BalanceDto.g.cs` with:

- All properties from `MerchantBalance` with `init` accessors
- Validation attributes copied from the entity
- Helper methods for mapping between entity and DTO

### Step 3: Use the Generated DTO

```csharp
// Convert entity to DTO
var entity = await dbContext.MerchantBalances.FindAsync(id);
var dto = mapper.Map<BalanceDto>(entity);

// Convert DTO back to entity
var newEntity = mapper.Map<MerchantBalance>(dto);

// Convert multiple entities
var dtos = mapper.Map<IEnumerable<BalanceDto>>(dbContext.MerchantBalances);
```

## Validation Attributes Support

One of the most powerful features of DKNet.EfCore.DtoGenerator is its automatic copying of validation attributes. This ensures that validation rules are consistently applied across your application layers without manual duplication.

### Supported Attributes

All `System.ComponentModel.DataAnnotations` attributes are supported, including:

- `[Required]` - Marks a property as required
- `[StringLength]` - Limits string length with optional minimum
- `[MaxLength]` - Sets maximum length for strings or collections
- `[MinLength]` - Sets minimum length for strings or collections
- `[Range]` - Validates numeric ranges
- `[EmailAddress]` - Validates email format
- `[Phone]` - Validates phone number format
- `[Url]` - Validates URL format
- `[RegularExpression]` - Validates against regex pattern
- `[Compare]` - Compares two properties
- `[CreditCard]` - Validates credit card format
- And all other custom validation attributes

### Example with Validation

**Entity with Validation:**

```csharp
public class User
{
    public Guid Id { get; set; }

    [Required(ErrorMessage = "Username is required")]
    [StringLength(50, MinimumLength = 3,
                  ErrorMessage = "Username must be between 3 and 50 characters")]
    public string Username { get; set; } = string.Empty;

    [Required]
    [EmailAddress(ErrorMessage = "Invalid email format")]
    public string Email { get; set; } = string.Empty;

    [Phone]
    public string? PhoneNumber { get; set; }

    [Range(18, 120, ErrorMessage = "Age must be between 18 and 120")]
    public int Age { get; set; }

    [Url]
    public string? Website { get; set; }
}
```

**DTO Declaration:**

```csharp
[GenerateDto(typeof(User))]
public partial record UserDto;
```

**Generated DTO (simplified view):**

```csharp
public partial record UserDto
{
    public Guid Id { get; init; }

    [Required(ErrorMessage = "Username is required")]
    [StringLength(50, MinimumLength = 3,
                  ErrorMessage = "Username must be between 3 and 50 characters")]
    public required string Username { get; init; }

    [Required]
    [EmailAddress(ErrorMessage = "Invalid email format")]
    public required string Email { get; init; }

    [Phone]
    public string? PhoneNumber { get; init; }

    [Range(18, 120, ErrorMessage = "Age must be between 18 and 120")]
    public int Age { get; init; }

    [Url]
    public string? Website { get; init; }
}
```

## Advanced Features

### Excluding Properties

You can exclude specific properties from the generated DTO:

```csharp
[GenerateDto(typeof(MerchantBalance),
             Exclude = new[] { nameof(MerchantBalance.LastUpdated), "Id" })]
public partial record BalanceSummaryDto;
```

Generated DTO will exclude `LastUpdated` and `Id` from Entity's properties.

### Including Only Specific Properties

Alternatively, specify only the properties you want:

```csharp
[GenerateDto(typeof(MerchantBalance),
             Include = new[] { nameof(MerchantBalance.MerchantId), "Balance" })]
public partial record BalanceOnlyDto;
```

> **Note:** `Include` and `Exclude` are mutually exclusive. If both are specified, `Include` takes precedence, and a warning will be generated.

### Custom Properties

You can extend generated DTOs with custom properties or methods:

```csharp
[GenerateDto(typeof(MerchantBalance))]
public partial record BalanceDto
{
    // Custom computed property
    public string DisplayBalance => $"${Balance:N2}";

    // Custom method
    public bool IsPositive() => Balance > 0;

    // Override generated property (if needed)
    public new decimal Balance { get; init; }
}
```

### Multiple DTOs from Same Entity

You can generate multiple DTOs from the same entity for different use cases:

```csharp
// Full DTO with all properties
[GenerateDto(typeof(Product))]
public partial record ProductDto;

// Summary DTO for list views
[GenerateDto(typeof(Product),
             Include = new[] { "Id", "Name", "Price" })]
public partial record ProductSummaryDto;

// Create DTO without Id
[GenerateDto(typeof(Product),
             Exclude = new[] { "Id", "CreatedAt", "UpdatedAt" })]
public partial record CreateProductDto;
```

## Integration with Mapster

When Mapster is present in your project, DKNet.EfCore.DtoGenerator automatically generates code that uses `TypeAdapter.Adapt` for efficient mapping.

### Generated Code with Mapster

```csharp
public partial record BalanceDto
{
    // Properties...

    public static BalanceDto FromEntity(MerchantBalance entity)
        => Mapster.TypeAdapter.Adapt<BalanceDto>(entity);

    public MerchantBalance ToEntity()
        => Mapster.TypeAdapter.Adapt<MerchantBalance>(this);

    public static IEnumerable<BalanceDto> FromEntities(
        IEnumerable<MerchantBalance> entities)
        => Mapster.TypeAdapter.Adapt<IEnumerable<BalanceDto>>(entities);
}
```

### Mapster Configuration

You can customize mapping behavior with Mapster configurations:

```csharp
// Global configuration during startup
TypeAdapterConfig.GlobalSettings.Scan(Assembly.GetExecutingAssembly());

// Type-specific configuration
TypeAdapterConfig<MerchantBalance, BalanceDto>
    .NewConfig()
    .Map(dest => dest.DisplayBalance, src => $"${src.Balance:N2}")
    .Ignore(dest => dest.SomeCustomProperty);
```

### EF Core Query Projections

For optimal performance with database queries, use Mapster's projection:

```csharp
using Mapster;

var balances = await dbContext.MerchantBalances
    .Where(b => b.Balance > 0)
    .ProjectToType<BalanceDto>()
    .ToListAsync();
```

This translates the projection to SQL, avoiding loading unnecessary entity data.

## Viewing Generated Code

Generated files are located in the `obj/Generated` directory by default. To make them more accessible, you can add an MSBuild target to copy them to your project:

```xml
<Target Name="CopyGeneratedDtos" AfterTargets="CoreCompile">
    <ItemGroup>
        <GeneratedDtoFiles Include="$(CompilerGeneratedFilesOutputPath)\**\*Dto.g.cs"/>
    </ItemGroup>
    <MakeDir Directories="$(ProjectDir)GeneratedDtos"
             Condition="'@(GeneratedDtoFiles)' != ''"/>
    <Copy SourceFiles="@(GeneratedDtoFiles)"
          DestinationFiles="$(ProjectDir)GeneratedDtos\%(Filename)%(Extension)"
          SkipUnchangedFiles="false"
          OverwriteReadOnlyFiles="true"
          Condition="'@(GeneratedDtoFiles)' != ''"/>
</Target>

<!-- Make generated DTOs visible but excluded from compilation -->
<ItemGroup>
    <Compile Remove="GeneratedDtos\**\*.cs"/>
    <None Include="GeneratedDtos\**\*.cs"/>
</ItemGroup>
```

This target:

- Copies generated files to a `GeneratedDtos` folder
- Keeps them visible in Solution Explorer for inspection
- Excludes them from compilation to avoid duplicates

## Best Practices

### 1. Use Records for DTOs

Records are ideal for DTOs because they provide:

- Value-based equality
- Immutability with `init` properties
- Concise syntax with positional parameters
- Built-in `ToString()` implementation

```csharp
[GenerateDto(typeof(Product))]
public partial record ProductDto;  // ✅ Recommended
```

### 2. Keep DTOs Simple

DTOs should be simple data containers. Avoid adding business logic:

```csharp
[GenerateDto(typeof(Order))]
public partial record OrderDto
{
    // ✅ Good: Computed display property
    public string DisplayTotal => $"${Total:N2}";

    // ❌ Avoid: Business logic
    public void ProcessPayment() { /* ... */ }
}
```

### 3. Use Meaningful DTO Names

Choose descriptive names that indicate the DTO's purpose:

```csharp
// ✅ Good
[GenerateDto(typeof(Product))]
public partial record ProductDto;

[GenerateDto(typeof(Product), Include = new[] { "Id", "Name" })]
public partial record ProductSummaryDto;

[GenerateDto(typeof(Product), Exclude = new[] { "Id" })]
public partial record CreateProductDto;

// ❌ Avoid
[GenerateDto(typeof(Product))]
public partial record ProductDto1;
```

### 4. Leverage Include/Exclude for Different Scenarios

Create specialized DTOs for different use cases:

```csharp
// List view - minimal data
[GenerateDto(typeof(User),
             Include = new[] { "Id", "Username", "Email" })]
public partial record UserListDto;

// Detail view - full data
[GenerateDto(typeof(User))]
public partial record UserDetailDto;

// Create/Update - no Id or audit fields
[GenerateDto(typeof(User),
             Exclude = new[] { "Id", "CreatedAt", "UpdatedAt" })]
public partial record UserInputDto;
```

### 5. Combine with FluentValidation

While validation attributes are automatically copied, you can layer additional validation:

```csharp
public class CreateProductDtoValidator : AbstractValidator<CreateProductDto>
{
    public CreateProductDtoValidator()
    {
        // Additional business rules
        RuleFor(x => x.Price)
            .GreaterThan(0)
            .When(x => x.IsActive);

        RuleFor(x => x.Sku)
            .MustAsync(async (sku, ct) => await IsUniqueSkuAsync(sku, ct))
            .WithMessage("SKU must be unique");
    }
}
```

### 6. Version Your DTOs

When making breaking changes, version your DTOs:

```csharp
// V1
[GenerateDto(typeof(Product))]
public partial record ProductDtoV1;

// V2 with additional fields
[GenerateDto(typeof(Product))]
public partial record ProductDtoV2;
```

### 7. Use Mapster for Complex Mappings

For complex scenarios, leverage Mapster's configuration:

```csharp
TypeAdapterConfig<Product, ProductDto>
    .NewConfig()
    .Map(dest => dest.CategoryName, src => src.Category.Name)
    .Map(dest => dest.DiscountedPrice,
         src => src.Price * (1 - src.DiscountPercentage / 100));
```

## Conclusion

DKNet.EfCore.DtoGenerator revolutionizes how we work with DTOs in .NET applications by:

- **Eliminating Boilerplate**: No more manual DTO creation and maintenance
- **Ensuring Consistency**: Validation attributes are automatically synchronized
- **Improving Type Safety**: Compile-time generation ensures correctness
- **Boosting Productivity**: Focus on business logic instead of plumbing code
- **Maintaining Performance**: Zero runtime overhead with compile-time generation

The source generator seamlessly integrates into your development workflow, automatically updating DTOs as your entities evolve. Combined with Mapster, it provides a complete solution for entity-DTO mapping that's both powerful and easy to use.

Whether you're building a small API or a large enterprise application, DKNet.EfCore.DtoGenerator can significantly reduce development time while improving code quality and maintainability.

## References

- [DKNet.EfCore.DtoGenerator Source Code](https://github.com/baoduy/DKNet/tree/dev/src/EfCore/DKNet.EfCore.DtoGenerator)
- [NuGet Package](https://www.nuget.org/packages/DKNet.EfCore.DtoGenerator)
- [Mapster Documentation](https://github.com/MapsterMapper/Mapster)
- [Roslyn Source Generators](https://learn.microsoft.com/en-us/dotnet/csharp/roslyn-sdk/source-generators-overview)
- [EF Core Documentation](https://learn.microsoft.com/en-us/ef/core/)

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven** | [GitHub](https://github.com/baoduy)
