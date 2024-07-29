FROM --platform=$BUILDPLATFORM node:lts AS build
ARG BUILDPLATFORM

WORKDIR /app

COPY . .

RUN npm install --forcer
RUN npm run build

FROM --platform=$TARGETARCH joseluisq/static-web-server:latest AS runtime
ARG TARGETARCH

ENV SERVER_ROOT=/app
ENV SERVER_FALLBACK_PAGE=/app/index.html

WORKDIR /app

COPY --from=build /app/dist .
