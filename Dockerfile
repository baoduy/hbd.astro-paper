FROM node:tls AS build
WORKDIR /app

COPY . .

RUN npm ci
RUN npm run build

FROM httpd:alpine AS runtime
WORKDIR /app

COPY --from=build /app/dist /usr/local/apache2/htdocs/
USER node
EXPOSE 80