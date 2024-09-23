---
author: Steven Hoang
pubDatetime: 2024-08-24T12:00:00Z
title: "[Dotnet] Aspire.NET, A First Try with EfCore and Testing."
postSlug: az-pulumi-series-aks-private-env-pulumi
featured: true
draft: false
tags:
  - aks
  - private
  - pulumi
description: ""
---

As a developer, the most challenge I saw when joining a new project that I need to setup the development on my local PC as each project require different tech stack. 

Recently, once Docker becomes famust the docker-compose had been developed for each project and share acros the team. That can help developer to form up local development environment quickly using Docker.

With Aspire.NET it is an alternative for us to not only able to replicate entire development environment locally but also natively support Integration Test development that allows us to develop "redy-to-run" local envronment for developer and running integration test on AzureDevOps.

Aspire.NET is a framework that allows developers to host their entire application environment locally. By integrating Docker, you can containerize dependencies, making them easy to manage and ensuring consistency across different environments.

---

### Setting Up the Local Environment

#### Sample API

Let's take a look on my simple API here as example and this API is using:

- MediatR for command and response pattern for API level.
- EntityFrameworkCore (EfCore) for ORM
- PostgresQL for Database level.

![Api](/assets/dotnet-04-aspire-local-env-tests/api.png)

#### Aspire Templates

Aspire is providing a few project templates as below:

- App Host: the main template to create Aspire Hosting.
- Service Defaults: the project template that help to config `OpenTelemetry`, `DefaultHealthChecks` and `RequestTimeouts`. This is optional but recommened for the applications hosting on Aspire.
- Test Project (MSTest): the project template For unit testing using the MSTest framework.
- Test Project (NUnit): the project template For unit testing using the NUnit framework.
- Test Project (xUnit): the project template For unit testing using the xUnit framework.

![AspireTemplates](/assets/dotnet-04-aspire-local-env-tests/AspireTemplates.png)

#### Hosting with Aspire

- Add new Aspire `App Host` project
- Install PostgreSQL package for Aspire:

```bash
dotnet add package Aspire.Hosting.PostgreSQL
```

- Hosting the API above toghether with Postgress Database with just a new line of code:

```csharp
var builder = DistributedApplication.CreateBuilder(args);

//Database
var postgres = builder.AddPostgres("postgres").PublishAsConnectionString();
var db = postgres.AddDatabase("Db");

//Internal API
builder.AddProject<Projects.Api>("api")
    .WithReference(db);

builder.Build().Run();
```

