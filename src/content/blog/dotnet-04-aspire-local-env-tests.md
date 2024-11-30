---
author: Steven Hoang
pubDatetime: 2024-08-22T12:00:00Z
title: "[.NET] Aspire, Simplifying Local Development Environment and Testing."
postSlug: dotnet-04-aspire-local-env-and-testing
featured: true
draft: false
tags:
  - dotnet
  - aspire
  - local-env
description: "Setting up a new project can be challenging, especially with the involvement of various technologies. This guide explores how .NET Aspire simplifies development by streamlining local environment setup, testing, and continuous integration, while also detailing the end-to-end process with an Azure DevOps CI/CD pipeline."
---

Starting a new project is both exciting and challenging, especially when it comes to configuring the development environment. Many projects require a mix of technologies, which can lead to time-consuming setup and potential errors. **.NET Aspire** simplifies this process by offering a framework that helps developers set up a consistent and efficient environment across various projects.

With .NET Aspire, We can create a ready-to-run local environment that integrates seamlessly with Docker, allowing the development team to focus on coding without worrying about complex setup requirements. It supports smooth integration with containers, making it easier to handle dependencies and ensuring that our local environment closely mirrors the development/staging environment setup.

In addition to simplifying environment setup, this guide walks us through writing robust integration tests. These tests ensure all components work well together and catch potential issues early in the development process. We'll also learn how to incorporate these tests into a continuous integration (CI) pipeline, ensuring the code is consistently validated and error-free before it reaches production.

## Why .NET Aspire?

**.NET Aspire** is designed to improve the experience of building .NET cloud-native applications. It provides a consistent, opinionated set of tools and patterns that help to build and run distributed apps. .NET Aspire assists with:

- **Orchestration**: Features for running and connecting multi-project applications and their dependencies in local development environments.
- **Integrations**: NuGet packages for commonly used services, such as Redis or PostgreSQL, with standardized interfaces ensuring they connect consistently and seamlessly with the app.
- **Tooling**: Project templates and tooling experiences for Visual Studio, Visual Studio Code, and the `dotnet` CLI to help to create and interact with .NET Aspire projects.

## Table of Contents

