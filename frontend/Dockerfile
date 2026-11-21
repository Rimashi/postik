# Multi-stage: собираем Vite отдельно; в runtime остаются только статика и Nginx.
FROM node:22.14.0-alpine AS build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
# npm ci использует зафиксированное дерево зависимостей, а не пересчитывает его.
RUN npm ci --no-audit --no-fund
COPY frontend/index.html ./index.html
COPY frontend/public/ ./public/
COPY frontend/src/ ./src/
COPY frontend/vite.config.js ./vite.config.js
RUN npm run build

FROM nginx/nginx-unprivileged:1.30.7-alpine3.24
USER root
RUN apk add --no-cache --upgrade "libxml2>=2.13.9-r3"

COPY --from=build /build/dist/ /usr/share/nginx/html/
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
USER 101:101
EXPOSE 8080
STOPSIGNAL SIGQUIT
HEALTHCHECK --interval=15s --timeout=4s --start-period=10s --retries=4 \
 CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
