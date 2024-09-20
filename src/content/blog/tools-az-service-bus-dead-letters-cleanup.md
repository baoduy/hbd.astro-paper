---
author: Steven Hoang
pubDatetime: 2024-08-26T12:00:00Z
title: "[Tools] Cleaning Up Azure Service Bus Dead-Letter Queues with .NET"
postSlug: tools-az-service-bus-dead-letters-cleanup
featured: false
draft: false
tags:
  - azure-servicebus-cleanup
  - deadletters-cleanup
  - tools
description: "This post highlights the importance of regularly cleaning Azure Service Bus Dead-Letter Queues (DLQs) to prevent `QuotaExceededException` storage issues and maintain performance. 
It explains how to automate the process with a .NET background service that moves dead-letter messages to Azure Blob Storage for future analysis, 
along with a ready-to-use Docker image for easy deployment."
---

## Introduction

In cloud-based applications, message queues are critical for enabling reliable, asynchronous communication between services. **Azure Service Bus** is a robust messaging platform that facilitates this communication in distributed systems. However, messages that cannot be processed or delivered successfully may end up in the **Dead-Letter Queue (DLQ)**. If left unmanaged, these dead-letter messages can accumulate, leading to storage issues and degraded system performance.

In this article, we'll explore the importance of regularly cleaning up dead-letter queues in Azure Service Bus. We'll guide you through implementing a .NET background service that automates this cleanup process by moving dead-letter messages to Azure Blob Storage. This approach ensures your messaging system remains efficient while preserving problematic messages for future analysis or reprocessing.

## Table of Contents

## Understanding Dead-Letter Queues

A **Dead-Letter Queue (DLQ)** is a sub-queue associated with each Azure Service Bus entity (queue or topic subscription). It holds messages that cannot be delivered or processed successfully. Messages may be moved to the DLQ for several reasons:

- **Exceeding Maximum Delivery Attempts**: A message is retried multiple times but still cannot be processed successfully.
- **Message Expiration**: The message's **Time to Live (TTL)** expires before it is processed.
- **Filter Violations**: The message does not match the filter criteria of a subscription.
- **Processing Errors**: An application explicitly moves a message to the DLQ due to a processing failure.

By design, the DLQ provides a way to isolate faulty messages, allowing your system to continue processing valid messages without interruption.

## Why Regularly Clean Up Dead-Letter Messages?

### 1. Prevent Storage Overruns

Dead-letter messages accumulate over time, consuming storage resources. If left unchecked, this can lead to a `QuotaExceededException`, where the maximum size limit for a Service Bus entity is reached:

```
Microsoft.Azure.ServiceBus.QuotaExceededException:
The maximum entity size has been reached or exceeded for Topic:
'YourTopicName'. Size of entity in bytes: 2147489161, Max entity size in bytes: 2147483648.
```

This exception can disrupt normal operations, preventing new messages from being sent or received.

### 2. Maintain System Performance and Reliability

Large volumes of dead-letter messages can degrade the performance of your Service Bus namespace. They can slow down operations such as message retrieval and monitoring, leading to bottlenecks in your system.

### 3. Enable Effective Error Handling and Analysis

By archiving dead-letter messages to Azure Blob Storage, you retain the ability to analyze and diagnose issues without impacting the performance of your messaging system. This allows your team to:

- **Investigate Failures**: Understand why messages failed and identify patterns.
- **Reprocess Messages**: Correct issues and resend messages if necessary.
- **Improve Resilience**: Implement fixes to prevent similar failures in the future.

## Implementing a Dead-Letter Cleanup Service with .NET

To automate the cleanup process, we'll create a .NET background service that:

1. **Retrieves dead-letter messages** from all queues and topic subscriptions.
2. **Archives messages** to Azure Blob Storage.
3. **Deletes messages** from the DLQ after successful archiving.

### Prerequisites

- **Azure Service Bus Namespace**: With appropriate permissions (Manage rights) to access queues and topics.
- **Azure Storage Account**: For storing archived dead-letter messages.
- **.NET 6 SDK**: Installed on your development machine.
- **Docker**: (Optional) For containerized deployment.

### Getting the Source Code

The source code for the cleanup tool is available on GitHub:

