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
description:
  In this post, sharing about Docker optimisation for the .NET Core framework. and build a multi platform image using capabilities of Docker buildx, enabling us to create multi-platform images that can seamlessly run on diverse architectures. Moreover, we will discuss the integration of GitAction into the image-building process, empowering us to automate the creation and publish of multi-platform Docker images.
---

# Optimising .NET Core with Multi-Platform Docker Images: A Complete Guide

## Built-in template

When creating a .NET application with Docker support, a Dockerfile will be automatically generated for the project.

Let's begin with a simple API and the following Dockerfile.

```docker
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

With this docker file you can build and run your application in Docker faultlessly.

![sample-api.png](/public/assets/Optimising_NET_Core_with_Multi-Platform_Docker/sample-api.png)

### What is the issue?

The image built from the docker file above is over **215 MB** in size. This is not a problem when running on a platform with plenty of hard drive space, but it can quickly use up the SD card space on a low-spec resource platform or an IOT device like a Raspberry K3s cluster.

Let's optimise this docker file to reduce its size.

## Docker file optimisation

Using the same Dockerfile as before, let’s changed the. .NET image to `alpine` and built the Docker image again. The image size shrank to around 110 MB, which is half the previous size. This is very cool, right? 😎

```docker
# *All the changes highlighted with read color.*
FROM mcr.microsoft.com/dotnet/aspnet:7.0-alpine AS base
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
RUN dotnet publish "SampleApi.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "SampleApi.dll"]
```

### With Self contained .NET app (**experimental**)

Furthermore, There is an option that allows for optimising "dotnet push" to a self-contained, single execution file and trimmed library application. This allows building applications without depending on the .NET runtime and trimming away all unused methods in the library to make the application smaller. Let's check out the Dockerfile below.

```docker
# *All the changes highlighted with read color.*
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
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["./SampleApi"]
```

The image now is just around 47MB and application is working fine without any issue. However, I would recommend that you should test your application to ensure it is compatible with alpine image.

### Docker Image without root user.

In a production environment, it is recommended to avoid using root user privileges for most applications. If your application does not require special permissions, you can create a non-root user during the Docker build process. Doing so will improve the security of your image but no size is reduced. 🙂

```docker
# *All the changes highlighted with read color.*
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

# create a new user and change directory ownership
RUN adduser --disabled-password \
  --home /app \
  --gecos '' dotnetuser && chown -R dotnetuser /app

# impersonate into the new user
USER dotnetuser
WORKDIR /app

COPY --from=publish /app/publish .
ENTRYPOINT ["./SampleApi"]
```

## Multi platform docker image.

Despite the above steps, the Docker image is still built for the x64 platform. If you want to run your Docker on an ARM processor, you need to update the Docker image to make it compatible with the "docker buildx" feature. Let's take a look at the Dockerfile below.

```docker
# *All the changes highlighted with read color.*
FROM mcr.microsoft.com/dotnet/runtime-deps:7.0-alpine AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:7.0-alpine AS build
ARG TARGETARCH
ARG BUILDPLATFORM

WORKDIR /src
COPY ["SampleApi/SampleApi.csproj", "SampleApi/"]
RUN dotnet restore "SampleApi/SampleApi.csproj"
COPY . .
WORKDIR "/src/SampleApi"
RUN dotnet build "SampleApi.csproj" -c Release -o /app/build -a $TARGETARCH

FROM build AS publish
RUN dotnet publish "SampleApi.csproj" -c Release -o /app/publish \
    #--runtime alpine-x64 \
    --self-contained true \
    /p:PublishTrimmed=true \
    /p:PublishSingleFile=true \
    -a $TARGETARCH

FROM --platform=$BUILDPLATFORM base AS final
ARG TARGETARCH
ARG BUILDPLATFORM

# create a new user and change directory ownership
RUN adduser --disabled-password \
  --home /app \
  --gecos '' dotnetuser && chown -R dotnetuser /app

# impersonate into the new user
USER dotnetuser
WORKDIR /app

COPY --from=publish /app/publish .
ENTRYPOINT ["./SampleApi"]
```

Here is the command to build image for multi platform.

```bash
# Build docker for x64 processor
docker build --platform="linux/amd64" -f Dockerfile -t sampleapi-x64:latest .

# Build image for arm64 processor
docker build --platform="linux/arm64" -f Dockerfile -t sampleapi-arm64:latest .

# All toghether build image for multi platform with docker buildx
docker buildx build --platform="linux/amd64,inux/arm64" -f Dockerfile -t sampleapi:latest .
```

Here are some sample results of Docker images on my Intel workstation.


Btw, both images are working property without any issues on my workstation too.


## Altogether with GitAction.

So far, we have a Dockerfile that supports multi-platform for .NET 7. Combined with GitAction, we can build and push the image to a container registry, specifically Docker Hub in this case.

Before setting up the GitAction, I would like to introduce a useful feature called **[Reusing workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows)**. This allows us to define a build workflow that can be reused for many projects in the future.

For example, let's consider the following workflow under **[.github/workflows/docker-publish.yaml](https://github.com/baoduy/ShareWorkflows/blob/main/.github/workflows/docker-publish.yaml)** in the [**ShareWorkflows](https://github.com/baoduy/ShareWorkflows)** repository. This workflow builds a Dockerfile for multi-platform and pushes the images to Docker Hub.

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

I have committed my SampleAPI to my GitHub repository under the **[HBD.Samples](https://github.com/baoduy/HBD.Samples)** repository. The following is the git action for the SampleAPI, which essentially calls the shared workflow while providing proper parameters.

*Note: Before running the action, ensure that you add DOCKER_USERNAME and DOCKER_TOKEN as secrets to your repository.*

```yaml
name: Docker-Buildx

on:
  push:
    branches:
      - 'main'

jobs:
  dotnet_release_job:
    uses: baoduy/ShareWorkflows/.github/workflows/docker-publish.yaml@main
    with:
      # The location of the Dockerfile parameter.
      dockerFile: '01_Multi_platform_docker_image_for_NET/SampleApi/Dockerfile'
      # The context path of the project parameter.
      context: '"./01_Multi_platform_docker_image_for_NET"'
      # The name of the docker image parameter.
      imageName: 'baoduy2412/sample-01-api'
      # The docker platforms parameter.
      platforms: linux/arm64,linux/amd64
    secrets:
      # The DOCKER_USERNAME secret parameter.
      DOCKER_USERNAME: ${{ secrets.DOCKER_USERNAME }}
      # The DOCKER_TOKEN secret parameter.
      DOCKER_TOKEN: ${{ secrets.DOCKER_TOKEN }}
```

That's it! After the Git action runs successfully, you should be able to find the image on Docker Hub with multi-platform tagging.


*Just to confirm these both image had been tested on my IMAC running Intel chip and MacMini running M1 chip.*

Thanks for reading

Steven
[Github]([https://github.com/baoduy](https://github.com/baoduy))