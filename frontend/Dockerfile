# Build the static client once; nginx serves it and proxies /svc/* to the
# matching Compose service. The dev proxy in vite.config.ts uses the same paths.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_DEMO_DIRECTORY=1
ENV VITE_DEMO_DIRECTORY=${VITE_DEMO_DIRECTORY}
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-proxy-headers.conf /etc/nginx/snippets/proxy-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -q -O /dev/null http://localhost/ || exit 1