- **Repository**: [Azure Service Bus Dead-Letter Cleanup Tool](https://github.com/baoduy/tool-serviceBus-deadLetters-cleanup)

### Service Configuration

The service uses an `appsettings.json` file for configuration:

```json
{
  "ServiceBus": {
    "ConnectionString": "YOUR_SERVICE_BUS_CONNECTION_STRING"
  },
  "StorageAccount": {
    "ConnectionString": "YOUR_STORAGE_ACCOUNT_CONNECTION_STRING",
    "ContainerName": "bus-dead-letters"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft": "Warning"
    }
  }
}
```

- **ServiceBus**:
  - `ConnectionString`: Your Azure Service Bus connection string with Manage permissions.
- **StorageAccount**:
  - `ConnectionString`: Your Azure Storage Account connection string.
  - `ContainerName`: The name of the Blob Storage container where dead-letter messages will be stored.

> **Security Note**: For production environments, consider using Azure Key Vault or environment variables to securely manage connection strings.

### How the Cleanup Service Works

1. **Connect to Azure Service Bus**: The service connects to your Service Bus namespace using the provided connection string.

2. **Discover Entities**: It retrieves all queues and topic subscriptions in the namespace.

3. **Process Dead-Letter Messages**:

   - For each entity, it checks the DLQ for messages.
   - If messages are found, it reads them and saves each message as a JSON file in Azure Blob Storage.
   - The messages are organized in folders by entity name and date, making them easy to locate.

4. **Delete Processed Messages**: After successfully archiving, the messages are deleted from the DLQ.

### Archiving Structure in Blob Storage

The messages are stored in Azure Blob Storage with the following structure:

```
bus-dead-letters/
├── queues/
│   ├── queue1/
│   │   └── 2023-09-20/
│   │       ├── message1.json
│   │       └── message2.json
│   └── queue2/
│       └── 2023-09-20/
│           └── message1.json
└── topics/
    ├── topic1/
    │   ├── subscription1/
    │   │   └── 2023-09-20/
    │   │       └── message1.json
    │   └── subscription2/
    │       └── 2023-09-20/
    │           └── message1.json
```

### Setting Up the Service

#### Option 1: Running Locally

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/baoduy/tool-serviceBus-deadLetters-cleanup.git
   cd tool-serviceBus-deadLetters-cleanup
   ```

2. **Configure the Service**:

   - Update `appsettings.json` with your connection strings.
   - Alternatively, set the environment variables `ServiceBus__ConnectionString`, `StorageAccount__ConnectionString`, and `StorageAccount__ContainerName`.

3. **Build and Run the Service**:

   ```bash
   dotnet build
   dotnet run
   ```

#### Option 2: Using Docker

A Docker image is available for easy deployment:

- **Docker Image**: [baoduy2412/servicebus-cleanup](https://hub.docker.com/r/baoduy2412/servicebus-cleanup)

##### Running with Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: "3.8"

services:
  servicebus-cleanup:
    image: baoduy2412/servicebus-cleanup:latest
    environment:
      ServiceBus__ConnectionString: YOUR_SERVICE_BUS_CONNECTION_STRING
      StorageAccount__ConnectionString: YOUR_STORAGE_ACCOUNT_CONNECTION_STRING
      StorageAccount__ContainerName: bus-dead-letters
    restart: unless-stopped
```

Run the service:

```bash
docker-compose up -d
```

##### Running with Docker Command Line

```bash
docker run -d \
  -e ServiceBus__ConnectionString=YOUR_SERVICE_BUS_CONNECTION_STRING \
  -e StorageAccount__ConnectionString=YOUR_STORAGE_ACCOUNT_CONNECTION_STRING \
  -e StorageAccount__ContainerName=bus-dead-letters \
  baoduy2412/servicebus-cleanup:latest
```

### Managing Storage Costs with Lifecycle Policies

Over time, archived messages in Blob Storage can accumulate and consume significant storage space. To manage this:

1. **Set Up Lifecycle Management**:

   - In the Azure Portal, navigate to your Storage Account.
   - Select **Lifecycle management** under **Blob service**.

2. **Create a Rule**:

   - **Name**: e.g., `DeleteOldArchivedMessages`.
   - **Scope**: Apply to the container `bus-dead-letters`.
   - **Filter**: Optionally specify filters if needed.
   - **Action**: Delete blobs older than a specified number of days (e.g., 30 days).

3. **Save the Rule**: Azure will automatically delete archived messages older than the specified retention period.

## Conclusion

Dead-letter queues are an integral part of Azure Service Bus, providing a mechanism to handle messages that cannot be processed. However, without regular maintenance, they can lead to storage overruns and impact system performance.

By implementing the .NET background service described in this article, you can automate the cleanup of dead-letter queues:

- **Automated Cleanup**: Keeps DLQs empty, preventing storage issues.
- **Message Archiving**: Stores messages for future analysis without impacting Service Bus performance.
- **Scalability**: The tool operates at the namespace level, handling all queues and topics automatically.
- **Cost Management**: Utilizes storage lifecycle policies to control storage costs.

This approach ensures your messaging system remains reliable and efficient while preserving valuable data for troubleshooting and improvement.

## Additional Resources

- **GitHub Repository**: [Azure Service Bus Dead-Letter Cleanup Tool](https://github.com/baoduy/tool-serviceBus-deadLetters-cleanup)
- **Docker Image**: [baoduy2412/servicebus-cleanup](https://hub.docker.com/r/baoduy2412/servicebus-cleanup)
- **Azure Service Bus Documentation**:
  - [Dead-letter Queues](https://docs.microsoft.com/azure/service-bus-messaging/service-bus-dead-letter-queues)
  - [Service Bus Quotas and Limits](https://docs.microsoft.com/azure/service-bus-messaging/service-bus-quotas)
- **Azure Blob Storage**:
  - [Lifecycle Management Overview](https://docs.microsoft.com/azure/storage/blobs/lifecycle-management-overview)
  - [Optimize Costs by Automating Data Lifecycle Management](https://docs.microsoft.com/azure/storage/blobs/storage-lifecycle-management-concepts)

---

By automating dead-letter queue management, you enhance the stability and maintainability of your messaging infrastructure, ensuring it continues to meet the demands of your applications.

---

Thank you for your time! If you have any further questions, feel free to ask. 🌟✨🎁

Steven
[GitHub](<[https://github.com/baoduy](https://github.com/baoduy)>)
