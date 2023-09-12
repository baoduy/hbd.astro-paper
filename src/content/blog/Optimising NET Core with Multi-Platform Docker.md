---
author: Steven Hoang
pubDatetime: 2023-09-10T00:00:00Z
title: "Optimising .NET Core with Multi-Platform Docker Images: A Complete Guide"
postSlug: dotnet-dickerfile-multi-platform
featured: false
draft: false
tags:
  - dotnet
  - dockerfile
  - multi-platform
  - arm
ogImage: ""
description: In this post, sharing about Docker optimisation for the .NET Core framework and build a multi-platform image using the capabilities of Docker buildx, enabling us to create multi-platform images that can seamlessly run on diverse architectures. Moreover, we will discuss the integration of GitAction into the image-building process, empowering us to automate creating and publishing multi-platform Docker images.
---

# Optimising .NET Core with Multi-Platform Docker Images: A Complete Guide

## Built-in template

Let's start with a simple API for a .NET application with Docker support.
Once begun, a Dockerfile will automatically be generated for the project.

Here's how a basic Dockerfile might look.

```ps
FROM mcr.microsoft.com/dotnet/aspnet:7.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:7.0 AS build
WORKDIR /src
COPY ["SampleApi/SampleApi.csproj", "SampleApi/"]
RUN dotnet restore "SampleApi/SampleApi.csproj"
COPY . .
WORKDIR "/src/SampleApi"
RUN dotnet build "SampleApi.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "SampleApi.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "SampleApi.dll"]
```

Utilizing the provided Dockerfile, we can seamlessly build and execute the application in a Docker environment successfully.
![sample-api.png](/assets/OptimisingDockerNET/sample-api.png)

### What is the issue?

The resulting image generated from the Dockerfile previously illustrated exceeds **215 MB** in size.
Although this might not prove troublesome when executing on systems abundant in storage capacity,
it can lead to rapid depletion of SD card storage space on platforms with lower specifications or IOT devices,
such as a Raspberry K3s cluster.

Our next step involves optimizing this Dockerfile to minimize its footprint.

## Dockerfile optimisation

Let's proceed by transitioning the .NET image to the alpine image by adding `-alpine` at the end of the image version.

Remarkably, the updated image size has contracted substantially to approximately **110 MB**,
signifying a reduction of almost half from its original dimensions.

```ps
# 1. Changes this image from 'aspnet:7.0' to 'aspnet:7.0-alpine'
FROM mcr.microsoft.com/dotnet/aspnet:7.0-alpine AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

# 2. Changes this image from 'sdk:7.0' to 'sdk:7.0-alpine'
FROM mcr.microsoft.com/dotnet/sdk:7.0-alpine AS build
WORKDIR /src
COPY ["SampleApi/SampleApi.csproj", "SampleApi/"]
RUN dotnet restore "SampleApi/SampleApi.csproj"
COPY . .
WORKDIR "/src/SampleApi"
RUN dotnet build "SampleApi.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "SampleApi.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "SampleApi.dll"]
```

![alpine-debian-sdk-image-size.png](/assets/OptimisingDockerNET/alpine-debian-sdk-image-size.png)

### With Self contained .NET app (**experimental**)

Additionally, a feature is presented that enhances the "dotnet push" operation,
enabling it to create self-contained, singular executable files and reduced library applications.

This facilitates the construction of applications that are not reliant on the .NET runtime,
as well as the removal of all unused methods present within the library,
consequently yielding a more compact application.

Let's evaluate the Dockerfile delineated below, _The comments have been added on top of all changed lines_:

```ps
# 1. Changes this image from 'aspnet:7.0-alpine' to 'runtime-deps:7.0-alpine'
FROM mcr.microsoft.com/dotnet/runtime-deps:7.0-alpine AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:7.0-alpine AS build
WORKDIR /src
COPY ["SampleApi/SampleApi.csproj", "SampleApi/"]
RUN dotnet restore "SampleApi/SampleApi.csproj"
COPY . .
WORKDIR "/src/SampleApi"
RUN dotnet build "SampleApi.csproj" -c Release -o /app/build

FROM build AS publish

# 2. updated 'dotnet publish' options
RUN dotnet publish "SampleApi.csproj" -c Release -o /app/publish \
  --runtime alpine-x64 \
  --self-contained true \
  /p:PublishTrimmed=true \
  /p:PublishSingleFile=true

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["./SampleApi"]
```

Good news! Our application is impressively lean and only uses about **47MB**.
That's pretty light, right? So, we can count on it to run smoothly even on low-specs environments.

