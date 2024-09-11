---
author: Steven Hoang
pubDatetime: 2024-08-26T12:00:00Z
title: "[Tools] Cleaning Up Azure Service Bus Dead-Letter Queues with .NET"
postSlug: tools-azure-service-bus-dead-letters-cleanup
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

In cloud-based applications, message queues are essential for reliable communication between services. Azure Service Bus is a powerful messaging service used in many distributed systems. However, messages that cannot be processed or delivered eventually end up in **Dead-Letter Queues (DLQs)**. If left unchecked, accumulated dead-letter messages can cause storage overruns and degrade system performance. In this post, I'll share the importance of cleaning up dead-letter queues and walk you through how to implement a .NET background service to automate this process by moving dead-letter messages to Azure Blob Storage for future analysis or reprocessing.

## What Are Dead-Letter Queues?

A **Dead-Letter Queue (DLQ)** is a special queue that stores messages that couldn't be delivered or processed, often due to reasons like:

- Exceeding the maximum delivery attempts.
- Message expiration.
- Violating user-defined filters or conditions.

Instead of discarding these problematic messages, Azure Service Bus moves them to a DLQ for further inspection and handling.

## Why Clean Up Dead-Letter Messages?

Regularly cleaning up dead-letter queues is crucial for several reasons:

### Prevent Storage Overruns

Unattended dead-letter messages can accumulate, leading to storage consumption and eventually triggering a `QuotaExceededException`. This error occurs when the maximum size limit for a Service Bus entity is reached, which could disrupt normal operations. For example:

```bash
Microsoft.Azure.ServiceBus.QuotaExceededException: 
The maximum entity size has been reached or exceeded for Topic: 
'TP-NAME-TP~47'. Size of entity in bytes: 2147489161, Max entity size in bytes: 2147483648.

...
```

Cleaning up dead-letter messages ensures that your system remains within quota limits, preventing service disruption.

### Maintain System Reliability

Accumulated dead-letter messages can impact the overall performance and reliability of your system. Regular cleanup prevents these messages from degrading system performance or causing bottlenecks.

### Enable Effective Error Handling

Moving dead-letter messages to Azure Blob Storage provides a secure way to store these messages for future analysis. This allows teams to investigate failures, reprocess messages if necessary, and improve system resilience without compromising performance.

## Implementing Dead-Letter Cleanup with .NET

I have developed a small program to automate the cleanup of dead-letter queues from all Azure Service Bus *queues* and *topics*. This job moves dead-letter messages to an Azure Blob Storage container for backup purposes. You can set up a retention policy on the storage account to automatically delete old messages after a certain period, further simplifying management.

You can find the source code and details here: [GitHub: Azure Service Bus Dead-Letters Cleanup Tool](https://github.com/baoduy/tool-serviceBus-deadLetters-cleanup).

### Configuration

The service configuration is stored in an `appsettings.json` file, including settings for logging, Azure Service Bus, and Azure Storage Account connections. Here's a sample configuration:

```json
{
  "ServiceBus": {
    "ConnectionString": "YOUR_SERVICE_BUS_CONNECTION_STRING"
  },
  "StorageAccount": {
    "ConnectionString": "YOUR_STORAGE_ACCOUNT_CONNECTION_STRING",
    "ContainerName": "bus-dead-letters"
  }
}
```

- **ServiceBus**: Your Azure Service Bus connection string (must be a namespace-level management connection string to allow listing all queues and topics).
- **StorageAccount**: Your Azure Storage Account connection string and the container where dead-letter messages will be stored.

> Over time, the number of dead-letter messages stored in your Azure Storage Account may grow significantly, consuming more storage space. Since these messages might not be needed for more than a few months, you can leverage [Storage Account Lifecycle Management](https://learn.microsoft.com/en-us/azure/storage/blobs/lifecycle-management-overview) to automatically delete old, redundant blobs. This helps in managing storage costs and keeping your storage account organized.

### Docker Support

For ease of deployment, the tool is also available as a Docker image on Docker Hub, supporting both ARM and AMD platforms:

- **Docker Image:** [baoduy2412/servicebus-cleanup](https://hub.docker.com/r/baoduy2412/servicebus-cleanup/tags)

Here’s an example `docker-compose.yml` file for running the service using environment variables:

```yaml
services:
  app:
    image: baoduy2412/servicebus-cleanup:latest
    environment:
      ServiceBus__ConnectionString: YOUR_SERVICE_BUS_CONNECTION_STRING
      StorageAccount__ConnectionString: YOUR_STORAGE_ACCOUNT_CONNECTION_STRING
      StorageAccount__ContainerName: bus-dead-letters
```

By using Docker, you can quickly deploy the tool without needing to rebuild the project from source, allowing you to streamline dead-letter cleanup in your production environment.

## Conclusion

Dead-letter queues are an essential part of Azure Service Bus, providing a way to manage undelivered or unprocessed messages. However, letting dead-letter messages accumulate without regular cleanup can lead to storage issues and system degradation. By implementing a .NET background service that moves dead-letter messages to Azure Blob Storage, you can prevent `QuotaExceededException` errors, maintain system reliability, and preserve valuable data for analysis and reprocessing.

The provided tool offers a safe and efficient way to manage dead-letter queues, ensuring that your Service Bus remains within quota limits while giving production support teams the ability to retrieve and reprocess messages as needed.

By automating this process, you'll ensure that your cloud-based messaging system continues to perform optimally without losing the insights that dead-letter messages can provide.

<hr/>

Thank you for your time! If you have any further questions, feel free to ask. 🌟✨🎁

Steven
[GitHub](<[https://github.com/baoduy](https://github.com/baoduy)>)