1. [Why .NET Aspire?](#why-net-aspire)
2. [Setting Up the Local Environment](#setting-up-the-local-environment)
3. [Hosting with Aspire](#hosting-with-aspire)
4. [.NET Aspire for Testing](#net-aspire-for-testing)
5. [Running Tests on Azure DevOps](#running-tests-on-azure-devops)
6. [Conclusion](#conclusion)

## Setting Up the Local Environment

Let's start by creating a simple API project and hosting it with .NET Aspire.

### Prerequisites

- **.NET 8 SDK** or later
- **Docker Desktop** installed and running
- **Aspire workload** installed: Install the Aspire workload using the following command:

  ```bash
  dotnet workload install aspire
  ```

## Creating an API Project

Assuming we already have a simple API that utilizes the following technologies:

- **MediatR**: A library used to implement the command and response pattern at the API level. It helps decouple request handling logic from controllers, making the code more modular and easier to maintain.
- **Entity Framework Core (EF Core)**: An Object-Relational Mapper (ORM) used to manage database access.
- **PostgreSQL**: Used as the database to store and manage the application's data.

This API has the following endpoints, as displayed in the Swagger UI:

![Api](/assets/dotnet-04-aspire-local-env-tests/api.png)

## Aspire Templates Explanation

Aspire provides several project templates to help to get started quickly with different aspects of application development and testing:

- **App Host**: The primary template for creating an Aspire hosting project. It sets up the necessary infrastructure to host the application and its dependencies.
- **Service Defaults**: Configures essential services for the application, such as `OpenTelemetry` for distributed tracing, `DefaultHealthChecks` for monitoring service health, and `RequestTimeouts` to manage request durations. While optional, it's highly recommended for applications hosted on Aspire to ensure robust monitoring and orchestration management.
- **Test Project (MSTest)**: Sets up a project for unit testing using the MSTest framework.
- **Test Project (NUnit)**: Sets up a project for unit testing using the NUnit framework.
- **Test Project (xUnit)**: Sets up a project for unit testing using the xUnit framework.

![AspireTemplates](/assets/dotnet-04-aspire-local-env-tests/AspireTemplates.png)

## Hosting with Aspire

To host the API above with its dependencies with Aspire, follow these steps:

### 1. Create `Aspire.Host`

First, create a new project named `Aspire.Host` using the App Host template provided by .NET Aspire.

### 2. Add PostgreSQL Support

Next, install the Aspire PostgreSQL hosting package to add PostgreSQL support to this project.

```bash
dotnet add package Aspire.Hosting.PostgreSQL
```

> **Note**: Refer to the [.NET Aspire GitHub repository](https://github.com/dotnet/aspire) for a full list of hosting components supported by Aspire.

### 3. Aspire Host with `Config as Code`

Open `Program.cs` in the `Aspire.Host` project and configure the `DistributedApplication` as shown:

[inline](https://github.com/baoduy/sample-aspire-dotnet-testing/blob/main/Aspire.Host/Program.cs#1-100)

**Explanation**:

- **AddPostgres("postgres")**: This adds a PostgreSQL service to the Aspire hostwith named as "postgres".
- **AddDatabase("Db")**: This sets up a database named "Db". This database will be used by the API.
- **AddProject<Projects.Api>("api")**: This method adds our API project to the Aspire host named as "api".
- **WithReference(postgres)**: This references the database service to the API project. It sets up the connection string configuration for the API to connect to the PostgreSQL database.
- **WaitFor(postgres)**: This ensures that the PostgreSQL resource is fully up and running before the API project starts. This is a new functionality added in Aspire 9, ensuring that the API only starts after the database is ready.

### 4. EF Core Database Migration

Automating database migrations is important when using EF Core to ensure consistency across environments. While we won't discuss the details here, you can refer to the [EF Core Migrations guide](https://learn.microsoft.com/en-us/dotnet/aspire/database/ef-core-migrations) compatible with .NET Aspire.

Here is a sample code to run the EfCore migration as a background job when the API started:

<details><summary><em>Example <code>DbMigrationJob.cs</code></em></summary>

[inline](https://github.com/baoduy/sample-aspire-dotnet-testing/blob/main/Api/Configs/DbMigrationJob.cs#1-100)

</details>

### 5. Aspire Host Dashboard

Run the `Aspire.Host` project. The dashboard will display all running components.

![Dashboard](/assets/dotnet-04-aspire-local-env-tests/AspireDashboard.png)

**Note:**
If you are migrating from Aspire version 8 to version 9, ensure that the `<Sdk Name="Aspire.AppHost.Sdk" Version="9.0.0"/>` element is added to the project file. This ensures compatibility and leverages the latest features and improvements in Aspire 9.

<details><summary><em>Example <code>Aspire.Host.csproj</code></em></summary>

[inline](https://github.com/baoduy/sample-aspire-dotnet-testing/blob/main/Aspire.Host/Aspire.Host.csproj#1-100)

</details>

## .NET Aspire for Testing

Integration tests ensure that different parts of the application work together correctly. However, writing and running them on CI/CD pipelines can be challenging and time-consuming. .NET Aspire simplifies this process by handling much of the setup for us.

### 1. Create `Aspire.Tests`

Create a new test project named `Aspire.Tests` using the Test Project (xUnit) template provided by .NET Aspire. This template sets up the necessary scaffolding for integration tests using xUnit.

**Note:**
Similar to `Aspire.Host` project. Ensure that the `<Sdk Name="Aspire.AppHost.Sdk" Version="9.0.0"/>` element is added to the project file.

<details><summary><em>Example <code>Aspire.Tests.csproj</code></em></summary>

[inline](https://github.com/baoduy/sample-aspire-dotnet-testing/blob/main/Aspire.Tests/Aspire.Tests.csproj#1-100)

</details>

### 2. ApiFixture Class

The `ApiFixture` class sets up the necessary environment for integration tests. It extends `WebApplicationFactory<Api.Program>` and implements `IAsyncLifetime` to manage the lifecycle of the test environment.

[inline](https://github.com/baoduy/sample-aspire-dotnet-testing/blob/main/Aspire.Tests/Fixtures/ApiFixture.cs#1-100)

**Explanation**:

The `ApiFixture` class is responsible for:

- Setting up a PostgreSQL server resource.
- Configuring the host with the necessary connection strings.
- Ensuring the database is created and testing data prepared before tests run.
- Starting and stopping the application host.
- Cleaning up resources after tests are completed.

### 3. Test Cases Class

The `ProductEndpointsTests` class contains integration tests for the product endpoints of the API. It uses the `ApiFixture` to set up the test environment and `HttpClient` to make requests to the API.

[inline](https://github.com/baoduy/sample-aspire-dotnet-testing/blob/main/Aspire.Tests/ProductEndpointsTests.cs#1-105)

**Explanation**:

The `ProductEndpointsTests` class is responsible for testing the CRUD of the product endpoints. It ensures that:

- **Creating a product** works correctly and returns a valid product ID.
- **Retrieving a product** returns the expected product details.
- **Updating a product** successfully applies the changes and returns the appropriate status.
- **Deleting a product** removes it from the database and returns the correct status code.

### 4. Testing Results

Here are the reports on Azure DevOps after the pipeline ran successfully.

- **Test Case Results**:

  The test case results show the outcome of each executed test.

  ![TestCasesResults](/assets/dotnet-04-aspire-local-env-tests/TestCasesResults.png)

- **Coverage Results**:

  Code coverage results provide insights into how much of the codebase is being tested.

  ![TestCoverageResults](/assets/dotnet-04-aspire-local-env-tests/TestCoverageResults.png)

## Running Tests on Azure DevOps

### 1. Configuring the Pipeline

To automate testing and code coverage collection, let's set up a continuous integration (CI) pipeline using Azure DevOps.

In the Azure DevOps project, create a new pipeline that builds the code, runs tests, and collects code coverage data.

Here is an example of what our `azure-pipelines.yml` file might look like.

[inline](https://github.com/baoduy/sample-aspire-dotnet-testing/blob/main/pipelines/no-filter.azure-pipelines.yml#1-100)

**Explanation**:

- **UseDotNet@2**: Ensures that the correct .NET SDK is installed on the build agent.
- **Install Aspire Workload**: Installs the Aspire workload needed for the project.
- **Build Projects**: Builds all the projects specified by the `RestoreBuildProjects` variable.
- **Run Tests and Collect Code Coverage**: Executes the tests in the projects specified by the `TestProjects` variable and collects code coverage data.

_Note_: Ensure that the YAML file includes the `UseDotNet@2` task to specify the required .NET SDK version.

### Running the Pipeline

Save the pipeline configuration and run it. Monitor the build process to ensure all steps complete successfully.

After the pipeline completes, the test results and code coverage reports should be appeared in Azure DevOps.

1. **Test Results**:

   Displays which tests passed or failed.

   ![devops-test-results](/assets/dotnet-04-aspire-local-env-tests/az-devops-no-filter-test-results.png)

2. **Code Coverage**:

   Provides detailed information about which parts of the code were tested.

   ![devops-test-coverage](/assets/dotnet-04-aspire-local-env-tests/az-devops-no-filter-test-coverage.png)

> **Note**: The initial code coverage might be lower than expected. For example, you might see an overall coverage of 23.89%, even though the API component itself has 88.14% coverage. This discrepancy occurs because the coverage report includes all libraries, those not part of the API project.

## Improving Code Coverage Reports
To produce a more focused and insightful code coverage report, we can adjust the settings to concentrate on the pertinent components of the project.

### 1. Add the `coverlet.collector` NuGet Package

  Coverlet is a versatile, cross-platform library designed for code coverage analysis. It supports a variety of code coverage formats and allows for extensive customization options.

  Ensure that the `coverlet.collector` package is added to every testing project in order to generate and compile comprehensive code coverage reports.

```bash
dotnet add package coverlet.collector --version latest
```

2. **Creating the Coverage Filtering File**:

   Create a file named `coverage.runsettings` in the project root with the appropriate configuration.

  [inline](https://github.com/baoduy/sample-aspire-dotnet-testing/blob/main/coverage.runsettings#1-100)

**Explanation**:

- The `<Include>` section specifies which assemblies to include in the code coverage report. In this case, `[Api*]*` includes all assemblies starting with "Api".
- The `<Exclude>` section can be used to exclude specific assemblies or classes.

3. **Updating the Pipeline Configuration**:

   Modify the `azure-pipelines.yml` file to use the `coverage.runsettings` file and publish the code coverage results.

```yaml
# ... previous configuration ...

# Run tests with coverage filtering
- task: DotNetCoreCLI@2
  displayName: "Test with Coverage Filtering"
  inputs:
    command: "test"
    projects: "$(TestProjects)"
    arguments: '--configuration $(BuildConfiguration) --settings coverage.runsettings --collect "XPlat Code Coverage"'

# Publish the code coverage results to Azure DevOps
- task: PublishCodeCoverageResults@2
  inputs:
    summaryFileLocation: "$(Agent.TempDirectory)/**/coverage.cobertura.xml"
```

**Explanation**:

- **Run Tests with Coverage Filtering**: Executes tests using the `coverage.runsettings` file to filter the code coverage data.
- **Publish Code Coverage Results**: Publishes the code coverage results to Azure DevOps for easy visualization.

4. **Review the Enhanced Coverage Report**:

   After running the updated pipeline, We should see an improved code coverage report that focuses on the relevant parts of the project. The coverage results will now provide detailed insights at the class level using the XPlat format.

![devops-test-coverage-with-filter](/assets/dotnet-04-aspire-local-env-tests/az-devops-with-filter-test-coverage.png)

## Conclusion

By utilizing .NET Aspire and Docker, we can create a consistent, isolated environment that streamlines not just Entity Framework integration testing but the entire development lifecycle. .NET Aspire offers a flexible to `config as code` and sharing `ready-to-run` environment to all the development teams.

## References

- [Sample Code From DrunkCode](https://github.com/baoduy/sample-aspire-dotnet-unittests)
- [.NET Aspire Documentation](https://learn.microsoft.com/en-us/dotnet/aspire/get-started/aspire-overview)
- [EfCore Migration in .NET Aspire](https://learn.microsoft.com/en-us/dotnet/aspire/database/ef-core-migrations)

## Thank You

Thank for taking the time to read this guide! I hope it has been helpful, feel free to explore further, and happy coding! 🌟✨

**Steven**
[GitHub](https://github.com/baoduy)
