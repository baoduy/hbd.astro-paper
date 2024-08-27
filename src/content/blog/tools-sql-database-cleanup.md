---
author: Steven Hoang
pubDatetime: 2024-08-26T12:00:00Z
title: "[Tools] Automating SQL Data Cleanup in Development and Sandbox Environments"
postSlug: tools-sql-server-data-cleanup
featured: true
draft: false
tags:
  - database-cleanup
  - tools
description: "In development and sandbox environments, data can quickly accumulate, leading to performance issues and increased costs. The SQL Data Cleanup program automates the removal of old records from SQL databases based on configurable settings. This post highlights the importance of regular data cleanup to reduce clutter, enhance performance, and manage costs, while also providing guidance on configuring the program to meet specific needs. The tool helps keep databases efficient and manageable, ensuring optimal performance in development and testing environments."
---

## Introduction

In our development and sandbox environments, data can quickly accumulate, leading to bloated databases filled with old transaction records, exchange rates, and logs. Without a dedicated housekeeper, these environments can become cluttered, impacting performance and increasing storage costs. To address this issue, I developed the SQL Data Cleanup program, a powerful tool designed to clean up old records from multiple SQL databases based on a provided configuration.

## Why Clean Up Data?

Before we dive into the technical details, let’s talk about why this is important:

- **Reduce Clutter**: Too much data can make it difficult to manage and navigate the database, especially when trying to find relevant records.
- **Improve Performance**: A clean database is easier to manage and can lead to better performance in your development and testing environments.
- **Cost Savings**: Our entire environment is hosted on the cloud, and to keep storage and usage within budget, it is crucial to regularly clean up data. This applies not only to sandbox environments but also to production environments.
- **Prevent Confusion**: Developers might accidentally use or reference outdated data, leading to potential issues in the codebase.

## Configuration

The configuration for the SQL Data Cleanup program is stored in the `appsettings.json` file. Here is a simplified example configuration for one database and one table:

```json
{
  "DbCleanup": {
    // Number of days to keep data before considering it old and eligible for cleanup
    "OlderThanDays": 365, // Keep Data for 1 year

    // Connection string template for connecting to the SQL databases
    "ConnectionString": "YOUR_CONNECTION_STRING",

    // Primary field used for identifying records in the tables
    "PrimaryField": "Id",

    // Fields used to determine the age of the records for cleanup
    "ConditionFields": ["CreatedOn"],

    // Configuration for individual databases
    "Databases": {
      // Configuration for the "random-database-1" database
      "database-1": {
        // Primary field used for identifying records in this database
        "PrimaryField": "Id",

        // Fields used to determine the age of the records for cleanup in this database
        "ConditionFields": ["UpdateOn"],

        // Configuration for individual tables within this database
        "Tables": {
          // Configuration for the "random-table-1" table
          "table-1": {
            // Primary field used for identifying records in this table
            "PrimaryField": "Id"
          },
          // Configuration for the "random-table-2" table
          "random-table-2": {
            // Primary field used for identifying records in this table
            "PrimaryField": "Id"
          }
        }
      }
    }
  }
}
```

### Configuration Explanation

The configuration is divided into three levels: Global, Database, and Table. Each level allows you to specify `ConditionFields` and `PrimaryField` settings, providing flexibility and control over the cleanup process.

- **Global Level**: Settings specified under `DbCleanup` apply to all databases and tables unless overridden at a lower level.
  - **OlderThanDays**: Specifies the number of days to retain data before it is considered old and eligible for cleanup. In this case, data older than 365 days will be cleaned up.
  - **ConnectionString**: Template for the connection string used to connect to the SQL databases. The placeholder `[DbName]` will be replaced with the actual database name during runtime.
  - **PrimaryField**: The primary key field used to identify records in the tables.
  - **ConditionFields**: Fields used to determine the age of the records. Records older than the specified number of days in these fields will be considered for cleanup.

- **Database Level**: Settings specified for each database apply to all tables within that database unless overridden at the table level.
  - **PrimaryField**: The primary key field used to identify records in the tables within this database.
  - **ConditionFields**: Fields used to determine the age of the records in the tables within this database.

- **Table Level**: Settings specified for each table apply only to that specific table.
  - **PrimaryField**: The primary key field used to identify records in this table.
  - **ConditionFields**: Fields used to determine the age of the records in this table.

## Usage

For detailed setup instructions, please refer to the [SQL Data Cleanup GitHub repository](https://github.com/baoduy/tool-sql-data-cleanup). The repository contains comprehensive instructions on how to clone the project, update the configuration, build, and run the program.

### Code Structure

- **SqlDataCleanup/Config.cs**: Contains configuration classes and methods for setting up dependency injection.
- **SqlDataCleanup/DbCleanupJob.cs**: Contains the `DbCleanupJob` class, which handles the cleanup operations for individual databases.
- **SqlDataCleanup/Extensions.cs**: Contains extension methods for configuration objects.
- **SqlDataCleanup/SqlCleanupJob.cs**: Contains the `SqlCleanupJob` class, which orchestrates the cleanup operations for all configured databases.

## Conclusion

By using the SQL Data Cleanup program, you can efficiently manage and maintain your SQL databases, ensuring that old and unnecessary data is regularly cleaned up. This not only improves database performance but also helps in reducing storage costs. The program allows you to configure and clean up only the tables you want (whitelist), providing flexibility and control over the cleanup process. Give it a try and let us know your feedback!

<hr/>

Thank you for your time! If you have any further questions, feel free to ask. 🌟✨🎁

Steven
[GitHub](<[https://github.com/baoduy](https://github.com/baoduy)>)