- Db migration is one of the most important thing to ensure the application running propertly in all environments, and to automate that you can refer the solution [here](https://learn.microsoft.com/en-us/dotnet/aspire/database/ef-core-migrations) that compatible with Aspire.

- Run the Aspire.Host project and here the Dasshboard with all components running there.
![Dashboard](/assets/dotnet-04-aspire-local-env-tests/AspireDashboard.png)

- Aspire also providing an other `ServiceDefault` project template that help to config `OpenTelemetry`, `DefaultHealthChecks` and `RequestTimeouts`. This is optional but recommened for the applications hosting on Aspire.

---

## Aspire.NET for Testing

As you know that writing the integration tests and running them on CI/CD pipelines is challegeing and take amount of effor to make it work from praparing the data until fully test the business cases. 

With Aspire, I hope this will simplify this process.

### Writing Test Cases

Here is sample test cases for the API abows with `Aspire xUnit` template.
Just a note that to let Aspire xUnit running smoothly instead of install the same set of nuget packages dependence to `Aspire.Tests` project. Just simply reference to the `Aspire.Host` project.

Here is reference graph
![ProjectDependency](/assets/dotnet-04-aspire-local-env-tests/ProjectDependency.png)

#### ApiFixture Class

Let's writing our APi Fixture class first.

```csharp
public sealed class ApiFixture : WebApplicationFactory<Api.Program>, IAsyncLifetime
{
    private readonly IHost _app;
    private readonly IResourceBuilder<PostgresServerResource> _postgres;
    private string? _postgresConnectionString;

    /**
     * Constructor for ApiFixture.
     * Initializes the DistributedApplicationOptions and sets up the PostgreSQL server resource.
     */
    public ApiFixture()
    {
        var options = new DistributedApplicationOptions
        {
            AssemblyName = typeof(ApiFixture).Assembly.FullName,
            DisableDashboard = true
        };
        var builder = DistributedApplication.CreateBuilder(options);

        _postgres = builder.AddPostgres("postgres").PublishAsConnectionString();
        _app = builder.Build();
    }

    /**
     * Creates and configures the host for the application.
     * Adds the PostgreSQL connection string to the host configuration.
     * Ensures the database is created before returning the host.
     *
     * @param builder The IHostBuilder instance.
     * @return The configured IHost instance.
     */
    protected override IHost CreateHost(IHostBuilder builder)
    {
        builder.ConfigureHostConfiguration(config =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "ConnectionStrings:Db", _postgresConnectionString },
            }!);
        });

        var host = base.CreateHost(builder);
        host.EnsureDbCreated().GetAwaiter().GetResult();
        return host;
    }

    /**
     * Disposes the resources used by the fixture asynchronously.
     * Stops the application host and disposes of it.
     */
    public new async Task DisposeAsync()
    {
        await base.DisposeAsync();
        await _app.StopAsync();
        if (_app is IAsyncDisposable asyncDisposable)
        {
            await asyncDisposable.DisposeAsync().ConfigureAwait(false);
        }
        else
        {
            _app.Dispose();
        }
    }

    /**
     * Initializes the fixture asynchronously.
     * Starts the application host and waits for the PostgreSQL resource to be in the running state.
     * Retrieves the PostgreSQL connection string.
     */
    public async Task InitializeAsync()
    {
        var resourceNotificationService = _app.Services.GetRequiredService<ResourceNotificationService>();
        await _app.StartAsync();

        await resourceNotificationService.WaitForResourceAsync(_postgres.Resource.Name, KnownResourceStates.Running);
        _postgresConnectionString = await _postgres.Resource.GetConnectionStringAsync();
    }
}
```

ApiFixture is a test fixture class that sets up the necessary environment for integration tests.
 It extends WebApplicationFactory<Api.Program> and implements IAsyncLifetime to manage the lifecycle of the test environment.

  This class is responsible for:

- Setting up a PostgreSQL server resource.
- Configuring the host with the necessary connection strings.
- Ensuring the database is created before tests run.
- Starting and stopping the application host.
- Cleaning up resources after tests are completed.

#### Test Cases Class

And here is our tes cases.

```csharp
public class ProductEndpointsTests(ApiFixture fixture, ITestOutputHelper output) : IClassFixture<ApiFixture>
{
    private readonly HttpClient _client = fixture.CreateClient();

    /**
     * Tests the creation of a product.
     * Ensures that the product is created successfully and returns a valid product ID.
     */
    [Fact]
    public async Task CreateProduct_ReturnsCreatedProduct()
    {
        // Arrange
        var command = new CreateProduct.Command { Name = "Test Product", Price = 10.99m };
        // Act
        var response = await _client.PostAsJsonAsync("/products", command);

        // Assert
        response.EnsureSuccessStatusCode();
        var productId = await response.Content.ReadFromJsonAsync<int>();
        Assert.True(productId > 0);
    }

    /**
     * Tests the retrieval of a product.
     * Ensures that the product is retrieved successfully and matches the expected values.
     */
    [Fact]
    public async Task GetProduct_ReturnsProduct()
    {
        // Arrange
        var command = new CreateProduct.Command { Name = "Test Product", Price = 10.99m };
        var createResponse = await _client.PostAsJsonAsync("/products", command);
        var productId = await createResponse.Content.ReadFromJsonAsync<int>();

        // Act
        var response = await _client.GetAsync($"/products/{productId}");

        // Assert
        response.EnsureSuccessStatusCode();
        var product = await response.Content.ReadFromJsonAsync<Product>();
        Assert.NotNull(product);
        Assert.Equal("Test Product", product.Name);
        Assert.Equal(10.99m, product.Price);
    }

    /**
     * Tests the update of a product.
     * Ensures that the product is updated successfully and returns a NoContent status.
     */
    [Fact]
    public async Task UpdateProduct_ReturnsNoContent()
    {
        // Arrange
        var command = new CreateProduct.Command { Name = "Test Product", Price = 10.99m };
        var createResponse = await _client.PostAsJsonAsync("/products", command);
        var productId = await createResponse.Content.ReadFromJsonAsync<int>();

        var updateCommand = new UpdateProduct.Command { Id = productId, Name = "Updated Product", Price = 20.99m };

        // Act
        var response = await _client.PutAsJsonAsync($"/products/{productId}", updateCommand);

        // Assert
        response.EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    /**
     * Tests the deletion of a product.
     * Ensures that the product is deleted successfully and returns a NoContent status.
     */
    [Fact]
    public async Task DeleteProduct_ReturnsNoContent()
    {
        // Arrange
        var command = new CreateProduct.Command { Name = "Test Product", Price = 10.99m };
        var createResponse = await _client.PostAsJsonAsync("/products", command);
        var productId = await createResponse.Content.ReadFromJsonAsync<int>();

        // Act
        var response = await _client.DeleteAsync($"/products/{productId}");

        // Assert
        response.EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }
}
```

The ProductEndpointsTests class contains integration tests for the product endpoints.
It uses the ApiFixture to set up the test environment and HttpClient to make requests to the API.

This class is responsible for:

- Testing the creation of a product.
- Testing the retrieval of a product.
- Testing the update of a product.
- Testing the deletion of a product.
 
#### The Testing result

- Test cases results
![TestCases](/assets/dotnet-04-aspire-local-env-tests/TestCasesResults.png)

- Coverage Results
![TestCases](/assets/dotnet-04-aspire-local-env-tests/TestCoverageResults.png)

## Testing on Azure DevOps

Here is the pipeline yaml file that running Aspire Tesing on AzureDevOps. This Azure Pipeline configuration file defines the CI/CD pipeline for building and testing the project with code coverage collecting.

```yaml
trigger:
  - main

resources:
  - repo: self

variables:
  BUILDCONFIGURATION: Release
  RestoreBuildProjects: "**/*.csproj"
  TestProjects: "**/*[Tt]ests/*.csproj"

  # Agent VM image name
  vmImageName: "ubuntu-latest"

stages:
  - stage: Build
    displayName: Build and push stage
    jobs:
      - job: Build
        displayName: Build
        pool:
          vmImage: $(vmImageName)
        steps:
          # Install the necessary .NET workload
          - task: Bash@3
            inputs:
              targetType: "inline"
              script: "dotnet workload install aspire"

          # Build the project
          - task: DotNetCoreCLI@2
            displayName: Build
            inputs:
              projects: $(RestoreBuildProjects)
              arguments: -c $(BuildConfiguration)

          # Run tests and collect code coverage
          - task: DotNetCoreCLI@2
            displayName: Test
            inputs:
              command: "test"
              projects: "$(TestProjects)"
              arguments: '--configuration $(BuildConfiguration) --collect "Code Coverage"'
```

After run the pipeline We have the result as below:

- Test cases
![devops-test-results](/assets/dotnet-04-aspire-local-env-tests/az-devops-no-filter-test-results.png)

- Code Coverage
![devops-test-coverage](/assets/dotnet-04-aspire-local-env-tests/az-devops-no-filter-test-coverage.png)

With the coverage above we only got 23.89% of the overal coverage. However, the API component itself got 88.14% coverage.

So to make the report better We can enhance the piple-line that only includes the component belong to the projects by using the configuration below.

I create a file named `coverage.runsettings` with the content as below

```xml
<?xml version="1.0" encoding="utf-8"?>
<RunSettings>
  <DataCollectionRunSettings>
    <DataCollectors>
      <DataCollector friendlyName="XPlat Code Coverage">
        <Configuration>
          <Include>
            [Api*]*
          </Include>
          <Exclude>
          </Exclude>
        </Configuration>
      </DataCollector>
    </DataCollectors>
  </DataCollectionRunSettings>
</RunSettings>
```

Take a look at the includes section this only include the library that belong to the project. In this case is `[Api*]*`

And here is updated pipline with the configuration above: I only show th updated steps here since the others are remining the same:

```yaml
...

          # Run tests and collect code coverage
          - task: DotNetCoreCLI@2
            displayName: Test with coverage filtering
            inputs:
              command: "test"
              projects: "$(TestProjects)"
              arguments: '--configuration $(BuildConfiguration) --settings coverage.runsettings --collect "XPlat Code Coverage"'

          # Publish code coverage results
          - task: PublishCodeCoverageResults@1
            inputs:
              codeCoverageTool: "cobertura"
              summaryFileLocation: "$(Agent.TempDirectory)/**/coverage.cobertura.xml"
```

Here is the coverage results, this one using `XPlat` format which shows details of the covergate at the class leve.
![devops-test-coverage-with-filter](/assets/dotnet-04-aspire-local-env-tests/az-devops-with-filter-test-coverage.png)

## Conclusion

Integration testing with Entity Framework doesn't have to be a daunting task. By leveraging Aspire.NET and Docker, you can create a consistent and isolated environment for your tests. Customizing your Azure DevOps pipeline further streamlines the process, allowing you to focus on writing meaningful tests rather than wrestling with infrastructure.

## References

- [Sample Aspire.NET Unit Tests](https://github.com/baoduy/sample-aspire-dotnet-unittests)
