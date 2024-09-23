---
author: Steven Hoang
pubDatetime: 2024-08-22T12:00:00Z
title: "[Dotnet] Simplifying Local Development Environment and Testing with Aspire.NET."
postSlug: dotnet-04-aspire-local-env-and-testing
featured: true
draft: false
tags:
  - dotnet
  - aspire
  - local-env
description: "Setting up a new project can be challenging, especially with various technologies involved. This guide explores how Aspire.NET simplify development by streamlining local environment setup, testing, and continuous integration. By the end, you’ll know how to enhance your workflow with these tools."
---

Starting a new project can be both exciting and challenging, especially when it comes to setting up the development environment. Different projects often require various technologies and configurations, which can be time-consuming and sometimes confusing.

In this guide, we'll explore how Aspire.NET and Docker can streamline your development workflow. You'll learn how to set up a local environment, write integration tests, and run them in a continuous integration pipeline. By the end, you'll have a clear understanding of how to simplify your development and testing processes.

## Why .NET Aspire?

- **.NET Aspire** is designed to improve the experience of building .NET cloud-native apps. It provides a consistent, opinionated set of tools and patterns that help you build and run distributed apps. .NET Aspire is designed to help you with:

- **Orchestration**: .NET Aspire provides features for running and connecting multi-project applications and their dependencies for local development environments.
Integrations: .NET Aspire integrations are NuGet packages for commonly used services, such as Redis or Postgres, with standardized interfaces ensuring they connect consistently and seamlessly with your app.

- **Tooling**: .NET Aspire comes with project templates and tooling experiences for Visual Studio, Visual Studio Code, and the dotnet CLI to help you create and interact with .NET Aspire projects.

---

## Table of Contents

---

## Setting Up the Local Environment

Let's start by creating a simple API project and hosting it with Aspire.NET.

### Prerequisites

- **.NET 8 SDK** or later
- **Docker Desktop** installed and running
- **Aspire workload** installed: Install the Aspire workload using the following command:

  ```bash
  dotnet workload install aspire
  ```

### Creating an API Project

The API utilizes the following technologies:

- **MediatR**: A library used to implement the command and response pattern at the API level. It helps decouple the request handling logic from the controllers, making the code more modular and easier to maintain.
- **Entity Framework Core (EF Core)**: An Object-Relational Mapper (ORM) used to manage database access.
- **PostgreSQL**: Used as the database to store and manage the application's data.

Below is the Swagger UI of the API:

![Api](/assets/dotnet-04-aspire-local-env-tests/api.png)

#### Aspire Templates

Aspire provides several project templates to help you get started quickly with different aspects of your application development and testing:

- **App Host**: The primary template for creating an Aspire Hosting project. It sets up the necessary infrastructure to host your application locally.
- **Service Defaults**: Configures essential services for your application, such as `OpenTelemetry` for distributed tracing, `DefaultHealthChecks` for monitoring the health of your services, and `RequestTimeouts` to manage request durations. While optional, it is highly recommended for applications hosted on Aspire to ensure robust monitoring and orchestration management.
- **Test Project (MSTest)**: Sets up a project for unit testing using the MSTest framework.
- **Test Project (NUnit)**: Sets up a project for unit testing using the NUnit framework.
- **Test Project (xUnit)**: Sets up a project for unit testing using the xUnit framework.

![AspireTemplates](/assets/dotnet-04-aspire-local-env-tests/AspireTemplates.png)

#### Hosting with Aspire

To host your API and its dependencies with Aspire, follow these steps:

1. **Add PostgreSQL Support**:

   Install the Aspire PostgreSQL hosting package to add PostgreSQL support to your project.

   ```bash
   dotnet add package Aspire.Hosting.PostgreSQL
   ```