Nonetheless, it is prudently advisable to subject your application to a comprehensive compatibility test with the Alpine image,
ensuring seamless real-world performance without compromising on any usage scenarios.

### Docker Image without root user.

In a production environment, it is recommended to restrict the utilization of root user privileges for the majority of applications.
In the event that your application doesn't necessitate elevated permissions, you are advised to instantiate a non-root user during the Docker build process.

I'd like to share a quick best practice tip with you to boost the security level of your images. Keep in mind, this might not necessarily decrease the image size, but it's an essential step nonetheless.

Implementing this practice could potentially prevent any flags by our InfoSec's security scanning system during the vetting process for Production deployment. It's always better to be safe and secure as we progress!

```ps
FROM mcr.microsoft.com/dotnet/runtime-deps:7.0-alpine AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:7.0-alpine AS build
WORKDIR /src
COPY ["SampleApi/SampleApi.csproj", "SampleApi/"]
RUN dotnet restore "SampleApi/SampleApi.csproj"
COPY . .
WORKDIR "/src/SampleApi"
RUN dotnet build "SampleApi.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "SampleApi.csproj" -c Release -o /app/publish \
  --runtime alpine-x64 \
  --self-contained true \
  /p:PublishTrimmed=true \
  /p:PublishSingleFile=true

FROM base AS final

# 1. Create a new user and change directory ownership
RUN adduser --disabled-password \
  --home /app \
  --gecos '' dotnetuser && chown -R dotnetuser /app

# 2. Impersonate into the new user
USER dotnetuser
WORKDIR /app

COPY --from=publish /app/publish .
ENTRYPOINT ["./SampleApi"]
```

## Multi-platform docker image.

Even after performing the aforementioned steps, the Docker image remains built for the x64 platform.
To add support for the Docker on an ARM processor, it is essential to revise your Docker image and leverage the "docker buildx" feature for cross-compatibility.
Consider the changes of the following Dockerfile for reference.

```ps
FROM mcr.microsoft.com/dotnet/runtime-deps:7.0-alpine AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

# 1. Add 2 (BUILDPLATFORM and TARGETARCH) arguments and add 'platform' parameter to the FROM statement.
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:7.0-alpine AS build
ARG TARGETARCH
ARG BUILDPLATFORM

WORKDIR /src
COPY ["SampleApi/SampleApi.csproj", "SampleApi/"]
RUN dotnet restore "SampleApi/SampleApi.csproj"
COPY . .
WORKDIR "/src/SampleApi"

# 2. add '-a $TARGETARCH' to the 'dotnet build' command.
RUN dotnet build "SampleApi.csproj" -c Release -o /app/build -a $TARGETARCH

FROM build AS publish

# 2. add '-a $TARGETARCH' to the 'dotnet publish' command.
RUN dotnet publish "SampleApi.csproj" -c Release -o /app/publish \
    #--runtime alpine-x64 \
    --self-contained true \
    /p:PublishTrimmed=true \
    /p:PublishSingleFile=true \
    -a $TARGETARCH

# 3. Add 2 (BUILDPLATFORM and TARGETARCH) arguments and add 'platform' parameter to the FROM statement.
FROM --platform=$BUILDPLATFORM base AS final
ARG TARGETARCH
ARG BUILDPLATFORM

RUN adduser --disabled-password \
  --home /app \
  --gecos '' dotnetuser && chown -R dotnetuser /app

USER dotnetuser
WORKDIR /app

COPY --from=publish /app/publish .
ENTRYPOINT ["./SampleApi"]
```

This is the command to construct a multi-platform compatible image.

```bash
# Build Docker for x64 processor
docker build --platform="linux/amd64" -f Dockerfile -t sampleapi-x64:latest .

# Build image for arm64 processor
docker build --platform="linux/arm64" -f Dockerfile -t sampleapi-arm64:latest .

# All together, build image for multip-platform with docker buildx
docker buildx build --platform="linux/amd64,inux/arm64" -f Dockerfile -t sampleapi:latest .
```

Here are some sample results of Docker images on my Intel workstation.
![multi-platform-docker-image.png](/assets/OptimisingDockerNET/multi-platform-docker-image.png)

Test to ensure both images work correctly without any issues on my workstation.
![Running-instance-docker.png](/assets/OptimisingDockerNET/Running-instance-docker.png)

## Altogether with GitAction.

We have successfully established a Dockerfile that facilitates multi-platform support for .NET 7.
In coordination with GitHub Actions, this allows us to construct and propel the respective image to a container registry
Docker Hub being our prime focus in this situation.

Prior to engaging with the GitHub Action setup, I want to highlight a valuable feature known as **[Reusing workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows)**.
This sophisticated feature grants us the capability to outline a build workflow, which can be employed repetitively across multiple projects down the line.

