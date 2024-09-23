---
author: Steven Hoang
pubDatetime: 2024-08-22T12:00:00Z
title: "[Dotnet] Simplifying Local Development Environment and Testing with .NET Aspire."
postSlug: dotnet-04-aspire-local-env-and-testing
featured: true
draft: false
tags:
  - dotnet
  - aspire
  - local-env
description: "Setting up a new project can be challenging, especially with the involvement of various technologies. This guide explores how .NET Aspire simplifies development by streamlining local environment setup, testing, and continuous integration, while also detailing the end-to-end process with an Azure DevOps CI/CD pipeline."
---

Starting a new project is both exciting and challenging, especially when it comes to configuring the development environment. Many projects require a mix of technologies, which can lead to time-consuming setup and potential errors. .NET Aspire simplifies this by offering a framework that helps developers set up a consistent and efficient environment across various projects.

With .NET Aspire, you can create a `ready-to-run` local environment that integrates seamlessly with Docker, allowing your team to focus on development without worrying about complex setup requirements. .NET Aspire supports smooth integration with containers, making it easier to handle dependencies and ensuring that your local environment mirrors the production setup closely.

In addition to the simplified environment setup, this guide walks you through writing robust integration tests. These tests ensure that your components work well together and catch potential issues early in the development process. You’ll also learn how to incorporate these tests into a continuous integration (CI) pipeline, ensuring that your code is consistently validated and error-free before it reaches production.

## Why .NET Aspire?

- **.NET Aspire** is designed to improve the experience of building .NET cloud-native apps. It provides a consistent, opinionated set of tools and patterns that help to build and run distributed apps. .NET Aspire is designed to help you with:

- **Orchestration**: .NET Aspire provides features for running and connecting multi-project applications and their dependencies for local development environments.
Integrations: .NET Aspire integrations are NuGet packages for commonly used services, such as Redis or Postgres, with standardized interfaces ensuring they connect consistently and seamlessly with your app.

- **Tooling**: .NET Aspire comes with project templates and tooling experiences for Visual Studio, Visual Studio Code, and the dotnet CLI to help you create and interact with .NET Aspire projects.

---

## Table of Contents