> Notes: Refer [here Aspire github](https://github.com/dotnet/aspire) for full list of hosting components that supporting by Aspire.

2. **Configure Aspire Host**:

   Open `Program.cs` in the `Aspire.Host` project and configure the host to include your API project and the PostgreSQL database.

   ```csharp
   var builder = DistributedApplication.CreateBuilder(args);

   // Database
   var postgres = builder.AddPostgres("postgres").PublishAsConnectionString();
   var db = postgres.AddDatabase("Db");

   // Internal API
   builder.AddProject<Projects.Api>("api")
       .WithReference(db);

   builder.Build().Run();
   ```

   **Explanation**:

   - **AddPostgres("postgres")**: Adds a PostgreSQL service.
   - **PublishAsConnectionString()**: Makes the connection string available to other services.
   - **AddDatabase("Db")**: Sets up a database named "Db".
   - **AddProject**: Includes the API project in the Aspire host configuration.
   - **WithReference(db)**: Links the API project to the database.

3. **EF Core Database Migration**:

   Automate database migrations to ensure consistency across environments and compatibility with Aspire. Refer to the [EF Core Migrations guide](https://learn.microsoft.com/en-us/dotnet/aspire/database/ef-core-migrations) for details.

4. **Run the Aspire Host**:

   Execute the `Aspire.Host` project. The dashboard will display all running components.
   ![Dashboard](/assets/dotnet-04-aspire-local-env-tests/AspireDashboard.png)

---

## Aspire.NET for Testing

Integration tests ensure that different parts of your application work together correctly. However, writing and running them on CI/CD pipelines can be challenging and time-consuming. Aspire.NET simplifies this process by handling much of the setup for you.

### Writing Test Cases

Below are sample test cases for the API using the `Aspire xUnit` template. To run Aspire xUnit tests smoothly, you should reference the `Aspire.Host` project instead of installing the same set of NuGet package dependencies in the `Aspire.Tests` project.

Here is a reference graph:

![ProjectDependency](/assets/dotnet-04-aspire-local-env-tests/ProjectDependency.png)

#### ApiFixture Class

The `ApiFixture` class sets up the necessary environment for integration tests. It extends `WebApplicationFactory<Api.Program>` and implements `IAsyncLifetime` to manage the lifecycle of the test environment.

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

This class is responsible for:

- Setting up a PostgreSQL server resource.
- Configuring the host with the necessary connection strings.
- Ensuring the database is created before tests run.
- Starting and stopping the application host.
- Cleaning up resources after tests are completed.

#### Test Cases Class

The `ProductEndpointsTests` class contains integration tests for the product endpoints of your API. It uses the `ApiFixture` to set up the test environment and `HttpClient` to make requests to the API.

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

**Explanation**:

The `ProductEndpointsTests` class is responsible for testing the CRUD (Create, Read, Update, Delete) operations of the product endpoints in your API. It ensures that:

- **Creating a product** works correctly and returns a valid product ID.
- **Retrieving a product** returns the expected product details.
- **Updating a product** successfully applies the changes and returns the appropriate status.
- **Deleting a product** removes it from the database and returns the correct status code.

Each test follows a similar structure:

1. **Arrange**: Set up the necessary data and state for the test.
2. **Act**: Perform the action being tested (e.g., sending an HTTP request).
3. **Assert**: Verify that the action produced the expected results.

By using these tests, you can ensure that your API's product endpoints work correctly and handle various operations as expected.
 
### The Testing Results

After running the tests, you can analyze the results to ensure your API is functioning correctly and to measure the code coverage.

- **Test Cases Results**:

  The test cases results show the outcome of each test case executed.

  ![TestCasesResults](/assets/dotnet-04-aspire-local-env-tests/TestCasesResults.png)

- **Coverage Results**:

  Code coverage results provide insights into how much of the codebase is being tested by the test cases.

  ![TestCoverageResults](/assets/dotnet-04-aspire-local-env-tests/TestCoverageResults.png)

---

## Testing on Azure DevOps

### Configuring the Pipeline

To automate testing and code coverage collection, you can set up a continuous integration (CI) pipeline using Azure DevOps.

In your Azure DevOps project, create a new pipeline that builds the code, runs tests, and collects code coverage data.

Here is an example of what your `azure-pipelines.yml` file might look like.

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

**Explanation**:

- **UseDotNet@2**: Ensures that the correct .NET SDK is installed on the build agent.
- **Install Aspire Workload**: Installs the Aspire workload needed for your project.
- **Build Projects**: Builds all the projects specified by the `RestoreBuildProjects` variable.
- **Run Tests and Collect Code Coverage**: Executes the tests in the projects specified by the `TestProjects` variable and collects code coverage data.

*Note*: Ensure that the YAML file includes the `UseDotNet@2` task to specify the required .NET SDK version.

### Running the Pipeline

Save the pipeline configuration and run it. Monitor the build process to ensure all steps complete successfully.

After the pipeline completes, you can view the test results and code coverage reports in Azure DevOps.

- **Test Results**:

  Displays which tests passed or failed.

  ![devops-test-results](/assets/dotnet-04-aspire-local-env-tests/az-devops-no-filter-test-results.png)

- **Code Coverage**:

  Provides detailed information about which parts of your code were tested.

  ![devops-test-coverage](/assets/dotnet-04-aspire-local-env-tests/az-devops-no-filter-test-coverage.png)

>**Note**: The initial code coverage might be lower than expected. For example, you might see an overall coverage of 23.89%, even though the API component itself has 88.14% coverage. This discrepancy occurs because the coverage report includes all libraries, including those not part of your project.


### Improving the Pipeline for Better Code Coverage Reports

To generate a more meaningful code coverage report, you can configure it to include only the relevant components of your project.

**Creating the Coverage Filtering File**:

Create a file named `coverage.runsettings` in your project root with the appropriate configuration.

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

**Explanation**:

- The `<Include>` section specifies which assemblies to include in the code coverage report. In this case, `[Api*]*` includes all assemblies starting with "Api".
- The `<Exclude>` section can be used to exclude specific assemblies or classes.

### Updating the Pipeline Configuration

Modify your `azure-pipelines.yml` file to use the `coverage.runsettings` file and publish the code coverage results.

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

**Explanation**:

- **Run Tests with Coverage Filtering**: Executes tests using the `coverage.runsettings` file to filter the code coverage data.
- **Publish Code Coverage Results**: Publishes the code coverage results to Azure DevOps for easy visualization.

### Enhanced Coverage Report

After running the updated pipeline, you should see an improved code coverage report that focuses on the relevant parts of your project. The coverage results will now provide detailed insights at the class level using the XPlat format.

![devops-test-coverage-with-filter](/assets/dotnet-04-aspire-local-env-tests/az-devops-with-filter-test-coverage.png)

---

## Conclusion

Integration testing with Entity Framework doesn't have to be daunting. By leveraging Aspire.NET and Docker, you can create a consistent and isolated environment for your tests. By customizing your Azure DevOps pipeline to further automate the testing process, you can focus on writing meaningful code rather than wrestling with infrastructure.

---

## References

- [Sample Aspire.NET Unit Tests](https://github.com/baoduy/sample-aspire-dotnet-unittests)
- [Aspire.NET Documentation](https://learn.microsoft.com/en-us/dotnet/aspire/get-started/aspire-overview)


## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven**
[GitHub](<[https://github.com/baoduy](https://github.com/baoduy)>)
