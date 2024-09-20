---
author: Steven Hoang
pubDatetime: 2024-08-26T12:00:00Z
title: "[Tools] Automating SQL Data Cleanup in Development and Sandbox Environments"
postSlug: tools-sql-server-data-cleanup
featured: false
draft: true
tags:
  - database-cleanup
  - tools
description: "The post introduces the **SQL Data Cleanup** tool, which automates the removal of old records from SQL databases, 
improving performance and saving storage costs in development environments. It includes configuration options and Docker support for easy setup."
---

### Introduction

In development and sandbox environments, data can pile up quickly—old transaction records, exchange rates, logs, you name it! Without regular cleanup, databases become bloated, making it harder to work efficiently and often leading to increased storage costs. To tackle this, I’ve created the **SQL Data Cleanup** program, a handy tool that automates the removal of outdated records from SQL databases based on flexible configurations.

Let’s dive into why this matters and how this tool can help streamline your database management.

### Why Bother Cleaning Up?

Here are a few great reasons to stay on top of your data cleanup game:

- **Reduce Clutter**: As databases grow, they can get messy, making it harder to find relevant data and slowing down development work.
- **Boost Performance**: A lean database runs smoother! Regular cleanup helps keep things fast and efficient.
- **Save Money**: In cloud environments, storage costs can sneak up on you. Cleaning up old, unnecessary data helps keep your budget under control.
- **Avoid Confusion**: Nobody wants to mistakenly work with outdated records. Keeping only the relevant data ensures developers don’t accidentally reference old info in their code.

### The Solution: SQL Data Cleanup Program

To solve this, I’ve created a simple yet powerful tool that automates the cleanup of specific databases and tables. You can find the code and more details here: [GitHub: SQL Data Cleanup Tool](https://github.com/baoduy/tool-sql-data-cleanup).

The program allows you to configure which data to remove, how long to keep it, and what fields to use when determining the age of records. Here’s a basic example configuration:

```json
{
  "DbCleanup": {
    "OlderThanDays": 365,
    "ConnectionString": "YOUR_CONNECTION_STRING",
    "PrimaryField": "Id",
    "ConditionFields": ["CreatedOn"],
    "Databases": {
      "database-1": {
        "PrimaryField": "Id",
        "ConditionFields": ["UpdateOn"],
        "Tables": {
          "table-1": { "PrimaryField": "Id" },
          "random-table-2": { "PrimaryField": "Id" }
        }
      }
    }
  }
}
```

### Configuration Breakdown

The configuration has three levels: **Global**, **Database**, and **Table**, giving you full control over the cleanup process.

- **Global Settings**:

  - **OlderThanDays**: Specify how long to keep data (in this case, 365 days).
  - **ConnectionString**: The SQL connection string template.
  - **PrimaryField**: The key field used to identify records in all tables.
  - **ConditionFields**: These fields determine the age of the records to be cleaned up.

- **Database-Level Settings**:

  - Similar to global settings but applied to specific databases.

- **Table-Level Settings**:
  - Customize which fields to use for each table, ensuring flexibility in how you manage each dataset.

### Docker Support

To make things even easier, I’ve built the program into a Docker image, available on Docker Hub. You can run it on both ARM and AMD platforms without any hassle!

- **Docker Image**: [baoduy2412/tool-sql-cleanup](https://hub.docker.com/r/baoduy2412/tool-sql-cleanup)

Here’s a sample `docker-compose.yml` configuration to get you started:

```yaml
services:
  app:
    image: baoduy2412/tool-sql-cleanup:latest
    environment:
      DbCleanup__OlderThanDays: "365"
      DbCleanup__ConnectionString: "YOUR_CONNECTION_STRING"
      DbCleanup__PrimaryField: "Id"
      DbCleanup__ConditionFields__0: "CreatedOn"
      DbCleanup__Databases__database-1__PrimaryField: "Id"
      DbCleanup__Databases__database-1__ConditionFields__0: "UpdateOn"
      DbCleanup__Databases__database-1__Tables__table-1__PrimaryField: "Id"
      DbCleanup__Databases__database-1__Tables__random-table-2__PrimaryField: "Id"
```

### Conclusion

The **SQL Data Cleanup** program is a lifesaver for keeping your development and sandbox environments lean and efficient. It helps automate the process of removing outdated data, boosts performance, reduces costs, and ensures your database doesn’t become a tangled mess. Best of all, it’s fully configurable—you choose which tables to clean up and how long to keep your data.

Feel free to give it a try, and as always, I’d love to hear your feedback! Let’s keep our databases tidy! 🚀

<hr/>

Thank you for your time! If you have any further questions, feel free to ask. 🌟✨🎁

Steven
[GitHub](<[https://github.com/baoduy](https://github.com/baoduy)>)