1. [Why .NET Aspire?](#why-net-aspire)
2. [Setting Up the Local Environment](#setting-up-the-local-environment)
3. [Hosting with Aspire](#hosting-with-aspire)
4. [Aspire for Testing](#aspire-for-testing)
5. [Running Tests on Azure DevOps](#running-tests-on-azure-devops)
6. [Conclusion](#conclusion)

---

## Setting Up the Local Environment

Let's start by creating a simple API project and hosting it with .NET Aspire.

### Prerequisites

- **.NET 8 SDK** or later
- **Docker Desktop** installed and running
- **Aspire workload** installed: Install the Aspire workload using the following command:

  ```bash
  dotnet workload install aspire
  ```

### Creating an API Project

Let's assume that we already have a simple API that utilizes the following technologies:

- **MediatR**: A library used to implement the command and response pattern at the API level. It helps decouple the request handling logic from the controllers, making the code more modular and easier to maintain.
- **Entity Framework Core (EF Core)**: An Object-Relational Mapper (ORM) used to manage database access.
- **PostgreSQL**: Used as the database to store and manage the application's data.

This API has the following endpoints, as displayed in the Swagger UI:

![Api](/assets/dotnet-04-aspire-local-env-tests/api.png)

### Aspire Templates Explanation

Aspire provides several project templates to help you get started quickly with different aspects of your application development and testing:

- **App Host**: The primary template for creating an Aspire Hosting project. It sets up the necessary infrastructure to host your application locally.
- **Service Defaults**: Configures essential services for your application, such as `OpenTelemetry` for distributed tracing, `DefaultHealthChecks` for monitoring the health of your services, and `RequestTimeouts` to manage request durations. While optional, it is highly recommended for applications hosted on Aspire to ensure robust monitoring and orchestration management.
- **Test Project (MSTest)**: Sets up a project for unit testing using the MSTest framework.
- **Test Project (NUnit)**: Sets up a project for unit testing using the NUnit framework.
- **Test Project (xUnit)**: Sets up a project for unit testing using the xUnit framework.

![AspireTemplates](/assets/dotnet-04-aspire-local-env-tests/AspireTemplates.png)

---

## Hosting with Aspire

To host your API and its dependencies with Aspire, follow these steps:

### Create `Apspire.Host`

First, create a new project named Aspire.Host using the App Host template provided by .NET Aspire. This template sets up the necessary infrastructure to host your application locally.

### Add PostgreSQL Support

Second, Install the Aspire PostgreSQL hosting package to add PostgreSQL support to your project.

```bash
  dotnet add package Aspire.Hosting.PostgreSQL
```

> Notes: Refer [here Aspire github](https://github.com/dotnet/aspire) for full list of hosting components that supporting by Aspire.

### Aspire Host Config as Code

Last but not least, Open `Program.cs` in the `Aspire.Host` project and configure the host to include your API project and the PostgreSQL database.

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

### EF Core Database Migration

An important aspect when using EF Core is automating database migrations to ensure consistency across environments. While we won’t discuss the details here, you can refer to the [EF Core Migrations guide](https://learn.microsoft.com/en-us/dotnet/aspire/database/ef-core-migrations) compatible with .NET Aspire.

### Aspire Host Dashboard

Execute the `Aspire.Host` project. The dashboard will display all running components.
![Dashboard](/assets/dotnet-04-aspire-local-env-tests/AspireDashboard.png)

---

## .NET Aspire for Testing

Integration tests ensure that different parts of your application work together correctly. However, writing and running them on CI/CD pipelines can be challenging and time-consuming. .NET Aspire simplifies this process by handling much of the setup for us.

### Create `Apspire.Test`

Create a new test project named Aspire.Tests using the Test Project (xUnit) template provided by .NET Aspire. This template sets up the necessary scaffolding for integration tests using xUnit.

### Add Reference to `Aspire.Host`

Instead of installing all the same NuGet package dependencies in Aspire.Tests, add a project reference to Aspire.Host. This allows the test project to leverage the configurations and services defined in the host project.

Here is a reference graph:

![ProjectDependency](/assets/dotnet-04-aspire-local-env-tests/ProjectDependency.png)

### ApiFixture Class

Here is the `ApiFixture` class sets up the necessary environment for integration tests. It extends `WebApplicationFactory<Api.Program>` and implements `IAsyncLifetime` to manage the lifecycle of the test environment.

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

**This class is responsible for:**

- Setting up a PostgreSQL server resource.
- Configuring the host with the necessary connection strings.
- Ensuring the database is created before tests run.
- Starting and stopping the application host.
- Cleaning up resources after tests are completed.

### Test Cases Class

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

**Each test follows a similar structure:**

- **Arrange**: Set up the necessary data and state for the test.
- **Act**: Perform the action being tested (e.g., sending an HTTP request).
- **Assert**: Verify that the action produced the expected results.

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

## Run Test-Cases on Azure DevOps

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

1. **Test Results**:

  Displays which tests passed or failed.

  ![devops-test-results](/assets/dotnet-04-aspire-local-env-tests/az-devops-no-filter-test-results.png)

2. **Code Coverage**:

  Provides detailed information about which parts of your code were tested.

  ![devops-test-coverage](/assets/dotnet-04-aspire-local-env-tests/az-devops-no-filter-test-coverage.png)

>**Note**: The initial code coverage might be lower than expected. For example, you might see an overall coverage of 23.89%, even though the API component itself has 88.14% coverage. This discrepancy occurs because the coverage report includes all libraries, including those not part of your project.

### Improving for Better Code Coverage Reports

To generate a more meaningful code coverage report, you can configure it to include only the relevant components of your project.

1. **Creating the Coverage Filtering File**:

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

2. **Updating the Pipeline Configuration**:

    Modify your `azure-pipelines.yml` file to use the `coverage.runsettings` file and publish the code coverage results.

```yaml
# The same with above ...

          # Update the parameter with `runsettings` and code coverage
          - task: DotNetCoreCLI@2
            displayName: Test with coverage filtering
            inputs:
              command: "test"
              projects: "$(TestProjects)"
              arguments: '--configuration $(BuildConfiguration) --settings coverage.runsettings --collect "XPlat Code Coverage"'

          # Publish the new code coverage results format AzureDevOps report.
          - task: PublishCodeCoverageResults@1
            inputs:
              codeCoverageTool: "cobertura"
              summaryFileLocation: "$(Agent.TempDirectory)/**/coverage.cobertura.xml"
```

**Explanation**:

- **Run Tests with Coverage Filtering**: Executes tests using the `coverage.runsettings` file to filter the code coverage data.
- **Publish Code Coverage Results**: Publishes the code coverage results to Azure DevOps for easy visualization.

3. **Enhanced Coverage Report**:

    After running the updated pipeline, you should see an improved code coverage report that focuses on the relevant parts of your project. The coverage results will now provide detailed insights at the class level using the XPlat format.

![devops-test-coverage-with-filter](/assets/dotnet-04-aspire-local-env-tests/az-devops-with-filter-test-coverage.png)

---

## Conclusion

By utilizing .NET Aspire and Docker, you can create a consistent, isolated environment that streamlines not just Entity Framework integration testing but the entire development lifecycle. .NET Aspire offers a flexible framework with powerful orchestration capabilities, making it easier to manage dependencies and mirror production environments locally.

Integrating your tests into an Azure DevOps pipeline automates validation, ensuring your code remains robust and error-free. This automation allows you and your team to focus on writing meaningful, high-quality code, reducing time spent on infrastructure management and setup. With .NET Aspire, you can accelerate your development process and improve collaboration across your team.

---

## References

- [Sample Code From DrunkCode](https://github.com/baoduy/sample-aspire-dotnet-unittests)
- [.NET Aspire Documentation](https://learn.microsoft.com/en-us/dotnet/aspire/get-started/aspire-overview)
- [EfCore Migration in .NET Aspire](https://learn.microsoft.com/en-us/dotnet/aspire/database/ef-core-migrations)

---

## Thank You

Thank you for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven**
[GitHub](<[https://github.com/baoduy](https://github.com/baoduy)>)
