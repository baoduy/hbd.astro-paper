---
author: Steven Hoang
pubDatetime: 2024-08-26T12:00:00Z
title: "[Tools] Cleaning Up Azure Service Bus Dead-Letter Queues with .NET"
postSlug: tools-azure-service-bus-dead-letters-cleanup
featured: true
draft: false
tags:
  - azure-servicebus-cleanup
  - deadletters-cleanup
  - tools
description: "In cloud-based applications, message queues are essential for reliable communication between services, with Azure Service Bus being a popular choice. 
However, messages that cannot be delivered or processed are moved to dead-letter queues (DLQs). Accumulating dead-letter messages without regular cleanup can lead to storage overruns 
and performance issues. This post explains the importance of cleaning up DLQs to prevent issues like QuotaExceededException and ensure system reliability. 
It also provides a guide on implementing a .NET background service to automate the cleanup process by moving dead-letter messages to Azure Blob Storage for later analysis or reprocessing. This approach helps maintain optimal system performance while preserving valuable data for future troubleshooting."
---

In modern cloud-based applications, message queues are essential for ensuring reliable communication between distributed services. Azure Service Bus is a popular messaging service that provides robust capabilities for handling these communications. However, sometimes messages cannot be delivered or processed, resulting in what are known as **dead-letter messages**. In this post, we’ll explore the concept of dead-letter queues, the importance of cleaning them up, and how to create a .NET background service that automates this cleanup process by storing dead-letter messages in Azure Blob Storage for later analysis or reprocessing.

## What Are Dead-Letter Queues?

A dead-letter queue (DLQ) is a special queue that holds messages that cannot be delivered or processed due to various reasons, such as exceeding the maximum number of delivery attempts, message expiration, or any specific conditions set by the user. These messages are moved to the dead-letter queue for further inspection and handling, rather than being lost or discarded.

## Why Clean Up Dead-Letter Messages?

Dead-letter messages need to be cleaned up regularly for several critical reasons:

- **Prevent Storage Overruns:** If dead-letter messages accumulate without being cleaned up, they can consume significant storage space, eventually leading to a `QuotaExceededException`. This exception occurs when the maximum entity size for a Service Bus resource is reached, potentially disrupting normal operations. Here’s an example of such an error:

  ```
  Microsoft.Azure.ServiceBus.QuotaExceededException: The maximum entity size has been reached or exceeded for Topic: 'SG-PRD-BUS-TRANS:TOPIC:COMPLIANCE-V1-TP~47'. Size of entity in bytes: 2147489161, Max entity size in bytes: 2147483648. For more information please see
  https://aka.ms/ServiceBusExceptions.
  QuotaType: EntitySize Reference:94a0d962-9919-48bc-8462-e32ab865bac8, TrackingId:97627e480000fd78005afd8566cc2fc4_G23_B20, SystemTracker:gi::G23:Send:268196192:638115103418830000:bus-compliance-v1-send:EntitySAS:F2:C64888, bi::in-connection2792(G23-1801057)::session2807::link5963141, Timestamp:2024-08-26T07:33:25
  ```

- **Ensure System Reliability:** Accumulated dead-letter messages can degrade the performance and reliability of the messaging system. Regular cleanup helps maintain optimal performance and prevents system failures due to exceeded quotas.

- **Facilitate Error Handling:** By moving dead-letter messages to Azure Blob Storage, you retain them for later analysis and reprocessing, which is crucial for debugging and improving your application’s resilience.

## Implementing Dead-Letter Cleanup with .NET

### Configuration

The configuration for the dead-letter cleanup service is stored in the `appsettings.json` file, which includes settings for logging, Azure Service Bus, and Azure Storage Account connections.

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ServiceBus": {
    "ConnectionString": ""
  },
  "StorageAccount": {
    "ConnectionString": "",
    "ContainerName": "bus-dead-letters"
  }
}
```

- **Logging:** Specifies the logging levels for the application.
- **AllowedHosts:** Defines the allowed hosts for the application.
- **ServiceBus:** Configuration for the Azure Service Bus, including the connection string.
- **StorageAccount:** Configuration for the Azure Storage Account, specifying the connection string and the blob container where dead-letter messages will be stored.

### Configuration Classes

The configuration settings are mapped to classes in the application, ensuring that they can be easily accessed and used throughout the service.

```csharp
public sealed class BusConfig
{
    public static string Name => "ServiceBus";
    [Required(AllowEmptyStrings = false)]
    public string ConnectionString { get; set; } = default!;
}

public sealed class StorageConfig
{
    public static string Name => "StorageAccount";
    [Required(AllowEmptyStrings = false)]
    public string ConnectionString { get; set; } = default!;
    [Required(AllowEmptyStrings = false)]
    public string ContainerName { get; set; } = default!;
}
```

### ServiceBusBackgroundService

The core component of the cleanup process is the `ServiceBusBackgroundService` class, which listens to dead-letter queues of Azure Service Bus topics and writes the dead-letter messages to Azure Blob Storage.

#### Key Methods:

- **`StartListeningToDeadLetterQueueAsync`:** Initiates the process of listening to a specific dead-letter queue and handles incoming messages.
- **`WriteMessageToBlobAsync`:** Writes a dead-letter message to Azure Blob Storage, preserving it for future analysis.
- **`ExecuteAsync`:** The main execution method that starts the service, ensures the blob container exists, and begins listening to dead-letter queues across all topics and subscriptions.
- **`StopAsync`:** Safely stops the background service and disposes of the Service Bus client.

### Example Code Snippet

```csharp
private async Task StartListeningToDeadLetterQueueAsync(string topicName, string subscriptionName)
{
    Console.WriteLine($"Processing: {topicName}/{subscriptionName}");

    var deadLetterPath = $"{topicName}/Subscriptions/{subscriptionName}/$DeadLetterQueue";
    var processor = _busClient.CreateProcessor(deadLetterPath, new ServiceBusProcessorOptions());

    processor.ProcessMessageAsync += async args =>
    {
        await WriteMessageToBlobAsync(topicName, subscriptionName, args.Message);
        await args.CompleteMessageAsync(args.Message);
    };

    processor.ProcessErrorAsync += args =>
    {
        Console.WriteLine($"Error processing message: {args.Exception.Message}");
        return Task.CompletedTask;
    };

    await processor.StartProcessingAsync();
    Console.WriteLine($"Started listening to DLQ: {topicName}/{subscriptionName}");
}

private async Task WriteMessageToBlobAsync(string topicName, string subscriptionName, ServiceBusReceivedMessage message)
{
    var blobName = $"{topicName}/{subscriptionName}/{message.MessageId}.txt";
    var blobClient = _storageClient.GetBlobClient(blobName);

    await using (var stream = message.Body.ToStream())
        await blobClient.UploadAsync(stream, overwrite: true);

    Console.WriteLine($"Dead-letter message written to blob {blobName}");
}
```

## Conclusion

In this blog post, we’ve covered the importance of regularly cleaning up Azure Service Bus dead-letter queues and how to implement a .NET background service to automate this task. By storing dead-letter messages in Azure Blob Storage, you can ensure that your Service Bus remains within its quota limits while also preserving important information for future analysis or reprocessing. This approach not only maintains the reliability and performance of your messaging system but also enhances its robustness by providing a mechanism for handling and analyzing failed messages.

By following the steps outlined above, you can implement a similar solution in your own projects, ensuring that dead-letter messages are managed efficiently and effectively.