To provide an illustrative example, please consider the undermentioned workflow located at **[.github/workflows/docker-publish.yaml](https://github.com/baoduy/ShareWorkflows/blob/main/.github/workflows/docker-publish.yaml)** within the **[ShareWorkflows](https://github.com/baoduy/ShareWorkflows)** repository.
This workflow effectively develops a Dockerfile for multi-platform usage and subsequently propels the images to Docker Hub.

```yaml
name: Docker-Publish

on:
  workflow_call:
    inputs:
      # The location of the Dockerfile parameter.
      dockerFile:
        required: true
        type: string
        description: The location of the Dockerfile.

      # The context path of the project parameter.
      context:
        default: .
        type: string
        description: The context path of the project.

      # The docker platforms parameter with default value is "linux/arm64 and linux/amd64"
      platforms:
        default: linux/arm64,linux/amd64
        type: string
        description: The docker platforms parameter with default value is "linux/arm64 and linux/amd64".

      # The name of the docker image parameter.
      imageName:
        required: true
        type: string
        description: The name of the docker image.

      # The version parameter of the image with default value is current date-time.
      version:
        default: $(date +%s)
        type: string
        description: The version of the image with default value is current date-time.
    secrets:
      # The DOCKER_USERNAME secret parameter.
      DOCKER_USERNAME:
        required: true
        description: The docker hub user name.
      # The DOCKER_TOKEN secret parameter.
      DOCKER_TOKEN:
        required: true
        description: The docker hub PAT token.

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      # Setup Buildx
      - name: Docker Setup Buildx
        uses: docker/setup-buildx-action@v2.9.1
        with:
          platforms: ${{ inputs.platforms }}

      # Login to docker hub
      - name: Docker Login
        uses: docker/login-action@v2.0.0
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_TOKEN }}
          ecr: auto
          logout: true

      # Pull previous image from docker hub to use it as cache to improve the image build time.
      - name: docker pull cache image
        continue-on-error: true
        run: docker pull ${{ inputs.imageName }}:latest

      # Setup QEMU
      - name: Set up QEMU
        uses: docker/setup-qemu-action@v2

      # Build and Publish to Docker
      - name: Build the Docker image
        run: |
          docker buildx build ${{ inputs.context }} --file ${{ inputs.dockerFile }} \
            --tag ${{ inputs.imageName }}:${{ inputs.version }} \
            --tag ${{ inputs.imageName }}:latest \
            --cache-from=${{ inputs.imageName }}:latest \
            --push --platform=${{ inputs.platforms }}
```

### How to reuse the Git workflows

I've pushed my SampleAPI to my GitHub. You can find it in the **[HBD.Samples](https://github.com/baoduy/HBD.Samples)** repository.
Following with the SampleAPI of GitAction that calls the shared workflow, making sure to give it the right parameters.

_Remember, before you get this action running, it's important to first update the workflow location accrding to your Git repository
and add your **DOCKER_USERNAME** and **DOCKER_TOKEN** into your repository's secrets._

```yaml
name: Docker-Buildx

on:
  push:
    branches:
      - "main"

jobs:
  dotnet_release_job:
    # TODO: Update this path according to your git repository.
    uses: baoduy/ShareWorkflows/.github/workflows/docker-publish.yaml@main
    with:
      # The location of the Dockerfile parameter.
      dockerFile: "01_Multi_platform_docker_image_for_NET/SampleApi/Dockerfile"
      # The context path of the project parameter.
      context: '"./01_Multi_platform_docker_image_for_NET"'
      # The name of the docker image parameter.
      imageName: "baoduy2412/sample-01-api"
      # The docker platforms parameter.
      platforms: linux/arm64,linux/amd64
    secrets:
      # The DOCKER_USERNAME secret parameter.
      DOCKER_USERNAME: ${{ secrets.DOCKER_USERNAME }}
      # The DOCKER_TOKEN secret parameter.
      DOCKER_TOKEN: ${{ secrets.DOCKER_TOKEN }}
```

Woohoo! Once the Git action has been executed successfully, we can hop over to Docker Hub to see the image neatly tagged across multiple platforms.

![Image_on_Docker_Hub.png](/assets/OptimisingDockerNET/Docker-hub-results.png)

_To ensure that everything's working as it should,
both images were put to the test on my iMac (which has an Intel chip) and a K3s Raspberry Pi 4 cluster._

Thank you so much for your time, Really appreciate it!

Steven
[Github](<[https://github.com/baoduy](https://github.com/baoduy)>)
