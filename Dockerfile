# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:stable-alpine AS runtime
RUN apk add --no-cache jq
ENV VITE_API_URL=/api \
    API_PROXY_TARGET=http://127.0.0.1:3001 \
    NGINX_ENVSUBST_FILTER=API_PROXY_TARGET
COPY deploy/docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/docker/15-runtime-config.envsh /docker-entrypoint.d/15-runtime-config.envsh
RUN chmod +x /docker-entrypoint.d/15-runtime-config.envsh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
